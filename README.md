# Reporta Aula Moodle

App web para extraer evidencias de participacion y desempeno desde Moodle, sincronizar resultados con Google Sheets y guardar evidencias en Google Drive usando Google Apps Script como backend operativo principal.

Hoja objetivo inicial:

`https://docs.google.com/spreadsheets/d/1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8/edit`

Proyecto GAS asociado:

`https://script.google.com/u/0/home/projects/1_wepzWMyJH-DgdhE3Wsu_Ci0QSikfhEcgWJipJdhXAjyYIfEq5up3hz-/edit`

Web App GAS real vinculada a Sheets/Drive:

`https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec`

Muestra GAS publica sin permisos sensibles, conservada solo como respaldo tecnico:

`https://script.google.com/macros/s/AKfycbzzr2X40ajp0AlTeD4jbHNZzsugkGeHzVtEa_s73kZTJQhQuCe0FrHaLg0PAwu7vHa-qg/exec`

Publicacion GitHub Pages con tablero completo:

`https://diegomezapy.github.io/reporta_aula_moodle/`

La barra superior incluye el boton `Hoja en linea` para abrir la Google Sheet operativa vinculada:

`https://docs.google.com/spreadsheets/d/1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8/edit?usp=sharing`

Endpoint de verificacion JSON:

`https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec?api=1`

Endpoint JSONP para GitHub Pages:

`https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec?api=report&callback=cb`

Estado operativo del 2026-06-11:

- El codigo GAS real fue cargado al proyecto `1_wepzWMyJH-DgdhE3Wsu_Ci0QSikfhEcgWJipJdhXAjyYIfEq5up3hz-`.
- El deployment real v3 existe: `AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA`.
- La URL devuelve `403 Acceso denegado` hasta que la cuenta ejecutora autorice los scopes de `spreadsheets`, `drive` y ejecucion de Apps Script, y tenga acceso efectivo a la hoja.
- La hoja no se considera operativa hasta verificar una escritura real en `GAS_RESUMEN`, `GAS_RIESGO`, `GAS_CORRIDA`, `GAS_EVIDENCIAS` y `GAS_AUDITORIA`.
- La sesion `clasp` local usada para la carga estaba autenticada como `monitorimpactosocial@gmail.com`; esa cuenta debe tener acceso de edicion a la hoja o el deployment debe recrearse desde una cuenta que lo tenga.

Para desbloquear la escritura real:

```bash
cd gas
clasp login --use-project-scopes --include-clasp-scopes
clasp run initializeReportaAulaWorkbook
```

Luego abrir `/exec?api=report&callback=cb`. Si responde `ok:true`, la primera lectura inicializa datos de muestra y registra evidencia JSON en Drive.

## Que Extrae

- Participantes del aula con rol estudiante.
- Ultimo acceso disponible en Moodle.
- Libro de calificaciones.
- Actividades detectadas en el curso.
- Informe nativo de participacion por actividad.
- Participacion del tutor/docente desde el informe nativo de participacion, cuando Moodle expone esos roles.
- Resumen por estudiante con indicadores separados de actividad en plataforma y participacion evaluativa.
- Estimacion bayesiana inicial de probabilidad de desercion a partir de actividad, evaluacion, foros, ultimo acceso y acompanamiento tutorial.

## Tablero

La URL publica de GitHub Pages abre directamente un tablero operativo completo, no una portada intermedia. La app estatica consulta Apps Script por JSONP y usa datos locales integrados si el endpoint de GAS no esta disponible o esta pendiente de autorizacion.

La primera pantalla incluye:

- KPIs generales del aula.
- Filtros globales por estudiante, nivel de riesgo, actividad en plataforma, participacion evaluativa y alertas.
- KPIs dinamicos que se recalculan con los filtros activos.
- Grafico de dona para el semaforo de riesgo.
- Grafico de dispersion para cruzar acciones Moodle y evaluaciones registradas.
- Distribucion de actividad en plataforma.
- Distribucion de participacion evaluativa.
- Ranking de actividades con mas evidencia.
- Tabla filtrable por estudiante.
- Panel individual con ultimo acceso, acciones, foros, evaluaciones, total del curso e indicador de seguimiento.
- Vista de riesgo de desercion con priorizacion por estudiante, bandas de probabilidad y evidencia bayesiana.
- Vista de tutoria con acciones, foros, cobertura y actividades con evidencia.
- Vista de automatizacion para configurar corridas periodicas desde GAS.
- Vista de auditoria con registro de uso de la app.
- PWA basica con `manifest.json` y `service-worker.js`.

Los endpoints usados por el tablero devuelven un payload compacto. Las evidencias completas deben quedar en Google Sheets y en archivos JSON dentro de la carpeta Drive configurada en Apps Script.

## Privacidad Y Acceso

La aplicacion maneja datos personales de estudiantes. En produccion configura Basic Auth:

```bash
APP_USERNAME=admin
APP_PASSWORD=un-password-largo
```

En la arquitectura GAS directa, las credenciales Moodle, tokens compartidos y carpeta Drive deben ir en `Script Properties`, no en GitHub Pages ni en archivos versionados.

Cada acceso queda registrado localmente en `data/access_log.jsonl` con usuario, fecha, ruta, estado HTTP y origen tecnico. No se registran contrasenas.

## Automatizacion GAS

La vista `Automatización` permite:

- activar o pausar extracciones periodicas;
- definir intervalo minimo de 5 minutos;
- sincronizar o no con Google Sheets;
- incluir o excluir la extraccion de participacion del tutor;
- ejecutar una corrida inmediata usando la configuracion guardada.

La configuracion productiva debe guardarse en Google Sheets y/o Script Properties. `data/automation_config.json` queda solo para ejecucion local Python.

## Riesgo De Desercion

La app calcula una probabilidad inicial de desercion con un modelo bayesiano auditable basado en razones de verosimilitud definidas por criterio experto. En cada corrida:

1. Se parte de un prior conservador de desercion si no hay historial.
2. Si existe una corrida previa del mismo curso, el posterior anterior del estudiante se usa como prior semanal.
3. Las evidencias de Moodle actualizan el riesgo: actividad en plataforma, participacion evaluativa, foros, ultimo acceso, total del curso y senal tutorial.
4. El reporte conserva `bayesian_prior_probability`, `bayesian_posterior_probability`, `bayesian_log_likelihood_ratio`, factores de evidencia y version del modelo.

Este valor sirve para priorizar seguimiento tutorial. No debe usarse como decision automatica ni como sancion academica.

En la vista `Riesgo`, el tablero muestra el prior medio, posterior medio, maximo posterior, version del modelo y cantidad de evidencias aplicadas. Tambien presenta una tabla de evidencia por estudiante con prior, posterior y log LR para auditoria docente.

## Ejecucion Local Opcional

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Luego abrir `http://127.0.0.1:8000`. Esta ruta local no reemplaza GAS; sirve para desarrollo, extraccion reproducible y pruebas con Python.

## Variables Principales

```bash
MOODLE_BASE_URL=https://www.virtual.facen.una.py/gradofacen
MOODLE_COURSE_ID=1718
MOODLE_USERNAME=
MOODLE_PASSWORD=
GOOGLE_SPREADSHEET_ID=1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8
```

No guardes usuario, contrasena ni tokens en Git.

## Vinculacion Con Apps Script

### Muestra publica sin permisos sensibles

La carpeta `gas_public_demo/` contiene una Web App GAS de muestra que no pide acceso a Google Sheets, Moodle ni Drive. Sirve para demostrar que la app puede ejecutarse desde Google Apps Script con acceso anonimo antes de migrarla a una cuenta institucional.

URL verificada:

`https://script.google.com/macros/s/AKfycbzzr2X40ajp0AlTeD4jbHNZzsugkGeHzVtEa_s73kZTJQhQuCe0FrHaLg0PAwu7vHa-qg/exec`

Pruebas realizadas el 2026-06-11:

- `/exec?api=1`: HTTP 200, `application/json`.
- `/exec?api=report`: HTTP 200, `application/json`, incluye `report.summaries`.
- `/exec?api=report&callback=cb`: HTTP 200, `text/javascript`, respuesta JSONP para GitHub Pages.
- `/exec`: HTTP 200, `text/html`, titulo `Reporta Aula Moodle`.

Esta muestra calcula KPIs y riesgo bayesiano con datos simulados y anonimizados. No escribe en hojas ni almacena credenciales.

### Integracion Real Con Google Sheets Y Drive

1. Abrir el proyecto GAS vinculado.
2. Reemplazar o agregar el contenido de `gas/Code.gs`, `gas/Index.html` y `gas/appsscript.json`.
3. Ejecutar una vez en el editor:

```javascript
setReportaAulaSecret('un-token-largo-y-privado')
initializeReportaAulaWorkbook()
```

`initializeReportaAulaWorkbook()` prepara las hojas operativas `CONFIG`, `USUARIOS`, `AUDITORIA`, `ERRORES`, `GAS_RESUMEN`, `GAS_RIESGO`, `GAS_CORRIDA` y `GAS_EVIDENCIAS`. Tambien prepara o reutiliza la carpeta Drive de evidencias.

4. Desplegar como Web App.
5. Verificar con:

```text
/exec?api=1
/exec?api=report
/exec?api=report&callback=cb
```

6. Para sincronizacion desde Python local, configurar en `.env`:

```bash
GAS_WEBAPP_URL=https://script.google.com/macros/s/XXXXX/exec
GAS_SHARED_SECRET=un-token-largo-y-privado
```

La app GAS real guarda tablas operativas en Sheets y evidencia JSON en Drive. La ruta Python local puede enviar las hojas `Corrida`, `Resumen`, `Riesgo desercion`, `Resumen tutor`, `Matriculados`, `Calificaciones`, `Actividades`, `Resumen actividades`, `Detalle participacion`, `Resumen act tutor` y `Detalle tutor`.

## Alternativa Con Google Sheets API

Compartir la hoja con el correo de una service account y configurar:

```bash
GOOGLE_SERVICE_ACCOUNT_FILE=/ruta/segura/service-account.json
```

Tambien se puede usar `GOOGLE_SERVICE_ACCOUNT_JSON` con el JSON completo desde un gestor de secretos del proveedor de despliegue.

## Evidencias Locales

Cada corrida genera una carpeta en `data/runs/<run_id>/` con:

- `reporte.json`
- `reporte_aula_moodle.xlsx`
- `resumen_estudiantes.csv`
- `riesgo_desercion.csv`
- `resumen_tutor.csv`
- `matriculados.csv`
- `calificaciones.csv`
- `actividades.csv`
- `resumen_actividades.csv`
- `detalle_participacion.csv`
- `resumen_actividades_tutor.csv`
- `detalle_participacion_tutor.csv`
- `status.json`

Las capturas de verificacion visual local pueden guardarse en `data/ui_checks/`; esa carpeta esta ignorada por Git.

## Despliegue Sugerido

La arquitectura principal es:

- Frontend: GitHub Pages.
- Backend operativo: Google Apps Script.
- Base de datos: Google Sheets.
- Evidencias: Google Drive.

GitHub Pages solo sirve archivos estaticos. Por eso no debe guardar credenciales ni ejecutar extracciones Moodle por si mismo. Apps Script debe recibir la configuracion segura y escribir en Sheets/Drive.

FastAPI queda como alternativa tecnica opcional para extracciones locales o un servicio persistente si mas adelante se requiere procesamiento Python continuo.

Opcionalmente, el repositorio conserva `render.yaml` para crear un servicio Python desde Render Blueprint si se decide mantener una capa FastAPI de extraccion avanzada:

`https://render.com/deploy?repo=https://github.com/diegomezapy/reporta_aula_moodle`

Render debe usar:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/healthz`

Comando:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Corrida Automatica Opcional En Python

Para ejecutar una corrida programada desde el servidor, cargar credenciales Moodle por variables de entorno y activar:

```bash
AUTO_RUN_ENABLED=true
AUTO_RUN_INTERVAL_MINUTES=10080
```

`10080` equivale a una corrida semanal. En la arquitectura GAS directa, la periodicidad debe configurarse con triggers de Apps Script; esta configuracion Python solo aplica a un despliegue FastAPI opcional.

## Documentacion Operativa

- `docs/manual_usuario.md`
- `docs/manual_tecnico.md`
- `docs/diccionario_datos.md`
- `docs/secuencia_prompts_reporta_aula_moodle_ultima_edicion_20260611.md`
- `BITACORA.md`
