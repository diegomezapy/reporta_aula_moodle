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

