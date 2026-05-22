# SISGED UE002 - Plataforma de Trámites y Revisión Documental

Esta plataforma es una aplicación web interactiva autocontenida (Single Page Application) diseñada para visualizar, buscar y analizar trámites documentarios basados en el reporte `reporte UE002.csv`. Permite optimizar la revisión de expedientes, identificar los códigos únicos de trámite (CUT) más duplicados en forma de árbol y añadir observaciones técnicas que se guardan de manera segura en el navegador.

## 🚀 Características Principales

- **Carga de Datos Inteligente:**
  - **Carga Automática:** Si la aplicación se ejecuta en un servidor (como GitHub Pages o un servidor local), cargará de forma automática el archivo `reporte UE002.csv` de la raíz del proyecto.
  - **Carga Manual (Drag & Drop):** Si falla la carga automática (por ejemplo, debido a políticas CORS al abrir el archivo HTML directamente con doble clic), la plataforma muestra una interfaz de arrastrar y soltar para seleccionar el archivo CSV manualmente.
  - **Persistencia en IndexedDB:** Una vez procesado el CSV por primera vez, se almacena en la base de datos local del navegador (`IndexedDB`) para que la aplicación cargue instantáneamente en las siguientes visitas sin tener que procesar el archivo de nuevo.
- **Buscador de Remitentes Avanzado:**
  - Búsqueda en tiempo real por el nombre del remitente.
  - Filtros instantáneos por **Origen** (Interno / Externo) y por **Tipo de Persona** (Persona Natural / Persona Jurídica).
  - Indicadores individuales del remitente consultado: total de trámites y detalle/fecha del último trámite.
- **Historial Completo de Trámites:**
  - Tabla detallada con `CUT`, `Fecha de Creación de Trámite`, `Documento Origen` y `Asunto Origen` del remitente seleccionado.
  - Botón de edición para añadir observaciones de revisión a cada trámite.
- **Analizador de CUTs Duplicados en Árbol:**
  - Panel que identifica y ordena de mayor a menor los CUTs con múltiples registros.
  - Al hacer clic en un CUT duplicado, se despliega una estructura de árbol que muestra todos los registros detallados asociados al mismo (Oficina actual, Tarea, Asunto, Remitente, etc.).
  - Campo de entrada rápida para agregar observaciones comunes al CUT directamente en el árbol.
- **Gestión de Observaciones de Revisión:**
  - Las observaciones se guardan en el `localStorage` del navegador vinculadas al `CUT`.
  - **Exportar observaciones:** Permite descargar un archivo JSON o CSV con todas las observaciones registradas.
  - **Importar observaciones:** Permite cargar un archivo JSON previamente exportado para recuperar las observaciones o fusionar el trabajo realizado por diferentes revisores.
- **Modo Oscuro / Claro:** Alternador de tema visual premium con persistencia de preferencia en el navegador.

---

## 🛠️ Cómo Ejecutar la Aplicación Localmente

### Opción 1: Abrir el archivo HTML directamente
1. Haz doble clic en el archivo `index.html`.
2. La primera vez, la aplicación te solicitará cargar el archivo `reporte UE002.csv`. Arrástralo a la zona punteada o búscalo en tu equipo.
3. El archivo se procesará y guardará en tu navegador de forma 100% local (sin subirlo a internet).

### Opción 2: Usar un servidor local (Recomendado)
Para probar la carga automática sin arrastrar el archivo, puedes levantar un servidor HTTP básico en la carpeta del proyecto.
* **Si usas Python:**
  ```bash
  python -m http.server 8000
  ```
  Luego abre tu navegador en `http://localhost:8000`.
* **Si tienes Node.js:**
  ```bash
  npx http-server
  ```
* **Si usas VS Code:** Haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.

---

## 📂 Estructura del Proyecto

```text
PENDIENTES_UE002/
├── lib/
│   └── papaparse.min.js      # Biblioteca de parseo CSV local (soporte offline)
├── index.html                # Estructura e interfaz de usuario de la plataforma
├── style.css                 # Estilos visuales de alto impacto (Light/Dark mode, adaptable)
├── app.js                    # Controladores, IndexedDB, lógica y exportaciones
├── README.md                 # Documentación del proyecto
└── reporte UE002.csv         # Archivo de datos (Subido a Git para carga automática)
```

---

## 💻 Subida a Git y Despliegue en GitHub Pages

Has seleccionado la **Opción A**, lo que significa que el archivo `reporte UE002.csv` (2.2 MB) se subirá directamente al repositorio Git junto al código. Esto permite que GitHub Pages lo sirva y la plataforma funcione de forma totalmente automatizada.

### Paso 1: Inicializar y subir a tu repositorio Git
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
# Inicializar repositorio local
git init

# Agregar todos los archivos (incluyendo el reporte UE002.csv y la carpeta lib/)
git add .

# Crear el primer commit
git commit -m "Initial commit: SISGED Document Tracker web application with dataset"

# Renombrar rama a main
git branch -M main

# Vincular con tu repositorio vacío en GitHub/GitLab
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# Subir los archivos
git push -u origin main
```

### Paso 2: Desplegar en GitHub Pages
1. Abre tu repositorio en **GitHub**.
2. Ve a **Settings** (Configuración) en la barra superior.
3. En el menú lateral izquierdo, haz clic en **Pages**.
4. En **Build and deployment**, bajo "Source", selecciona **Deploy from a branch**.
5. Bajo "Branch", selecciona la rama **main** (o master) y la carpeta **/ (root)**.
6. Haz clic en **Save**.
7. En aproximadamente 1 minuto, GitHub te dará un enlace público (ej. `https://TU_USUARIO.github.io/TU_REPOSITORIO/`) donde podrás ingresar a la aplicación desde cualquier computadora o celular.

---

## 🔒 Privacidad y Seguridad de Datos
Esta aplicación es del tipo **Client-Side (Fiel al Cliente)**. Ninguno de los datos contenidos en el CSV o las observaciones ingresadas se envían a servidores externos. Todo el procesamiento y almacenamiento de observaciones ocurre de manera segura dentro de la base de datos de tu propio navegador (`IndexedDB` y `localStorage`). Para transferir observaciones de una computadora a otra, utiliza los botones de **Exportar/Importar JSON** en la pestaña de Observaciones.
