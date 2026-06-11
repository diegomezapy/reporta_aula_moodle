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
| `tutor_profiles` | Listado agregado de tutores/profesores identificados en la corrida. |

## StudentSummary

| Campo | Descripcion |
| --- | --- |
| `student_moodle_id` | Identificador Moodle del estudiante; en demo se usa un ID anonimizado. |
| `student_document_id` | Identificador institucional/documental; en demo se usa un valor ficticio. |
| `cohort` | Cohorte academica del estudiante. |
| `career` | Carrera o programa academico. |
| `semester_number` | Semestre academico de referencia. |
| `enrollment_status` | Estado operativo de matricula. |
| `academic_load` | Cantidad/carga academica actual usada como variable del modelo. |
| `failed_previous_subjects` | Materias previas no aprobadas o pendientes. |
| `program_progress_percent` | Avance porcentual de la carrera. |
| `scholarship_status` | Senal academica/administrativa de beca, si existe. |
| `work_shift` | Turno o condicion horaria declarada. |
| `tutor_id` | Identificador del tutor/profesor asignado. |
| `tutor_name` | Nombre del tutor/profesor asignado. |
| `tutor_email` | Correo del tutor/profesor asignado. |
| `tutor_role` | Rol Moodle o academico del tutor/profesor. |
| `tutor_actions_registered` | Acciones del tutor vinculadas al seguimiento del estudiante. |
| `tutor_forum_replies` | Respuestas o mensajes del tutor/profesor. |
| `tutor_feedback_count` | Retroalimentaciones registradas. |
| `tutor_response_hours` | Tiempo promedio de respuesta estimado en horas. |
| `tutor_activity_coverage` | Cobertura tutorial entre 0 y 1. |
| `tutor_followup_signal` | Senal cualitativa de acompanamiento: Alta, Media, Bajo o Sin dato. |
| `actions_registered` | Total de acciones Moodle registradas. |
| `forum_posts` | Acciones relacionadas con foros o mensajes. |
| `grade_cells_with_value` | Celdas evaluativas con valor numerico. |
| `platform_level` | Nivel operativo de actividad en plataforma. |
| `evaluative_level` | Nivel de participacion evaluativa. |
| `risk_model_version` | Version del modelo de riesgo aplicado. |
| `heuristic_probability` | Probabilidad heuristica de referencia, conservada para comparacion. |
| `semester_bayesian_prior_probability` | Prior de desercion durante el semestre. |
| `semester_bayesian_posterior_probability` | Posterior bayesiano de desercion durante el semestre. |
| `semester_bayesian_log_likelihood_ratio` | Log LR aplicado para la modalidad semestre. |
| `semester_desertion_probability` | Probabilidad operativa de desercion durante el semestre. |
| `semester_desertion_risk_level` | Nivel Bajo, Medio, Alto o Critico para semestre. |
| `semester_desertion_risk_factors` | Evidencias usadas para la modalidad semestre. |
| `career_bayesian_prior_probability` | Prior de desercion en la carrera. |
| `career_bayesian_posterior_probability` | Posterior bayesiano de desercion en la carrera. |
| `career_bayesian_log_likelihood_ratio` | Log LR aplicado para la modalidad carrera. |
| `career_desertion_probability` | Probabilidad operativa de desercion en la carrera. |
| `career_desertion_risk_level` | Nivel Bajo, Medio, Alto o Critico para carrera. |
| `career_desertion_risk_factors` | Evidencias usadas para la modalidad carrera. |
| `bayesian_prior_probability` | Prior usado para la corrida actual. |
| `bayesian_posterior_probability` | Posterior bayesiano estimado con la evidencia de la corrida. |
| `bayesian_log_likelihood_ratio` | Suma logaritmica de razones de verosimilitud aplicadas. |
| `bayesian_evidence_factors` | Evidencias que actualizaron el prior. |
| `desertion_probability` | Alias historico de `semester_desertion_probability`. |
| `desertion_risk_level` | Alias historico del nivel de riesgo durante el semestre. |
| `desertion_risk_factors` | Alias historico de factores de la modalidad semestre. |
| `tutor_activity_signal` | Senal agregada de acompanamiento tutorial. |

## TutorProfile

| Campo | Descripcion |
| --- | --- |
| `tutor_id` | Identificador del tutor/profesor. |
| `tutor_name` | Nombre visible del tutor/profesor. |
| `tutor_email` | Correo institucional o Moodle. |
| `tutor_role` | Rol academico o Moodle. |
| `assigned_students` | Estudiantes vinculados al tutor en la corrida. |
| `tutor_actions_registered` | Acciones tutoriales registradas. |
| `tutor_forum_replies` | Respuestas o mensajes registrados. |
| `tutor_feedback_count` | Retroalimentaciones registradas. |
| `tutor_response_hours` | Tiempo promedio de respuesta en horas. |
| `tutor_activity_coverage` | Cobertura tutorial promedio. |
| `tutor_followup_signal` | Senal cualitativa de acompanamiento. |

## Archivos Generados

| Archivo | Contenido |
| --- | --- |
| `reporte.json` | Paquete completo de la corrida. |
| `resumen_estudiantes.csv` | Resumen operativo por estudiante. |
| `riesgo_desercion.csv` | Priorizacion de riesgo. |
| `resumen_tutor.csv` | KPIs de tutoria. |
| `detalle_participacion.csv` | Participacion estudiantil por actividad. |
| `detalle_participacion_tutor.csv` | Participacion tutorial por actividad. |
