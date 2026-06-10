# Diccionario De Datos

## ReportPackage

| Campo | Descripcion |
| --- | --- |
| `run_id` | Identificador unico de corrida. |
| `generated_at` | Fecha y hora UTC de generacion. |
| `moodle_base_url` | URL base del Moodle consultado. |
| `course_id` | Id del curso Moodle. |
| `course_title` | Titulo visible del curso. |
| `participants` | Participantes con rol estudiante. |
| `grade_rows` | Filas del libro de calificaciones. |
| `activities` | Actividades detectadas en el curso. |
| `participation_rows` | Participacion estudiantil por actividad. |
| `tutor_participation_rows` | Participacion tutorial por actividad. |
| `summaries` | Resumen por estudiante. |
| `activity_summary` | Agregado de actividad estudiantil. |
| `tutor_activity_summary` | Agregado de actividad tutorial. |
| `tutor_summary` | KPIs agregados del tutor. |

## StudentSummary

| Campo | Descripcion |
| --- | --- |
| `actions_registered` | Total de acciones Moodle registradas. |
| `forum_posts` | Acciones relacionadas con foros o mensajes. |
| `grade_cells_with_value` | Celdas evaluativas con valor numerico. |
| `platform_level` | Nivel operativo de actividad en plataforma. |
| `evaluative_level` | Nivel de participacion evaluativa. |
| `desertion_probability` | Probabilidad heuristica entre 0 y 1. |
| `desertion_risk_level` | Bajo, Medio, Alto o Critico. |
| `desertion_risk_factors` | Factores que explican la priorizacion. |
| `tutor_activity_signal` | Senal agregada de acompanamiento tutorial. |

## Archivos Generados

| Archivo | Contenido |
| --- | --- |
| `reporte.json` | Paquete completo de la corrida. |
| `resumen_estudiantes.csv` | Resumen operativo por estudiante. |
| `riesgo_desercion.csv` | Priorizacion de riesgo. |
| `resumen_tutor.csv` | KPIs de tutoria. |
| `detalle_participacion.csv` | Participacion estudiantil por actividad. |
| `detalle_participacion_tutor.csv` | Participacion tutorial por actividad. |

