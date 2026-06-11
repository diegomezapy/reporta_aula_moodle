const DEFAULT_SPREADSHEET_ID = '1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8';
const SECRET_PROPERTY = 'REPORTA_AULA_SECRET';
const SAMPLE_MODEL_VERSION = 'gas_demo_bayes_v0.1';

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.api === '1' || params.format === 'json') {
    return json_({
      ok: true,
      app: 'Reporta Aula Moodle GAS Demo',
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      mode: 'gas-webapp',
    });
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

    return json_({
      ok: true,
      spreadsheetId,
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
  writeGasSample_(ss, report);
  appendAudit_(ss, 'runGasSample', 'Muestra funcional GAS ejecutada', startedAt);
  return {
    ok: true,
    report,
    spreadsheetId,
    generatedAt: report.generated_at,
    elapsedMs: new Date().getTime() - startedAt.getTime(),
  };
}

function getLatestGasSample() {
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('GAS_RESUMEN');
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: false, error: 'Todavia no hay muestra GAS ejecutada.' };
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

function initializeReportaAulaWorkbook() {
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  ensureSheetWithHeaders_(ss, 'CONFIG', ['clave', 'valor', 'actualizado_en']);
  ensureSheetWithHeaders_(ss, 'USUARIOS', ['usuario', 'password_hash', 'nombre', 'correo', 'rol', 'activo', 'fecha_creacion', 'ultimo_acceso', 'observacion']);
  ensureSheetWithHeaders_(ss, 'AUDITORIA', ['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
  ensureSheetWithHeaders_(ss, 'ERRORES', ['timestamp', 'usuario', 'accion', 'error', 'detalle']);
  setupGasSampleWorkbook_(ss);
  return json_({ ok: true, initialized: ['CONFIG', 'USUARIOS', 'AUDITORIA', 'ERRORES', 'GAS_RESUMEN', 'GAS_RIESGO'] });
}

function setupGasSampleWorkbook_(ss) {
  ensureSheetWithHeaders_(ss, 'GAS_RESUMEN', [
    'user_id',
    'name',
    'email',
    'actions_registered',
    'forum_posts',
    'grade_cells_with_value',
    'platform_level',
    'evaluative_level',
    'bayesian_prior_probability',
    'bayesian_posterior_probability',
    'bayesian_log_likelihood_ratio',
    'risk_model_version',
    'desertion_risk_level',
    'desertion_risk_factors',
    'follow_up_alert',
  ]);
  ensureSheetWithHeaders_(ss, 'GAS_RIESGO', ['nivel', 'cantidad']);
  ensureSheetWithHeaders_(ss, 'GAS_AUDITORIA', ['timestamp', 'usuario', 'accion', 'detalle', 'origen']);
}

function buildDemoReport_(courseId, courseTitle) {
  const base = [
    ['demo-01', 'Estudiante 01', 'estudiante01@example.invalid', 6, 1, 1, 3],
    ['demo-02', 'Estudiante 02', 'estudiante02@example.invalid', 11, 3, 3, 7],
    ['demo-03', 'Estudiante 03', 'estudiante03@example.invalid', 5, 2, 1, 32],
    ['demo-04', 'Estudiante 04', 'estudiante04@example.invalid', 0, 0, 0, 72],
    ['demo-05', 'Estudiante 05', 'estudiante05@example.invalid', 6, 1, 1, 49],
    ['demo-06', 'Estudiante 06', 'estudiante06@example.invalid', 2, 0, 0, 82],
    ['demo-07', 'Estudiante 07', 'estudiante07@example.invalid', 17, 3, 3, 3],
    ['demo-08', 'Estudiante 08', 'estudiante08@example.invalid', 6, 0, 0, 66],
    ['demo-09', 'Estudiante 09', 'estudiante09@example.invalid', 20, 2, 2, 7],
    ['demo-10', 'Estudiante 10', 'estudiante10@example.invalid', 10, 2, 0, 1],
    ['demo-11', 'Estudiante 11', 'estudiante11@example.invalid', 1, 0, 0, 64],
    ['demo-12', 'Estudiante 12', 'estudiante12@example.invalid', 2, 0, 0, 57],
    ['demo-13', 'Estudiante 13', 'estudiante13@example.invalid', 15, 1, 1, 15],
    ['demo-14', 'Estudiante 14', 'estudiante14@example.invalid', 18, 3, 3, 0],
    ['demo-15', 'Estudiante 15', 'estudiante15@example.invalid', 23, 5, 3, 2],
    ['demo-16', 'Estudiante 16', 'estudiante16@example.invalid', 13, 2, 2, 50],
    ['demo-17', 'Estudiante 17', 'estudiante17@example.invalid', 10, 0, 0, 68],
    ['demo-18', 'Estudiante 18', 'estudiante18@example.invalid', 7, 1, 1, 67],
    ['demo-19', 'Estudiante 19', 'estudiante19@example.invalid', 16, 3, 1, 3],
    ['demo-20', 'Estudiante 20', 'estudiante20@example.invalid', 0, 0, 0, 88],
  ];

  const summaries = base.map((item) => buildStudentSummary_(item));
  return {
    run_id: 'gas-demo-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    generated_at: new Date().toISOString(),
    course_id: courseId,
    course_title: courseTitle,
    model_version: SAMPLE_MODEL_VERSION,
    summaries,
    kpis: buildKpis_(summaries),
  };
}

function buildStudentSummary_(item) {
  const actions = Number(item[3]);
  const forums = Number(item[4]);
  const grades = Number(item[5]);
  const days = Number(item[6]);
  const prior = 0.2;
  const evidence = [];
  const lr = [];

  if (days >= 45) {
    evidence.push('Ultimo acceso mayor o igual a 45 dias');
    lr.push(2.2);
  } else if (days <= 7) {
    evidence.push('Acceso reciente al aula');
    lr.push(0.55);
  }

  if (actions === 0) {
    evidence.push('Sin actividad en plataforma');
    lr.push(2.8);
  } else if (actions < 5) {
    evidence.push('Baja actividad en plataforma');
    lr.push(1.7);
  } else if (actions >= 15) {
    evidence.push('Alta actividad en plataforma');
    lr.push(0.55);
  }

  if (grades === 0) {
    evidence.push('Sin evaluaciones registradas');
    lr.push(2.4);
  } else if (grades >= 3) {
    evidence.push('Evaluaciones registradas');
    lr.push(0.55);
  }

  if (forums === 0) {
    evidence.push('Sin participacion registrada en foros');
    lr.push(1.35);
  } else if (forums >= 3) {
    evidence.push('Participacion frecuente en foros');
    lr.push(0.65);
  }

  const priorOdds = prior / (1 - prior);
  const likelihood = lr.reduce((acc, value) => acc * value, 1);
  const posteriorOdds = priorOdds * likelihood;
  const posterior = posteriorOdds / (1 + posteriorOdds);
  const logLr = Math.log(likelihood || 1);

  return {
    user_id: item[0],
    name: item[1],
    email: item[2],
    actions_registered: actions,
    forum_posts: forums,
    grade_cells_with_value: grades,
    platform_level: platformLevel_(actions),
    evaluative_level: evaluativeLevel_(grades),
    bayesian_prior_probability: round_(prior),
    bayesian_posterior_probability: round_(posterior),
    bayesian_log_likelihood_ratio: round_(logLr),
    risk_model_version: SAMPLE_MODEL_VERSION,
    desertion_risk_level: riskLevel_(posterior),
    desertion_risk_factors: evidence.join('; '),
    follow_up_alert: posterior >= 0.5,
  };
}

function buildKpis_(summaries) {
  const total = summaries.length;
  const alerts = summaries.filter((row) => row.follow_up_alert === true || row.follow_up_alert === 'TRUE').length;
  const avgRisk = total ? summaries.reduce((sum, row) => sum + Number(row.bayesian_posterior_probability || 0), 0) / total : 0;
  const actions = summaries.reduce((sum, row) => sum + Number(row.actions_registered || 0), 0);
  const forums = summaries.reduce((sum, row) => sum + Number(row.forum_posts || 0), 0);
  const risk = summaries.reduce((acc, row) => {
    const level = row.desertion_risk_level || 'Sin dato';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  return {
    total_students: total,
    alerts,
    average_risk: round_(avgRisk),
    actions,
    forums,
    risk,
  };
}

function writeGasSample_(ss, report) {
  const summaryHeaders = [
    'user_id',
    'name',
    'email',
    'actions_registered',
    'forum_posts',
    'grade_cells_with_value',
    'platform_level',
    'evaluative_level',
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
  const riskValues = [['nivel', 'cantidad']].concat(Object.keys(report.kpis.risk).map((key) => [key, report.kpis.risk[key]]));
  writeValues_(ss, 'GAS_RIESGO', riskValues);
  writeValues_(ss, 'GAS_CORRIDA', [
    ['Campo', 'Valor'],
    ['run_id', report.run_id],
    ['generated_at', report.generated_at],
    ['course_id', report.course_id],
    ['course_title', report.course_title],
    ['model_version', report.model_version],
  ]);
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
