const DEFAULT_SPREADSHEET_ID = '1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8';
const SECRET_PROPERTY = 'REPORTA_AULA_SECRET';

function doGet() {
  return json_({
    ok: true,
    app: 'Reporta Aula Moodle',
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
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

function setReportaAulaSecret(secret) {
  PropertiesService.getScriptProperties().setProperty(SECRET_PROPERTY, secret);
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
  const width = Math.max(...values.map((row) => row.length));
  const padded = values.map((row) => {
    const copy = row.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
  sheet.setFrozenRows(1);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

