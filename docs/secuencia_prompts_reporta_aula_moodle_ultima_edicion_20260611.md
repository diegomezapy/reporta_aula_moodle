# Secuencia de prompts - Reporta Aula Moodle

Proyecto: `FACEN_BIGDATA / reporta_aula_moodle`

Ultima fecha de edicion: 2026-06-11

Responsable operativo: Diego Gomez / FACEN Big Data

## Criterio de registro

Este archivo conserva la secuencia de pedidos que guiaron el trabajo del proyecto, para mantener trazabilidad tecnica y pedagogica. Las credenciales, tokens, contrasenas, enlaces privados temporales y codigos de acceso se omiten o se reemplazan por `[REDACTADO]`.

No debe usarse este archivo para guardar secretos. Los secretos deben permanecer en variables de entorno, gestores de secretos, archivos locales ignorados por Git o cuentas institucionales autorizadas.

## Secuencia cronologica consolidada

1. Buscar en la guia academica 2026-2 las fechas de inicio y fin de clases del segundo periodo 2026, parciales y finales de Analitica de Big Data.

2. Actualizar la guia didactica de la asignatura con las nuevas fechas del segundo periodo 2026, distribuyendo fechas de inicio de entrega de actividades por unidad para modalidad a distancia o virtual.

3. Ajustar las tutorias sincronicas a sabados de 10:00 a 11:30.

4. Actualizar materiales de cada unidad: orientaciones, descripcion de actividad 1, descripcion de actividad 2 y descripcion de actividad 3.

5. Guardar materiales actualizados en `G:\Mi unidad\FACEN_BIGDATA\BigData_Materiales_2026_2P`, incluyendo materiales de lectura de cada unidad.

6. Reconstruir materiales usando plantillas ubicadas en `G:\Mi unidad\FACEN_Software_Estadistico\Materiales_v2\recursos_comunes\plantillas`.

7. Corregir encabezados, pies de pagina y portada de guia didactica y materiales de lectura.

8. Mejorar completamente el material de lectura de la unidad 1.

9. Crear presentaciones PPT para cada unidad usando la plantilla de ejemplo.

10. Reconstruir los materiales de lectura de unidades 3 y 4 por baja calidad de contenido y presentacion.

11. Consultar fechas de examenes del primer periodo y mostrar tambien las fechas de modalidad presencial.

12. Explorar posibilidad de editar Google Calendar personal e instalar/conectar herramientas necesarias.

13. Cargar eventos de examenes parciales y finales de modalidad presencial y a distancia de Analitica de Big Data.

14. Agregar fechas del segundo periodo: inicio y fin de clases, clases sincronicas virtuales, clases presenciales y finales, distinguiendo modalidades.

15. Configurar enlaces de Google Meet en cada tutoria sabatina.

16. Evaluar programacion de correos a estudiantes un dia antes de cada fecha, con lista del aula virtual. Las credenciales indicadas por el usuario fueron tratadas como sensibles y no deben guardarse aqui.

17. Eliminar correos programados al detectarse que la lista actual pertenecia a otro periodo.

18. Verificar fechas de vencimiento/entrega de actividades configuradas en Moodle y modificar vencimientos para el 15 de agosto cuando fue solicitado.

19. Revisar si habia mensajes de foros o entregas de tareas pendientes de calificacion.

20. Crear bitacora de manejo de aula virtual Moodle y guardar copias en carpetas maestras de manuales/formatos.

21. Evaluar foros con escala 0 a 100, asignar 100% a mensajes pendientes y dejar comentario breve de agradecimiento por participacion.

22. Crear actividad necesaria para Unidad 4 cuando se detecto que no tenia preguntas cargadas.

23. Verificar y subir recursos de aprendizaje de Unidad 4 al aula, manteniendolos ocultos.

24. Generar reporte de participacion de estudiantes matriculados.

25. Enviar aviso en foro novedades y mensajes personalizados de desempeno a estudiantes afectados, previa revision del texto.

26. Actualizar la bitacora para automatizar revision semanal de participacion y envio de reportes.

27. Registrar en bitacora que no debe volver a copiarse el marcador tecnico `_qf__force_multiselect_submission` como si fuera texto visible del mensaje.

28. Evaluar proyecto estudiantil publicado en RPubs y devolver codigo completo con sugerencias, tablas y figuras mejoradas.

29. Revisar el primer parcial en el aula y proponer forma de evaluar el segundo parcial.

30. Crear en Moodle todo lo necesario para el segundo parcial, oculto hasta un dia antes, con envio programado de aviso a estudiantes.

31. Explorar un modelo bayesiano para estimar probabilidad de desercion con datos semanales de participacion Moodle.

32. Proponer titulo de articulo sobre el modelo de alerta/desercion.

33. Analizar por que habia pocos productos coincidentes en otro flujo de datos.

34. Revisar situacion actual del proyecto y concentrarse en el proyecto que extrae datos de aulas y calcula probabilidad de desercion.

35. Estudiar el repositorio `diegomezapy/reporta_aula_moodle` e integrar la propuesta bayesiana con la appweb, agregando tablero, graficas, tablas y KPIs.

36. Aplicar buenas practicas registradas en `G:\Mi unidad\MANUAL_MAESTRO_FORMATOS_FUNCIONES_APPWEB`.

37. Publicar cambios, completar commit y push.

38. Verificar si se implementaron las buenas practicas del manual maestro.

39. Corregir error `File not found` de GitHub Pages y explicar por que GitHub Pages no abria la app FastAPI directamente.

40. Intentar despliegue persistente de backend. Se preparo Render, pero la API Key de Render no estaba disponible; el token GitHub no servia para crear servicios Render.

41. Abrir una URL temporal de prueba mediante tunel HTTPS local y protegerla con Basic Auth. Las credenciales temporales se mantienen fuera de Git.

42. Aclarar que se necesitaba una muestra funcional para lograr ejecucion por GAS, y que luego el proyecto se transferira a una cuenta institucional.

43. Crear una demo GAS publica sin scopes sensibles en `gas_public_demo/`, desplegarla como Web App y verificarla anonimamente:
    - `/exec?api=1`: HTTP 200 JSON.
    - `/exec`: HTTP 200 HTML.

44. Documentar la separacion entre:
    - `gas_public_demo/`: muestra publica funcional sin Google Sheets.
    - `gas/`: base de integracion real con Google Sheets para cuenta institucional.

45. Guardar obligatoriamente esta secuencia de prompts en un archivo claramente identificado por proyecto y ultima fecha de edicion.

## Estado al 2026-06-11

- Muestra GAS publica funcional creada y verificada.
- GitHub Pages corregido para evitar `File not found`.
- Backend FastAPI preparado para hosting persistente, pero todavia depende de proveedor con secretos configurados.
- Tunel temporal usado solo como apoyo de prueba, no como despliegue productivo.
- Integracion real con Google Sheets queda pendiente para autorizacion y transferencia institucional.
