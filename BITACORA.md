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

