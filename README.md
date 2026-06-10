# Reporta Aula Moodle

App web para extraer evidencias de participacion y desempeno desde Moodle, generar archivos locales de auditoria y sincronizar resultados con una hoja de Google Sheets.

Hoja objetivo inicial:

`https://docs.google.com/spreadsheets/d/1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8/edit`

Proyecto GAS asociado:

`https://script.google.com/u/0/home/projects/1_wepzWMyJH-DgdhE3Wsu_Ci0QSikfhEcgWJipJdhXAjyYIfEq5up3hz-/edit`

## Que Extrae

- Participantes del aula con rol estudiante.
- Ultimo acceso disponible en Moodle.
- Libro de calificaciones.
- Actividades detectadas en el curso.
- Informe nativo de participacion por actividad.
- Resumen por estudiante con indicadores separados de actividad en plataforma y participacion evaluativa.

## Ejecucion Local

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Luego abrir `http://127.0.0.1:8000`.

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

1. Abrir el proyecto GAS vinculado.
2. Reemplazar o agregar el contenido de `gas/Code.gs`.
3. Ejecutar una vez en el editor:

```javascript
setReportaAulaSecret('un-token-largo-y-privado')
```

4. Desplegar como Web App.
5. Configurar en `.env`:

```bash
GAS_WEBAPP_URL=https://script.google.com/macros/s/XXXXX/exec
GAS_SHARED_SECRET=un-token-largo-y-privado
```

La app enviara las hojas `Corrida`, `Resumen`, `Matriculados`, `Calificaciones`, `Actividades`, `Resumen actividades` y `Detalle participacion`.

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
- `matriculados.csv`
- `calificaciones.csv`
- `actividades.csv`
- `resumen_actividades.csv`
- `detalle_participacion.csv`
- `status.json`

## Despliegue Sugerido

La app puede desplegarse en Render, Railway, Fly.io, VPS o cualquier servicio que ejecute FastAPI con variables de entorno. En produccion, usar HTTPS y credenciales desde secretos del proveedor.

Comando:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Corrida Automatica

Para ejecutar una corrida programada desde el servidor, cargar credenciales Moodle por variables de entorno y activar:

```bash
AUTO_RUN_ENABLED=true
AUTO_RUN_INTERVAL_MINUTES=10080
```

`10080` equivale a una corrida semanal. La programacion integrada sirve para despliegues persistentes; en servicios que duermen conviene usar un cron externo que llame `POST /api/runs`.

