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

Las credenciales Moodle pueden ingresarse por formulario o por variables de entorno. No se escriben en reportes ni bitacoras.

## Automatizacion

El scheduler se ejecuta como hilo interno y revisa `data/automation_config.json` cada 30 segundos. Si la app esta desplegada en un servicio que duerme, use un cron externo contra `POST /api/runs`.

## Riesgo De Desercion

El riesgo se calcula en `app/reporting.py` mediante reglas heuristicas auditables. Los factores quedan en `desertion_risk_factors` para que el docente pueda revisar por que se priorizo a cada estudiante.

## Pruebas

```bash
python -m compileall app tests
python -m pytest
node --check app/static/app.js
```

