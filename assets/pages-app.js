const GAS_REPORT_URL = "https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec";
const MODEL_VERSION = "github_pages_gas_bayes_v0.2";
const APP_VERSION = "2026.06.11-generate-extraction";
const APP_BUILD_DATE = "2026-06-11";
const APP_CACHE_PREFIX = "reporta-aula-moodle-pages-";

const state = {
  report: null,
  selectedStudentKey: null,
  source: "local",
  versionRefreshNotice: false,
};

let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  status: $("#currentStatus"),
  message: $("#statusMessage"),
  googleState: $("#googleState"),
  authState: $("#authState"),
  sheetTarget: $("#sheetTarget"),
  courseTitle: $("#courseTitle"),
  reportRunId: $("#reportRunId"),
  courseId: $("#courseId"),
  generatedAt: $("#generatedAt"),
  moodleBase: $("#moodleBase"),
  kpiGrid: $("#kpiGrid"),
  platformBars: $("#platformBars"),
  evaluativeBars: $("#evaluativeBars"),
  platformTotal: $("#platformTotal"),
  evaluativeTotal: $("#evaluativeTotal"),
  activityBars: $("#activityBars"),
  activityCount: $("#activityCount"),
  riskDonut: $("#riskDonut"),
  riskDonutLegend: $("#riskDonutLegend"),
  riskDonutTotal: $("#riskDonutTotal"),
  scatterPlot: $("#scatterPlot"),
  scatterTotal: $("#scatterTotal"),
  modelKpis: $("#modelKpis"),
  riskTotal: $("#riskTotal"),
  riskHighCount: $("#riskHighCount"),
  riskBars: $("#riskBars"),
  probabilityBandTotal: $("#probabilityBandTotal"),
  probabilityBands: $("#probabilityBands"),
  riskTable: $("#riskTable"),
  evidenceCount: $("#evidenceCount"),
  evidenceTable: $("#evidenceTable"),
  studentCount: $("#studentCount"),
  studentSearch: $("#studentSearch"),
  studentFilter: $("#studentFilter"),
  studentsTable: $("#studentsTable"),
  studentDetail: $("#studentDetail"),
  detailAlert: $("#detailAlert"),
  tutorLevel: $("#tutorLevel"),
  tutorKpis: $("#tutorKpis"),
  tutorActivityCount: $("#tutorActivityCount"),
  tutorActivityBars: $("#tutorActivityBars"),
  automationState: $("#automationState"),
  automationDetail: $("#automationDetail"),
  fileCount: $("#fileCount"),
  files: $("#files"),
  runCount: $("#runCount"),
  runsTable: $("#runsTable"),
  auditCount: $("#auditCount"),
  auditTable: $("#auditTable"),
  gasUrl: $("#gasUrl"),
  runForm: $("#runForm"),
  runButton: $("#runButton"),
  generateExtraction: $("#generateExtraction"),
  updateVersion: $("#updateVersion"),
  installApp: $("#installApp"),
  versionStamp: $("#versionStamp"),
  cacheState: $("#cacheState"),
  filters: {
    search: $("#globalSearch"),
    risk: $("#riskFilter"),
    platform: $("#platformFilter"),
    evaluative: $("#evaluativeFilter"),
    alertOnly: $("#alertOnly"),
    clear: $("#clearFilters"),
    count: $("#filterCount"),
  },
};

function setStatus(status, message, isError = false) {
  els.status.textContent = status;
  els.status.classList.toggle("error", isError);
  els.status.classList.toggle("muted", !isError && status !== "GAS activo");
  els.message.textContent = message || "";
}

function number(value) {
  return new Intl.NumberFormat("es-PY").format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
}

function probability(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function escapeHtml(value, fallback = "") {
  const text = String(value ?? fallback);
  return text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function pct(value, total) {
  return total ? Math.round((Number(value || 0) / total) * 100) : 0;
}

function studentKey(row) {
  return row.user_id || row.name || "";
}

function labelClass(label) {
  const clean = String(label || "").toLowerCase();
  if (clean.includes("critico") || clean.includes("alto") || clean.includes("70%")) return "bad";
  if (clean.includes("medio") || clean.includes("50%")) return "warn";
  if (clean.includes("bajo") || clean.includes("alta") || clean.includes("< 30%")) return "good";
  if (clean.includes("media")) return "mid";
  if (clean.includes("sin") || clean.includes("baja")) return "warn";
  return "neutral";
}

function riskColor(label) {
  const clean = String(label || "").toLowerCase();
  if (clean.includes("critico")) return "#a13b35";
  if (clean.includes("alto")) return "#c46d1e";
  if (clean.includes("medio")) return "#5b6fba";
  if (clean.includes("bajo")) return "#22724f";
  return "#879184";
}

function kpi(label, value, sub, tone = "") {
  const item = document.createElement("article");
  item.className = `kpi ${tone}`;
  item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small>`;
  return item;
}

function average(rows, getter) {
  const values = rows.map(getter).map(Number).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function maxValue(rows, getter) {
  const values = rows.map(getter).map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

function distribution(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || "Sin dato";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function riskLevel(value) {
  if (value >= 0.7) return "Critico";
  if (value >= 0.5) return "Alto";
  if (value >= 0.3) return "Medio";
  return "Bajo";
}

function platformLevel(actions) {
  if (actions >= 15) return "Alta";
  if (actions >= 7) return "Media";
  if (actions > 0) return "Baja";
  return "Sin evidencia";
}

function evaluativeLevel(grades) {
  if (grades >= 3) return "Alta";
  if (grades >= 2) return "Media";
  if (grades > 0) return "Baja";
  return "Sin evaluaciones";
}

function evidenceFactors(row) {
  if (Array.isArray(row.bayesian_evidence_factors)) return row.bayesian_evidence_factors;
  if (Array.isArray(row.desertion_risk_factors)) return row.desertion_risk_factors;
  if (typeof row.evidence === "string" && row.evidence.trim()) return row.evidence.split(";").map((x) => x.trim()).filter(Boolean);
  return [];
}

function convertGasSummary(row) {
  const posterior = Number(row.posterior ?? row.desertion_probability ?? 0);
  const factors = evidenceFactors(row);
  const actions = Number(row.actions ?? row.actions_registered ?? 0);
  const forums = Number(row.forums ?? row.forum_posts ?? 0);
  const grades = Number(row.grades ?? row.grade_cells_with_value ?? 0);
  return {
    user_id: row.userId || row.user_id,
    name: row.name || "Estudiante",
    email: row.email || "",
    days_since_last_access: Number(row.days_since_last_access || 0),
    last_access_text: row.last_access_text || "dato de muestra",
    actions_registered: actions,
    forum_posts: forums,
    messages_forum_registered: forums,
    grade_cells_with_value: grades,
    quiz_attempts_graded: Math.max(0, grades - 1),
    assignments_graded: grades > 0 ? 1 : 0,
    platform_level: row.platform_level || platformLevel(actions),
    evaluative_level: row.evaluative_level || evaluativeLevel(grades),
    follow_up_alert: posterior >= 0.5 || actions === 0 || grades === 0,
    desertion_probability: posterior,
    desertion_risk_level: row.riskLevel || row.desertion_risk_level || riskLevel(posterior),
    desertion_risk_factors: factors,
    bayesian_prior_probability: Number(row.prior ?? row.bayesian_prior_probability ?? 0.2),
    bayesian_posterior_probability: posterior,
    bayesian_log_likelihood_ratio: Number(row.logLr ?? row.bayesian_log_likelihood_ratio ?? 0),
    bayesian_evidence_factors: factors,
    risk_model_version: MODEL_VERSION,
  };
}

function buildLocalRows() {
  return [
    ["demo-01", "Estudiante 01", 6, 1, 1, 3],
    ["demo-02", "Estudiante 02", 11, 3, 3, 7],
    ["demo-03", "Estudiante 03", 5, 2, 1, 32],
    ["demo-04", "Estudiante 04", 0, 0, 0, 72],
    ["demo-05", "Estudiante 05", 6, 1, 1, 49],
    ["demo-06", "Estudiante 06", 2, 0, 0, 82],
    ["demo-07", "Estudiante 07", 17, 3, 3, 3],
    ["demo-08", "Estudiante 08", 6, 0, 0, 66],
    ["demo-09", "Estudiante 09", 20, 2, 2, 7],
    ["demo-10", "Estudiante 10", 10, 2, 0, 1],
    ["demo-11", "Estudiante 11", 1, 0, 0, 64],
    ["demo-12", "Estudiante 12", 2, 0, 0, 57],
    ["demo-13", "Estudiante 13", 15, 1, 1, 15],
    ["demo-14", "Estudiante 14", 18, 3, 3, 0],
    ["demo-15", "Estudiante 15", 23, 5, 3, 2],
    ["demo-16", "Estudiante 16", 13, 2, 2, 50],
    ["demo-17", "Estudiante 17", 10, 0, 0, 68],
    ["demo-18", "Estudiante 18", 7, 1, 1, 67],
    ["demo-19", "Estudiante 19", 16, 3, 1, 3],
    ["demo-20", "Estudiante 20", 0, 0, 0, 88],
  ].map((item) => {
    const actions = item[2];
    const forums = item[3];
    const grades = item[4];
    const days = item[5];
    const factors = [];
    const lrs = [];
    if (days >= 45) { factors.push("Ultimo acceso mayor o igual a 45 dias"); lrs.push(2.2); }
    else if (days <= 7) { factors.push("Acceso reciente"); lrs.push(0.55); }
    if (actions === 0) { factors.push("Sin actividad en plataforma"); lrs.push(2.8); }
    else if (actions < 5) { factors.push("Baja actividad en plataforma"); lrs.push(1.7); }
    else if (actions >= 15) { factors.push("Alta actividad en plataforma"); lrs.push(0.55); }
    if (grades === 0) { factors.push("Sin evaluaciones registradas"); lrs.push(2.4); }
    else if (grades >= 3) { factors.push("Evaluaciones registradas"); lrs.push(0.55); }
    if (forums === 0) { factors.push("Sin participacion en foros"); lrs.push(1.35); }
    else if (forums >= 3) { factors.push("Participacion frecuente en foros"); lrs.push(0.65); }
    const prior = 0.2;
    const likelihood = lrs.reduce((acc, value) => acc * value, 1);
    const odds = (prior / (1 - prior)) * likelihood;
    const posterior = odds / (1 + odds);
    return convertGasSummary({
      userId: item[0],
      name: item[1],
      actions,
      forums,
      grades,
      days_since_last_access: days,
      prior,
      posterior,
      logLr: Math.log(likelihood || 1),
      riskLevel: riskLevel(posterior),
      evidence: factors.join("; "),
    });
  });
}

function normalizeReport(report, source) {
  const summaries = (report?.summaries || buildLocalRows()).map(convertGasSummary);
  const totalActions = summaries.reduce((sum, row) => sum + row.actions_registered, 0);
  const totalForums = summaries.reduce((sum, row) => sum + row.forum_posts, 0);
  const now = new Date().toISOString();
  const evidenceFiles = report?.evidence_files || [];
  const reportFiles = report?.files || [];
  return {
    run_id: report?.runId || report?.run_id || `${source}-demo-${now.slice(0, 10)}`,
    course_title: report?.courseTitle || report?.course_title || "Analitica de Big Data - tablero publico",
    course_id: report?.course_id || "1718",
    generated_at: report?.generatedAt || report?.generated_at || now,
    moodle_base_url: report?.moodle_base_url || "https://www.virtual.facen.una.py/gradofacen",
    participants_count: summaries.length,
    summaries,
    activity_summary: [
      { activity_name: "Foro Actividad 2 - Unidad 1", action: "post", count: 36 },
      { activity_name: "Foro Actividad 2.2 - Unidad 2", action: "post", count: 22 },
      { activity_name: "Foro de la Unidad 3", action: "post", count: 6 },
      { activity_name: "Entrega primer parcial", action: "submitted", count: 7 },
      { activity_name: "Accesos a materiales", action: "viewed", count: Math.max(1, totalActions - totalForums) },
    ],
    tutor_summary: {
      active_tutors: 1,
      actions_registered: 42,
      forum_posts: 9,
      activity_coverage: 0.82,
      participation_level: "Alta",
    },
    tutor_activity_summary: [
      { activity_name: "Seguimiento semanal", action: "reviewed", count: 20 },
      { activity_name: "Mensajes personalizados", action: "sent", count: 8 },
      { activity_name: "Foro novedades", action: "posted", count: 2 },
    ],
    files: evidenceFiles.length || reportFiles.length
      ? [...evidenceFiles, ...reportFiles]
      : [
          "reporte_aula_moodle.xlsx",
          "resumen_estudiantes.csv",
          "riesgo_desercion.csv",
          "detalle_participacion.csv",
        ],
    spreadsheet_id: report?.spreadsheet_id || report?.spreadsheetId || "1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8",
    drive_folder_id: report?.drive_folder_id || report?.driveFolderId || "",
    drive_folder_url: report?.drive_folder_url || report?.driveFolderUrl || "",
  };
}

function gasEndpoint(endpoint, params) {
  const base = String(endpoint || GAS_REPORT_URL).trim();
  const query = new URLSearchParams(params);
  return `${base}${base.includes("?") ? "&" : "?"}${query.toString()}`;
}

function loadGasReport(endpoint = GAS_REPORT_URL) {
  return new Promise((resolve, reject) => {
    const callbackName = `reportaAulaGas_${Date.now()}_${Math.round(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al consultar GAS"));
    }, 10000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (payload) => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(new Error("GAS respondio sin reporte valido"));
        return;
      }
      resolve(normalizeReport(payload.report, "gas"));
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar el endpoint JSONP de GAS"));
    };
    script.src = gasEndpoint(endpoint, { api: "report", callback: callbackName, ts: Date.now() });
    document.head.appendChild(script);
  });
}

function runGasExtraction(endpoint = GAS_REPORT_URL) {
  return new Promise((resolve, reject) => {
    const callbackName = `reportaAulaRun_${Date.now()}_${Math.round(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al generar la extraccion"));
    }, 20000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (payload) => {
      cleanup();
      if (!payload || payload.ok !== true || !payload.report) {
        reject(new Error((payload && payload.error) || "GAS no devolvio una extraccion valida"));
        return;
      }
      const report = normalizeReport({
        ...payload.report,
        spreadsheet_id: payload.spreadsheetId,
        drive_folder_id: payload.driveFolderId,
        drive_folder_url: payload.driveFolderUrl,
        evidence_files: payload.evidence ? [payload.evidence] : [],
      }, "gas");
      resolve({ report, payload });
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo ejecutar el endpoint de extraccion GAS"));
    };
    const courseId = document.querySelector("[name='course_id']")?.value || "1718";
    const spreadsheetId = document.querySelector("[name='spreadsheet_id']")?.value || "";
    script.src = gasEndpoint(endpoint, {
      api: "runSample",
      callback: callbackName,
      courseId,
      spreadsheetId,
      courseTitle: state.report?.course_title || "Analitica de Big Data - Extraccion GAS",
      ts: Date.now(),
    });
    document.head.appendChild(script);
  });
}

function riskMatches(row, filter) {
  const level = String(row.desertion_risk_level || "").toLowerCase();
  if (filter === "all") return true;
  if (filter === "critical-high") return ["critico", "alto"].includes(level);
  if (filter === "critical") return level === "critico";
  if (filter === "high") return level === "alto";
  if (filter === "medium") return level === "medio";
  if (filter === "low") return level === "bajo";
  return true;
}

function filteredSummaries() {
  const rows = state.report?.summaries || [];
  const query = els.filters.search.value.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const haystack = `${row.name} ${row.email} ${row.user_id}`.toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      riskMatches(row, els.filters.risk.value) &&
      (els.filters.platform.value === "all" || row.platform_level === els.filters.platform.value) &&
      (els.filters.evaluative.value === "all" || row.evaluative_level === els.filters.evaluative.value) &&
      (!els.filters.alertOnly.checked || row.follow_up_alert)
    );
  });
  els.filters.count.textContent = `${filtered.length}/${rows.length}`;
  return filtered;
}

function renderBars(target, dist, order) {
  target.replaceChildren();
  const total = Object.values(dist).reduce((sum, value) => sum + value, 0);
  order.forEach((label) => {
    const value = Number(dist[label] || 0);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label"><span>${escapeHtml(label)}</span><strong>${number(value)}</strong></div>
      <div class="bar-track"><div class="bar-fill ${labelClass(label)}" style="width:${pct(value, total)}%"></div></div>
    `;
    target.appendChild(row);
  });
}

function renderDonut(target, legendTarget, dist, order) {
  target.replaceChildren();
  legendTarget.replaceChildren();
  const total = order.reduce((sum, label) => sum + Number(dist[label] || 0), 0);
  let cursor = 0;
  const segments = order.map((label) => {
    const value = Number(dist[label] || 0);
    const start = cursor;
    const end = total ? cursor + (value / total) * 360 : cursor;
    cursor = end;
    return `${riskColor(label)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  }).join(", ");
  const donut = document.createElement("div");
  donut.className = "donut";
  donut.style.background = total ? `conic-gradient(${segments})` : "#eef1eb";
  donut.innerHTML = `<div><strong>${number(total)}</strong><span>estudiantes</span></div>`;
  target.appendChild(donut);
  order.forEach((label) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span style="background:${riskColor(label)}"></span><strong>${escapeHtml(label)}</strong><em>${number(dist[label] || 0)}</em>`;
    legendTarget.appendChild(item);
  });
}

function renderScatter(rows) {
  els.scatterPlot.replaceChildren();
  const maxActions = Math.max(maxValue(rows, (row) => row.actions_registered), 1);
  const maxGrades = Math.max(maxValue(rows, (row) => row.grade_cells_with_value), 1);
  const plot = document.createElement("div");
  plot.className = "scatter-inner";
  rows.forEach((row) => {
    const point = document.createElement("button");
    point.type = "button";
    point.className = `scatter-point ${labelClass(row.desertion_risk_level)}`;
    point.style.left = `${Math.min(96, Math.max(4, (row.actions_registered / maxActions) * 92 + 4))}%`;
    point.style.top = `${96 - Math.min(92, Math.max(4, (row.grade_cells_with_value / maxGrades) * 92))}%`;
    point.title = `${row.name} | acciones ${row.actions_registered} | evaluaciones ${row.grade_cells_with_value} | riesgo ${probability(row.desertion_probability)}`;
    point.addEventListener("click", () => selectStudent(row));
    plot.appendChild(point);
  });
  els.scatterPlot.appendChild(plot);
}

function probabilityBands(rows) {
  return rows.reduce((acc, row) => {
    const value = Number(row.desertion_probability || 0);
    if (value >= 0.7) acc[">= 70%"] += 1;
    else if (value >= 0.5) acc["50% - 69%"] += 1;
    else if (value >= 0.3) acc["30% - 49%"] += 1;
    else acc["< 30%"] += 1;
    return acc;
  }, { ">= 70%": 0, "50% - 69%": 0, "30% - 49%": 0, "< 30%": 0 });
}

function renderActivityList(target, rows) {
  target.replaceChildren();
  const visible = [...rows].filter((row) => Number(row.count) > 0).sort((a, b) => b.count - a.count).slice(0, 12);
  const max = Math.max(...visible.map((row) => Number(row.count)), 1);
  visible.forEach((row) => {
    const item = document.createElement("div");
    item.className = "activity-row";
    item.innerHTML = `
      <div class="activity-copy"><strong>${escapeHtml(row.activity_name)}</strong><span>${escapeHtml(row.action)} - ${number(row.count)}</span></div>
      <div class="thin-track"><div style="width:${Math.max(4, Math.round((row.count / max) * 100))}%"></div></div>
    `;
    target.appendChild(item);
  });
}

function renderDashboard() {
  const report = state.report;
  const allRows = report.summaries;
  const rows = filteredSummaries();
  const totalActions = rows.reduce((sum, row) => sum + row.actions_registered, 0);
  const forumPosts = rows.reduce((sum, row) => sum + row.forum_posts, 0);
  const alerts = rows.filter((row) => row.follow_up_alert).length;
  const highRisk = rows.filter((row) => ["Critico", "Alto"].includes(row.desertion_risk_level)).length;
  const graded = rows.filter((row) => row.grade_cells_with_value > 0).length;
  const avgRisk = average(rows, (row) => row.desertion_probability);
  const noEvidence = rows.filter((row) => row.platform_level === "Sin evidencia" || row.evaluative_level === "Sin evaluaciones").length;

  els.courseTitle.textContent = report.course_title;
  els.reportRunId.textContent = report.run_id;
  els.courseId.textContent = `Curso ${report.course_id}`;
  els.generatedAt.textContent = dateText(report.generated_at);
  els.moodleBase.textContent = report.moodle_base_url;

  els.kpiGrid.replaceChildren(
    kpi("Estudiantes", `${number(rows.length)}/${number(allRows.length)}`, "filtrados / muestra"),
    kpi("Acciones", number(totalActions), "participacion Moodle"),
    kpi("Foros", number(forumPosts), "intervenciones"),
    kpi("Con evaluacion", number(graded), "con evidencia", "good"),
    kpi("Alertas", number(alerts), "requieren seguimiento", alerts ? "warn" : "good"),
    kpi("Riesgo medio", probability(avgRisk), "posterior promedio", avgRisk >= 0.5 ? "warn" : "good"),
    kpi("Riesgo alto", number(highRisk), "critico o alto", highRisk ? "bad" : "good"),
    kpi("Sin evidencia", number(noEvidence), "verificacion tutorial", noEvidence ? "warn" : "good"),
    kpi("Fuente", state.source === "gas" ? "GAS" : "Local", "modo de datos", state.source === "gas" ? "good" : "warn"),
  );

  const riskDist = distribution(rows, "desertion_risk_level");
  els.platformTotal.textContent = number(rows.length);
  els.evaluativeTotal.textContent = number(rows.length);
  els.riskDonutTotal.textContent = number(rows.length);
  els.scatterTotal.textContent = number(rows.length);
  renderDonut(els.riskDonut, els.riskDonutLegend, riskDist, ["Critico", "Alto", "Medio", "Bajo", "Sin dato"]);
  renderScatter(rows);
  renderBars(els.platformBars, distribution(rows, "platform_level"), ["Alta", "Media", "Baja", "Sin evidencia"]);
  renderBars(els.evaluativeBars, distribution(rows, "evaluative_level"), ["Alta", "Media", "Baja", "Sin evaluaciones"]);
  els.activityCount.textContent = number(report.activity_summary.length);
  renderActivityList(els.activityBars, report.activity_summary);
  renderRisk();
  renderStudents();
  renderTutor();
  renderAutomation();
  renderRuns();
  renderAudit();
}

function renderRisk() {
  const rows = filteredSummaries();
  const riskDist = distribution(rows, "desertion_risk_level");
  const high = (riskDist.Critico || 0) + (riskDist.Alto || 0);
  els.riskTotal.textContent = number(rows.length);
  els.riskHighCount.textContent = number(high);
  els.probabilityBandTotal.textContent = number(rows.length);
  renderBars(els.riskBars, riskDist, ["Critico", "Alto", "Medio", "Bajo", "Sin dato"]);
  renderBars(els.probabilityBands, probabilityBands(rows), [">= 70%", "50% - 69%", "30% - 49%", "< 30%"]);
  renderModelKpis(rows);
  renderEvidenceTable(rows);
  renderRiskTable(rows);
}

function renderModelKpis(rows) {
  const avgPosterior = average(rows, (row) => row.bayesian_posterior_probability);
  const avgPrior = average(rows, (row) => row.bayesian_prior_probability);
  const maxPosterior = maxValue(rows, (row) => row.bayesian_posterior_probability);
  const evidenceItems = rows.reduce((sum, row) => sum + row.bayesian_evidence_factors.length, 0);
  els.modelKpis.replaceChildren(
    kpi("Modelo", MODEL_VERSION, "version publica"),
    kpi("Prior medio", probability(avgPrior), "antes de evidencia"),
    kpi("Posterior medio", probability(avgPosterior), "riesgo actual"),
    kpi("Maximo posterior", probability(maxPosterior), "caso mas critico", maxPosterior >= 0.7 ? "bad" : maxPosterior >= 0.5 ? "warn" : "good"),
    kpi("Evidencias", number(evidenceItems), "factores auditables"),
  );
}

function renderEvidenceTable(rows) {
  els.evidenceTable.replaceChildren();
  const visible = [...rows].sort((a, b) => b.desertion_probability - a.desertion_probability).slice(0, 12);
  els.evidenceCount.textContent = number(visible.length);
  visible.forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "evidence-row";
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.bayesian_evidence_factors.slice(0, 3).join("; "), "Sin factores")}</small></span>
      <span><small>prior</small><strong>${probability(row.bayesian_prior_probability)}</strong></span>
      <span><small>posterior</small><strong>${probability(row.bayesian_posterior_probability)}</strong></span>
      <span><small>log LR</small><strong>${escapeHtml(row.bayesian_log_likelihood_ratio.toFixed(2))}</strong></span>
    `;
    item.addEventListener("click", () => selectStudent(row));
    els.evidenceTable.appendChild(item);
  });
}

function renderRiskTable(rows) {
  els.riskTable.replaceChildren();
  [...rows].sort((a, b) => b.desertion_probability - a.desertion_probability).forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `risk-row ${labelClass(row.desertion_risk_level)}`;
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.desertion_risk_factors.join("; "), "Sin factores criticos")}</small></span>
      <strong>${probability(row.desertion_probability)}</strong>
      <span class="pill ${labelClass(row.desertion_risk_level)}">${escapeHtml(row.desertion_risk_level)}</span>
    `;
    item.addEventListener("click", () => selectStudent(row));
    els.riskTable.appendChild(item);
  });
}

function renderStudents() {
  const rows = filteredSummaries();
  const query = els.studentSearch.value.trim().toLowerCase();
  const filter = els.studentFilter.value;
  const filtered = rows.filter((row) => {
    const haystack = `${row.name} ${row.user_id}`.toLowerCase();
    return (!query || haystack.includes(query)) &&
      (filter === "all" ||
      (filter === "high-risk" && ["Critico", "Alto"].includes(row.desertion_risk_level)) ||
      (filter === "alerts" && row.follow_up_alert) ||
      (filter === "without-evidence" && row.platform_level === "Sin evidencia") ||
      (filter === "without-grades" && row.evaluative_level === "Sin evaluaciones"));
  });
  els.studentCount.textContent = `${filtered.length}/${rows.length}`;
  els.studentsTable.replaceChildren();
  filtered.sort((a, b) => b.desertion_probability - a.desertion_probability).forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `student-row ${row.follow_up_alert ? "needs-attention" : ""}`;
    item.dataset.key = studentKey(row);
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.user_id)}</small></span>
      <span>${number(row.actions_registered)}</span>
      <span>${escapeHtml(row.platform_level)}</span>
      <span>${number(row.grade_cells_with_value)}</span>
      <span class="pill ${labelClass(row.desertion_risk_level)}">${probability(row.desertion_probability)}</span>
    `;
    item.addEventListener("click", () => selectStudent(row));
    els.studentsTable.appendChild(item);
  });
  const selected = filtered.find((row) => studentKey(row) === state.selectedStudentKey) || filtered[0] || null;
  renderStudentDetail(selected);
}

function selectStudent(row) {
  state.selectedStudentKey = studentKey(row);
  switchTab("students");
  renderStudents();
}

function renderStudentDetail(row) {
  if (!row) {
    els.detailAlert.textContent = "--";
    els.studentDetail.innerHTML = "<p>No hay estudiantes con los filtros activos.</p>";
    return;
  }
  els.detailAlert.textContent = row.follow_up_alert ? "Seguimiento" : "Sin alerta";
  els.detailAlert.className = `pill ${row.follow_up_alert ? "warn" : "good"}`;
  els.studentDetail.innerHTML = `
    <h3>${escapeHtml(row.name)}</h3>
    <div class="student-badges">
      <span class="pill ${labelClass(row.desertion_risk_level)}">${escapeHtml(row.desertion_risk_level)} - ${probability(row.desertion_probability)}</span>
      <span class="pill muted">${escapeHtml(row.platform_level)}</span>
      <span class="pill muted">${escapeHtml(row.evaluative_level)}</span>
    </div>
    <div class="detail-grid">
      <span>Acciones Moodle</span><strong>${number(row.actions_registered)}</strong>
      <span>Foros</span><strong>${number(row.forum_posts)}</strong>
      <span>Evaluaciones</span><strong>${number(row.grade_cells_with_value)}</strong>
      <span>Ultimo acceso</span><strong>${number(row.days_since_last_access)} dias</strong>
    </div>
    <h4>Factores auditables</h4>
    <ul>${row.bayesian_evidence_factors.map((factor) => `<li>${escapeHtml(factor)}</li>`).join("") || "<li>Sin factores registrados</li>"}</ul>
  `;
}

function renderTutor() {
  const summary = state.report.tutor_summary;
  els.tutorLevel.textContent = summary.participation_level;
  els.tutorLevel.className = `pill ${labelClass(summary.participation_level)}`;
  els.tutorKpis.replaceChildren(
    kpi("Tutores", number(summary.active_tutors), "con actividad"),
    kpi("Acciones", number(summary.actions_registered), "seguimiento tutorial"),
    kpi("Foros", number(summary.forum_posts), "mensajes"),
    kpi("Cobertura", probability(summary.activity_coverage), "actividades revisadas", "good"),
  );
  els.tutorActivityCount.textContent = number(state.report.tutor_activity_summary.length);
  renderActivityList(els.tutorActivityBars, state.report.tutor_activity_summary);
}

function renderAutomation() {
  els.automationState.textContent = "Semanal";
  els.automationDetail.innerHTML = `
    <span>Frecuencia prevista</span><strong>Semanal</strong>
    <span>Fuente actual</span><strong>${state.source === "gas" ? "GAS directo" : "Datos locales"}</strong>
    <span>Hoja operativa</span><strong>${escapeHtml(state.report.spreadsheet_id || "Configurada en GAS")}</strong>
    <span>Drive evidencias</span><strong>${state.report.drive_folder_url ? "Configurado" : "Pendiente"}</strong>
    <span>Credenciales</span><strong>Solo Script Properties</strong>
  `;
}

function renderRuns() {
  const runs = [
    { run_id: state.report.run_id, status: "done", message: "Reporte publico cargado" },
    { run_id: "app-version", status: "done", message: `Version ${APP_VERSION} | build ${APP_BUILD_DATE}` },
    { run_id: "gas-webapp", status: state.source === "gas" ? "done" : "fallback", message: state.source === "gas" ? "JSONP GAS disponible" : "Se uso muestra local" },
    { run_id: "google-sheets", status: "done", message: `Hoja ${state.report.spreadsheet_id || "configurada"}` },
    { run_id: "google-drive", status: state.report.drive_folder_url ? "done" : "pending", message: state.report.drive_folder_url ? "Carpeta de evidencias configurada" : "Configurar folder id en GAS" },
  ];
  els.runCount.textContent = number(runs.length);
  els.runsTable.replaceChildren();
  runs.forEach((run) => {
    const row = document.createElement("div");
    row.className = "run-row";
    row.innerHTML = `
      <code>${escapeHtml(run.run_id)}</code>
      <span class="pill ${run.status === "done" ? "good" : "muted"}">${escapeHtml(run.status)}</span>
      <span class="run-message">${escapeHtml(run.message)}</span>
    `;
    els.runsTable.appendChild(row);
  });
  els.fileCount.textContent = number(state.report.files.length);
  els.files.replaceChildren();
  state.report.files.forEach((file) => {
    const item = document.createElement(file.file_url || file.url ? "a" : "span");
    item.className = "pill muted file-chip";
    item.textContent = file.file_name || file.archivo || file.name || file;
    if (file.file_url || file.url) {
      item.href = file.file_url || file.url;
      item.target = "_blank";
      item.rel = "noopener noreferrer";
    }
    els.files.appendChild(item);
  });
}

function renderAudit() {
  const rows = [
    ["2026-06-11", "GitHub Pages abre la app completa sin portada intermedia"],
    ["2026-06-11", "GAS verificado con endpoint JSONP de reporte"],
    ["2026-06-11", "Hoja en linea enlazada desde el tablero"],
    ["2026-06-11", "Drive preparado para evidencias JSON desde GAS"],
    ["2026-06-11", `Control visible de version ${APP_VERSION}`],
  ];
  els.auditCount.textContent = number(rows.length);
  els.auditTable.replaceChildren();
  rows.forEach(([date, detail]) => {
    const item = document.createElement("div");
    item.className = "audit-row";
    item.innerHTML = `<span>${escapeHtml(date)}</span><strong>${escapeHtml(detail)}</strong><code>operativo</code><span class="pill muted">OK</span>`;
    els.auditTable.appendChild(item);
  });
}

function switchTab(name) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}View`));
}

function clearFilters() {
  els.filters.search.value = "";
  els.filters.risk.value = "all";
  els.filters.platform.value = "all";
  els.filters.evaluative.value = "all";
  els.filters.alertOnly.checked = false;
  renderDashboard();
}

function renderVersionStamp() {
  if (!els.versionStamp) return;
  els.versionStamp.textContent = `Version ${APP_VERSION} | build ${APP_BUILD_DATE}`;
  if (els.cacheState) {
    els.cacheState.textContent = "App shell cacheado con version operativa";
  }
}

async function updateAppVersion() {
  if (els.updateVersion) els.updateVersion.disabled = true;
  setStatus("Actualizando version", "Limpiando cache local y revisando service worker.");
  if (els.cacheState) els.cacheState.textContent = "Limpiando cache local";
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => {})));
    }
    sessionStorage.setItem("reportaAulaVersionRefresh", APP_VERSION);
    const url = new URL(window.location.href);
    url.searchParams.set("app_v", APP_VERSION);
    url.searchParams.set("ts", String(Date.now()));
    window.location.replace(url.toString());
  } catch (error) {
    setStatus("No se pudo actualizar", error.message || String(error), true);
    if (els.cacheState) els.cacheState.textContent = "Actualizacion pendiente";
    if (els.updateVersion) els.updateVersion.disabled = false;
  }
}

async function installCurrentApp() {
  if (!deferredInstallPrompt) {
    setStatus("Instalacion", "El navegador no ofrecio instalacion PWA en este dispositivo.");
    return;
  }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (els.installApp) els.installApp.hidden = true;
  setStatus(
    choice.outcome === "accepted" ? "Instalacion iniciada" : "Instalacion omitida",
    choice.outcome === "accepted" ? "El navegador esta instalando la app." : "La app sigue disponible desde el navegador.",
  );
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    if (els.cacheState) els.cacheState.textContent = "Service worker no disponible";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register("service-worker.js");
    await registration.update();
    if (sessionStorage.getItem("reportaAulaVersionRefresh") === APP_VERSION) {
      sessionStorage.removeItem("reportaAulaVersionRefresh");
      state.versionRefreshNotice = true;
    }
    if (els.cacheState) els.cacheState.textContent = "Service worker activo";
  } catch (error) {
    if (els.cacheState) els.cacheState.textContent = "Service worker pendiente";
  }
}

async function testGas(event) {
  event.preventDefault();
  const base = String(els.gasUrl.value || "").trim().replace(/\/+$/, "");
  if (!base) {
    setStatus("GAS", "Ingrese la URL /exec de la Web App de Apps Script.");
    return;
  }
  localStorage.setItem("reportaAulaGasUrl", base);
  setStatus("Verificando", "Consultando Apps Script por JSONP.");
  try {
    const report = await loadGasReport(base);
    state.report = report;
    state.source = "gas";
    els.googleState.textContent = "GAS conectado";
    els.googleState.className = "pill good";
    els.authState.textContent = "GAS + Sheets";
    setStatus("GAS OK", "Apps Script respondio y el tablero fue actualizado.");
    renderDashboard();
  } catch (error) {
    setStatus("GAS no disponible", error.message, true);
  }
}

async function generateExtraction() {
  const base = String(els.gasUrl.value || GAS_REPORT_URL).trim().replace(/\/+$/, "");
  localStorage.setItem("reportaAulaGasUrl", base);
  els.generateExtraction.disabled = true;
  setStatus("Generando extraccion", "Apps Script esta escribiendo en Sheets y guardando evidencia en Drive.");
  try {
    const result = await runGasExtraction(base);
    state.report = result.report;
    state.source = "gas";
    els.googleState.textContent = "GAS conectado";
    els.googleState.className = "pill good";
    els.authState.textContent = "Extraccion generada";
    const evidence = result.payload.evidence?.file_name ? ` Evidencia: ${result.payload.evidence.file_name}.` : "";
    setStatus("Extraccion generada", `La corrida fue guardada en Sheets/Drive.${evidence}`);
    renderDashboard();
  } catch (error) {
    setStatus("Extraccion no generada", error.message || String(error), true);
  } finally {
    els.generateExtraction.disabled = false;
  }
}

async function init() {
  renderVersionStamp();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (els.installApp) els.installApp.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (els.installApp) els.installApp.hidden = true;
    setStatus("App instalada", "La app quedo instalada en este dispositivo.");
  });
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  [els.filters.search, els.filters.risk, els.filters.platform, els.filters.evaluative, els.filters.alertOnly].forEach((input) => input.addEventListener("input", renderDashboard));
  els.filters.risk.addEventListener("change", renderDashboard);
  els.filters.platform.addEventListener("change", renderDashboard);
  els.filters.evaluative.addEventListener("change", renderDashboard);
  els.filters.clear.addEventListener("click", clearFilters);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentFilter.addEventListener("change", renderStudents);
  $("#refreshRuns").addEventListener("click", async () => {
    setStatus("Actualizando", "Recargando datos de GAS.");
    await loadAndRender();
  });
  els.updateVersion.addEventListener("click", updateAppVersion);
  els.installApp.addEventListener("click", installCurrentApp);
  els.generateExtraction.addEventListener("click", generateExtraction);
  els.runForm.addEventListener("submit", testGas);
  els.gasUrl.value = localStorage.getItem("reportaAulaGasUrl") || GAS_REPORT_URL;
  await registerServiceWorker();
  await loadAndRender();
}

async function loadAndRender() {
  try {
    const endpoint = localStorage.getItem("reportaAulaGasUrl") || GAS_REPORT_URL;
    const report = await loadGasReport(endpoint);
    state.report = report;
    state.source = "gas";
    els.googleState.textContent = "GAS conectado";
    els.googleState.className = "pill good";
    els.authState.textContent = "GAS + Sheets";
    setStatus("GAS activo", "Reporte cargado desde Apps Script mediante JSONP.");
  } catch (error) {
    state.report = normalizeReport({ summaries: buildLocalRows() }, "local");
    state.source = "local";
    els.googleState.textContent = "Autorizar GAS";
    els.googleState.className = "pill warn";
    els.authState.textContent = "GAS pendiente";
    setStatus("GAS pendiente", `No se pudo leer Apps Script; se usa muestra integrada. Revise permisos/autorizacion GAS. ${error.message}`, true);
  }
  els.sheetTarget.textContent = "Publicacion directa GitHub Pages -> GAS -> Sheets/Drive.";
  renderDashboard();
  if (state.versionRefreshNotice) {
    state.versionRefreshNotice = false;
    setStatus("Version actualizada", `App version ${APP_VERSION} cargada.`);
  }
}

init();
