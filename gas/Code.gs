const DEFAULT_SPREADSHEET_ID = '1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8';
const SECRET_PROPERTY = 'REPORTA_AULA_SECRET';
const DRIVE_FOLDER_PROPERTY = 'REPORTA_AULA_DRIVE_FOLDER_ID';
const DEFAULT_DRIVE_FOLDER_NAME = 'Reporta Aula Moodle Evidencias';
const SAMPLE_MODEL_VERSION = 'gas_demo_bayes_v0.2_dual_desertion';

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.api === 'report') {
    return jsonOrJsonp_(getLatestGasSample(), params.callback);
  }

  if (params.api === 'runSample') {
    return jsonOrJsonp_(runGasSample(params), params.callback);
  }

  if (params.api === '1' || params.format === 'json') {
    return jsonOrJsonp_({
      ok: true,
      app: 'Reporta Aula Moodle GAS Demo',
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      driveFolderId: getDriveFolderId_(),
      driveFolderUrl: getDriveFolderUrl_(),
      mode: 'gas-webapp',
    }, params.callback);
  }

  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Reporta Aula Moodle')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (payload.action === 'runGasSample') {
      return json_(runGasSample(payload.form || {}));
    }

    validateSecret_(payload.secret || '');
    const spreadsheetId = payload.spreadsheetId || DEFAULT_SPREADSHEET_ID;
    const ss = SpreadsheetApp.openById(spreadsheetId);

    writeRunMetadata_(ss, payload.run || {});
    (payload.sheets || []).forEach((sheetPayload) => {
      writeValues_(ss, sheetPayload.name, sheetPayload.values || []);
    });
    const evidence = saveEvidenceFile_(payload.run || {}, payload, 'sync_payload');
    appendEvidence_(ss, payload.run || {}, evidence);

    return json_({
      ok: true,
      spreadsheetId,
      driveFolderId: evidence.folder_id,
      driveFolderUrl: evidence.folder_url,
      evidence,
      sheets: (payload.sheets || []).map((item) => item.name),
    });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function runGasSample(form) {
  const startedAt = new Date();
  const spreadsheetId = (form && form.spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  const courseId = Number((form && form.courseId) || 1718);
  const courseTitle = (form && form.courseTitle) || 'Analitica de Big Data - Muestra GAS';
  const report = buildDemoReport_(courseId, courseTitle);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  setupGasSampleWorkbook_(ss);
  const evidence = saveEvidenceFile_(report, { report }, 'gas_sample');
  writeGasSample_(ss, report, evidence);
  appendEvidence_(ss, report, evidence);
  appendAudit_(ss, 'runGasSample', 'Muestra funcional GAS ejecutada', startedAt);
  return {
    ok: true,
    report,
    spreadsheetId,
    driveFolderId: evidence.folder_id,
    driveFolderUrl: evidence.folder_url,
    evidence,
    generatedAt: report.generated_at,
    elapsedMs: new Date().getTime() - startedAt.getTime(),
  };
}

function getLatestGasSample() {
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('GAS_RESUMEN');
  if (!sheet || sheet.getLastRow() < 2) {
    return runGasSample({
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      courseId: 1718,
      courseTitle: 'Analitica de Big Data - Muestra GAS inicial',
    });
  }
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map((row) => objectFromRow_(headers, row));
  return {
    ok: true,
    report: {
      course_title: 'Analitica de Big Data - Muestra GAS',
      generated_at: new Date().toISOString(),
      summaries: rows,
      kpis: buildKpis_(rows),
      spreadsheet_id: DEFAULT_SPREADSHEET_ID,
      drive_folder_id: getDriveFolderId_(),
      drive_folder_url: getDriveFolderUrl_(),
      evidence_files: latestEvidence_(ss),
    },
  };
}

function setupGasSampleWorkbook() {
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  setupGasSampleWorkbook_(ss);
  return { ok: true, spreadsheetId: DEFAULT_SPREADSHEET_ID };
}

function setReportaAulaSecret(secret) {
  PropertiesService.getScriptProperties().setProperty(SECRET_PROPERTY, secret);
}

function setReportaAulaDriveFolderId(folderId) {
  PropertiesService.getScriptProperties().setProperty(DRIVE_FOLDER_PROPERTY, folderId);
  return { ok: true, driveFolderId: folderId, driveFolderUrl: getDriveFolderUrl_() };
}

function initializeReportaAulaWorkbook() {
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  ensureSheetWithHeaders_(ss, 'CONFIG', ['clave', 'valor', 'actualizado_en']);
  ensureSheetWithHeaders_(ss, 'USUARIOS', ['usuario', 'password_hash', 'nombre', 'correo', 'rol', 'activo', 'fecha_creacion', 'ultimo_acceso', 'observacion']);
  ensureSheetWithHeaders_(ss, 'AUDITORIA', ['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
  ensureSheetWithHeaders_(ss, 'ERRORES', ['timestamp', 'usuario', 'accion', 'error', 'detalle']);
  setupGasSampleWorkbook_(ss);
  return json_({
    ok: true,
    initialized: ['CONFIG', 'USUARIOS', 'AUDITORIA', 'ERRORES', 'GAS_RESUMEN', 'GAS_RIESGO', 'GAS_EVIDENCIAS'],
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    driveFolderId: getDriveFolderId_(),
    driveFolderUrl: getDriveFolderUrl_(),
  });
}

function setupGasSampleWorkbook_(ss) {
  ensureSheetWithHeaders_(ss, 'GAS_RESUMEN', [
    'user_id',
    'student_moodle_id',
    'student_document_id',
    'name',
    'email',
    'cohort',
    'career',
    'semester_number',
    'enrollment_status',
    'academic_load',
    'failed_previous_subjects',
    'program_progress_percent',
    'scholarship_status',
    'work_shift',
    'tutor_id',
    'tutor_name',
    'tutor_email',
    'tutor_role',
    'tutor_actions_registered',
    'tutor_forum_replies',
    'tutor_feedback_count',
    'tutor_response_hours',
    'tutor_activity_coverage',
    'tutor_followup_signal',
    'actions_registered',
    'forum_posts',
    'grade_cells_with_value',
    'days_since_last_access',
    'last_access_text',
    'platform_level',
    'evaluative_level',
    'semester_bayesian_prior_probability',
    'semester_bayesian_posterior_probability',
    'semester_bayesian_log_likelihood_ratio',
    'semester_desertion_probability',
    'semester_desertion_risk_level',
    'semester_desertion_risk_factors',
    'career_bayesian_prior_probability',
    'career_bayesian_posterior_probability',
    'career_bayesian_log_likelihood_ratio',
    'career_desertion_probability',
    'career_desertion_risk_level',
    'career_desertion_risk_factors',
    'bayesian_prior_probability',
    'bayesian_posterior_probability',
    'bayesian_log_likelihood_ratio',
    'risk_model_version',
    'desertion_risk_level',
    'desertion_risk_factors',
    'follow_up_alert',
  ]);
  ensureSheetWithHeaders_(ss, 'GAS_RIESGO', ['modalidad', 'nivel', 'cantidad']);
  ensureSheetWithHeaders_(ss, 'GAS_AUDITORIA', ['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
  ensureSheetWithHeaders_(ss, 'GAS_EVIDENCIAS', ['timestamp', 'run_id', 'tipo', 'archivo', 'url', 'folder_id', 'folder_url']);
}

function buildDemoReport_(courseId, courseTitle) {
  const base = [
    demoStudent_('demo-01', 'Estudiante 01', 6, 1, 1, 3, 1, 0, 18, 12, 4, 1.0, 'Alta'),
    demoStudent_('demo-02', 'Estudiante 02', 11, 3, 3, 7, 2, 0, 32, 9, 5, 0.88, 'Alta'),
    demoStudent_('demo-03', 'Estudiante 03', 5, 2, 1, 32, 3, 1, 38, 5, 2, 0.63, 'Media'),
    demoStudent_('demo-04', 'Estudiante 04', 0, 0, 0, 72, 5, 4, 36, 1, 0, 0.22, 'Bajo'),
    demoStudent_('demo-05', 'Estudiante 05', 6, 1, 1, 49, 4, 2, 42, 3, 1, 0.43, 'Media'),
    demoStudent_('demo-06', 'Estudiante 06', 2, 0, 0, 82, 6, 5, 44, 1, 0, 0.18, 'Bajo'),
    demoStudent_('demo-07', 'Estudiante 07', 17, 3, 3, 3, 2, 0, 36, 10, 5, 0.92, 'Alta'),
    demoStudent_('demo-08', 'Estudiante 08', 6, 0, 0, 66, 5, 3, 47, 2, 0, 0.34, 'Bajo'),
    demoStudent_('demo-09', 'Estudiante 09', 20, 2, 2, 7, 3, 0, 54, 8, 4, 0.76, 'Alta'),
    demoStudent_('demo-10', 'Estudiante 10', 10, 2, 0, 1, 1, 1, 16, 6, 2, 0.58, 'Media'),
    demoStudent_('demo-11', 'Estudiante 11', 1, 0, 0, 64, 7, 4, 52, 1, 0, 0.25, 'Bajo'),
    demoStudent_('demo-12', 'Estudiante 12', 2, 0, 0, 57, 4, 2, 31, 2, 0, 0.3, 'Bajo'),
    demoStudent_('demo-13', 'Estudiante 13', 15, 1, 1, 15, 2, 0, 40, 7, 3, 0.78, 'Alta'),
    demoStudent_('demo-14', 'Estudiante 14', 18, 3, 3, 0, 1, 0, 20, 12, 6, 1.0, 'Alta'),
    demoStudent_('demo-15', 'Estudiante 15', 23, 5, 3, 2, 3, 0, 58, 13, 6, 0.94, 'Alta'),
    demoStudent_('demo-16', 'Estudiante 16', 13, 2, 2, 50, 6, 2, 62, 4, 2, 0.52, 'Media'),
    demoStudent_('demo-17', 'Estudiante 17', 10, 0, 0, 68, 7, 5, 48, 2, 0, 0.27, 'Bajo'),
    demoStudent_('demo-18', 'Estudiante 18', 7, 1, 1, 67, 5, 3, 45, 3, 1, 0.38, 'Media'),
    demoStudent_('demo-19', 'Estudiante 19', 16, 3, 1, 3, 2, 0, 34, 8, 4, 0.84, 'Alta'),
    demoStudent_('demo-20', 'Estudiante 20', 0, 0, 0, 88, 8, 6, 51, 0, 0, 0.14, 'Bajo'),
  ];

  const summaries = base.map((item) => buildStudentSummary_(item));
  const tutorProfiles = buildTutorProfiles_(summaries);
  return {
    run_id: 'gas-demo-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    generated_at: new Date().toISOString(),
    course_id: courseId,
    course_title: courseTitle,
    model_version: SAMPLE_MODEL_VERSION,
    summaries,
    tutor_profiles: tutorProfiles,
    tutor_summary: buildTutorSummary_(summaries, tutorProfiles),
    tutor_activity_summary: buildTutorActivitySummary_(summaries),
    kpis: buildKpis_(summaries),
  };
}

function buildStudentSummary_(item) {
  const actions = Number(item.actions_registered || 0);
  const forums = Number(item.forum_posts || 0);
  const grades = Number(item.grade_cells_with_value || 0);
  const days = Number(item.days_since_last_access || 0);
  const semesterRisk = estimateSemesterRisk_(item);
  const careerRisk = estimateCareerRisk_(item, semesterRisk.posterior_probability);

  return {
    user_id: item.user_id,
    student_moodle_id: item.student_moodle_id,
    student_document_id: item.student_document_id,
    name: item.name,
    email: item.email,
    cohort: item.cohort,
    career: item.career,
    semester_number: item.semester_number,
    enrollment_status: item.enrollment_status,
    academic_load: item.academic_load,
    failed_previous_subjects: item.failed_previous_subjects,
    program_progress_percent: item.program_progress_percent,
    scholarship_status: item.scholarship_status,
    work_shift: item.work_shift,
    tutor_id: item.tutor_id,
    tutor_name: item.tutor_name,
    tutor_email: item.tutor_email,
    tutor_role: item.tutor_role,
    tutor_actions_registered: item.tutor_actions_registered,
    tutor_forum_replies: item.tutor_forum_replies,
    tutor_feedback_count: item.tutor_feedback_count,
    tutor_response_hours: item.tutor_response_hours,
    tutor_activity_coverage: item.tutor_activity_coverage,
    tutor_followup_signal: item.tutor_followup_signal,
    actions_registered: actions,
    forum_posts: forums,
    grade_cells_with_value: grades,
    days_since_last_access: days,
    last_access_text: days <= 1 ? 'Ultimo dia' : days + ' dias',
    platform_level: platformLevel_(actions),
    evaluative_level: evaluativeLevel_(grades),
    semester_bayesian_prior_probability: semesterRisk.prior_probability,
    semester_bayesian_posterior_probability: semesterRisk.posterior_probability,
    semester_bayesian_log_likelihood_ratio: semesterRisk.log_likelihood_ratio,
    semester_desertion_probability: semesterRisk.posterior_probability,
    semester_desertion_risk_level: riskLevel_(semesterRisk.posterior_probability),
    semester_desertion_risk_factors: semesterRisk.evidence_factors.join('; '),
    career_bayesian_prior_probability: careerRisk.prior_probability,
    career_bayesian_posterior_probability: careerRisk.posterior_probability,
    career_bayesian_log_likelihood_ratio: careerRisk.log_likelihood_ratio,
    career_desertion_probability: careerRisk.posterior_probability,
    career_desertion_risk_level: riskLevel_(careerRisk.posterior_probability),
    career_desertion_risk_factors: careerRisk.evidence_factors.join('; '),
    bayesian_prior_probability: semesterRisk.prior_probability,
    bayesian_posterior_probability: semesterRisk.posterior_probability,
    bayesian_log_likelihood_ratio: semesterRisk.log_likelihood_ratio,
    risk_model_version: SAMPLE_MODEL_VERSION,
    desertion_risk_level: riskLevel_(semesterRisk.posterior_probability),
    desertion_risk_factors: semesterRisk.evidence_factors.join('; '),
    follow_up_alert: semesterRisk.posterior_probability >= 0.5 || careerRisk.posterior_probability >= 0.5,
  };
}

function buildKpis_(summaries) {
  const total = summaries.length;
  const alerts = summaries.filter((row) => row.follow_up_alert === true || row.follow_up_alert === 'TRUE').length;
  const avgSemesterRisk = total ? summaries.reduce((sum, row) => sum + Number(row.semester_desertion_probability || row.desertion_probability || 0), 0) / total : 0;
  const avgCareerRisk = total ? summaries.reduce((sum, row) => sum + Number(row.career_desertion_probability || 0), 0) / total : 0;
  const actions = summaries.reduce((sum, row) => sum + Number(row.actions_registered || 0), 0);
  const forums = summaries.reduce((sum, row) => sum + Number(row.forum_posts || 0), 0);
  const semesterRisk = summaries.reduce((acc, row) => {
    const level = row.semester_desertion_risk_level || row.desertion_risk_level || 'Sin dato';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  const careerRisk = summaries.reduce((acc, row) => {
    const level = row.career_desertion_risk_level || 'Sin dato';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  return {
    total_students: total,
    alerts,
    average_risk: round_(avgSemesterRisk),
    average_semester_risk: round_(avgSemesterRisk),
    average_career_risk: round_(avgCareerRisk),
    actions,
    forums,
    risk: semesterRisk,
    semester_risk: semesterRisk,
    career_risk: careerRisk,
  };
}

function writeGasSample_(ss, report, evidence) {
  const summaryHeaders = [
    'user_id',
    'student_moodle_id',
    'student_document_id',
    'name',
    'email',
    'cohort',
    'career',
    'semester_number',
    'enrollment_status',
    'academic_load',
    'failed_previous_subjects',
    'program_progress_percent',
    'scholarship_status',
    'work_shift',
    'tutor_id',
    'tutor_name',
    'tutor_email',
    'tutor_role',
    'tutor_actions_registered',
    'tutor_forum_replies',
    'tutor_feedback_count',
    'tutor_response_hours',
    'tutor_activity_coverage',
    'tutor_followup_signal',
    'actions_registered',
    'forum_posts',
    'grade_cells_with_value',
    'days_since_last_access',
    'last_access_text',
    'platform_level',
    'evaluative_level',
    'semester_bayesian_prior_probability',
    'semester_bayesian_posterior_probability',
    'semester_bayesian_log_likelihood_ratio',
    'semester_desertion_probability',
    'semester_desertion_risk_level',
    'semester_desertion_risk_factors',
    'career_bayesian_prior_probability',
    'career_bayesian_posterior_probability',
    'career_bayesian_log_likelihood_ratio',
    'career_desertion_probability',
    'career_desertion_risk_level',
    'career_desertion_risk_factors',
    'bayesian_prior_probability',
    'bayesian_posterior_probability',
    'bayesian_log_likelihood_ratio',
    'risk_model_version',
    'desertion_risk_level',
    'desertion_risk_factors',
    'follow_up_alert',
  ];
  const summaryValues = [summaryHeaders].concat(report.summaries.map((row) => summaryHeaders.map((key) => row[key])));
  writeValues_(ss, 'GAS_RESUMEN', summaryValues);
  const riskValues = [['modalidad', 'nivel', 'cantidad']]
    .concat(Object.keys(report.kpis.semester_risk).map((key) => ['semestre', key, report.kpis.semester_risk[key]]))
    .concat(Object.keys(report.kpis.career_risk).map((key) => ['carrera', key, report.kpis.career_risk[key]]));
  writeValues_(ss, 'GAS_RIESGO', riskValues);
  writeValues_(ss, 'GAS_CORRIDA', [
    ['Campo', 'Valor'],
    ['run_id', report.run_id],
    ['generated_at', report.generated_at],
    ['course_id', report.course_id],
    ['course_title', report.course_title],
    ['model_version', report.model_version],
    ['spreadsheet_id', DEFAULT_SPREADSHEET_ID],
    ['drive_folder_id', evidence && evidence.folder_id ? evidence.folder_id : ''],
    ['drive_folder_url', evidence && evidence.folder_url ? evidence.folder_url : ''],
    ['evidence_file', evidence && evidence.file_url ? evidence.file_url : ''],
  ]);
}

function demoStudent_(id, name, actions, forums, grades, days, semester, failed, progress, tutorActions, tutorFeedback, coverage, followupSignal) {
  const index = Number(String(id).replace(/\D/g, '')) || 1;
  const tutorIndex = ((index - 1) % 3) + 1;
  return {
    user_id: id,
    student_moodle_id: 'MOODLE-STU-' + pad2_(index),
    student_document_id: 'DOC-DEMO-' + pad2_(index),
    name,
    email: 'estudiante' + pad2_(index) + '@example.invalid',
    cohort: semester <= 2 ? '2026' : semester <= 5 ? '2025' : '2024',
    career: index % 2 === 0 ? 'Licenciatura en Ciencia de Datos' : 'Analitica de Big Data',
    semester_number: semester,
    enrollment_status: days >= 80 || failed >= 5 ? 'Revision academica' : 'Regular',
    academic_load: actions === 0 ? 1 : Math.max(1, Math.min(5, grades + 2)),
    failed_previous_subjects: failed,
    program_progress_percent: progress,
    scholarship_status: index % 4 === 0 ? 'Beca activa' : 'Sin beca registrada',
    work_shift: index % 3 === 0 ? 'Nocturno' : 'Diurno',
    tutor_id: 'TUT-DEMO-' + pad2_(tutorIndex),
    tutor_name: 'Docente Tutor ' + pad2_(tutorIndex),
    tutor_email: 'tutor' + pad2_(tutorIndex) + '@example.invalid',
    tutor_role: tutorIndex === 1 ? 'Docente responsable' : 'Tutor academico',
    tutor_actions_registered: tutorActions,
    tutor_forum_replies: Math.max(0, Math.round(tutorActions / 4)),
    tutor_feedback_count: tutorFeedback,
    tutor_response_hours: followupSignal === 'Alta' ? 18 : followupSignal === 'Media' ? 42 : 96,
    tutor_activity_coverage: coverage,
    tutor_followup_signal: followupSignal,
    actions_registered: actions,
    forum_posts: forums,
    grade_cells_with_value: grades,
    days_since_last_access: days,
  };
}

function estimateSemesterRisk_(item) {
  const actions = Number(item.actions_registered || 0);
  const forums = Number(item.forum_posts || 0);
  const grades = Number(item.grade_cells_with_value || 0);
  const days = Number(item.days_since_last_access || 0);
  const evidence = [];

  if (days >= 45) addEvidence_(evidence, 2.3, 'Ultimo acceso mayor o igual a 45 dias');
  else if (days <= 7) addEvidence_(evidence, 0.55, 'Acceso reciente al aula');

  if (actions === 0) addEvidence_(evidence, 2.8, 'Sin actividad en plataforma');
  else if (actions < 5) addEvidence_(evidence, 1.7, 'Baja actividad en plataforma');
  else if (actions >= 15) addEvidence_(evidence, 0.55, 'Alta actividad en plataforma');

  if (grades === 0) addEvidence_(evidence, 2.4, 'Sin evaluaciones registradas');
  else if (grades >= 3) addEvidence_(evidence, 0.55, 'Evaluaciones registradas');

  if (forums === 0) addEvidence_(evidence, 1.35, 'Sin participacion registrada en foros');
  else if (forums >= 3) addEvidence_(evidence, 0.65, 'Participacion frecuente en foros');

  if (Number(item.academic_load || 0) <= 1) addEvidence_(evidence, 1.25, 'Carga academica actual muy baja');
  if (Number(item.tutor_feedback_count || 0) === 0) addEvidence_(evidence, 1.4, 'Sin retroalimentacion tutorial registrada');
  if (Number(item.tutor_response_hours || 0) >= 72) addEvidence_(evidence, 1.45, 'Respuesta tutorial mayor o igual a 72 horas');
  if (Number(item.tutor_activity_coverage || 0) < 0.35) addEvidence_(evidence, 1.35, 'Cobertura tutorial baja');
  else if (Number(item.tutor_activity_coverage || 0) >= 0.75) addEvidence_(evidence, 0.78, 'Cobertura tutorial amplia');

  return bayesianFromEvidence_(0.22, evidence);
}

function estimateCareerRisk_(item, semesterPosterior) {
  const semester = Number(item.semester_number || 0);
  const failed = Number(item.failed_previous_subjects || 0);
  const progress = Number(item.program_progress_percent || 0);
  const load = Number(item.academic_load || 0);
  const evidence = [];

  if (failed >= 4) addEvidence_(evidence, 2.4, 'Cuatro o mas materias previas no aprobadas');
  else if (failed >= 2) addEvidence_(evidence, 1.6, 'Dos o mas materias previas no aprobadas');
  else if (failed === 0) addEvidence_(evidence, 0.75, 'Sin materias previas no aprobadas');

  if (semester >= 6 && progress < 55) addEvidence_(evidence, 2.1, 'Avance de carrera bajo para el semestre cursado');
  else if (semester >= 4 && progress < 35) addEvidence_(evidence, 1.75, 'Avance acumulado rezagado');
  else if (progress >= 60) addEvidence_(evidence, 0.78, 'Avance de carrera consistente');

  if (load <= 1) addEvidence_(evidence, 1.7, 'Carga academica reducida');
  else if (load >= 4) addEvidence_(evidence, 0.85, 'Carga academica activa');

  if (item.enrollment_status !== 'Regular') addEvidence_(evidence, 2.0, 'Estado de matricula requiere revision academica');
  if (item.scholarship_status === 'Beca activa') addEvidence_(evidence, 0.85, 'Beca activa registrada');
  if (item.tutor_followup_signal === 'Bajo') addEvidence_(evidence, 1.35, 'Acompanamiento tutorial bajo');
  else if (item.tutor_followup_signal === 'Alta') addEvidence_(evidence, 0.85, 'Acompanamiento tutorial alto');

  if (semesterPosterior >= 0.7) addEvidence_(evidence, 1.5, 'Riesgo alto durante el semestre actual');
  else if (semesterPosterior < 0.3) addEvidence_(evidence, 0.85, 'Riesgo bajo durante el semestre actual');

  return bayesianFromEvidence_(0.16, evidence);
}

function addEvidence_(evidence, likelihoodRatio, label) {
  evidence.push({ likelihood_ratio: likelihoodRatio, label });
}

function bayesianFromEvidence_(prior, evidence) {
  const likelihood = evidence.reduce((acc, item) => acc * Number(item.likelihood_ratio || 1), 1);
  const priorOdds = prior / (1 - prior);
  const posteriorOdds = priorOdds * likelihood;
  const posterior = posteriorOdds / (1 + posteriorOdds);
  return {
    prior_probability: round_(prior),
    posterior_probability: round_(Math.max(0.02, Math.min(0.98, posterior))),
    log_likelihood_ratio: round_(Math.log(likelihood || 1)),
    evidence_factors: evidence.map((item) => item.label),
  };
}

function buildTutorProfiles_(summaries) {
  const byTutor = {};
  summaries.forEach((row) => {
    const id = row.tutor_id || 'SIN-TUTOR';
    if (!byTutor[id]) {
      byTutor[id] = {
        tutor_id: id,
        tutor_name: row.tutor_name || 'Tutor sin dato',
        tutor_email: row.tutor_email || '',
        tutor_role: row.tutor_role || 'Tutor',
        assigned_students: 0,
        tutor_actions_registered: 0,
        tutor_forum_replies: 0,
        tutor_feedback_count: 0,
        tutor_response_hours: 0,
        tutor_activity_coverage: 0,
        tutor_followup_signal: row.tutor_followup_signal || 'Sin dato',
      };
    }
    byTutor[id].assigned_students += 1;
    byTutor[id].tutor_actions_registered += Number(row.tutor_actions_registered || 0);
    byTutor[id].tutor_forum_replies += Number(row.tutor_forum_replies || 0);
    byTutor[id].tutor_feedback_count += Number(row.tutor_feedback_count || 0);
    byTutor[id].tutor_response_hours += Number(row.tutor_response_hours || 0);
    byTutor[id].tutor_activity_coverage += Number(row.tutor_activity_coverage || 0);
  });
  return Object.keys(byTutor).map((key) => {
    const tutor = byTutor[key];
    tutor.tutor_response_hours = round_(tutor.tutor_response_hours / Math.max(1, tutor.assigned_students));
    tutor.tutor_activity_coverage = round_(tutor.tutor_activity_coverage / Math.max(1, tutor.assigned_students));
    return tutor;
  });
}

function buildTutorSummary_(summaries, tutorProfiles) {
  const totalStudents = summaries.length || 1;
  const actions = tutorProfiles.reduce((sum, row) => sum + Number(row.tutor_actions_registered || 0), 0);
  const forums = tutorProfiles.reduce((sum, row) => sum + Number(row.tutor_forum_replies || 0), 0);
  const coverage = summaries.reduce((sum, row) => sum + Number(row.tutor_activity_coverage || 0), 0) / totalStudents;
  const level = actions >= 120 && coverage >= 0.6 ? 'Alta' : actions >= 45 || coverage >= 0.35 ? 'Media' : actions > 0 ? 'Baja' : 'Sin evidencia';
  return {
    active_tutors: tutorProfiles.length,
    actions_registered: actions,
    forum_posts: forums,
    activities_with_evidence: Math.round(coverage * 10),
    activity_coverage: round_(coverage),
    participation_level: level,
  };
}

function buildTutorActivitySummary_(summaries) {
  const feedback = summaries.reduce((sum, row) => sum + Number(row.tutor_feedback_count || 0), 0);
  const actions = summaries.reduce((sum, row) => sum + Number(row.tutor_actions_registered || 0), 0);
  const replies = summaries.reduce((sum, row) => sum + Number(row.tutor_forum_replies || 0), 0);
  const highFollowup = summaries.filter((row) => row.tutor_followup_signal === 'Alta').length;
  return [
    { activity_name: 'Acciones tutoriales identificadas', action: 'registered', count: actions },
    { activity_name: 'Retroalimentaciones a estudiantes', action: 'feedback', count: feedback },
    { activity_name: 'Respuestas en foros o mensajes', action: 'reply', count: replies },
    { activity_name: 'Estudiantes con acompanamiento alto', action: 'coverage', count: highFollowup },
  ];
}

function pad2_(value) {
  return String(value).padStart(2, '0');
}

function platformLevel_(actions) {
  if (actions >= 15) return 'Alta';
  if (actions >= 6) return 'Media';
  if (actions > 0) return 'Baja';
  return 'Sin evidencia';
}

function evaluativeLevel_(grades) {
  if (grades >= 3) return 'Alta';
  if (grades >= 1) return 'Media';
  return 'Sin evaluaciones';
}

function riskLevel_(probability) {
  if (probability >= 0.7) return 'Critico';
  if (probability >= 0.5) return 'Alto';
  if (probability >= 0.3) return 'Medio';
  return 'Bajo';
}

function round_(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function objectFromRow_(headers, row) {
  return headers.reduce((acc, key, index) => {
    acc[key] = row[index];
    return acc;
  }, {});
}

function appendAudit_(ss, action, detail, startedAt) {
  const user = Session.getActiveUser().getEmail() || 'usuario_gas';
  const sheet = ss.getSheetByName('GAS_AUDITORIA') || ss.insertSheet('GAS_AUDITORIA');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
  }
  sheet.appendRow([startedAt || new Date(), user, action, detail, 'gas-webapp']);
}

function appendEvidence_(ss, run, evidence) {
  if (!evidence) return;
  const sheet = ss.getSheetByName('GAS_EVIDENCIAS') || ss.insertSheet('GAS_EVIDENCIAS');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'run_id', 'tipo', 'archivo', 'url', 'folder_id', 'folder_url']);
  }
  sheet.appendRow([
    new Date(),
    run.run_id || run.runId || '',
    evidence.type || '',
    evidence.file_name || '',
    evidence.file_url || '',
    evidence.folder_id || '',
    evidence.folder_url || '',
  ]);
}

function latestEvidence_(ss) {
  const sheet = ss.getSheetByName('GAS_EVIDENCIAS');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  return [objectFromRow_(headers, row)];
}

function saveEvidenceFile_(run, payload, type) {
  const folder = getEvidenceFolder_();
  const runId = run.run_id || run.runId || 'gas-run';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const safeRunId = String(runId).replace(/[^A-Za-z0-9_-]+/g, '_').substring(0, 80);
  const fileName = 'reporta_aula_' + safeRunId + '_' + stamp + '.json';
  const file = folder.createFile(fileName, JSON.stringify(payload, null, 2), 'application/json');
  return {
    type: type || 'json',
    file_id: file.getId(),
    file_name: fileName,
    file_url: file.getUrl(),
    folder_id: folder.getId(),
    folder_url: folder.getUrl(),
  };
}

function getEvidenceFolder_() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = props.getProperty(DRIVE_FOLDER_PROPERTY);
  if (configuredId) {
    return DriveApp.getFolderById(configuredId);
  }
  const folders = DriveApp.getFoldersByName(DEFAULT_DRIVE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DEFAULT_DRIVE_FOLDER_NAME);
  props.setProperty(DRIVE_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function getDriveFolderId_() {
  return getEvidenceFolder_().getId();
}

function getDriveFolderUrl_() {
  return getEvidenceFolder_().getUrl();
}

function validateSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  if (expected && secret !== expected) {
    throw new Error('Token de Apps Script invalido.');
  }
}

function writeRunMetadata_(ss, run) {
  const values = [
    ['Campo', 'Valor'],
    ['run_id', run.run_id || ''],
    ['generated_at', run.generated_at || ''],
    ['course_id', run.course_id || ''],
    ['course_title', run.course_title || ''],
    ['moodle_base_url', run.moodle_base_url || ''],
  ];
  writeValues_(ss, 'Corrida', values);
}

function writeValues_(ss, name, values) {
  const safeName = String(name || 'Datos').substring(0, 99);
  let sheet = ss.getSheetByName(safeName);
  if (!sheet) {
    sheet = ss.insertSheet(safeName);
  }
  sheet.clearContents();
  if (!values.length) {
    return;
  }
  const width = Math.max.apply(null, values.map((row) => row.length));
  const padded = values.map((row) => {
    const copy = row.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
  sheet.setFrozenRows(1);
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, payload) {
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(String(callback || ''))
    ? String(callback)
    : 'reportaAulaCallback';
  return ContentService
    .createTextOutput(safeCallback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonOrJsonp_(payload, callback) {
  return callback ? jsonp_(callback, payload) : json_(payload);
}
