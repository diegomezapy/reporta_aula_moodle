# Manual Tecnico

## Stack

- FastAPI.
- Extraccion Moodle con `requests` y `BeautifulSoup`.
- Reportes locales en JSON, CSV y XLSX.
- Sincronizacion opcional con Google Sheets via Apps Script o service account.

## Archivos Locales No Versionados

- `data/runs/`: evidencias por corrida.
- `data/automation_config.json`: configuracion de scheduler.
- `data/access_log.jsonl`: registro de uso.
- `.env`: credenciales y secretos.

## Seguridad

Configure Basic Auth en produccion:

```bash
APP_USERNAME=admin
APP_PASSWORD=clave-larga
```

En la publicacion GitHub Pages las credenciales Moodle no se ingresan ni se almacenan en el navegador. Para GAS directo, deben cargarse en `Script Properties`:

```text
REPORTA_AULA_MOODLE_BASE_URL
REPORTA_AULA_MOODLE_USERNAME
REPORTA_AULA_MOODLE_PASSWORD
```

El backend GAS expone `api=credentialStatus` para verificar configuracion sin revelar la contrasena, y `api=runMoodleExtraction` para ejecutar la extraccion real. `api=runSample` queda como muestra anonima.

Las credenciales locales Python pueden ingresarse por formulario o por variables de entorno. No se escriben en reportes ni bitacoras.

## Automatizacion

El scheduler se ejecuta como hilo interno y revisa `data/automation_config.json` cada 30 segundos. Si la app esta desplegada en un servicio que duerme, use un cron externo contra `POST /api/runs`.

## Riesgo De Desercion

El riesgo se calcula en `app/bayesian.py` y `app/reporting.py` mediante una primera capa bayesiana auditable. El modelo usa odds y razones de verosimilitud definidas por criterio experto:

```text
odds posterior = odds prior * producto de razones de verosimilitud
```

El modelo tiene dos modalidades:

- `semester_*`: desercion durante el semestre, usando evidencia Moodle semanal, carga actual y acompanamiento tutorial.
- `career_*`: desercion en la carrera, usando trayectoria academica, avance, materias previas, estado de matricula, carga, beca, acompanamiento tutorial y senal del semestre.

Si existe una corrida previa completada del mismo curso, el posterior anterior de cada estudiante se usa como prior de la nueva semana para la modalidad semestre. Si no hay historial, se usa un prior conservador inicial. Los campos historicos `bayesian_*` y `desertion_*` se conservan como alias de `semester_*`.

Los factores quedan en `semester_desertion_risk_factors`, `career_desertion_risk_factors`, `bayesian_evidence_factors` y `desertion_risk_factors` para que el docente pueda revisar por que se priorizo a cada estudiante.

La probabilidad es una senal de seguimiento tutorial, no una decision automatica.

## Tablero Y Verificacion Visual

El frontend vive en `app/static/`. El tablero consume el payload compacto de `/api/reports/latest/dashboard` y recalcula KPIs, graficos y tablas desde los filtros globales del navegador.

La publicacion GitHub Pages vive en `index.html`, `assets/pages-app.js`, `assets/pages-app.css`, `manifest.json` y `service-worker.js`. Esa version consume GAS por JSONP y usa el mismo contrato de campos `semester_*`, `career_*`, identificadores de estudiantes y variables de tutores/profesores.

Componentes principales:

- `#kpiGrid`: KPIs generales filtrables.
- `#riskDonut`: dona del semaforo de riesgo.
- `#scatterPlot`: dispersion entre acciones Moodle y evaluaciones.
- `#modelKpis`: KPIs del modelo bayesiano.
- `#probabilityBands`: bandas de posterior.
- `#riskTable`: priorizacion por estudiante.
- `#evidenceTable`: evidencia bayesiana auditable.

Para QA visual local se pueden guardar capturas en `data/ui_checks/`, carpeta ignorada por Git.

## Pruebas

```bash
python -m compileall app tests
python -m pytest
node --check app/static/app.js
```
