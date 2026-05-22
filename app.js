/**
 * SISGED UE002 - Plataforma Tecnológica de Seguimiento y Revisión
 * Lógica de Negocio y Control de Datos
 */

// Global State
let rawRecords = [];
let senders = [];
let sendersMap = {};
let duplicates = [];
let observations = {};

// Active state for selected elements
let selectedSenderId = null;

// Senders Filter & Sort States
let senderFilterOrigin = 'ALL';
let senderFilterType = 'ALL';
let senderSortCriterion = 'name-asc';

// --- Tab-specific Pagination & Sort States ---

// 1. Explorador General State
let expCurrentPage = 1;
let expPageSize = 20;
let expFilteredRecords = [];
let expSortCol = 'index';
let expSortDir = 'asc';

// 2. Sender History State
let senderHistoryCurrentPage = 1;
let senderHistoryPageSize = 20;
let selectedSenderRecords = [];
let senderHistorySortCol = 'Fecha de Creación de Tramite';
let senderHistorySortDir = 'desc';

// 3. Duplicates State
let dupCurrentPage = 1;
let dupPageSize = 20;
let dupFilteredList = [];

// 4. Observations State
let obsCurrentPage = 1;
let obsPageSize = 20;
let obsFilteredList = [];

// LocalStorage key
const STORAGE_KEY = 'sisged_observations';

// DOM Elements
const dropzone = document.getElementById('dropzone');
const csvFileInput = document.getElementById('csv-file-input');
const uploadSection = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const appContent = document.getElementById('app-content');
const themeToggleBtn = document.getElementById('theme-toggle');
const clearDbBtn = document.getElementById('clear-db-btn');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const saveModalBtn = document.getElementById('save-modal-btn');
const modalTitleCut = document.getElementById('modal-title-cut');
const modalDocName = document.getElementById('modal-doc-name');
const modalTextareaObs = document.getElementById('modal-textarea-obs');
let activeModalRecord = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadObservations();
  initTheme();
  setupEventListeners();
  checkStoredData();
});

// Load saved observations from LocalStorage
function loadObservations() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      observations = JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored observations", e);
      observations = {};
    }
  }
}

// Save observations to LocalStorage
function saveObservations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  updateGlobalKPIs();
  // Re-sync all views
  filterExplorerData();
  renderExplorer();
  if (selectedSenderId) {
    loadSenderDetails(selectedSenderId);
  }
  filterDuplicatesList();
  renderDuplicates();
  filterObservationsList();
  renderObservations();
}

// Theme Handling
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.body.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const themeIcon = document.getElementById('theme-icon');
  if (isDark) {
    themeIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
  } else {
    themeIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
  }
}

// Database Check
function checkStoredData() {
  // Always fetch the latest CSV from the root workspace to stay synced
  fetch('reporte UE002.csv')
    .then(response => {
      if (response.ok) {
        return response.text();
      }
      throw new Error('Not found on root');
    })
    .then(csvText => {
      console.log('Loading updated dataset from local root workspace file...');
      localStorage.setItem('sisged_raw_csv', csvText);
      parseCSVContent(csvText);
    })
    .catch(() => {
      // Fallback to localStorage if the root file is not available
      const storedCsv = localStorage.getItem('sisged_raw_csv');
      if (storedCsv) {
        parseCSVContent(storedCsv);
      } else {
        showUploadScreen();
      }
    });
}

function showUploadScreen() {
  loadingSection.style.display = 'none';
  appContent.style.display = 'none';
  uploadSection.style.display = 'block';
}

// Event Listeners Setup
function setupEventListeners() {
  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Clear Database button
  clearDbBtn.addEventListener('click', () => {
    if (confirm('¿Está seguro de que desea limpiar la base de datos? Esto restablecerá la base de datos pero mantendrá las observaciones anotadas.')) {
      localStorage.removeItem('sisged_raw_csv');
      rawRecords = [];
      senders = [];
      duplicates = [];
      showUploadScreen();
    }
  });

  // Drag and Drop files
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  document.getElementById('browse-btn').addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Navigation tabs dynamic switches (Syncing active view AND left-panel controls)
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // --- Senders Sidebar Filter Event Listeners ---
  const senderOriginPills = document.querySelectorAll('#origin-pills .pill');
  senderOriginPills.forEach(pill => {
    pill.addEventListener('click', () => {
      senderOriginPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      senderFilterOrigin = pill.getAttribute('data-filter-origin');
      filterAndRenderSendersList();
    });
  });

  const senderTypePills = document.querySelectorAll('#type-pills .pill');
  senderTypePills.forEach(pill => {
    pill.addEventListener('click', () => {
      senderTypePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      senderFilterType = pill.getAttribute('data-filter-type');
      filterAndRenderSendersList();
    });
  });

  document.getElementById('sort-sender-select').addEventListener('change', (e) => {
    senderSortCriterion = e.target.value;
    filterAndRenderSendersList();
  });

  document.getElementById('search-sender').addEventListener('input', () => {
    filterAndRenderSendersList();
  });

  // --- Explorer Sidebar Filter Event Listeners ---
  document.getElementById('exp-search-cut').addEventListener('input', () => { expCurrentPage = 1; filterExplorerData(); renderExplorer(); });
  document.getElementById('exp-search-subject').addEventListener('input', () => { expCurrentPage = 1; filterExplorerData(); renderExplorer(); });
  document.getElementById('exp-search-sender').addEventListener('input', () => { expCurrentPage = 1; filterExplorerData(); renderExplorer(); });
  document.getElementById('exp-date-start').addEventListener('change', () => { expCurrentPage = 1; filterExplorerData(); renderExplorer(); });
  document.getElementById('exp-date-end').addEventListener('change', () => { expCurrentPage = 1; filterExplorerData(); renderExplorer(); });

  // Explorer Origin Pills
  const expOriginPills = document.querySelectorAll('#exp-origin-pills .pill');
  expOriginPills.forEach(pill => {
    pill.addEventListener('click', () => {
      expOriginPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      expCurrentPage = 1;
      filterExplorerData();
      renderExplorer();
    });
  });

  // Explorer Type Pills
  const expTypePills = document.querySelectorAll('#exp-type-pills .pill');
  expTypePills.forEach(pill => {
    pill.addEventListener('click', () => {
      expTypePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      expCurrentPage = 1;
      filterExplorerData();
      renderExplorer();
    });
  });

  // Explorer Observation pills
  const expObsPills = document.querySelectorAll('#exp-obs-pills .pill');
  expObsPills.forEach(pill => {
    pill.addEventListener('click', () => {
      expObsPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      expCurrentPage = 1;
      filterExplorerData();
      renderExplorer();
    });
  });

  // Reset explorer filters
  document.getElementById('exp-clear-filters-btn').addEventListener('click', () => {
    document.getElementById('exp-search-cut').value = '';
    document.getElementById('exp-search-subject').value = '';
    document.getElementById('exp-search-sender').value = '';
    document.getElementById('exp-date-start').value = '';
    document.getElementById('exp-date-end').value = '';
    
    expOriginPills.forEach(p => p.classList.remove('active'));
    document.querySelector('#exp-origin-pills [data-exp-origin="ALL"]').classList.add('active');
    
    expTypePills.forEach(p => p.classList.remove('active'));
    document.querySelector('#exp-type-pills [data-exp-type="ALL"]').classList.add('active');
    
    expObsPills.forEach(p => p.classList.remove('active'));
    document.querySelector('#exp-obs-pills [data-exp-obs="ALL"]').classList.add('active');
    
    expCurrentPage = 1;
    filterExplorerData();
    renderExplorer();
  });

  // --- Duplicates Sidebar Filter ---
  document.getElementById('search-duplicate').addEventListener('input', () => {
    dupCurrentPage = 1;
    filterDuplicatesList();
    renderDuplicates();
  });

  // --- Observations Sidebar Filter & Actions ---
  document.getElementById('search-observation-text').addEventListener('input', () => {
    obsCurrentPage = 1;
    filterObservationsList();
    renderObservations();
  });

  document.getElementById('export-json-btn').addEventListener('click', exportObservationsAsJSON);
  document.getElementById('export-csv-btn').addEventListener('click', exportObservationsAsCSV);
  document.getElementById('import-obs-file').addEventListener('change', importObservationsJSON);

  // --- Table Headers Interactive Sorting listeners ---
  // 1. Explorer Table
  const expHeaders = document.querySelectorAll('#explorer-results-table th.sortable');
  expHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const colName = th.getAttribute('data-col');
      if (expSortCol === colName) {
        expSortDir = expSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        expSortCol = colName;
        expSortDir = 'asc';
      }
      // Update sorted headers CSS indicators
      expHeaders.forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      th.classList.add(expSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      
      sortExplorerData();
      renderExplorer();
    });
  });

  // --- Page Size Selector Event Listeners ---
  document.getElementById('exp-page-size').addEventListener('change', (e) => {
    expPageSize = parseInt(e.target.value);
    expCurrentPage = 1;
    renderExplorer();
  });

  document.getElementById('dup-page-size').addEventListener('change', (e) => {
    dupPageSize = parseInt(e.target.value);
    dupCurrentPage = 1;
    renderDuplicates();
  });

  document.getElementById('obs-page-size').addEventListener('change', (e) => {
    obsPageSize = parseInt(e.target.value);
    obsCurrentPage = 1;
    renderObservations();
  });

  // --- Modal Event Listeners ---
  closeModalBtn.addEventListener('click', hideModal);
  cancelModalBtn.addEventListener('click', hideModal);
  saveModalBtn.addEventListener('click', submitModalObservation);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });
}

// Switch Tabs Navigation & Swaps Left-Panel Sidebar Cards
function switchTab(tabId) {
  // Update Tab buttons active state
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  // Update Main tab panels active state
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    if (content.id === tabId) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Swap Left Sidebar dynamic card layout
  const sidebarCards = document.querySelectorAll('.sidebar-control-card');
  sidebarCards.forEach(card => {
    card.classList.remove('active');
  });

  // Maps target content id to its corresponding sidebar card controls id
  if (tabId === 'tab-explorer') {
    document.getElementById('sidebar-explorer-controls').classList.add('active');
    filterExplorerData();
    renderExplorer();
  } else if (tabId === 'tab-search-senders') {
    document.getElementById('sidebar-senders-controls').classList.add('active');
    filterAndRenderSendersList();
  } else if (tabId === 'tab-duplicates') {
    document.getElementById('sidebar-duplicates-controls').classList.add('active');
    filterDuplicatesList();
    renderDuplicates();
  } else if (tabId === 'tab-observations') {
    document.getElementById('sidebar-observations-controls').classList.add('active');
    filterObservationsList();
    renderObservations();
  } else if (tabId === 'tab-git-guide') {
    document.getElementById('sidebar-git-controls').classList.add('active');
  }
}

// File Selection Handler
function handleFileSelected(file) {
  if (!file.name.endsWith('.csv')) {
    alert('Por favor, seleccione un archivo de formato .csv válido.');
    return;
  }
  
  loadingSection.style.display = 'flex';
  uploadSection.style.display = 'none';

  const reader = new FileReader();
  reader.onload = (e) => {
    const csvContent = e.target.result;
    localStorage.setItem('sisged_raw_csv', csvContent);
    parseCSVContent(csvContent);
  };
  reader.onerror = () => {
    alert('Ocurrió un error al leer el archivo.');
    showUploadScreen();
  };
  reader.readAsText(file, 'UTF-8');
}

// Parse CSV content using PapaParse
function parseCSVContent(csvText) {
  loadingSection.style.display = 'flex';
  uploadSection.style.display = 'none';
  appContent.style.display = 'none';

  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
    complete: function (results) {
      if (results.errors.length > 0) {
        console.warn("PapaParse errors encountered:", results.errors);
      }
      
      processRawData(results.data);
    },
    error: function (error) {
      alert("Error al parsear el archivo CSV: " + error.message);
      showUploadScreen();
    }
  });
}

// Core Data Processing Logic
function processRawData(data) {
  rawRecords = data.map((record, index) => {
    const rawName = (record['Remitente'] || '').trim();
    let origin = 'INTERNO';
    let personType = 'INTERNO';
    let cleanName = rawName;

    if (rawName.includes('[P. JURIDICA]')) {
      origin = 'EXTERNO';
      personType = 'JURIDICA';
      cleanName = rawName.replace('[P. JURIDICA]', '').trim();
    } else if (rawName.includes('[P. NATURAL]')) {
      origin = 'EXTERNO';
      personType = 'NATURAL';
      cleanName = rawName.replace('[P. NATURAL]', '').trim();
    }

    // Safely get Último Documento supporting various encodings
    const ultimoDoc = (record['Último Documento'] || record['Ultimo Documento'] || record['ltimo Documento'] || '').trim();

    return {
      index: index + 1,
      CUT: (record['CUT'] || '').trim(),
      'Fecha de Creación de Tramite': (record['Fecha de Creación de Tramite'] || record['Fecha de Creación'] || record['Fecha de Creacin de Tramite'] || '').trim(),
      'Documento Origen': (record['Documento Origen'] || record['Documento'] || '').trim(),
      'Asunto Origen': (record['Asunto Origen'] || record['Asunto'] || '').trim(),
      'Remitente': cleanName,
      'Origen': origin,
      'Tipo de Persona': personType,
      'Último Documento': ultimoDoc
    };
  });

  // 1. Analyze and group senders
  sendersMap = {};
  rawRecords.forEach(record => {
    const name = record.Remitente;
    if (!name) return;

    if (!sendersMap[name]) {
      sendersMap[name] = {
        name: name,
        origin: record.Origen,
        type: record['Tipo de Persona'],
        documentCount: 0,
        documents: [],
        latestDate: null
      };
    } else {
      // Si ya existe pero estaba catalogado como INTERNO, y encontramos un registro EXTERNO, lo actualizamos
      if (sendersMap[name].type === 'INTERNO' && record['Tipo de Persona'] !== 'INTERNO') {
        sendersMap[name].type = record['Tipo de Persona'];
        sendersMap[name].origin = record.Origen;
      }
    }
    
    sendersMap[name].documentCount++;
    sendersMap[name].documents.push(record);

    // Keep track of the latest date
    const recDate = parseDate(record['Fecha de Creación de Tramite']);
    if (recDate) {
      if (!sendersMap[name].latestDate || recDate > sendersMap[name].latestDate) {
        sendersMap[name].latestDate = recDate;
      }
    }
  });

  senders = Object.values(sendersMap);

  // 2. Identify duplicate CUTs
  const cutGroups = {};
  rawRecords.forEach(record => {
    const cut = record.CUT;
    if (!cut) return;
    if (!cutGroups[cut]) cutGroups[cut] = [];
    cutGroups[cut].push(record);
  });

  duplicates = Object.keys(cutGroups)
    .map(cut => {
      const records = cutGroups[cut];
      
      // Find the main sender
      const senderCount = {};
      records.forEach(rec => {
        senderCount[rec.Remitente] = (senderCount[rec.Remitente] || 0) + 1;
      });
      let mainSender = '';
      let maxDocs = 0;
      Object.keys(senderCount).forEach(sender => {
        if (senderCount[sender] > maxDocs) {
          maxDocs = senderCount[sender];
          mainSender = sender;
        }
      });

      // Group records by Documento Origen
      const docOrigenGroups = {};
      records.forEach(rec => {
        const docOrigen = rec['Documento Origen'] || 'Sin Documento Origen';
        if (!docOrigenGroups[docOrigen]) {
          docOrigenGroups[docOrigen] = [];
        }
        docOrigenGroups[docOrigen].push(rec);
      });

      const docOrigenList = [];
      let totalUniqueDocsInCut = 0;

      Object.keys(docOrigenGroups).forEach(docOrigen => {
        const groupRecords = docOrigenGroups[docOrigen];
        const ultimosMap = {};
        
        groupRecords.forEach(rec => {
          const ultDoc = rec['Último Documento'] || rec['Documento Origen'] || 'Sin Documento';
          if (!ultimosMap[ultDoc]) {
            ultimosMap[ultDoc] = [];
          }
          ultimosMap[ultDoc].push(rec);
        });

        const ultimosList = Object.keys(ultimosMap).map(ultDoc => {
          const ultRecs = ultimosMap[ultDoc];
          return {
            ultimoDocumento: ultDoc,
            records: ultRecs,
            representative: ultRecs[0]
          };
        });

        totalUniqueDocsInCut += ultimosList.length;

        docOrigenList.push({
          documentoOrigen: docOrigen,
          ultimos: ultimosList,
          records: groupRecords
        });
      });

      return {
        cut: cut,
        documentCount: totalUniqueDocsInCut,
        sender: mainSender,
        docOrigens: docOrigenList,
        records: records
      };
    })
    .filter(item => item.records.length > 1) // Only duplicate CUTs (appearing more than once in the dataset)
    .sort((a, b) => b.records.length - a.records.length); // Rank by total records descending

  // Update Global KPIs Summary
  updateGlobalKPIs();

  // Hide loader and show app workspace
  loadingSection.style.display = 'none';
  appContent.style.display = 'grid';

  // Default active tab is Explorador General
  switchTab('tab-explorer');
}

// Update KPI cards UI
function updateGlobalKPIs() {
  document.getElementById('stat-total-docs').textContent = rawRecords.length.toLocaleString();
  document.getElementById('stat-total-senders').textContent = senders.length.toLocaleString();
  document.getElementById('stat-total-duplicates').textContent = duplicates.length.toLocaleString();
  document.getElementById('stat-total-obs').textContent = Object.keys(observations).length.toLocaleString();

  // Calculate unique senders breakdown
  let countInternos = 0;
  let countNatural = 0;
  let countJuridica = 0;

  senders.forEach(s => {
    if (s.type === 'INTERNO') countInternos++;
    else if (s.type === 'NATURAL') countNatural++;
    else if (s.type === 'JURIDICA') countJuridica++;
  });

  const breakdownContainer = document.getElementById('stat-senders-breakdown');
  if (breakdownContainer) {
    breakdownContainer.innerHTML = `
      <span class="badge-tag interno" style="font-size:0.6rem; padding:0.15rem 0.35rem; white-space:nowrap; border-radius:4px; font-weight:700;">Int: ${countInternos}</span>
      <span class="badge-tag natural" style="font-size:0.6rem; padding:0.15rem 0.35rem; white-space:nowrap; border-radius:4px; font-weight:700;">Nat: ${countNatural}</span>
      <span class="badge-tag juridica" style="font-size:0.6rem; padding:0.15rem 0.35rem; white-space:nowrap; border-radius:4px; font-weight:700;">Jur: ${countJuridica}</span>
    `;
  }
}

// --- Date Parser Helper ---
// Parses date formats: "DD/MM/YYYY HH:mm" or "DD/MM/YYYY"
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('/');
  if (dateParts.length !== 3) return null;
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
  const year = parseInt(dateParts[2], 10);

  if (parts.length > 1) {
    const timeParts = parts[1].split(':');
    if (timeParts.length >= 2) {
      const hour = parseInt(timeParts[0], 10);
      const min = parseInt(timeParts[1], 10);
      return new Date(year, month, day, hour, min);
    }
  }
  return new Date(year, month, day);
}

// --- Dynamic Pagination Footer Helper ---
function renderPaginationFooter({ containerId, infoId, btnsId, totalRecords, currentPage, pageSize, onPageChange }) {
  const container = document.getElementById(containerId);
  const infoEl = document.getElementById(infoId);
  const btnsEl = document.getElementById(btnsId);

  if (!container) return;

  if (totalRecords === 0) {
    infoEl.textContent = 'Mostrando 0 - 0 de 0 registros';
    btnsEl.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(totalRecords / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);

  infoEl.textContent = `Mostrando ${start.toLocaleString()} - ${end.toLocaleString()} de ${totalRecords.toLocaleString()} registros`;

  // Build Page navigation buttons list
  let pages = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) pages.push('...');
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  btnsEl.innerHTML = '';

  // Previous page button (SVG left arrow)
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.disabled = currentPage === 1;
  prevBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
  btnsEl.appendChild(prevBtn);

  // Numeric page buttons
  pages.forEach(p => {
    if (p === '...') {
      const span = document.createElement('span');
      span.textContent = '...';
      span.style.color = 'var(--text-muted)';
      span.style.padding = '0 0.25rem';
      span.style.alignSelf = 'center';
      btnsEl.appendChild(span);
    } else {
      const pBtn = document.createElement('button');
      pBtn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
      pBtn.textContent = p;
      pBtn.addEventListener('click', () => onPageChange(p));
      btnsEl.appendChild(pBtn);
    }
  });

  // Next page button (SVG right arrow)
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
  btnsEl.appendChild(nextBtn);
}


// ==========================================
// VIEW 1: EXPLORADOR GENERAL LOGIC
// ==========================================

function filterExplorerData() {
  const queryCut = document.getElementById('exp-search-cut').value.trim().toLowerCase();
  const querySubject = document.getElementById('exp-search-subject').value.trim().toLowerCase();
  const querySender = document.getElementById('exp-search-sender').value.trim().toLowerCase();
  
  const dateStartStr = document.getElementById('exp-date-start').value;
  const dateEndStr = document.getElementById('exp-date-end').value;
  const dateStart = dateStartStr ? new Date(dateStartStr + 'T00:00:00') : null;
  const dateEnd = dateEndStr ? new Date(dateEndStr + 'T23:59:59') : null;

  const originActive = document.querySelector('#exp-origin-pills .pill.active').getAttribute('data-exp-origin');
  const typeActive = document.querySelector('#exp-type-pills .pill.active').getAttribute('data-exp-type');
  const obsActive = document.querySelector('#exp-obs-pills .pill.active').getAttribute('data-exp-obs');

  expFilteredRecords = rawRecords.filter(rec => {
    // 1. CUT Filter
    if (queryCut && !rec.CUT.toLowerCase().includes(queryCut)) return false;
    
    // 2. Subject Filter
    if (querySubject && !rec['Asunto Origen'].toLowerCase().includes(querySubject)) return false;
    
    // 3. Sender Filter
    if (querySender && !rec.Remitente.toLowerCase().includes(querySender)) return false;

    // 4. Date Range Filter
    if (dateStart || dateEnd) {
      const recDate = parseDate(rec['Fecha de Creación de Tramite']);
      if (!recDate) return false;
      if (dateStart && recDate < dateStart) return false;
      if (dateEnd && recDate > dateEnd) return false;
    }

    // 5. Origin Filter
    if (originActive !== 'ALL' && rec.Origen !== originActive) return false;

    // 6. Type Filter
    if (typeActive !== 'ALL' && rec['Tipo de Persona'] !== typeActive) return false;

    // 7. Observation Review Filter
    const hasObs = !!observations[rec.CUT];
    if (obsActive === 'WITH' && !hasObs) return false;
    if (obsActive === 'WITHOUT' && hasObs) return false;

    return true;
  });

  sortExplorerData();
}

function sortExplorerData() {
  if (expSortCol === 'index') {
    expFilteredRecords.sort((a, b) => {
      return expSortDir === 'asc' ? a.index - b.index : b.index - a.index;
    });
  } else if (expSortCol === 'Fecha de Creación de Tramite') {
    expFilteredRecords.sort((a, b) => {
      const dateA = parseDate(a['Fecha de Creación de Tramite']) || new Date(0);
      const dateB = parseDate(b['Fecha de Creación de Tramite']) || new Date(0);
      return expSortDir === 'asc' ? dateA - dateB : dateB - dateA;
    });
  } else {
    // Standard string comparison
    expFilteredRecords.sort((a, b) => {
      const valA = (a[expSortCol] || '').toString().toLowerCase();
      const valB = (b[expSortCol] || '').toString().toLowerCase();
      if (valA < valB) return expSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return expSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

function renderExplorer() {
  const tableBody = document.getElementById('explorer-table-body');
  
  if (expFilteredRecords.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem 1rem;">
          <div style="color: var(--text-muted); margin-bottom: 0.5rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto 0.5rem auto; display: block;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Ningún trámite coincide con los filtros establecidos
          </div>
        </td>
      </tr>
    `;
    renderPaginationFooter({
      containerId: 'explorer-pagination',
      infoId: 'explorer-pagination-info',
      btnsId: 'explorer-pagination-btns',
      totalRecords: 0,
      currentPage: 1,
      pageSize: expPageSize,
      onPageChange: () => {}
    });
    return;
  }

  // Calculate slice
  const startIdx = (expCurrentPage - 1) * expPageSize;
  const pageSlice = expFilteredRecords.slice(startIdx, startIdx + expPageSize);

  let html = '';
  pageSlice.forEach(rec => {
    const hasObs = observations[rec.CUT];
    const obsBadge = hasObs 
      ? `<span class="obs-indicator" title="${hasObs.replace(/"/g, '&quot;')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px; vertical-align:middle;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg> Con Obs.
         </span>`
      : `<span style="color: var(--text-muted); font-size: 0.75rem;">Sin obs.</span>`;

    html += `
      <tr>
        <td class="num-cell">${rec.index}</td>
        <td class="cut-cell">${rec.CUT}</td>
        <td style="white-space: nowrap;">${rec['Fecha de Creación de Tramite']}</td>
        <td>
          <div style="font-weight:600; font-size:0.8rem; color:var(--text-primary); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${rec.Remitente}">
            ${rec.Remitente}
          </div>
          <div style="display:flex; gap:0.25rem; margin-top:0.15rem;">
            <span class="badge-tag ${rec.Origen.toLowerCase()}">${rec.Origen}</span>
            <span class="badge-tag ${rec['Tipo de Persona'].toLowerCase()}">${rec['Tipo de Persona']}</span>
          </div>
        </td>
        <td style="font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${rec['Documento Origen']}">
          ${rec['Documento Origen']}
        </td>
        <td class="asunto-cell" title="${rec['Asunto Origen']}">${rec['Asunto Origen']}</td>
        <td>${obsBadge}</td>
        <td style="text-align:right;">
          <button class="action-btn" onclick="openRevisionModal(${rec.index})" title="Ver o editar anotaciones de revisión">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
            </svg>
            Revisar
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;

  // Render pagination controls
  renderPaginationFooter({
    containerId: 'explorer-pagination',
    infoId: 'explorer-pagination-info',
    btnsId: 'explorer-pagination-btns',
    totalRecords: expFilteredRecords.length,
    currentPage: expCurrentPage,
    pageSize: expPageSize,
    onPageChange: (newPage) => {
      expCurrentPage = newPage;
      renderExplorer();
      // Scroll table to top
      document.querySelector('#tab-explorer .table-container').scrollTop = 0;
    }
  });
}


// ==========================================
// VIEW 2: BUSCADOR REMITENTES LOGIC
// ==========================================

function filterAndRenderSendersList() {
  const query = document.getElementById('search-sender').value.trim().toLowerCase();
  
  let filteredSenders = senders.filter(s => {
    // 1. Text Search Filter
    if (query && !s.name.toLowerCase().includes(query)) return false;
    
    // 2. Origin Filter
    if (senderFilterOrigin !== 'ALL' && s.origin !== senderFilterOrigin) return false;
    
    // 3. Type Filter
    if (senderFilterType !== 'ALL' && s.type !== senderFilterType) return false;
    
    return true;
  });

  // Sort Senders List
  if (senderSortCriterion === 'name-asc') {
    filteredSenders.sort((a, b) => a.name.localeCompare(b.name));
  } else if (senderSortCriterion === 'name-desc') {
    filteredSenders.sort((a, b) => b.name.localeCompare(a.name));
  } else if (senderSortCriterion === 'docs-desc') {
    filteredSenders.sort((a, b) => b.documentCount - a.documentCount);
  } else if (senderSortCriterion === 'docs-asc') {
    filteredSenders.sort((a, b) => a.documentCount - b.documentCount);
  } else if (senderSortCriterion === 'date-desc') {
    filteredSenders.sort((a, b) => {
      const dA = a.latestDate || new Date(0);
      const dB = b.latestDate || new Date(0);
      return dB - dA;
    });
  }

  const container = document.getElementById('senders-list-container');
  if (filteredSenders.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding:2rem 0;">
        Ningún remitente coincide con los filtros.
      </div>
    `;
    return;
  }

  let html = '';
  filteredSenders.forEach(s => {
    const isSelected = selectedSenderId === s.name ? 'selected' : '';
    html += `
      <div class="sender-item ${isSelected}" onclick="selectSender('${s.name.replace(/'/g, "\\'")}')">
        <div class="sender-name" title="${s.name}">${s.name}</div>
        <div class="sender-meta">
          <div style="display:flex; gap:0.25rem;">
            <span class="badge-tag ${s.origin.toLowerCase()}">${s.origin}</span>
            <span class="badge-tag ${s.type.toLowerCase()}">${s.type}</span>
          </div>
          <span style="font-weight:700; color:var(--text-primary);">${s.documentCount} document${s.documentCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function selectSender(senderName) {
  selectedSenderId = senderName;
  
  // Highlight in sidebar list
  const items = document.querySelectorAll('.sender-item');
  items.forEach(item => {
    const nameEl = item.querySelector('.sender-name');
    if (nameEl && nameEl.textContent === senderName) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  loadSenderDetails(senderName);
}

function loadSenderDetails(senderName) {
  const senderData = sendersMap[senderName];
  if (!senderData) return;

  const emptyState = document.getElementById('sender-empty-state');
  const detailsContainer = document.getElementById('sender-details-container');
  
  emptyState.style.display = 'none';
  detailsContainer.style.display = 'block';

  selectedSenderRecords = senderData.documents;
  
  // Reset sorting and page
  senderHistoryCurrentPage = 1;
  senderHistorySortCol = 'Fecha de Creación de Tramite';
  senderHistorySortDir = 'desc';

  renderSenderDetailsCard(senderData);
  sortSenderHistory();
  renderSenderHistory();
}

function renderSenderDetailsCard(senderData) {
  const container = document.getElementById('sender-details-container');
  
  // Calculate specific sender KPIs
  const totalTrámites = senderData.documentCount;
  const recentDoc = selectedSenderRecords.reduce((prev, current) => {
    const dateP = parseDate(prev['Fecha de Creación de Tramite']);
    const dateC = parseDate(current['Fecha de Creación de Tramite']);
    if (!dateP) return current;
    if (!dateC) return prev;
    return dateC > dateP ? current : prev;
  });
  
  const obsCount = selectedSenderRecords.filter(r => !!observations[r.CUT]).length;

  container.innerHTML = `
    <!-- Top Details KPI panel -->
    <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
      <div>
        <h2 style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${senderData.name}</h2>
        <div style="display:flex; gap:0.35rem; margin-top:0.25rem;">
          <span class="badge-tag ${senderData.origin.toLowerCase()}" style="font-size:0.75rem; padding:0.2rem 0.5rem;">${senderData.origin}</span>
          <span class="badge-tag ${senderData.type.toLowerCase()}" style="font-size:0.75rem; padding:0.2rem 0.5rem;">${senderData.type}</span>
        </div>
      </div>
      
      <!-- Sub KPIs -->
      <div style="display:flex; gap:0.5rem;">
        <div class="stat-item" style="min-width:90px;">
          <div class="stat-item-val">${totalTrámites}</div>
          <div class="stat-item-label">Documentos</div>
        </div>
        <div class="stat-item" style="min-width:90px;">
          <div class="stat-item-val" style="color:var(--warning);">${obsCount}</div>
          <div class="stat-item-label">Con Obs.</div>
        </div>
      </div>
    </div>

    <!-- History Results List -->
    <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem; color:var(--text-primary);">Historial de Documentos Presentados</h3>
    
    <div class="table-container">
      <table class="data-table" id="sender-history-table">
        <thead>
          <tr>
            <th class="sortable ${senderHistorySortCol === 'index' ? (senderHistorySortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}" data-history-col="index">N°</th>
            <th class="sortable ${senderHistorySortCol === 'CUT' ? (senderHistorySortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}" data-history-col="CUT">CUT</th>
            <th class="sortable ${senderHistorySortCol === 'Fecha de Creación de Tramite' ? (senderHistorySortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}" data-history-col="Fecha de Creación de Tramite">Fecha de Creación de Trámite</th>
            <th class="sortable ${senderHistorySortCol === 'Documento Origen' ? (senderHistorySortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}" data-history-col="Documento Origen">Documento Origen</th>
            <th class="sortable ${senderHistorySortCol === 'Asunto Origen' ? (senderHistorySortDir === 'asc' ? (senderHistorySortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : '') : ''}" data-history-col="Asunto Origen">Asunto</th>
            <th>Revisión</th>
            <th style="text-align:right;">Acción</th>
          </tr>
        </thead>
        <tbody id="sender-history-body">
          <!-- Dynamic documents rows -->
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls -->
    <div class="pagination-controls" id="sender-history-pagination">
      <div class="pagination-left">
        <span class="info" id="sender-history-pagination-info">Mostrando 0 - 0 de 0 registros</span>
        <span style="color:var(--text-muted); font-size:0.8rem; margin:0 0.5rem;">|</span>
        <label for="sender-history-page-size" style="font-size:0.8rem; color:var(--text-secondary);">Mostrar:</label>
        <select class="page-size-select" id="sender-history-page-size">
          <option value="20" ${senderHistoryPageSize === 20 ? 'selected' : ''}>20</option>
          <option value="50" ${senderHistoryPageSize === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${senderHistoryPageSize === 100 ? 'selected' : ''}>100</option>
          <option value="300" ${senderHistoryPageSize === 300 ? 'selected' : ''}>300</option>
        </select>
      </div>
      <div class="pagination-buttons" id="sender-history-pagination-btns"></div>
    </div>
  `;

  // Attach event listener for history column sorting
  const headers = container.querySelectorAll('#sender-history-table th.sortable');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const colName = th.getAttribute('data-history-col');
      if (senderHistorySortCol === colName) {
        senderHistorySortDir = senderHistorySortDir === 'asc' ? 'desc' : 'asc';
      } else {
        senderHistorySortCol = colName;
        senderHistorySortDir = 'asc';
      }
      sortSenderHistory();
      renderSenderHistory();
      renderSenderDetailsCard(senderData); // Re-render headers to update sort direction icons
    });
  });

  // Attach event listener for page size selector change
  container.querySelector('#sender-history-page-size').addEventListener('change', (e) => {
    senderHistoryPageSize = parseInt(e.target.value);
    senderHistoryCurrentPage = 1;
    renderSenderHistory();
  });
}

function sortSenderHistory() {
  if (senderHistorySortCol === 'index') {
    selectedSenderRecords.sort((a, b) => {
      return senderHistorySortDir === 'asc' ? a.index - b.index : b.index - a.index;
    });
  } else if (senderHistorySortCol === 'Fecha de Creación de Tramite') {
    selectedSenderRecords.sort((a, b) => {
      const dateA = parseDate(a['Fecha de Creación de Tramite']) || new Date(0);
      const dateB = parseDate(b['Fecha de Creación de Tramite']) || new Date(0);
      return senderHistorySortDir === 'asc' ? dateA - dateB : dateB - dateA;
    });
  } else {
    selectedSenderRecords.sort((a, b) => {
      const valA = (a[senderHistorySortCol] || '').toString().toLowerCase();
      const valB = (b[senderHistorySortCol] || '').toString().toLowerCase();
      if (valA < valB) return senderHistorySortDir === 'asc' ? -1 : 1;
      if (valA > valB) return senderHistorySortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

function renderSenderHistory() {
  const tableBody = document.getElementById('sender-history-body');
  if (!tableBody) return;

  const startIdx = (senderHistoryCurrentPage - 1) * senderHistoryPageSize;
  const pageSlice = selectedSenderRecords.slice(startIdx, startIdx + senderHistoryPageSize);

  let html = '';
  pageSlice.forEach(rec => {
    const hasObs = observations[rec.CUT];
    const obsText = hasObs 
      ? `<span class="obs-indicator" title="${hasObs.replace(/"/g, '&quot;')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px; vertical-align:middle;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg> Con Obs.
         </span>`
      : `<span style="color: var(--text-muted); font-size: 0.75rem;">Sin obs.</span>`;

    html += `
      <tr>
        <td class="num-cell">${rec.index}</td>
        <td class="cut-cell">${rec.CUT}</td>
        <td style="white-space: nowrap;">${rec['Fecha de Creación de Tramite']}</td>
        <td style="font-size:0.75rem;" title="${rec['Documento Origen']}">${rec['Documento Origen']}</td>
        <td class="asunto-cell" title="${rec['Asunto Origen']}">${rec['Asunto Origen']}</td>
        <td>${obsText}</td>
        <td style="text-align:right;">
          <button class="action-btn" onclick="openRevisionModal(${rec.index})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
            </svg>
            Revisar
          </button>
        </td>
      </tr>
    `;
  });
  tableBody.innerHTML = html;

  // Render pagination
  renderPaginationFooter({
    containerId: 'sender-history-pagination',
    infoId: 'sender-history-pagination-info',
    btnsId: 'sender-history-pagination-btns',
    totalRecords: selectedSenderRecords.length,
    currentPage: senderHistoryCurrentPage,
    pageSize: senderHistoryPageSize,
    onPageChange: (newPage) => {
      senderHistoryCurrentPage = newPage;
      renderSenderHistory();
    }
  });
}


// ==========================================
// VIEW 3: ANALIZADOR DUPLICADOS LOGIC
// ==========================================

function filterDuplicatesList() {
  const query = document.getElementById('search-duplicate').value.trim().toLowerCase();
  
  dupFilteredList = duplicates.filter(item => {
    if (query && !item.cut.toLowerCase().includes(query)) return false;
    return true;
  });
}

function renderDuplicates() {
  const container = document.getElementById('duplicates-tree-container');
  
  if (dupFilteredList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <h3>No se encontraron duplicados</h3>
        <p>No hay códigos CUT repetidos que coincidan con la búsqueda.</p>
      </div>
    `;
    renderPaginationFooter({
      containerId: 'duplicates-pagination',
      infoId: 'duplicates-pagination-info',
      btnsId: 'duplicates-pagination-btns',
      totalRecords: 0,
      currentPage: 1,
      pageSize: dupPageSize,
      onPageChange: () => {}
    });
    return;
  }

  // Calculate slice
  const startIdx = (dupCurrentPage - 1) * dupPageSize;
  const pageSlice = dupFilteredList.slice(startIdx, startIdx + dupPageSize);

  let html = '';
  pageSlice.forEach((item, index) => {
    const globalIndex = startIdx + index + 1;
    html += `
      <div class="duplicate-item" id="dup-item-${item.cut}">
        <div class="duplicate-header" onclick="toggleDuplicateAccordion('${item.cut}')">
          <div class="duplicate-header-left">
            <span class="chevron-icon">▼</span>
            <span style="font-weight:bold; color:var(--text-muted); font-size:0.8rem; margin-right:0.25rem;">N° ${globalIndex}</span>
            <span class="cut-number">${item.cut}</span>
            <span class="dup-badge">${item.records.length} registros</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">
            Remitente: <span style="font-weight:600; color:var(--text-primary);">${item.sender}</span>
          </div>
        </div>
        <div class="duplicate-content">
          <div class="tree-container" id="tree-content-${item.cut}">
            <!-- Connections rendered dynamically when accordion expands -->
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;

  // Render pagination
  renderPaginationFooter({
    containerId: 'duplicates-pagination',
    infoId: 'duplicates-pagination-info',
    btnsId: 'duplicates-pagination-btns',
    totalRecords: dupFilteredList.length,
    currentPage: dupCurrentPage,
    pageSize: dupPageSize,
    onPageChange: (newPage) => {
      dupCurrentPage = newPage;
      renderDuplicates();
      document.getElementById('duplicates-card-panel').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function toggleDuplicateAccordion(cut) {
  const itemEl = document.getElementById(`dup-item-${cut}`);
  if (!itemEl) return;

  const isOpen = itemEl.classList.contains('open');
  
  // Close all other duplicate items on page to improve performance
  const siblings = document.querySelectorAll('.duplicate-item');
  siblings.forEach(sibling => {
    sibling.classList.remove('open');
  });

  if (!isOpen) {
    itemEl.classList.add('open');
    renderDuplicateTree(cut);
  }
}

function renderDuplicateTree(cut) {
  const treeContainer = document.getElementById(`tree-content-${cut}`);
  if (!treeContainer) return;

  // Find the duplicate data object
  const dupData = duplicates.find(item => item.cut === cut);
  if (!dupData) return;

  let html = '';
  
  // Iterate through docOrigens
  dupData.docOrigens.forEach((docGroup, groupIndex) => {
    const rep = docGroup.records[0];
    const hasObs = observations[rep.CUT] || '';

    html += `
      <div class="tree-group">
        <div class="tree-group-title">
          <span><strong>Documento Origen:</strong> ${docGroup.documentoOrigen}</span>
        </div>
        <div class="tree-group-content">
          <!-- Nivel 2: Información detallada del Documento Origen -->
          <div class="tree-group-detail-card" style="padding: 0.85rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; font-size: 0.75rem; margin-bottom: 0.75rem; box-shadow: var(--shadow-sm);">
            <div style="margin-bottom: 0.5rem; line-height: 1.4; color: var(--text-primary);">
              <strong>Asunto:</strong> ${rep['Asunto Origen']}
            </div>
            <div style="display:flex; justify-content:space-between; gap:1rem; font-size:0.7rem; color:var(--text-muted); margin-bottom:0.5rem; flex-wrap:wrap;">
              <span><strong>Remitente:</strong> ${rep.Remitente}</span>
              <span><strong>Fecha Trámite:</strong> ${rep['Fecha de Creación de Tramite']}</span>
            </div>
            
            <!-- Campo de observaciones a nivel de Documento Origen -->
            <div class="tree-quick-obs" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border); display: flex; gap: 0.5rem; align-items: center;">
              <span style="font-size:0.7rem; font-weight:700; color:var(--text-secondary); white-space:nowrap;">Revisión:</span>
              <input type="text" class="tree-obs-input" id="quick-obs-${rep.index}" 
                value="${hasObs.replace(/"/g, '&quot;')}" 
                placeholder="Escriba una observación rápida..." 
                onchange="saveQuickObservation(${rep.index}, this.value)">
            </div>
          </div>

          <!-- Nivel 3: Listado de Últimos Documentos simplificados -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem; border-left: 1px dashed var(--border); margin-left: 0.5rem; padding-left: 0.75rem;">
    `;

    // Sort ultimos in group by Date of their representative record
    const sortedUltimos = [...docGroup.ultimos].sort((a, b) => {
      const dA = parseDate(a.representative['Fecha de Creación de Tramite']) || new Date(0);
      const dB = parseDate(b.representative['Fecha de Creación de Tramite']) || new Date(0);
      return dA - dB;
    });

    sortedUltimos.forEach(ultimo => {
      const rec = ultimo.representative;
      const ultObs = observations[rec.CUT] || '';

      html += `
        <div class="tree-node" style="padding-left: 1rem; border-left: none; margin-left: 0; position: relative;">
          <div style="content: ''; position: absolute; left: -0.75rem; top: 18px; width: 0.75rem; height: 1px; background: var(--border);"></div>
          <div style="content: ''; position: absolute; left: -0.75rem; top: 15px; width: 6px; height: 6px; background: var(--accent); border-radius: 50%; box-shadow: var(--tech-glow);"></div>
          <div class="tree-node-content" style="padding: 0.5rem 0.75rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600;">
              <span style="color: var(--accent); word-break: break-all;">${ultimo.ultimoDocumento}</span>
              <span class="badge" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; background: var(--border); border-radius: 4px; color: var(--text-secondary); white-space: nowrap;">
                ${ultimo.records.length} registros
              </span>
            </div>
            
            <!-- Campo de observaciones a nivel de Último Documento -->
            <div class="tree-quick-obs" style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dotted var(--border); display: flex; gap: 0.5rem; align-items: center;">
              <span style="font-size:0.65rem; font-weight:700; color:var(--text-secondary); white-space:nowrap;">Revisión:</span>
              <input type="text" class="tree-obs-input" id="quick-obs-ultimo-${rec.index}" 
                value="${ultObs.replace(/"/g, '&quot;')}" 
                placeholder="Escriba una observación rápida..." 
                onchange="saveQuickObservation(${rec.index}, this.value)"
                style="padding: 0.2rem 0.4rem; font-size: 0.7rem;">
            </div>
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  });

  treeContainer.innerHTML = html;
}


function saveQuickObservation(recordIndex, value) {
  const rec = rawRecords.find(r => r.index === recordIndex);
  if (!rec) return;

  const trimmed = value.trim();
  if (trimmed) {
    observations[rec.CUT] = trimmed;
  } else {
    delete observations[rec.CUT];
  }
  
  saveObservations();
}


// ==========================================
// VIEW 4: OBSERVACIONES REGISTRO LOGIC
// ==========================================

function filterObservationsList() {
  const query = document.getElementById('search-observation-text').value.trim().toLowerCase();
  
  const cutsWithObs = Object.keys(observations);
  const matchedList = [];

  cutsWithObs.forEach(cut => {
    const obsText = observations[cut] || '';
    
    // Find metadata of this CUT (get the first matching record in rawRecords)
    const rec = rawRecords.find(r => r.CUT === cut);
    if (!rec) return;

    if (query) {
      const cutMatch = cut.toLowerCase().includes(query);
      const senderMatch = rec.Remitente.toLowerCase().includes(query);
      const docMatch = rec['Documento Origen'].toLowerCase().includes(query);
      const obsMatch = obsText.toLowerCase().includes(query);
      
      if (!cutMatch && !senderMatch && !docMatch && !obsMatch) return;
    }

    matchedList.push({
      cut: cut,
      sender: rec.Remitente,
      documentName: rec['Documento Origen'],
      observation: obsText,
      recordIndex: rec.index
    });
  });

  // Sort observations alphabetically by sender name
  matchedList.sort((a, b) => a.sender.localeCompare(b.sender));
  obsFilteredList = matchedList;
}

function renderObservations() {
  const tableBody = document.getElementById('observations-table-body');
  
  if (obsFilteredList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1rem;">
          <div style="color: var(--text-muted); margin-bottom: 0.5rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto 0.5rem auto; display: block;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Ningún expediente cuenta con observaciones registradas
          </div>
        </td>
      </tr>
    `;
    renderPaginationFooter({
      containerId: 'observations-pagination',
      infoId: 'observations-pagination-info',
      btnsId: 'observations-pagination-btns',
      totalRecords: 0,
      currentPage: 1,
      pageSize: obsPageSize,
      onPageChange: () => {}
    });
    return;
  }

  // Calculate slice
  const startIdx = (obsCurrentPage - 1) * obsPageSize;
  const pageSlice = obsFilteredList.slice(startIdx, startIdx + obsPageSize);

  let html = '';
  pageSlice.forEach((item, index) => {
    const globalIndex = startIdx + index + 1;
    html += `
      <tr>
        <td class="num-cell">${globalIndex}</td>
        <td class="cut-cell">${item.cut}</td>
        <td style="font-weight:600; color:var(--text-primary); font-size:0.8rem;">${item.sender}</td>
        <td style="font-size:0.75rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.documentName}">
          ${item.documentName}
        </td>
        <td style="line-height:1.4; color:var(--text-secondary); max-width:350px; word-wrap:break-word; font-size:0.8rem;">
          ${item.observation}
        </td>
        <td style="text-align:right;">
          <div style="display:flex; justify-content:flex-end; gap:0.25rem;">
            <button class="action-btn" onclick="openRevisionModal(${item.recordIndex})" title="Editar observación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
              </svg>
            </button>
            <button class="action-btn" onclick="deleteObservationDirect('${item.cut}')" style="color:var(--danger); border-color:rgba(220,38,38,0.15);" title="Eliminar observación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tableBody.innerHTML = html;

  // Render pagination
  renderPaginationFooter({
    containerId: 'observations-pagination',
    infoId: 'observations-pagination-info',
    btnsId: 'observations-pagination-btns',
    totalRecords: obsFilteredList.length,
    currentPage: obsCurrentPage,
    pageSize: obsPageSize,
    onPageChange: (newPage) => {
      obsCurrentPage = newPage;
      renderObservations();
    }
  });
}

function deleteObservationDirect(cut) {
  if (confirm(`¿Está seguro de que desea eliminar la observación para el CUT ${cut}?`)) {
    delete observations[cut];
    saveObservations();
  }
}


// ==========================================
// DATA UTILITIES: EXPORT & IMPORT
// ==========================================

function exportObservationsAsJSON() {
  if (Object.keys(observations).length === 0) {
    alert('No hay observaciones registradas para exportar.');
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(observations, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `observaciones_sisged_ue002_${getFormattedDate()}.json`);
  dlAnchorElem.click();
}

function exportObservationsAsCSV() {
  if (Object.keys(observations).length === 0) {
    alert('No hay observaciones registradas para exportar.');
    return;
  }

  let csvRows = ['"CUT";"Observación de Revisión"'];
  Object.keys(observations).forEach(cut => {
    const text = (observations[cut] || '').replace(/"/g, '""');
    csvRows.push(`"${cut}";"${text}"`);
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", url);
  dlAnchorElem.setAttribute("download", `observaciones_sisged_ue002_${getFormattedDate()}.csv`);
  dlAnchorElem.click();
}

function importObservationsJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object' || Array.isArray(imported)) {
        throw new Error('Estructura JSON inválida. Debe ser un mapa clave-valor.');
      }
      
      let mergedCount = 0;
      Object.keys(imported).forEach(key => {
        if (typeof imported[key] === 'string') {
          observations[key] = imported[key];
          mergedCount++;
        }
      });

      alert(`Se importaron e integraron ${mergedCount} observaciones exitosamente.`);
      saveObservations();
      event.target.value = ''; // Reset input
    } catch (err) {
      alert("Error al importar el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function getFormattedDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  let mm = today.getMonth() + 1;
  let dd = today.getDate();
  if (dd < 10) dd = '0' + dd;
  if (mm < 10) mm = '0' + mm;
  return dd + '_' + mm + '_' + yyyy;
}


// ==========================================
// MODAL REVIEW CONTROLLER
// ==========================================

function openRevisionModal(recordIndex) {
  const rec = rawRecords.find(r => r.index === recordIndex);
  if (!rec) return;

  activeModalRecord = rec;
  modalTitleCut.textContent = rec.CUT || 'Sin CUT';
  modalDocName.textContent = rec['Documento Origen'] || 'Sin documento';
  modalTextareaObs.value = observations[rec.CUT] || '';

  modalOverlay.classList.add('active');
  modalTextareaObs.focus();
}

function hideModal() {
  modalOverlay.classList.remove('active');
  activeModalRecord = null;
}

function submitModalObservation() {
  if (!activeModalRecord) return;

  const obsText = modalTextareaObs.value.trim();
  if (obsText) {
    observations[activeModalRecord.CUT] = obsText;
  } else {
    delete observations[activeModalRecord.CUT];
  }

  saveObservations();
  hideModal();
}

// Global hook for inline HTML calls (since module boundaries or bundling don't exist here)
window.openRevisionModal = openRevisionModal;
window.toggleDuplicateAccordion = toggleDuplicateAccordion;
window.saveQuickObservation = saveQuickObservation;
window.selectSender = selectSender;
window.deleteObservationDirect = deleteObservationDirect;
