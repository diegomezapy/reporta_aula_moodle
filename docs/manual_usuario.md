# Manual De Usuario

## Acceso

Abra la app y autentiquese si el administrador configuro `APP_USERNAME` y `APP_PASSWORD`.

## Tablero

La pantalla inicial muestra KPIs generales del aula, actividad en plataforma, participacion evaluativa, actividades con mayor evidencia, un semaforo de riesgo y una dispersion entre acciones Moodle y evaluaciones registradas.

Use la banda de filtros globales para buscar por nombre, correo o id Moodle, y para limitar el tablero por riesgo, actividad en plataforma, participacion evaluativa o estudiantes con alerta. Los KPIs, graficos y tablas se recalculan con esos filtros.

## Riesgo

La vista `Riesgo` ordena estudiantes por probabilidad bayesiana de desercion. El calculo usa actividad en plataforma, evaluaciones, foros, ultimo acceso, total del curso y senal agregada de acompanamiento tutorial.

La vista incluye:

- KPIs del modelo: version, prior medio, posterior medio, maximo posterior y evidencias aplicadas.
- Distribucion por nivel de riesgo.
- Bandas de probabilidad.
- Priorizacion por estudiante.
- Tabla de evidencia bayesiana con prior, posterior y log LR.

Es una priorizacion de seguimiento, no una decision automatica.

## Estudiantes

Use busqueda y filtros para revisar estudiantes con alerta, riesgo alto, sin evidencia o sin evaluaciones. Al seleccionar una fila se abre el detalle individual.

## Tutoria

La vista `Tutoria` resume participacion del tutor/docente cuando Moodle permite extraer esos roles desde el informe de participacion.

## Automatizacion

En `Automatizacion` puede activar corridas periodicas, definir intervalo, sincronizar con Google Sheets, incluir tutoria y ejecutar una corrida inmediata.

## Auditoria

`Auditoria` muestra accesos recientes a la app. No registra contrasenas.

