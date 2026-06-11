const DEFAULT_SPREADSHEET_ID = '1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8';
const SECRET_PROPERTY = 'REPORTA_AULA_SECRET';
const DRIVE_FOLDER_PROPERTY = 'REPORTA_AULA_DRIVE_FOLDER_ID';
const MOODLE_BASE_URL_PROPERTY = 'REPORTA_AULA_MOODLE_BASE_URL';
const MOODLE_USERNAME_PROPERTY = 'REPORTA_AULA_MOODLE_USERNAME';
const MOODLE_PASSWORD_PROPERTY = 'REPORTA_AULA_MOODLE_PASSWORD';
const DEFAULT_DRIVE_FOLDER_NAME = 'Reporta Aula Moodle Evidencias';
const SAMPLE_MODEL_VERSION = 'gas_demo_bayes_v0.2_dual_desertion';
const MOODLE_MODEL_VERSION = 'gas_moodle_bayes_v0.1';

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.api === 'report') {
    return jsonOrJsonp_(getLatestGasSample(), params.callback);
  }

  if (params.api === 'runSample') {
    return jsonOrJsonp_(runGasSample(params), params.callback);
  }

  if (params.api === 'credentialStatus') {
    return jsonOrJsonp_(getMoodleCredentialStatus(), params.callback);
  }

  if (params.api === 'runMoodleExtraction') {
    return jsonOrJsonp_(runMoodleExtraction(params), params.callback);
  }

  if (params.api === '1' || params.format === 'json') {
    return jsonOrJsonp_({
      ok: true,
      app: 'Reporta Aula Moodle GAS Demo',
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      driveFolderId: getDriveFolderId_(),
      driveFolderUrl: getDriveFolderUrl_(),
      mode: 'gas-webapp',
      moodleCredentialStatus: getMoodleCredentialStatus(),
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

    if (payload.action === 'configureMoodleCredentials') {
      validateAdminSecret_(payload.secret || '');
      return json_(configureMoodleCredentials_(payload.form || payload));
    }

    if (payload.action === 'runMoodleExtraction') {
      return json_(runMoodleExtraction(payload.form || payload));
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

function runMoodleExtraction(form) {
  const startedAt = new Date();
  const spreadsheetId = (form && form.spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  const courseId = Number((form && form.courseId) || 1718);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  setupGasSampleWorkbook_(ss);

  try {
    const credentials = getMoodleCredentials_();
    const report = buildMoodleReport_(credentials, courseId, form || {});
    const evidence = saveEvidenceFile_(report, { report }, 'moodle_extraction');
    writeGasSample_(ss, report, evidence);
    writeMoodleRawSheets_(ss, report);
    appendEvidence_(ss, report, evidence);
    appendAudit_(ss, 'runMoodleExtraction', 'Extraccion Moodle real ejecutada para curso ' + courseId, startedAt);
    return {
      ok: true,
      mode: 'moodle-real',
      report,
      spreadsheetId,
      driveFolderId: evidence.folder_id,
      driveFolderUrl: evidence.folder_url,
      evidence,
      generatedAt: report.generated_at,
      elapsedMs: new Date().getTime() - startedAt.getTime(),
    };
  } catch (error) {
    appendGasError_(ss, 'runMoodleExtraction', error, 'curso ' + courseId);
    return {
      ok: false,
      mode: 'moodle-real',
      error: String(error && error.message ? error.message : error),
      credentialStatus: getMoodleCredentialStatus(),
      spreadsheetId,
      elapsedMs: new Date().getTime() - startedAt.getTime(),
    };
  }
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

function setReportaAulaMoodleCredentials(baseUrl, username, password) {
  return configureMoodleCredentials_({ baseUrl, username, password });
}

function clearReportaAulaMoodleCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(MOODLE_BASE_URL_PROPERTY);
  props.deleteProperty(MOODLE_USERNAME_PROPERTY);
  props.deleteProperty(MOODLE_PASSWORD_PROPERTY);
  return { ok: true, cleared: true };
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
  ensureSheetWithHeaders_(ss, 'GAS_ERRORES', ['timestamp', 'usuario', 'accion', 'error', 'detalle']);
  ensureSheetWithHeaders_(ss, 'GAS_EVIDENCIAS', ['timestamp', 'run_id', 'tipo', 'archivo', 'url', 'folder_id', 'folder_url']);
  ensureSheetWithHeaders_(ss, 'GAS_PARTICIPANTES', ['user_id', 'name', 'username', 'email', 'roles', 'last_access', 'status']);
  ensureSheetWithHeaders_(ss, 'GAS_CALIFICACIONES', ['user_id', 'name', 'username', 'email', 'grade_cells_with_value', 'course_total']);
  ensureSheetWithHeaders_(ss, 'GAS_ACTIVIDADES', ['cmid', 'module', 'name', 'url']);
  ensureSheetWithHeaders_(ss, 'GAS_PARTICIPACION', ['activity_cmid', 'activity_name', 'action', 'role_id', 'role_name', 'user_id', 'student_name', 'count']);
  ensureSheetWithHeaders_(ss, 'GAS_TUTORES', ['tutor_id', 'tutor_name', 'tutor_email', 'tutor_role', 'assigned_students', 'tutor_actions_registered', 'tutor_forum_replies', 'tutor_feedback_count', 'tutor_response_hours', 'tutor_activity_coverage', 'tutor_followup_signal']);
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

function buildMoodleReport_(credentials, courseId, form) {
  const client = createMoodleClient_(credentials.baseUrl);
  moodleLogin_(client, credentials.username, credentials.password);
  const courseHtml = moodleFetch_(client, '/course/view.php?id=' + courseId);
  if (isMoodleLoginPage_(courseHtml)) {
    throw new Error('Moodle redirigio al login despues de autenticar. Revise permisos del usuario para el curso.');
  }

  const courseTitle = extractTitle_(courseHtml) || (form.courseTitle || 'Curso Moodle ' + courseId);
  const participants = extractMoodleParticipants_(moodleFetch_(client, '/user/index.php?id=' + courseId + '&perpage=5000'));
  const gradeRows = extractMoodleGrades_(moodleFetch_(client, '/grade/report/grader/index.php?id=' + courseId), participants);
  const activities = extractMoodleActivities_(courseHtml);
  const maxActivities = Math.max(1, Math.min(Number(form.maxActivities || 25), 60));
  const selectedActivities = activities.slice(0, maxActivities);
  const participationRows = extractMoodleParticipation_(client, courseId, selectedActivities, [{ id: '5', name: 'Estudiante' }]);
  const tutorRows = String(form.includeTutorParticipation || 'true') === 'false'
    ? []
    : extractMoodleParticipation_(client, courseId, selectedActivities, [{ id: '3', name: 'Docente' }, { id: '4', name: 'Tutor' }]);
  const tutorProfiles = buildTutorProfilesFromParticipation_(tutorRows);
  const summaries = buildMoodleSummaries_(participants, gradeRows, participationRows, tutorRows, tutorProfiles);
  const effectiveTutorProfiles = tutorProfiles.length ? tutorProfiles : buildTutorProfiles_(summaries);
  const tutorSummary = buildTutorSummary_(summaries, effectiveTutorProfiles);
  const report = {
    run_id: 'moodle-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    generated_at: new Date().toISOString(),
    course_id: courseId,
    course_title: courseTitle,
    moodle_base_url: credentials.baseUrl,
    model_version: MOODLE_MODEL_VERSION,
    extraction_mode: 'moodle-real',
    source_counts: {
      participants: participants.length,
      grade_rows: gradeRows.length,
      activities: activities.length,
      activities_extracted_for_participation: selectedActivities.length,
      participation_rows: participationRows.length,
      tutor_participation_rows: tutorRows.length,
    },
    participants,
    grade_rows: gradeRows,
    activities,
    participation_rows: participationRows,
    tutor_participation_rows: tutorRows,
    summaries,
    tutor_profiles: effectiveTutorProfiles,
    tutor_summary: tutorSummary,
    tutor_activity_summary: buildTutorActivitySummaryFromRows_(tutorRows),
    activity_summary: buildActivitySummaryFromRows_(participationRows),
    kpis: buildKpis_(summaries),
  };

  if (!participants.length) {
    throw new Error('Moodle respondio, pero no se detectaron participantes en el curso ' + courseId + '.');
  }
  return report;
}

function createMoodleClient_(baseUrl) {
  return {
    baseUrl: String(baseUrl || '').replace(/\/+$/, ''),
    cookies: {},
  };
}

function moodleFetch_(client, pathOrUrl, options) {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : client.baseUrl + '/' + String(pathOrUrl || '').replace(/^\/+/, '');
  const requestOptions = Object.assign({
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'reporta-aula-moodle-gas/0.1',
      'Cookie': cookieHeader_(client.cookies),
    },
  }, options || {});
  if (!requestOptions.headers.Cookie) {
    delete requestOptions.headers.Cookie;
  }
  const response = UrlFetchApp.fetch(url, requestOptions);
  rememberCookies_(client, response);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 400) {
    throw new Error('Moodle devolvio HTTP ' + code + ' al consultar ' + url);
  }
  return text;
}

function moodleLogin_(client, username, password) {
  const loginHtml = moodleFetch_(client, '/login/index.php');
  const token = extractInputValue_(loginHtml, 'logintoken');
  const payload = {
    username,
    password,
  };
  if (token) payload.logintoken = token;
  const result = moodleFetch_(client, '/login/index.php', {
    method: 'post',
    payload,
  });
  if (loginFailed_(result)) {
    throw new Error('No se pudo iniciar sesion en Moodle. Revise usuario, contrasena y URL base.');
  }
}

function rememberCookies_(client, response) {
  const headers = response.getAllHeaders();
  const raw = headers['Set-Cookie'] || headers['set-cookie'];
  if (!raw) return;
  const values = Array.isArray(raw) ? raw : [raw];
  values.forEach((header) => {
    String(header).split(/,(?=[^;,]+=)/).forEach((cookie) => {
      const pair = cookie.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq > 0) {
        client.cookies[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
      }
    });
  });
}

function cookieHeader_(cookies) {
  return Object.keys(cookies || {}).map((key) => key + '=' + cookies[key]).join('; ');
}

function loginFailed_(html) {
  const clean = stripTags_(html).toLowerCase();
  return clean.indexOf('loginerrormessage') >= 0 ||
    clean.indexOf('datos erroneos') >= 0 ||
    clean.indexOf('invalid login') >= 0 ||
    (clean.indexOf('nombre de usuario') >= 0 && clean.indexOf('contrasena') >= 0 && clean.indexOf('recordar nombre') >= 0);
}

function isMoodleLoginPage_(html) {
  const clean = stripTags_(html).toLowerCase();
  return clean.indexOf('recordar nombre de usuario') >= 0 || clean.indexOf('logintoken') >= 0 && clean.indexOf('nombre de usuario') >= 0;
}

function extractMoodleParticipants_(html) {
  const rows = chooseRows_(parseHtmlTables_(html), ['direccion de correo', 'email', 'roles', 'ultimo acceso']);
  return rows.map((row) => {
    const username = cellValue_(row, ['nombre de usuario', 'username'], []);
    const name = cellValue_(row, ['nombre ordenar', 'apellido', 'name'], ['nombre de usuario', 'username']) || cellValue_(row, ['nombre'], ['nombre de usuario']);
    return {
      user_id: row.user_id || username || keyNorm_(name),
      name,
      username,
      email: cellValue_(row, ['direccion de correo', 'correo', 'email'], []),
      roles: cellValue_(row, ['roles', 'rol', 'role'], []),
      last_access: cellValue_(row, ['ultimo acceso al curso', 'ultimo acceso', 'last access'], []),
      status: cellValue_(row, ['estatus', 'estado', 'status'], []),
    };
  }).filter((row) => row.name && (!row.roles || keyNorm_(row.roles).indexOf('estudiante') >= 0 || keyNorm_(row.roles).indexOf('student') >= 0));
}

function extractMoodleGrades_(html, participants) {
  const rows = chooseRows_(parseHtmlTables_(html), ['nombre', 'total', 'calificacion', 'grade']);
  const participantByUsername = {};
  participants.forEach((participant) => {
    if (participant.username) participantByUsername[keyNorm_(participant.username)] = participant;
    if (participant.name) participantByUsername[keyNorm_(participant.name)] = participant;
  });
  return rows.map((row) => {
    const username = cellValue_(row, ['nombre de usuario', 'username'], []);
    const name = cellValue_(row, ['nombre ordenar', 'apellido', 'name'], ['nombre de usuario', 'username']) || cellValue_(row, ['nombre'], ['nombre de usuario']);
    const participant = participantByUsername[keyNorm_(username)] || participantByUsername[keyNorm_(name)] || {};
    const gradeCells = Object.keys(row.cells).reduce((count, key) => {
      const clean = keyNorm_(key);
      if (clean.indexOf('nombre') >= 0 || clean.indexOf('email') >= 0 || clean.indexOf('correo') >= 0 || clean.indexOf('usuario') >= 0) return count;
      return /\d/.test(String(row.cells[key] || '')) ? count + 1 : count;
    }, 0);
    return {
      user_id: row.user_id || participant.user_id || username || keyNorm_(name),
      name: name || participant.name || '',
      username: username || participant.username || '',
      email: cellValue_(row, ['direccion de correo', 'correo', 'email'], []) || participant.email || '',
      grade_cells_with_value: gradeCells,
      course_total: courseTotalFromRow_(row),
    };
  }).filter((row) => row.name || row.username);
}

function extractMoodleActivities_(html) {
  const activities = {};
  const linkRegex = /<a\b[^>]*href=["']([^"']*\/mod\/([^\/]+)\/view\.php\?id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const name = stripTags_(match[4]);
    if (!name || activities[match[3]]) continue;
    activities[match[3]] = {
      cmid: match[3],
      module: match[2],
      name,
      url: absoluteMoodleUrl_(match[1]),
    };
  }
  return Object.keys(activities).map((key) => activities[key]);
}

function extractMoodleParticipation_(client, courseId, activities, roles) {
  const rows = [];
  roles.forEach((role) => {
    activities.forEach((activity) => {
      try {
        const html = moodleFetch_(client, '/report/participation/index.php?id=' + courseId + '&roleid=' + encodeURIComponent(role.id) + '&instanceid=' + encodeURIComponent(activity.cmid) + '&perpage=5000');
        const tableRows = chooseRows_(parseHtmlTables_(html), ['nombre', 'acciones', 'actions', 'si', 'yes']);
        tableRows.forEach((row) => {
          const name = cellValue_(row, ['nombre ordenar', 'apellido', 'name'], ['nombre de usuario', 'username']) || cellValue_(row, ['nombre'], ['nombre de usuario']);
          if (!name) return;
          rows.push({
            activity_cmid: activity.cmid,
            activity_name: activity.name,
            action: 'participacion',
            role_id: role.id,
            role_name: role.name,
            user_id: row.user_id || cellValue_(row, ['nombre de usuario', 'username'], []) || keyNorm_(name),
            student_name: name,
            count: countFromParticipationRow_(row),
          });
        });
      } catch (error) {
        rows.push({
          activity_cmid: activity.cmid,
          activity_name: activity.name,
          action: 'error',
          role_id: role.id,
          role_name: role.name,
          user_id: '',
          student_name: 'ERROR: ' + String(error.message || error).substring(0, 160),
          count: 0,
        });
      }
    });
  });
  return rows.filter((row) => row.action !== 'error' || row.student_name);
}

function buildMoodleSummaries_(participants, gradeRows, participationRows, tutorRows, tutorProfiles) {
  const gradeByKey = {};
  gradeRows.forEach((row) => {
    [row.user_id, row.username, row.name].forEach((key) => {
      if (key) gradeByKey[keyNorm_(key)] = row;
    });
  });
  const participationByKey = {};
  const forumByKey = {};
  participationRows.forEach((row) => {
    const key = keyNorm_(row.user_id || row.student_name);
    participationByKey[key] = (participationByKey[key] || 0) + Number(row.count || 0);
    if (keyNorm_(row.activity_name).indexOf('foro') >= 0 || keyNorm_(row.activity_name).indexOf('forum') >= 0) {
      forumByKey[key] = (forumByKey[key] || 0) + Number(row.count || 0);
    }
  });
  const tutorStats = aggregateTutorStats_(tutorRows, tutorProfiles);
  return participants.map((participant, index) => {
    const key = keyNorm_(participant.user_id || participant.username || participant.name);
    const grade = gradeByKey[key] || gradeByKey[keyNorm_(participant.username)] || gradeByKey[keyNorm_(participant.name)] || {};
    const actions = Number(participationByKey[key] || participationByKey[keyNorm_(participant.username)] || participationByKey[keyNorm_(participant.name)] || 0);
    const gradeCount = Number(grade.grade_cells_with_value || 0);
    const item = {
      user_id: participant.user_id || participant.username || 'moodle-' + (index + 1),
      student_moodle_id: 'MOODLE-' + (participant.user_id || participant.username || pad2_(index + 1)),
      student_document_id: participant.username || participant.user_id || '',
      name: participant.name,
      email: participant.email,
      cohort: '',
      career: '',
      semester_number: 1,
      enrollment_status: participant.status || 'Regular',
      academic_load: Math.max(1, gradeCount || 1),
      failed_previous_subjects: 0,
      program_progress_percent: 0,
      scholarship_status: 'Sin dato',
      work_shift: 'Sin dato',
      tutor_id: tutorStats.tutor_id,
      tutor_name: tutorStats.tutor_name,
      tutor_email: tutorStats.tutor_email,
      tutor_role: tutorStats.tutor_role,
      tutor_actions_registered: tutorStats.tutor_actions_registered,
      tutor_forum_replies: tutorStats.tutor_forum_replies,
      tutor_feedback_count: tutorStats.tutor_feedback_count,
      tutor_response_hours: tutorStats.tutor_response_hours,
      tutor_activity_coverage: tutorStats.tutor_activity_coverage,
      tutor_followup_signal: tutorStats.tutor_followup_signal,
      actions_registered: actions,
      forum_posts: Number(forumByKey[key] || 0),
      grade_cells_with_value: gradeCount,
      days_since_last_access: daysFromText_(participant.last_access),
    };
    return buildStudentSummary_(item);
  });
}

function buildTutorProfilesFromParticipation_(tutorRows) {
  const byTutor = {};
  tutorRows.forEach((row) => {
    if (!row.user_id && !row.student_name) return;
    const id = row.user_id || keyNorm_(row.student_name);
    if (!byTutor[id]) {
      byTutor[id] = {
        tutor_id: id,
        tutor_name: row.student_name || 'Tutor Moodle',
        tutor_email: '',
        tutor_role: row.role_name || 'Tutor',
        assigned_students: 0,
        tutor_actions_registered: 0,
        tutor_forum_replies: 0,
        tutor_feedback_count: 0,
        tutor_response_hours: 24,
        tutor_activity_coverage: 0,
        tutor_followup_signal: 'Media',
        _activities: {},
      };
    }
    byTutor[id].tutor_actions_registered += Number(row.count || 0);
    if (keyNorm_(row.activity_name).indexOf('foro') >= 0 || keyNorm_(row.activity_name).indexOf('forum') >= 0) {
      byTutor[id].tutor_forum_replies += Number(row.count || 0);
    }
    if (Number(row.count || 0) > 0) {
      byTutor[id].tutor_feedback_count += 1;
      byTutor[id]._activities[row.activity_cmid || row.activity_name] = true;
    }
  });
  return Object.keys(byTutor).map((key) => {
    const tutor = byTutor[key];
    tutor.tutor_activity_coverage = Math.min(1, Object.keys(tutor._activities).length / 10);
    tutor.tutor_followup_signal = tutor.tutor_actions_registered >= 30 ? 'Alta' : tutor.tutor_actions_registered > 0 ? 'Media' : 'Bajo';
    delete tutor._activities;
    return tutor;
  });
}

function aggregateTutorStats_(tutorRows, tutorProfiles) {
  const profiles = tutorProfiles || [];
  const actions = tutorRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const forums = tutorRows.reduce((sum, row) => sum + (keyNorm_(row.activity_name).indexOf('foro') >= 0 || keyNorm_(row.activity_name).indexOf('forum') >= 0 ? Number(row.count || 0) : 0), 0);
  const first = profiles[0] || {};
  return {
    tutor_id: first.tutor_id || 'TUTOR-AGREGADO',
    tutor_name: first.tutor_name || 'Equipo docente Moodle',
    tutor_email: first.tutor_email || '',
    tutor_role: first.tutor_role || 'Docente/Tutor',
    tutor_actions_registered: actions,
    tutor_forum_replies: forums,
    tutor_feedback_count: tutorRows.filter((row) => Number(row.count || 0) > 0).length,
    tutor_response_hours: actions > 0 ? 24 : 96,
    tutor_activity_coverage: Math.min(1, tutorRows.filter((row) => Number(row.count || 0) > 0).length / 10),
    tutor_followup_signal: actions >= 30 ? 'Alta' : actions > 0 ? 'Media' : 'Bajo',
  };
}

function buildActivitySummaryFromRows_(rows) {
  const grouped = {};
  rows.forEach((row) => {
    const key = (row.activity_cmid || '') + '|' + (row.activity_name || '') + '|' + (row.action || '');
    if (!grouped[key]) grouped[key] = { activity_cmid: row.activity_cmid, activity_name: row.activity_name, action: row.action, count: 0 };
    grouped[key].count += Number(row.count || 0);
  });
  return Object.keys(grouped).map((key) => grouped[key]);
}

function buildTutorActivitySummaryFromRows_(rows) {
  return buildActivitySummaryFromRows_(rows).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 30);
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

function parseHtmlTables_(html) {
  const tables = [];
  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[0];
    const rowMatches = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    if (!rowMatches.length) continue;
    const headerCells = extractCells_(rowMatches[0]).map((cell, index) => cleanHeader_(cell.text || ('col_' + (index + 1))));
    if (!headerCells.length) continue;
    const rows = [];
    rowMatches.slice(1).forEach((rowHtml) => {
      const cells = extractCells_(rowHtml);
      if (cells.length < 2) return;
      const row = { cells: {}, links: [], user_id: '' };
      cells.forEach((cell, index) => {
        row.cells[headerCells[index] || ('col_' + (index + 1))] = cell.text;
        row.links = row.links.concat(cell.links);
      });
      row.user_id = userIdFromLinks_(row.links);
      rows.push(row);
    });
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function extractCells_(rowHtml) {
  const cells = [];
  const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
  let match;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push({
      text: stripTags_(match[1]),
      links: extractLinks_(match[1]),
    });
  }
  return cells;
}

function extractLinks_(html) {
  const links = [];
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function chooseRows_(tables, hints) {
  let bestRows = [];
  let bestScore = -1;
  const normalizedHints = hints.map(keyNorm_);
  tables.forEach((rows) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0].cells).map(keyNorm_).join(' ');
    const score = normalizedHints.reduce((sum, hint) => sum + (headers.indexOf(hint) >= 0 ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRows = rows;
    }
  });
  return bestScore > 0 ? bestRows : [];
}

function cellValue_(row, includes, excludes) {
  const includeNorm = includes.map(keyNorm_);
  const excludeNorm = (excludes || []).map(keyNorm_);
  const keys = Object.keys(row.cells || {});
  for (let i = 0; i < keys.length; i += 1) {
    const clean = keyNorm_(keys[i]);
    const included = includeNorm.some((hint) => clean.indexOf(hint) >= 0);
    const excluded = excludeNorm.some((hint) => clean.indexOf(hint) >= 0);
    if (included && !excluded) return row.cells[keys[i]];
  }
  return '';
}

function courseTotalFromRow_(row) {
  const total = cellValue_(row, ['total del curso', 'total curso', 'course total', 'total'], []);
  if (total) return total;
  const values = Object.keys(row.cells || {}).map((key) => row.cells[key]).filter((value) => /\d/.test(String(value || '')));
  return values.length ? values[values.length - 1] : '';
}

function countFromParticipationRow_(row) {
  let maxValue = 0;
  Object.keys(row.cells || {}).forEach((key) => {
    const clean = keyNorm_(key);
    if (clean.indexOf('usuario') >= 0 || clean.indexOf('nombre') >= 0 || clean.indexOf('email') >= 0 || clean.indexOf('correo') >= 0) return;
    const text = String(row.cells[key] || '');
    const match = text.match(/\d+/);
    if (match) maxValue = Math.max(maxValue, Number(match[0]));
    else if (keyNorm_(text).indexOf('si') >= 0 || keyNorm_(text).indexOf('yes') >= 0) maxValue = Math.max(maxValue, 1);
  });
  return maxValue;
}

function userIdFromLinks_(links) {
  for (let i = 0; i < links.length; i += 1) {
    const match = String(links[i]).match(/[?&](?:id|userid)=(\d+)/);
    if (match) return match[1];
  }
  return '';
}

function extractInputValue_(html, name) {
  const re = new RegExp("<input\\b[^>]*name=[\"']" + name + "[\"'][^>]*>", 'i');
  const match = String(html || '').match(re);
  if (!match) return '';
  const value = match[0].match(/value=["']([^"']*)["']/i);
  return value ? decodeHtml_(value[1]) : '';
}

function extractTitle_(html) {
  const heading = String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return heading ? stripTags_(heading[1]).replace(/\s*:\s*Participantes\s*$/i, '') : '';
}

function stripTags_(html) {
  return decodeHtml_(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtml_(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeader_(text) {
  return stripTags_(text)
    .replace(/\s*Ordenar por\s+.*$/i, '')
    .replace(/\s*Ascending\s*.*$/i, '')
    .replace(/\s*Ascendente\s*.*$/i, '')
    .trim();
}

function keyNorm_(text) {
  return String(text || '').toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysFromText_(text) {
  const clean = keyNorm_(text);
  if (!clean || clean.indexOf('nunca') >= 0 || clean.indexOf('never') >= 0) return 999;
  const day = clean.match(/(\d+)\s*d[ií]?a/);
  const hour = clean.match(/(\d+)\s*hora/);
  let value = 0;
  if (day) value += Number(day[1]);
  if (hour) value += Number(hour[1]) / 24;
  return round_(value || 0);
}

function absoluteMoodleUrl_(href) {
  if (/^https?:\/\//i.test(href)) return href;
  const base = PropertiesService.getScriptProperties().getProperty(MOODLE_BASE_URL_PROPERTY) || '';
  return base.replace(/\/+$/, '') + '/' + String(href || '').replace(/^\/+/, '');
}

function getMoodleCredentialStatus() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty(MOODLE_BASE_URL_PROPERTY) || '';
  const username = props.getProperty(MOODLE_USERNAME_PROPERTY) || '';
  const password = props.getProperty(MOODLE_PASSWORD_PROPERTY) || '';
  return {
    ok: true,
    configured: Boolean(baseUrl && username && password),
    hasBaseUrl: Boolean(baseUrl),
    hasUsername: Boolean(username),
    hasPassword: Boolean(password),
    baseUrl,
    usernameMasked: username ? maskValue_(username) : '',
    propertyNames: [MOODLE_BASE_URL_PROPERTY, MOODLE_USERNAME_PROPERTY, MOODLE_PASSWORD_PROPERTY],
  };
}

function getMoodleCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const credentials = {
    baseUrl: props.getProperty(MOODLE_BASE_URL_PROPERTY) || '',
    username: props.getProperty(MOODLE_USERNAME_PROPERTY) || '',
    password: props.getProperty(MOODLE_PASSWORD_PROPERTY) || '',
  };
  if (!credentials.baseUrl || !credentials.username || !credentials.password) {
    throw new Error('Credenciales Moodle no configuradas en Script Properties. Configure REPORTA_AULA_MOODLE_BASE_URL, REPORTA_AULA_MOODLE_USERNAME y REPORTA_AULA_MOODLE_PASSWORD.');
  }
  return credentials;
}

function configureMoodleCredentials_(form) {
  const baseUrl = String(form.baseUrl || form.moodleBaseUrl || form.moodle_base_url || '').replace(/\/+$/, '');
  const username = String(form.username || form.moodleUsername || '').trim();
  const password = String(form.password || form.moodlePassword || '');
  if (!baseUrl || !username || !password) {
    throw new Error('Faltan URL base, usuario o contrasena Moodle.');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty(MOODLE_BASE_URL_PROPERTY, baseUrl);
  props.setProperty(MOODLE_USERNAME_PROPERTY, username);
  props.setProperty(MOODLE_PASSWORD_PROPERTY, password);
  return {
    ok: true,
    configured: true,
    baseUrl,
    usernameMasked: maskValue_(username),
  };
}

function maskValue_(value) {
  const text = String(value || '');
  if (text.length <= 4) return '****';
  return text.substring(0, 2) + '***' + text.substring(text.length - 2);
}

function appendAudit_(ss, action, detail, startedAt) {
  const user = Session.getActiveUser().getEmail() || 'usuario_gas';
  const sheet = ss.getSheetByName('GAS_AUDITORIA') || ss.insertSheet('GAS_AUDITORIA');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
  }
  sheet.appendRow([startedAt || new Date(), user, action, detail, 'gas-webapp']);
}

function appendGasError_(ss, action, error, detail) {
  const user = Session.getActiveUser().getEmail() || 'usuario_gas';
  const sheet = ss.getSheetByName('GAS_ERRORES') || ss.insertSheet('GAS_ERRORES');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'usuario', 'accion', 'error', 'detalle']);
  }
  sheet.appendRow([new Date(), user, action, String(error && error.message ? error.message : error), detail || '']);
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

function validateAdminSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  if (!expected) {
    throw new Error('REPORTA_AULA_SECRET no esta configurado. Configure primero un secreto administrativo en Script Properties.');
  }
  if (secret !== expected) {
    throw new Error('Token administrativo invalido.');
  }
}

function writeMoodleRawSheets_(ss, report) {
  writeObjects_(ss, 'GAS_PARTICIPANTES', report.participants || [], ['user_id', 'name', 'username', 'email', 'roles', 'last_access', 'status']);
  writeObjects_(ss, 'GAS_CALIFICACIONES', report.grade_rows || [], ['user_id', 'name', 'username', 'email', 'grade_cells_with_value', 'course_total']);
  writeObjects_(ss, 'GAS_ACTIVIDADES', report.activities || [], ['cmid', 'module', 'name', 'url']);
  writeObjects_(ss, 'GAS_PARTICIPACION', report.participation_rows || [], ['activity_cmid', 'activity_name', 'action', 'role_id', 'role_name', 'user_id', 'student_name', 'count']);
  writeObjects_(ss, 'GAS_TUTORES', report.tutor_profiles || [], ['tutor_id', 'tutor_name', 'tutor_email', 'tutor_role', 'assigned_students', 'tutor_actions_registered', 'tutor_forum_replies', 'tutor_feedback_count', 'tutor_response_hours', 'tutor_activity_coverage', 'tutor_followup_signal']);
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

function writeObjects_(ss, name, rows, headers) {
  const values = [headers].concat((rows || []).map((row) => headers.map((key) => row[key] === undefined ? '' : row[key])));
  writeValues_(ss, name, values);
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
