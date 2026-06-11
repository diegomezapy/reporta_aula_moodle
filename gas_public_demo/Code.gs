const MODEL_VERSION = 'gas_public_demo_bayes_v0.1';

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.api === '1') {
    return json_({
      ok: true,
      app: 'Reporta Aula Moodle GAS Public Demo',
      mode: 'gas-public-demo',
      generatedAt: new Date().toISOString(),
    });
  }
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Reporta Aula Moodle')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function runGasSample() {
  const report = buildDemoReport_();
  return {
    ok: true,
    report,
    generatedAt: new Date().toISOString(),
  };
}

function buildDemoReport_() {
  const rows = [
    ['demo-01', 'Estudiante 01', 6, 1, 1, 3],
    ['demo-02', 'Estudiante 02', 11, 3, 3, 7],
    ['demo-03', 'Estudiante 03', 5, 2, 1, 32],
    ['demo-04', 'Estudiante 04', 0, 0, 0, 72],
    ['demo-05', 'Estudiante 05', 6, 1, 1, 49],
    ['demo-06', 'Estudiante 06', 2, 0, 0, 82],
    ['demo-07', 'Estudiante 07', 17, 3, 3, 3],
    ['demo-08', 'Estudiante 08', 6, 0, 0, 66],
    ['demo-09', 'Estudiante 09', 20, 2, 2, 7],
    ['demo-10', 'Estudiante 10', 10, 2, 0, 1],
    ['demo-11', 'Estudiante 11', 1, 0, 0, 64],
    ['demo-12', 'Estudiante 12', 2, 0, 0, 57],
    ['demo-13', 'Estudiante 13', 15, 1, 1, 15],
    ['demo-14', 'Estudiante 14', 18, 3, 3, 0],
    ['demo-15', 'Estudiante 15', 23, 5, 3, 2],
    ['demo-16', 'Estudiante 16', 13, 2, 2, 50],
    ['demo-17', 'Estudiante 17', 10, 0, 0, 68],
    ['demo-18', 'Estudiante 18', 7, 1, 1, 67],
    ['demo-19', 'Estudiante 19', 16, 3, 1, 3],
    ['demo-20', 'Estudiante 20', 0, 0, 0, 88],
  ].map(buildSummary_);
  return {
    courseTitle: 'Analitica de Big Data - GAS demo',
    modelVersion: MODEL_VERSION,
    runId: 'gas-public-demo-' + Utilities.formatDate(new Date(), 'America/Asuncion', 'yyyyMMdd-HHmmss'),
    summaries: rows,
    kpis: buildKpis_(rows),
  };
}

function buildSummary_(item) {
  const actions = Number(item[2]);
  const forums = Number(item[3]);
  const grades = Number(item[4]);
  const days = Number(item[5]);
  const prior = 0.2;
  const evidence = [];
  const lrs = [];

  if (days >= 45) {
    evidence.push('Ultimo acceso mayor o igual a 45 dias');
    lrs.push(2.2);
  } else if (days <= 7) {
    evidence.push('Acceso reciente');
    lrs.push(0.55);
  }
  if (actions === 0) {
    evidence.push('Sin actividad en plataforma');
    lrs.push(2.8);
  } else if (actions < 5) {
    evidence.push('Baja actividad en plataforma');
    lrs.push(1.7);
  } else if (actions >= 15) {
    evidence.push('Alta actividad en plataforma');
    lrs.push(0.55);
  }
  if (grades === 0) {
    evidence.push('Sin evaluaciones registradas');
    lrs.push(2.4);
  } else if (grades >= 3) {
    evidence.push('Evaluaciones registradas');
    lrs.push(0.55);
  }
  if (forums === 0) {
    evidence.push('Sin participacion en foros');
    lrs.push(1.35);
  } else if (forums >= 3) {
    evidence.push('Participacion frecuente en foros');
    lrs.push(0.65);
  }

  const priorOdds = prior / (1 - prior);
  const likelihood = lrs.reduce((acc, value) => acc * value, 1);
  const posteriorOdds = priorOdds * likelihood;
  const posterior = posteriorOdds / (1 + posteriorOdds);
  return {
    userId: item[0],
    name: item[1],
    actions,
    forums,
    grades,
    prior: round_(prior),
    posterior: round_(posterior),
    logLr: round_(Math.log(likelihood || 1)),
    riskLevel: riskLevel_(posterior),
    evidence: evidence.join('; '),
  };
}

function buildKpis_(rows) {
  const total = rows.length;
  const alerts = rows.filter((row) => row.posterior >= 0.5).length;
  const avgRisk = total ? rows.reduce((sum, row) => sum + row.posterior, 0) / total : 0;
  const risk = rows.reduce((acc, row) => {
    acc[row.riskLevel] = (acc[row.riskLevel] || 0) + 1;
    return acc;
  }, {});
  return {
    total,
    alerts,
    avgRisk: round_(avgRisk),
    actions: rows.reduce((sum, row) => sum + row.actions, 0),
    forums: rows.reduce((sum, row) => sum + row.forums, 0),
    risk,
  };
}

function riskLevel_(value) {
  if (value >= 0.7) return 'Critico';
  if (value >= 0.5) return 'Alto';
  if (value >= 0.3) return 'Medio';
  return 'Bajo';
}

function round_(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
