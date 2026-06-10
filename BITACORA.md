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

