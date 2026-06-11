# Manual De Usuario

## Acceso

Abra la app y autentiquese si el administrador configuro `APP_USERNAME` y `APP_PASSWORD`.

## Tablero

La pantalla inicial muestra KPIs generales del aula, actividad en plataforma, participacion evaluativa, actividades con mayor evidencia, un semaforo de riesgo y una dispersion entre acciones Moodle y evaluaciones registradas.

Use la banda de filtros globales para buscar por nombre, correo, id Moodle, documento demo, carrera o tutor, y para limitar el tablero por riesgo, actividad en plataforma, participacion evaluativa o estudiantes con alerta. Los KPIs, graficos y tablas se recalculan con esos filtros.

El control `Modalidad` permite alternar entre:

- `Semestre`: probabilidad de desercion durante el semestre actual.
- `Carrera`: probabilidad de desercion en la carrera o programa academico.

## Riesgo

La vista `Riesgo` ordena estudiantes por probabilidad bayesiana de desercion segun la modalidad activa. El calculo `Semestre` usa actividad en plataforma, evaluaciones, foros, ultimo acceso, carga actual y acompanamiento tutorial. El calculo `Carrera` usa trayectoria academica, avance, materias previas, estado de matricula, carga, beca, senal tutorial y riesgo del semestre.

La vista incluye:

- KPIs del modelo: version, prior medio, posterior medio, maximo posterior y evidencias aplicadas.
- Distribucion por nivel de riesgo.
- Bandas de probabilidad.
- Priorizacion por estudiante.
- Tabla de evidencia bayesiana con prior, posterior y log LR.

Es una priorizacion de seguimiento, no una decision automatica.

## Estudiantes

Use busqueda y filtros para revisar estudiantes con alerta, riesgo alto, sin evidencia o sin evaluaciones. Al seleccionar una fila se abre el detalle individual con identificadores, trayectoria academica, actividad Moodle, tutor asignado y factores bayesianos de la modalidad activa.

## Tutoria

La vista `Tutoria` resume participacion del tutor/docente cuando Moodle permite extraer esos roles desde el informe de participacion. Tambien muestra tutores/profesores identificados, estudiantes asignados, rol, correo, acciones, respuestas, retroalimentacion, tiempo de respuesta y cobertura.

## Automatizacion

En `Automatizacion` puede activar corridas periodicas, definir intervalo, sincronizar con Google Sheets, incluir tutoria y ejecutar una corrida inmediata.

## Extraccion

La vista `Extraccion` separa dos acciones:

- `Generar extraccion Moodle`: usa GAS para iniciar sesion en Moodle con credenciales guardadas en `Script Properties`.
- `Generar muestra`: genera datos anonimizados para diagnostico cuando no se quiere tocar Moodle real.

Si `Credenciales Moodle` aparece como pendiente, el administrador debe configurar las propiedades `REPORTA_AULA_MOODLE_BASE_URL`, `REPORTA_AULA_MOODLE_USERNAME` y `REPORTA_AULA_MOODLE_PASSWORD` en Apps Script. La app publica no almacena ni muestra la contrasena.

## Auditoria

`Auditoria` muestra accesos recientes a la app. No registra contrasenas.
