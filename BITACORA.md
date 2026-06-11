# BITACORA - Reporta Aula Moodle

## 2026-06-10

### Hito

Implementacion de app web para extraer evidencias desde Moodle, sincronizar con Google Sheets y operar un tablero de seguimiento academico.

### Buenas Practicas Aplicadas

- Separacion de actividad en plataforma y participacion evaluativa.
- Evidencias locales reproducibles en JSON, CSV y XLSX.
- Configuracion sensible por variables de entorno, sin credenciales versionadas.
- Basic Auth opcional para despliegue.
- Registro local de accesos sin guardar contrasenas.
- Automatizacion periodica configurable desde la app.
- Extraccion opcional de participacion del tutor.
- Riesgo de desercion calculado con reglas heuristicas auditables.

### Pendientes

- Configurar credenciales Moodle y Google Sheets en el proveedor de despliegue.
- Activar Basic Auth antes de exponer la app fuera de entorno local.
- Verificar con el docente el periodo y titulo visible del aula antes de automatizar corridas semanales.

## 2026-06-10 - Capa bayesiana inicial de riesgo de desercion

### Hito

Se reemplazo el uso puramente heuristico del riesgo por una primera capa bayesiana auditable, manteniendo compatibilidad con el campo operativo `desertion_probability`.

### Cambios Tecnicos

- Se agrego `app/bayesian.py` con modelo `bayes_lr_expert_v0.1`.
- El modelo calcula odds posteriores a partir de un prior y razones de verosimilitud por evidencia.
- Si existe una corrida previa completada del mismo curso, el posterior previo del estudiante se usa como prior semanal.
- Se agregaron campos exportables: `risk_model_version`, `heuristic_probability`, `bayesian_prior_probability`, `bayesian_posterior_probability`, `bayesian_log_likelihood_ratio` y `bayesian_evidence_factors`.
- Se amplio `riesgo_desercion.csv` para dejar trazabilidad del calculo.
- Se actualizaron pruebas unitarias para casos criticos, evidencia positiva y actualizacion semanal de priors.

### Verificacion

- `python -m compileall app tests`: correcto.
- `python -m pytest`: 5 pruebas pasadas.

### Pendientes

- Calibrar las razones de verosimilitud con cohortes historicas reales cuando existan datos suficientes.
- Definir formalmente la variable objetivo: abandono, no entrega, no acceso prolongado, no rendicion de parcial/final o combinacion.
- Construir tabla longitudinal semanal para analisis academico y articulo.

## 2026-06-10 - Tablero operativo integrado con el modelo bayesiano

### Hito

Se integro la propuesta bayesiana al tablero web existente para que la app sea util como superficie de seguimiento semanal, no solo como generador de archivos.

### Cambios Tecnicos

- Se agregaron filtros globales por busqueda, riesgo, actividad en plataforma, participacion evaluativa y alerta.
- Los KPIs principales ahora se recalculan segun los filtros activos.
- Se agrego grafico de dona para semaforo de riesgo.
- Se agrego grafico de dispersion entre acciones Moodle y evaluaciones registradas.
- La vista `Riesgo` ahora muestra KPIs del modelo, bandas de probabilidad, priorizacion por estudiante y tabla de evidencia bayesiana.
- Se reforzo la visualizacion del detalle individual con prior, posterior, log LR y version del modelo.
- Se ignoran las capturas locales de QA visual en `data/ui_checks/`.

### Verificacion

- `python -m compileall app tests`: correcto.
- `python -m pytest`: 5 pruebas pasadas.
- `node --check app/static/app.js`: correcto.
- Verificacion HTTP local de `/api/reports/latest/dashboard`: 200.
- Verificacion visual con Playwright en `http://127.0.0.1:8000`:
  - KPIs del dashboard: 9.
  - Dona de riesgo: 1.
  - Puntos de dispersion: 20.
  - Filas de priorizacion: 20.
  - KPIs del modelo: 5.
  - Filas de evidencia bayesiana: 12.
  - Vista movil: KPIs y dona renderizados.

### Pendientes

- Desplegar la app en hosting persistente con Basic Auth y variables seguras.
- Conectar corridas reales semanales con credenciales Moodle seguras fuera del repositorio.
- Calibrar el modelo con cohortes historicas antes de usarlo como probabilidad estadistica formal en un articulo.

## 2026-06-10 - Correccion de publicacion GitHub Pages

### Problema

Al abrir la URL de GitHub Pages se recibia el mensaje `File not found`. La rama publicada no contenia `index.html` en la raiz del sitio, y GitHub Pages no puede ejecutar directamente la app FastAPI/Python.

### Acciones Realizadas

- Se agrego `index.html` en la raiz del repositorio como portada publica compatible con GitHub Pages.
- Se agrego `docs/index.html` como respaldo si Pages se configura desde la carpeta `docs`.
- Se agrego `.nojekyll` para evitar procesamiento innecesario de Jekyll.
- La portada publica explica la separacion entre frontend estatico y backend FastAPI.
- La portada permite guardar/probar una URL de backend publico mediante `/api/defaults`.
- Se actualizo README para aclarar que GitHub Pages no ejecuta Python y que el backend debe desplegarse en Render, Railway, Fly.io o VPS.

### Pendientes

- Verificar la URL de GitHub Pages una vez que GitHub procese el nuevo commit.
- Desplegar el backend FastAPI en hosting persistente para habilitar extracciones reales desde la URL publica.

## 2026-06-10 - Preparacion de despliegue FastAPI en Render

### Objetivo

Preparar el repositorio para que el backend FastAPI pueda desplegarse como servicio web real, separado de GitHub Pages.

### Acciones Realizadas

- Se agrego `render.yaml` en la raiz del repositorio.
- El servicio Render queda definido como `reporta-aula-moodle`, runtime `python`, rama `diego`, plan `free`.
- Se definieron comandos:
  - `pip install -r requirements.txt`
  - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Se agrego endpoint `/healthz` para health checks sin autenticacion.
- Se agrego enlace `Deploy to Render` en la portada publica de GitHub Pages.
- Se documentaron variables de entorno sensibles como `sync: false` para que Render las solicite en el dashboard y no queden versionadas.

### Pendientes

- Crear el servicio en Render desde el Blueprint.
- Configurar secretos en Render: `APP_USERNAME`, `APP_PASSWORD`, `MOODLE_USERNAME`, `MOODLE_PASSWORD`, y opcionalmente `GAS_WEBAPP_URL`/`GAS_SHARED_SECRET`.
- Verificar la URL `onrender.com` y luego redirigir GitHub Pages hacia esa URL si se desea acceso directo.

## 2026-06-11 - Publicacion de preparacion Render y URL temporal de app real

### Resultado

- Se publico en GitHub el commit `eee29da chore: preparar despliegue FastAPI en Render`.
- GitHub Pages fue reconstruido sobre el commit `eee29da`.
- `render.yaml` quedo accesible en la rama `diego`.
- Se levanto la app FastAPI localmente con Basic Auth.
- Se creo un tunel temporal HTTPS con `localhost.run` para abrir la app real mientras se completa el despliegue persistente.

### Verificacion

- URL temporal verificada: `https://58ecedd0f94160.lhr.life`.
- `/healthz`: HTTP 200.
- Pagina principal con Basic Auth: HTTP 200.
- La credencial temporal se mantiene fuera de Git en `data/TEMP_TUNNEL_CREDENTIALS.txt`.

### Pendiente Critico

El tunel temporal no reemplaza el despliegue productivo. Para crear el servicio permanente en Render mediante API se requiere una API Key de Render. El token GitHub no sirve para Render.

## 2026-06-11 - Regeneracion de tunel temporal

### Problema

La URL temporal anterior de `localhost.run` comenzo a responder `503`, aunque el backend local seguia sano.

### Accion

- Se reinicio el tunel SSH hacia `127.0.0.1:8000`.
- Nueva URL temporal verificada: `https://30c684a95440e7.lhr.life`.
- `/healthz`: HTTP 200.
- Sin autenticacion: HTTP 401.
- Con Basic Auth: HTTP 200.
- La credencial temporal se mantiene localmente fuera de Git.

## 2026-06-11 - Muestra funcional en Google Apps Script

### Objetivo

Crear una muestra publica ejecutable por GAS para demostrar el flujo de appweb sin depender todavia de Render, tuneles temporales ni permisos institucionales de Google Sheets.

### Acciones

- Se creo la carpeta `gas_public_demo/` con una Web App GAS autocontenida.
- La muestra no usa `SpreadsheetApp`, `DriveApp`, Moodle ni scopes sensibles.
- Se creo el proyecto Apps Script `Reporta Aula Moodle GAS Public Demo`.
- Se publico el deployment Web App:
  - `https://script.google.com/macros/s/AKfycbzzr2X40ajp0AlTeD4jbHNZzsugkGeHzVtEa_s73kZTJQhQuCe0FrHaLg0PAwu7vHa-qg/exec`
- Se mantuvo separada la carpeta `gas/` como base de integracion real con Google Sheets para la futura cuenta institucional.

### Verificacion

- `node --check` sobre el codigo GAS via stdin: correcto.
- `clasp push -f`: 3 archivos subidos.
- `clasp deploy`: deployment `AKfycbzzr2X40ajp0AlTeD4jbHNZzsugkGeHzVtEa_s73kZTJQhQuCe0FrHaLg0PAwu7vHa-qg @3`.
- Datos de muestra: anonimizados, sin correos ni nombres reales.
- `/exec?api=1`: HTTP 200, `application/json`, respuesta `ok:true`.
- `/exec`: HTTP 200, `text/html`, titulo `Reporta Aula Moodle`.

### Decision operativa

Para una muestra publica inicial conviene evitar scopes de Sheets/Drive/Moodle y probar primero ejecucion anonima real. La version con escritura en Google Sheets debe autorizarse y publicarse desde la cuenta propietaria/institucional, porque un deployment puede figurar como publico y aun asi devolver 403 si la cuenta no tiene permisos efectivos.

### Pendiente

- Transferir o recrear el proyecto GAS en la cuenta institucional cuando el modelo este listo.
- Rehabilitar la escritura en Google Sheets desde `gas/` luego de la autorizacion institucional.
- Probar lectura/escritura real contra la planilla institucional antes de declarar produccion.

## 2026-06-11 - Registro de secuencia de prompts del proyecto

### Accion

- Se creo `docs/secuencia_prompts_reporta_aula_moodle_ultima_edicion_20260611.md`.
- El archivo identifica claramente el proyecto, la ultima fecha de edicion y la secuencia cronologica consolidada de pedidos.
- Se redactaron credenciales, tokens y codigos temporales para evitar secretos versionados.
- Se agrego el archivo a la seccion de documentacion operativa del README.

## 2026-06-11 - Publicacion GitHub Pages como app completa

### Objetivo

Convertir la URL publica de GitHub Pages en la version extensa de la app, evitando que funcione solo como portada o pagina intermedia.

### Acciones

- Se reemplazo `index.html` por una app estatica completa con vistas de tablero, riesgo, estudiantes, tutoria, automatizacion, extraccion, corridas y auditoria.
- Se agregaron `assets/pages-app.js` y `assets/pages-app.css`.
- Se agregaron `manifest.json` y `service-worker.js` para PWA/cache basico.
- Se actualizo `gas_public_demo/Code.gs` para exponer:
  - `/exec?api=report`: JSON con reporte de muestra.
  - `/exec?api=report&callback=cb`: JSONP para consumo desde GitHub Pages sin bloqueo CORS.
- Se redeployo el GAS publico manteniendo el mismo deployment:
  - `AKfycbzzr2X40ajp0AlTeD4jbHNZzsugkGeHzVtEa_s73kZTJQhQuCe0FrHaLg0PAwu7vHa-qg @4`.

### Verificacion

- `node --check assets/pages-app.js`: correcto.
- `node --check` sobre `gas_public_demo/Code.gs` via stdin: correcto.
- `clasp push -f`: correcto.
- `clasp deploy -i ...`: correcto, version `@4`.
- `/exec?api=report`: HTTP 200, `application/json`, incluye `report.summaries`.
- `/exec?api=report&callback=cb`: HTTP 200, `text/javascript`, inicia con `cb(` e incluye `summaries`.
- Servidor local `http://127.0.0.1:8055/`: HTTP 200.
- Captura Playwright desktop: KPIs renderizados.
- Captura Playwright movil: vista responsive renderizada.

### Decision operativa

GitHub Pages queda como superficie visible y directa de la app. Los datos publicados son anonimos/de muestra; los datos reales de Moodle y Google Sheets deben cargarse solo cuando el backend/GAS se migre a la cuenta institucional autorizada.

## 2026-06-11 10:22 - Boton de acceso a hoja de registros

### Proyecto

- Nombre: Reporta Aula Moodle.
- Cliente o institucion: FACEN / Analitica de Big Data.
- Ruta local: `/tmp/reporta_aula_sheet_button` como clon limpio de publicacion; carpeta operativa original en Google Drive `FACEN_BIGDATA/reporta_aula_moodle`.
- Repositorio: `https://github.com/diegomezapy/reporta_aula_moodle.git`.
- URL publica: `https://diegomezapy.github.io/reporta_aula_moodle/`.
- Responsable: Diego Meza.
- Version: commit `c42ad05`.

### Objetivo de la intervencion

- Agregar un acceso visible desde la app hacia la hoja en linea que guarda los registros operativos.

### Diagnostico inicial

- La app publicada en GitHub Pages no tenia un boton directo para abrir la planilla de Google Sheets.
- El repositorio operativo local en Google Drive mantenia cambios de fin de linea y una rama local desfasada; para evitar pisar trabajo local se uso un clon limpio temporal.
- Se consulto el manual maestro de appweb y aplican los criterios de botones claros, acciones principales visibles, versionado de assets, verificacion real de GitHub Pages y bitacora actualizada.

### Acciones realizadas

- Se agrego el boton `Hoja en linea` en el encabezado de GitHub Pages.
- Se agrego el boton equivalente `Hoja en linea` en la interfaz FastAPI local.
- Se estilizo `.sheet-button` como accion secundaria visible, responsive y coherente con el tablero.
- Se actualizo el README para documentar el acceso a la hoja de registros.
- Se incremento el versionado de assets estaticos a `20260611-sheet-button`.
- Se actualizo el cache del service worker a `reporta-aula-moodle-pages-v20260611-sheet-button`.

### Archivos modificados

- `index.html`.
- `assets/pages-app.css`.
- `service-worker.js`.
- `app/static/index.html`.
- `app/static/styles.css`.
- `README.md`.
- `BITACORA.md`.

### Comandos o scripts ejecutados

- `python3 -m compileall app tests`.
- `/Users/diegobernardomezabogado/reporta_aula_moodle/.venv/bin/python -m pytest`.
- `node --check assets/pages-app.js`.
- `node --check app/static/app.js`.
- `node --input-type=commonjs --check - < gas_public_demo/Code.gs`.
- `git diff --check`.
- `git push origin diego`.
- `git push origin diego:main`.
- Verificaciones `curl` contra GitHub Pages, raw GitHub y assets versionados.

### Resultados verificados

- Commit publicado: `c42ad05 feat: agregar acceso a hoja de registros`.
- Ramas remotas `diego` y `main` verificadas en `c42ad05e293c37714b473a697e943c83bd1f7772`.
- GitHub raw de `main/index.html` incluye el boton, la URL de la planilla y `20260611-sheet-button`.
- GitHub Pages publico muestra el boton `Hoja en linea` y la URL:
  - `https://docs.google.com/spreadsheets/d/1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8/edit?usp=sharing`.
- `assets/pages-app.css?v=20260611-sheet-button`: HTTP 200.
- `service-worker.js`: HTTP 200.

### Pruebas realizadas

- Compilacion Python: correcta.
- Pytest: 5 pruebas pasadas.
- Validacion sintactica JS de frontend Pages y FastAPI: correcta.
- Validacion sintactica GAS por stdin: correcta.
- Verificacion de espacios finales con `git diff --check`: correcta.
- Verificacion publica de GitHub Pages: correcta luego de esperar invalidacion de cache.

### Errores o incidentes

- GitHub Pages sirvio temporalmente el HTML anterior `20260611-gas-full` por cache de borde.
- `gh` no esta instalado en este entorno, por lo que la verificacion de publicacion se realizo con `git`, `curl`, GitHub raw y API publica.

### Soluciones aplicadas

- Se uso cache busting mediante query/version de assets y nuevo nombre de cache del service worker.
- Se monitoreo la URL publica hasta confirmar que Pages ya servia `20260611-sheet-button`.

### Pendientes

- Validar con usuario que la cuenta tiene permisos para abrir la planilla desde el boton.
- Mantener la hoja real protegida con permisos institucionales adecuados.
- Migrar la integracion real Sheets/GAS a cuenta institucional autorizada antes de produccion.

### Riesgos

- Si la hoja cambia de URL o permisos, el boton seguira visible pero el acceso puede fallar para usuarios sin autorizacion.
- Los datos reales no deben exponerse en GitHub Pages ni en JSON publico sin control de acceso.

### Recomendaciones

- Mantener un enlace visible a la fuente operativa de registros en todas las vistas administrativas.
- Para siguientes cambios de GitHub Pages, conservar versionado de assets y verificar la URL publica, no solo el push.

## 2026-06-11 10:55 - Correccion de arquitectura GAS, Sheets y Drive

### Proyecto

- Nombre: Reporta Aula Moodle.
- Cliente o institucion: FACEN / Analitica de Big Data.
- Ruta local: `/tmp/reporta_aula_sheet_button`.
- Repositorio: `https://github.com/diegomezapy/reporta_aula_moodle.git`.
- URL publica: `https://diegomezapy.github.io/reporta_aula_moodle/`.
- Proyecto GAS objetivo: `1_wepzWMyJH-DgdhE3Wsu_Ci0QSikfhEcgWJipJdhXAjyYIfEq5up3hz-`.

### Objetivo de la intervencion

- Corregir la confusion entre backend Python y backend GAS.
- Cargar contenido real en el proyecto GAS asociado.
- Preparar escritura real en Google Sheets y evidencia JSON en Google Drive.

### Diagnostico inicial

- La hoja en linea no guardaba datos.
- El proyecto GAS indicado por el usuario no tenia el contenido operativo esperado en el editor.
- La app publica mantenia textos como `Backend FastAPI institucional` y `Probar backend`, incompatibles con la arquitectura esperada GitHub Pages -> GAS -> Sheets/Drive.
- El `.clasp.json` local de la carpeta operativa de Google Drive apuntaba a otro script ID (`1eZF...`) y no al proyecto GAS indicado (`1_wepz...`).

### Acciones realizadas

- Se creo temporalmente `gas/.clasp.json` apuntando al proyecto GAS correcto `1_wepz...` para publicar el codigo.
- Se empujaron a GAS los archivos `appsscript.json`, `Code.gs` e `Index.html`.
- Se agrego soporte GAS real para:
  - `/exec?api=1`.
  - `/exec?api=report`.
  - `/exec?api=report&callback=cb`.
  - JSONP para consumo desde GitHub Pages.
  - inicializacion de hojas operativas.
  - escritura de `GAS_RESUMEN`, `GAS_RIESGO`, `GAS_CORRIDA`, `GAS_EVIDENCIAS` y `GAS_AUDITORIA`.
  - creacion/reutilizacion de carpeta Drive de evidencias.
  - guardado de evidencia JSON por corrida.
- Se agrego scope Drive a `gas/appsscript.json`.
- Se actualizo GitHub Pages para usar el endpoint GAS real v3.
- Se cambio la vista `Extraccion` a `Conexion GAS`, con boton `Verificar GAS`, enlace a la hoja y enlace al editor GAS.
- Se actualizo el service worker a `reporta-aula-moodle-pages-v20260611-gas-direct`.
- Se actualizo README para aclarar que GAS es el backend operativo principal y FastAPI queda como alternativa opcional/local.

### Despliegue GAS realizado

- `clasp push -f`: 3 archivos cargados.
- Version 1: `Reporta Aula Moodle GAS Sheets Drive 20260611`.
- Version 2: `Reporta Aula Moodle GAS directo Sheets Drive v2`.
- Version 3: `Reporta Aula Moodle GAS auto inicializa Sheets Drive 20260611`.
- Deployment v3:
  - `AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA @3`.
  - URL: `https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec`.

### Resultados verificados

- La API de Apps Script confirma que el proyecto `1_wepz...` contiene `appsscript`, `Code` e `Index`.
- La API de Apps Script confirma deployments con `access: ANYONE_ANONYMOUS` y `executeAs: USER_DEPLOYING`.
- `node --input-type=commonjs --check - < gas/Code.gs`: correcto.
- `node --check assets/pages-app.js`: correcto.
- `git diff --check`: correcto.

### Errores o incidentes

- La URL GAS v3 devuelve `HTTP 403 Acceso denegado` pese a estar desplegada como `ANYONE_ANONYMOUS`.
- `clasp run initializeReportaAulaWorkbook` devuelve `Unable to run script function. Please make sure you have permission to run the script function.`
- La sesion local de `clasp` esta autenticada como `monitorimpactosocial@gmail.com`.
- El token local de `clasp` no incluye scopes de `spreadsheets`, `drive` ni ejecucion `script.scriptapp`; por tanto permite subir codigo, pero no autorizar/ejecutar escritura en Sheets/Drive.
- El conector Google Drive/Sheets de Codex fallo al iniciar por error de handshake, por lo que no se pudo inicializar la hoja por esa via.

### Estado operativo real

- Codigo GAS: cargado en el proyecto correcto.
- Deployment GAS: creado.
- GitHub Pages: preparado para usar el GAS real.
- Escritura real en la hoja: pendiente de autorizacion.
- Evidencia real en Drive: pendiente de autorizacion.

### Pendientes criticos

- Reautorizar `clasp` con scopes del proyecto:
  - `clasp login --use-project-scopes --include-clasp-scopes`.
- Confirmar que la cuenta ejecutora del deployment tenga acceso de edicion a la hoja:
  - `1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8`.
- Ejecutar:
  - `clasp run initializeReportaAulaWorkbook`.
- Verificar luego:
  - `/exec?api=1`.
  - `/exec?api=report`.
  - `/exec?api=report&callback=cb`.
- Confirmar que la hoja tenga filas en `GAS_RESUMEN`, `GAS_RIESGO`, `GAS_CORRIDA`, `GAS_EVIDENCIAS` y `GAS_AUDITORIA`.

### Recomendaciones

- No declarar la app como operativa hasta verificar escritura real en Sheets y archivo de evidencia en Drive.
- Mantener GAS como backend principal del proyecto y evitar textos de UI que indiquen FastAPI como requisito.

## 2026-06-11 11:18 - Aplicacion de recomendaciones MASTER sobre version y PWA

### Objetivo de la intervencion

- Aplicar recomendaciones del Manual Maestro relacionadas con version visible, cache, PWA y botones criticos.
- Agregar un boton visible para actualizar la version de la app publicada.

### Diagnostico inicial

- La app tenia service worker y cache busting, pero no exponia un control claro para que el usuario actualizara la version.
- El boton `R` era ambiguo: recargaba datos, pero no comunicaba actualizacion de version.
- No habia footer visible con version de app, fecha build y estado de cache.
- No habia flujo visible de instalacion PWA cuando el navegador lo permitiera.

### Acciones realizadas

- Se agrego boton `Actualizar version` en la barra superior.
- Se renombro el boton de recarga de datos a `Actualizar datos`.
- Se agrego boton `Instalar`, visible solo cuando el navegador emite `beforeinstallprompt`.
- Se agrego footer con version, fecha build y estado de cache.
- Se agregaron constantes `APP_VERSION`, `APP_BUILD_DATE` y `APP_CACHE_PREFIX`.
- El boton `Actualizar version` ahora:
  - elimina caches `reporta-aula-moodle-pages-*`;
  - solicita actualizacion de service workers registrados;
  - recarga la app con parametros `app_v` y `ts`;
  - informa `Version actualizada` al volver a cargar.
- Se agrego la version a la vista `Corridas` y a `Auditoria`.
- Se actualizo el cache del service worker a `reporta-aula-moodle-pages-v20260611-master-version`.

### Archivos modificados

- `index.html`.
- `assets/pages-app.js`.
- `assets/pages-app.css`.
- `service-worker.js`.
- `README.md`.
- `BITACORA.md`.

### Verificacion

- `node --check assets/pages-app.js`: correcto.
- `node --input-type=commonjs --check - < gas/Code.gs`: correcto.
- `git diff --check`: correcto.
- Servidor local `http://127.0.0.1:8066/`: HTML sirve `Actualizar datos`, `Actualizar version`, `Instalar` y footer `Version --`.
- Asset CSS versionado `assets/pages-app.css?v=20260611-master-version`: HTTP 200.
- Asset JS versionado `assets/pages-app.js?v=20260611-master-version`: HTTP 200 e incluye `APP_VERSION`, `updateAppVersion`, `beforeinstallprompt` y `registerServiceWorker`.
- `service-worker.js`: HTTP 200 con cache `reporta-aula-moodle-pages-v20260611-master-version`.

### Pendientes

- Verificar visualmente en GitHub Pages despues del push que aparezcan `Actualizar version`, `Instalar` cuando aplique y el footer de version.
- Mantener el mismo numero de version en `APP_VERSION`, `service-worker.js`, README y bitacora en cada despliegue.

## 2026-06-11 11:56 - Verificacion de GAS operativo actualizado

### Objetivo de la intervencion

- Verificar la Web App GAS informada como actualizada por el usuario.
- Actualizar el estado documental del proyecto, ya que el bloqueo `403 Acceso denegado` fue superado.

### URLs verificadas

- Web App GAS:
  - `https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec`.
- Endpoint JSON:
  - `/exec?api=1`.
- Endpoint JSONP:
  - `/exec?api=report&callback=cb`.

### Resultados verificados

- `/exec?api=1`: HTTP 200, `application/json`, `ok:true`.
- `/exec?api=report&callback=cb`: HTTP 200, `text/javascript`, `ok:true`.
- El endpoint JSONP devuelve 20 registros de muestra en `report.summaries`.
- Curso reportado: `Analitica de Big Data - Muestra GAS`.
- Hoja vinculada reportada por GAS:
  - `1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8`.
- Carpeta Drive reportada por GAS:
  - `https://drive.google.com/drive/folders/1qedaz8PyXE7W6PEMmLiGwPLq_h3B1j86`.
- GitHub Pages publica `assets/pages-app.js?v=20260611-master-version` apuntando al mismo deployment GAS.

### Estado operativo actualizado

- GAS Web App: accesible.
- Lectura JSON/JSONP desde GitHub Pages: disponible.
- Integracion Sheets/Drive de muestra: disponible segun respuesta GAS.
- Extraccion real Moodle con credenciales institucionales: pendiente de implementar/validar como flujo seguro independiente de GitHub Pages.

### Archivos modificados

- `README.md`.
- `BITACORA.md`.

### Recomendacion

- Mantener este deployment activo y evitar reemplazarlo por otro sin repetir las verificaciones `/exec?api=1` y `/exec?api=report&callback=cb`.

## 2026-06-11 14:49 - Boton para generar extraccion desde la app

### Objetivo de la intervencion

- Agregar un boton visible `Generar extraccion` en la vista `Extraccion`.
- Conectar el boton al endpoint GAS disponible para ejecutar una corrida y actualizar el tablero.

### Diagnostico inicial

- La app tenia boton `Verificar GAS`, pero no un boton separado para iniciar una corrida.
- El endpoint GAS ya exponia `api=runSample`, capaz de escribir en Sheets y guardar evidencia JSON en Drive.

### Acciones realizadas

- Se agrego el boton `Generar extraccion` en `index.html`.
- Se agrego `runGasExtraction()` en `assets/pages-app.js`.
- El boton llama a GAS por JSONP con `api=runSample`, `courseId`, `spreadsheetId`, `courseTitle` y `ts`.
- Cuando GAS responde `ok:true`, la app:
  - normaliza el reporte;
  - actualiza el tablero;
  - muestra estado `Extraccion generada`;
  - muestra la evidencia JSON generada en Drive dentro de la vista `Evidencias`.
- Se actualizo la version a `2026.06.11-generate-extraction`.
- Se actualizo el service worker a `reporta-aula-moodle-pages-v20260611-generate-extraction`.

### Verificacion

- `node --check assets/pages-app.js`: correcto.
- `node --input-type=commonjs --check - < gas/Code.gs`: correcto.
- `git diff --check`: correcto.
- Endpoint GAS probado:
  - `/exec?api=runSample&callback=cb&courseId=1718&spreadsheetId=...`
  - HTTP 200, `text/javascript`, `ok:true`.
- Servidor local `http://127.0.0.1:8067/`: HTML sirve `Verificar GAS`, `Generar extraccion` y assets `20260611-generate-extraction`.
- Asset JS local `assets/pages-app.js?v=20260611-generate-extraction`: HTTP 200 e incluye `runGasExtraction`, `api: "runSample"` y estado `Extraccion generada`.
- `service-worker.js` local: HTTP 200 con cache `reporta-aula-moodle-pages-v20260611-generate-extraction`.
- GitHub Pages publico `https://diegomezapy.github.io/reporta_aula_moodle/`: HTML sirve `Verificar GAS`, `Generar extraccion` y assets `20260611-generate-extraction`.
- Asset JS publico `assets/pages-app.js?v=20260611-generate-extraction`: HTTP 200 e incluye `runGasExtraction`, `api: "runSample"` y estado `Extraccion generada`.
- `service-worker.js` publico: HTTP 200 con cache `reporta-aula-moodle-pages-v20260611-generate-extraction`.
- Corrida generada:
  - `gas-demo-20260611-144837`.
- Registros devueltos:
  - 20.
- Evidencia Drive generada:
  - `reporta_aula_gas-demo-20260611-144837_20260611-144838.json`.
  - `https://drive.google.com/file/d/1kcAi-C-KQAfv9g7BiSP2AI5EUCtav51i/view?usp=drivesdk`.

### Estado operativo actualizado

- Boton visible de generacion: implementado.
- Generacion GAS de muestra con escritura Sheets/Drive: verificada.
- Extraccion real Moodle con credenciales institucionales: pendiente de reemplazar/implementar sobre el flujo seguro de GAS.

## 2026-06-11 15:14 - Identificadores y doble modalidad de desercion

### Proyecto

- Nombre: Reporta Aula Moodle.
- Cliente o institucion: FACEN / Aula Moodle.
- Ruta local: `/tmp/reporta_aula_sheet_button`.
- Repositorio: `https://github.com/diegomezapy/reporta_aula_moodle.git`.
- URL publica: `https://diegomezapy.github.io/reporta_aula_moodle/`.
- Responsable: Codex.
- Version: `2026.06.11-dual-risk-identifiers`.

### Objetivo de la intervencion

- Mostrar datos identificadores de estudiantes y tutores/profesores en el tablero.
- Incorporar variables academicas del estudiante y variables del tutor/profesor como determinantes auditables del modelo bayesiano.
- Separar la probabilidad de desercion en dos modalidades: durante el semestre y en la carrera.

### Diagnostico inicial

- La muestra GAS y el tablero exponian un contrato minimo: `user_id`, nombre, correo, actividad, foros, evaluaciones y una sola probabilidad.
- La vista de tutorias solo mostraba KPIs agregados, sin profesores/tutores identificados.
- Los campos historicos `bayesian_*` y `desertion_*` no distinguian entre riesgo semestral y riesgo de carrera.

### Acciones realizadas

- Se amplio `gas/Code.gs` para generar y escribir en `GAS_RESUMEN` identificadores anonimizados de estudiante, documento demo, cohorte, carrera, semestre, estado de matricula, carga academica, materias previas, avance de carrera, beca, turno, tutor asignado, rol, correo, acciones, respuestas, retroalimentacion, tiempo de respuesta y cobertura.
- Se agregaron salidas `semester_*` y `career_*` para prior, posterior, log LR, probabilidad, nivel y factores de riesgo.
- Se conservaron `bayesian_*` y `desertion_*` como alias de la modalidad semestre por compatibilidad.
- Se agrego selector global `Modalidad` con opciones `Semestre` y `Carrera`.
- Se ajustaron KPIs, dona, dispersion, filtros, tabla de riesgo, evidencia bayesiana y detalle de estudiante para usar la modalidad activa.
- Se agrego una vista de tutores/profesores identificados con variables de seguimiento.
- Se actualizo el modelo local Python con campos y estimadores `semester_*` y `career_*`.
- Se actualizo versionado de assets y service worker.
- Se actualizaron README, manual tecnico, manual de usuario y diccionario de datos.

### Archivos modificados

- `gas/Code.gs`.
- `assets/pages-app.js`.
- `assets/pages-app.css`.
- `index.html`.
- `service-worker.js`.
- `app/bayesian.py`.
- `app/reporting.py`.
- `app/models.py`.
- `tests/test_reporting.py`.
- `README.md`.
- `docs/diccionario_datos.md`.
- `docs/manual_usuario.md`.
- `docs/manual_tecnico.md`.
- `BITACORA.md`.

### Comandos o scripts ejecutados

- `node --check assets/pages-app.js`.
- `node --input-type=commonjs --check - < gas/Code.gs`.
- `python3 -m compileall app tests`.
- `/Users/diegobernardomezabogado/reporta_aula_moodle/.venv/bin/python -m pytest`.
- `clasp push -f`.
- `clasp deploy -i AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA -V 5 -d 'Reporta Aula Moodle dual risk identifiers 20260611'`.
- `curl` contra `/exec?api=runSample&callback=cb&courseId=1718&spreadsheetId=...`.
- `python3 -m http.server 8070`.
- `curl` contra `http://127.0.0.1:8070/`, `assets/pages-app.js` y `service-worker.js`.
- `curl` contra `https://diegomezapy.github.io/reporta_aula_moodle/?verify=dual-risk-identifiers-2`.
- `curl` contra `https://diegomezapy.github.io/reporta_aula_moodle/assets/pages-app.js?v=20260611-dual-risk-identifiers`.
- `curl` contra `https://diegomezapy.github.io/reporta_aula_moodle/service-worker.js?verify=dual-risk-identifiers`.

### Resultados verificados

- Sintaxis JavaScript correcta.
- Sintaxis GAS compatible con Node para revision local.
- Compilacion Python correcta.
- Pruebas Python: 5 passed, 1 warning por LibreSSL/urllib3.
- GAS remoto contiene `gas_demo_bayes_v0.2_dual_desertion` segun pull temporal con `clasp clone`.
- Deployment publico actualizado: `AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA @5`.
- Corrida GAS generada: `gas-demo-20260611-151950`.
- `api=runSample` devuelve `student_moodle_id`, `student_document_id`, variables del tutor, `semester_desertion_probability` y `career_desertion_probability`.
- `api=report&callback=cb` lee desde la hoja el contrato nuevo.
- Servidor local `http://127.0.0.1:8070/` sirve `riskModeSwitch`, botones `Semestre/Carrera`, `tutorRoster`, `Generar extraccion` y assets `20260611-dual-risk-identifiers`.
- `service-worker.js` local sirve cache `reporta-aula-moodle-pages-v20260611-dual-risk-identifiers`.
- Commit funcional publicado: `d8313b7 feat: agregar riesgos por semestre y carrera`.
- Ramas remotas actualizadas: `diego` y `main`.
- GitHub Pages publico sirve `riskModeSwitch`, botones `Semestre/Carrera`, `tutorRoster` y assets `20260611-dual-risk-identifiers`.
- Asset JS publico sirve `APP_VERSION = 2026.06.11-dual-risk-identifiers`, `activeRiskProbability`, `student_moodle_id`, `semester_desertion_probability`, `career_desertion_probability` y `tutorRoster`.
- Service worker publico sirve cache `reporta-aula-moodle-pages-v20260611-dual-risk-identifiers`.

### Errores o incidentes

- La prueba existente esperaba prior `0.20`. Se actualizo a `0.22` para la modalidad semestre y se agregaron verificaciones de `career_*`.

### Soluciones aplicadas

- Modelo bayesiano dual:
  - `Semestre`: actividad Moodle, evaluaciones, foros, ultimo acceso, carga actual y acompanamiento tutorial.
  - `Carrera`: trayectoria academica, avance, materias previas, estado de matricula, carga, beca, acompanamiento tutorial y senal del semestre.
- Datos de demostracion anonimizados para evitar exposicion publica de identificadores reales.

### Pendientes

- Reemplazar la muestra `runSample` por extraccion Moodle real con credenciales seguras en GAS.
- Incorporar al manual maestro el patron reutilizable de modelos bayesianos con modalidades separadas y alias historicos de compatibilidad.

### Riesgos

- La demo publica no debe confundirse con datos reales: los identificadores son ficticios.
- La probabilidad bayesiana es senal operativa de seguimiento, no decision automatica ni sancion.

### Recomendaciones

- Mantener los campos `semester_*` y `career_*` como contrato estable del tablero.
- Calibrar priors y razones de verosimilitud con cohortes historicas antes de presentar el modelo como prediccion estadistica formal.

## 2026-06-11 15:52 - Extraccion Moodle real desde GAS con credenciales seguras

### Proyecto

- Nombre: Reporta Aula Moodle.
- Cliente o institucion: FACEN / Aula Moodle.
- Ruta local: `/tmp/reporta_aula_sheet_button`.
- Repositorio: `https://github.com/diegomezapy/reporta_aula_moodle.git`.
- URL publica: `https://diegomezapy.github.io/reporta_aula_moodle/`.
- Responsable: Codex.
- Version: `2026.06.11-moodle-real-extraction`.

### Objetivo de la intervencion

- Sustituir el flujo unico de muestra por una extraccion Moodle real desde GAS.
- Evitar que GitHub Pages pida o almacene contrasenas.
- Habilitar verificacion de credenciales Moodle configuradas en `Script Properties`.

### Diagnostico inicial

- El boton `Generar extraccion` llamaba a `api=runSample`.
- La app solo solicitaba ID de curso porque la corrida era demo anonima.
- No existia endpoint GAS para iniciar sesion en Moodle ni leer participantes/calificaciones/participacion.

### Acciones realizadas

- Se agregaron propiedades seguras:
  - `REPORTA_AULA_MOODLE_BASE_URL`.
  - `REPORTA_AULA_MOODLE_USERNAME`.
  - `REPORTA_AULA_MOODLE_PASSWORD`.
- Se agregaron funciones GAS:
  - `setReportaAulaMoodleCredentials(baseUrl, username, password)`.
  - `clearReportaAulaMoodleCredentials()`.
  - `getMoodleCredentialStatus()`.
- Se agrego endpoint `api=credentialStatus` por JSONP.
- Se agrego endpoint `api=runMoodleExtraction` con login Moodle por cookies y extraccion HTML defensiva.
- Se agrego escritura de tablas crudas:
  - `GAS_PARTICIPANTES`.
  - `GAS_CALIFICACIONES`.
  - `GAS_ACTIVIDADES`.
  - `GAS_PARTICIPACION`.
  - `GAS_TUTORES`.
  - `GAS_ERRORES`.
- Se mantuvo `api=runSample` como muestra anonima secundaria.
- Se cambio la app publica:
  - boton principal `Generar extraccion Moodle`;
  - boton secundario `Generar muestra`;
  - boton `Ver credenciales GAS`;
  - estado visible `Credenciales Moodle`.
- Se actualizo version/cache a `2026.06.11-moodle-real-extraction`.
- Se actualizaron README, manual tecnico y manual de usuario.

### Archivos modificados

- `gas/Code.gs`.
- `index.html`.
- `assets/pages-app.js`.
- `assets/pages-app.css`.
- `service-worker.js`.
- `README.md`.
- `docs/manual_usuario.md`.
- `docs/manual_tecnico.md`.
- `BITACORA.md`.

### Comandos o scripts ejecutados

- `node --check assets/pages-app.js`.
- `node --input-type=commonjs --check - < gas/Code.gs`.
- `python3 -m compileall app tests`.
- `/Users/diegobernardomezabogado/reporta_aula_moodle/.venv/bin/python -m pytest`.
- `git diff --check`.
- `clasp push -f`.
- `clasp deploy -i AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA -d 'Reporta Aula Moodle Moodle real extraction 20260611'`.
- `curl` contra `api=credentialStatus`.
- `curl` contra `api=runMoodleExtraction`.
- `curl` contra `api=runSample`.
- `python3 -m http.server 8071`.

### Resultados verificados

- Sintaxis JS y GAS correcta.
- Pruebas Python: 5 passed, 1 warning LibreSSL/urllib3.
- Deployment GAS actualizado: `AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA @6`.
- `api=credentialStatus`: responde `configured:false` sin exponer secretos.
- `api=runMoodleExtraction`: responde error controlado cuando faltan credenciales.
- `api=runSample`: sigue generando muestra anonima y escribe en Sheets/Drive.
- Servidor local `http://127.0.0.1:8071/` sirve `Generar extraccion Moodle`, `Generar muestra`, `Ver credenciales GAS` y assets `20260611-moodle-real-extraction`.
- Commit publicado: `17e81b0 feat: habilitar extraccion moodle real en gas`.
- Ramas remotas actualizadas: `origin/diego` y `origin/main`.
- GitHub Pages verificado en `https://diegomezapy.github.io/reporta_aula_moodle/`:
  - HTML publico sirve assets `20260611-moodle-real-extraction`;
  - JS publico contiene `APP_VERSION = "2026.06.11-moodle-real-extraction"`;
  - service worker publico contiene cache `reporta-aula-moodle-pages-v20260611-moodle-real-extraction`;
  - UI publica contiene `Credenciales Moodle`, `Ver credenciales GAS`, `Generar extraccion Moodle` y `Generar muestra`.
- GAS publico verificado despues de la publicacion:
  - `api=credentialStatus` responde `configured:false`;
  - `api=runMoodleExtraction` responde error controlado por falta de credenciales;
  - `api=runSample` permanece operativo como muestra anonima.

### Errores o incidentes

- No hay credenciales reales cargadas en GAS al momento de esta intervencion, por lo que no se pudo validar login real ni extraccion real contra Moodle.

### Soluciones aplicadas

- Se evita pedir contrasenas en GitHub Pages.
- Se centraliza la autenticacion Moodle en GAS mediante `Script Properties`.
- Se registra error controlado en `GAS_ERRORES` cuando falta configuracion.

### Pendientes

- Cargar credenciales reales en Apps Script `Script Properties`.
- Ejecutar `api=runMoodleExtraction` con credenciales reales y validar:
  - login Moodle;
  - participantes;
  - calificaciones;
  - actividades;
  - participacion estudiantil;
  - participacion tutorial;
  - escritura Sheets/Drive.
- Hacer una corrida real desde la app publica con `maxActivities` bajo y revisar las hojas crudas `GAS_*`.

### Riesgos

- Moodle puede cambiar la estructura HTML de tablas; por eso se guardan tablas crudas y errores.
- La extraccion de participacion puede tardar si se consultan demasiadas actividades; se agrego `Actividades max.`.

### Recomendaciones

- Configurar inicialmente `maxActivities=5` para la primera prueba real y luego subirlo gradualmente.
- No usar cuentas personales con permisos excesivos; crear o usar una cuenta Moodle institucional de consulta.

## 2026-06-11 16:10 - Credenciales Moodle por usuario y acumulacion historica

### Proyecto

- Nombre: Reporta Aula Moodle.
- Cliente o institucion: FACEN / Aula Moodle.
- Ruta local: `/tmp/reporta_aula_sheet_button`.
- Repositorio: `https://github.com/diegomezapy/reporta_aula_moodle.git`.
- URL publica: `https://diegomezapy.github.io/reporta_aula_moodle/`.
- Responsable: Codex.
- Version: `2026.06.11-user-credentials`.

### Objetivo de la intervencion

- Corregir el flujo para que cualquier usuario pueda cargar sus credenciales Moodle y ejecutar la extraccion.
- Evitar envio de contrasenas por JSONP, URL o archivos versionados.
- Acumular datos por corrida sin perder la ultima foto operativa del tablero.

### Diagnostico inicial

- La version anterior dependia de credenciales institucionales en `Script Properties`.
- El boton `Ver credenciales GAS` generaba confusion porque el usuario final necesitaba cargar sus propias credenciales antes de extraer.
- Las hojas principales `GAS_*` se sobrescribian para mostrar la ultima corrida, sin hojas historicas acumulativas.

### Acciones realizadas

- Se reviso el manual maestro en `MANUAL_MAESTRO_FORMATOS_FUNCIONES_APPWEB` para criterios de seguridad, GAS, auditoria, GitHub Pages y Moodle.
- Se agrego modulo GAS `Extractor.html` con formulario seguro embebible.
- Se agrego `view=extractor` en GAS para servir el modulo con `HtmlService` y `google.script.run`.
- Se modifico `runMoodleExtraction` para aceptar credenciales temporales por formulario y mantener `Script Properties` solo como alternativa institucional.
- Se bloqueo el uso de credenciales Moodle por URL en `api=runMoodleExtraction`.
- Se agregaron hojas historicas acumulativas:
  - `GAS_CORRIDAS_HISTORICO`;
  - `GAS_RESUMEN_HISTORICO`;
  - `GAS_PARTICIPANTES_HISTORICO`;
  - `GAS_CALIFICACIONES_HISTORICO`;
  - `GAS_ACTIVIDADES_HISTORICO`;
  - `GAS_PARTICIPACION_HISTORICO`;
  - `GAS_TUTORES_HISTORICO`.
- Se actualizo la app publica para embeber el modulo seguro y recibir el resultado por `postMessage`.
- Se actualizo `.clasp.json` para que `clasp push` use la carpeta versionada `gas/` y no una carpeta temporal vieja.
- Se actualizo documentacion de usuario, tecnica, README y diccionario de datos.

### Archivos modificados

- `.clasp.json`.
- `gas/.claspignore`.
- `gas/Code.gs`.
- `gas/Extractor.html`.
- `index.html`.
- `assets/pages-app.js`.
- `assets/pages-app.css`.
- `service-worker.js`.
- `README.md`.
- `docs/manual_usuario.md`.
- `docs/manual_tecnico.md`.
- `docs/diccionario_datos.md`.
- `BITACORA.md`.

### Comandos o scripts ejecutados

- `node --check assets/pages-app.js`.
- `node --input-type=commonjs --check - < gas/Code.gs`.
- `python3 -m compileall app tests`.
- `/Users/diegobernardomezabogado/reporta_aula_moodle/.venv/bin/python -m pytest`.
- `git diff --check`.
- `python3 -m http.server 8072`.
- `clasp push -f`.
- `clasp deploy -i AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA -d 'Reporta Aula Moodle user credentials extractor 20260611'`.
- `curl` contra `view=extractor`.
- `curl` contra `api=runMoodleExtraction` con credenciales simuladas por URL.
- `curl` contra `api=credentialStatus`.
- `curl` contra `api=runSample`.

### Resultados verificados

- Sintaxis JS correcta.
- Sintaxis GAS correcta.
- Compilacion Python correcta.
- Pruebas Python: 5 passed, 1 warning LibreSSL/urllib3.
- `git diff --check`: correcto.
- Servidor local `http://127.0.0.1:8072/` sirve assets `20260611-user-credentials`, panel `Carga segura Moodle` e iframe `gasExtractorFrame`.
- `gas/Extractor.html` local contiene `moodlePassword`, `google.script.run`, `runMoodleExtraction` y `postMessage`.
- `clasp push -f`: correcto, subio `appsscript.json`, `Code.gs`, `Extractor.html` e `Index.html`.
- Deployment GAS actualizado: `AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA @7`.
- `view=extractor`: sirve `Extraccion Moodle`, `GAS seguro`, campo `moodlePassword`, `google.script.run`, `runMoodleExtraction` y `postMessage`.
- `api=runMoodleExtraction` con credenciales por URL: rechaza con error controlado `No envie credenciales Moodle por URL`.
- `api=credentialStatus`: responde `configured:false` sin exponer secretos.
- `api=runSample`: permanece operativo.
- Commit funcional publicado: `98ad9e3 feat: habilitar credenciales moodle por usuario`.
- Ramas remotas actualizadas: `origin/diego` y `origin/main`.
- GitHub Pages verificado en `https://diegomezapy.github.io/reporta_aula_moodle/`:
  - HTML publico sirve assets `20260611-user-credentials`;
  - UI publica contiene `Carga segura Moodle`, `Abrir modulo` e iframe `gasExtractorFrame`;
  - UI publica ya no contiene boton `Ver credenciales GAS`;
  - JS publico contiene `APP_VERSION = "2026.06.11-user-credentials"`, `gasExtractorUrl`, `handleExtractorMessage` y `Panel seguro GAS`;
  - service worker publico contiene cache `reporta-aula-moodle-pages-v20260611-user-credentials`.

### Errores o incidentes

- Se confirmo que `POST` directo desde GitHub Pages hacia Apps Script redirige y no es confiable para credenciales de usuario.
- `clasp status` lista `.claspignore` como archivo local frente al proyecto GAS; no afecta el despliegue porque `clasp push -f` subio solo los 4 archivos GAS esperados.

### Soluciones aplicadas

- Credenciales por usuario dentro de modulo GAS embebido.
- Contrasena usada solo en memoria durante la corrida y limpiada del formulario al terminar.
- Auditoria con usuario Moodle enmascarado y sin contrasenas.
- Hojas historicas acumulativas por `run_id`.

### Pendientes

- Validar extraccion real con credenciales Moodle reales.

### Riesgos

- La extraccion real sigue dependiendo de la estructura HTML de Moodle.
- El formulario seguro requiere que el despliegue GAS mantenga permisos correctos de Sheets, Drive y UrlFetch.

### Recomendaciones

- Iniciar primera prueba real con `Actividades max.` entre 5 y 10.
- Mantener cuenta institucional solo para automatizaciones periodicas; para corridas manuales usar credenciales del usuario operador.
