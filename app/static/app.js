const form = document.querySelector("#runForm");
const automationForm = document.querySelector("#automationForm");
const runButton = document.querySelector("#runButton");
const currentStatus = document.querySelector("#currentStatus");
const statusMessage = document.querySelector("#statusMessage");
const files = document.querySelector("#files");
const fileCount = document.querySelector("#fileCount");
const runsTable = document.querySelector("#runsTable");
const runCount = document.querySelector("#runCount");
const refreshRuns = document.querySelector("#refreshRuns");
const sheetTarget = document.querySelector("#sheetTarget");
const googleState = document.querySelector("#googleState");
const authState = document.querySelector("#authState");
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const intervalPreset = document.querySelector("#intervalPreset");
const runAutomationNow = document.querySelector("#runAutomationNow");
const globalFilters = {
  search: document.querySelector("#globalSearch"),
  risk: document.querySelector("#riskFilter"),
  platform: document.querySelector("#platformFilter"),
  evaluative: document.querySelector("#evaluativeFilter"),
  alertOnly: document.querySelector("#alertOnly"),
  clear: document.querySelector("#clearFilters"),
  count: document.querySelector("#filterCount"),
};

const dashboard = {
  courseTitle: document.querySelector("#courseTitle"),
  reportRunId: document.querySelector("#reportRunId"),
  courseId: document.querySelector("#courseId"),
  generatedAt: document.querySelector("#generatedAt"),
  moodleBase: document.querySelector("#moodleBase"),
  kpiGrid: document.querySelector("#kpiGrid"),
  platformBars: document.querySelector("#platformBars"),
  evaluativeBars: document.querySelector("#evaluativeBars"),
  platformTotal: document.querySelector("#platformTotal"),
  evaluativeTotal: document.querySelector("#evaluativeTotal"),
  activityBars: document.querySelector("#activityBars"),
  activityCount: document.querySelector("#activityCount"),
  riskDonut: document.querySelector("#riskDonut"),
  riskDonutLegend: document.querySelector("#riskDonutLegend"),
  riskDonutTotal: document.querySelector("#riskDonutTotal"),
  scatterPlot: document.querySelector("#scatterPlot"),
  scatterTotal: document.querySelector("#scatterTotal"),
};

const risk = {
  total: document.querySelector("#riskTotal"),
  highCount: document.querySelector("#riskHighCount"),
  bars: document.querySelector("#riskBars"),
  table: document.querySelector("#riskTable"),
  modelKpis: document.querySelector("#modelKpis"),
  probabilityBandTotal: document.querySelector("#probabilityBandTotal"),
  probabilityBands: document.querySelector("#probabilityBands"),
  evidenceCount: document.querySelector("#evidenceCount"),
  evidenceTable: document.querySelector("#evidenceTable"),
};

const students = {
  count: document.querySelector("#studentCount"),
  search: document.querySelector("#studentSearch"),
  filter: document.querySelector("#studentFilter"),
  table: document.querySelector("#studentsTable"),
  detail: document.querySelector("#studentDetail"),
  detailAlert: document.querySelector("#detailAlert"),
};

const tutor = {
  level: document.querySelector("#tutorLevel"),
  kpis: document.querySelector("#tutorKpis"),
  activityCount: document.querySelector("#tutorActivityCount"),
  activityBars: document.querySelector("#tutorActivityBars"),
};

const automation = {
  state: document.querySelector("#automationState"),
  detail: document.querySelector("#automationDetail"),
};

const audit = {
  count: document.querySelector("#auditCount"),
  table: document.querySelector("#auditTable"),
};

let activeRun = null;
let activeReport = null;
let selectedStudentKey = null;
let pollTimer = null;

function switchTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  views.forEach((view) => view.classList.toggle("active", view.id === `${name}View`));
}

function setStatus(status, message, isError = false) {
  currentStatus.textContent = status;
  currentStatus.classList.toggle("error", isError);
  currentStatus.classList.toggle("muted", !isError && status === "Listo");
  statusMessage.textContent = message || "";
}

function number(value) {
  return new Intl.NumberFormat("es-PY").format(value || 0);
}

function dateText(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
}

function probability(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function escapeHtml(value, fallback = "") {
  const text = String(value || fallback);
  return text.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function studentKey(student) {
  return student.user_id || student.name || student.email || "";
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function labelClass(label) {
  const clean = String(label || "").toLowerCase();
  if (clean.includes("sin dato")) return "neutral";
  if (clean.includes("70%")) return "bad";
  if (clean.includes("50%")) return "warn";
  if (clean.includes("30%")) return clean.includes("<") ? "good" : "mid";
  if (clean.includes("critico") || clean.includes("alto")) return "bad";
  if (clean.includes("alta")) return "good";
  if (clean.includes("media") || clean.includes("medio")) return "mid";
  if (clean.includes("baja")) return "warn";
  if (clean.includes("bajo")) return "good";
  if (clean.includes("sin")) return "bad";
  return "neutral";
}

function riskMatchesFilter(row, filter) {
  const level = String(row.desertion_risk_level || "").toLowerCase();
  if (filter === "all") return true;
  if (filter === "critical-high") return ["critico", "alto"].includes(level);
  if (filter === "critical") return level === "critico";
  if (filter === "high") return level === "alto";
  if (filter === "medium") return level === "medio";
  if (filter === "low") return level === "bajo";
  return true;
}

function globalFilteredSummaries() {
  const rows = activeReport?.summaries || [];
  const query = globalFilters.search.value.trim().toLowerCase();
  const riskFilter = globalFilters.risk.value;
  const platformFilter = globalFilters.platform.value;
  const evaluativeFilter = globalFilters.evaluative.value;
  const alertOnly = globalFilters.alertOnly.checked;
  const filtered = rows.filter((row) => {
    const haystack = `${row.name || ""} ${row.email || ""} ${row.user_id || ""}`.toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      riskMatchesFilter(row, riskFilter) &&
      (platformFilter === "all" || row.platform_level === platformFilter) &&
      (evaluativeFilter === "all" || row.evaluative_level === evaluativeFilter) &&
      (!alertOnly || row.follow_up_alert)
    );
  });
  globalFilters.count.textContent = `${filtered.length}/${rows.length}`;
  return filtered;
}

function clearGlobalFilters() {
  globalFilters.search.value = "";
  globalFilters.risk.value = "all";
  globalFilters.platform.value = "all";
  globalFilters.evaluative.value = "all";
  globalFilters.alertOnly.checked = false;
  rerenderActiveReport();
}

function rerenderActiveReport() {
  if (activeReport) renderDashboard(activeReport);
}

function average(rows, getter) {
  const values = rows.map(getter).map(Number).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxValue(rows, getter) {
  const values = rows.map(getter).map(Number).filter((value) => Number.isFinite(value));
  return values.length ? Math.max(...values) : 0;
}

function riskColor(label) {
  const clean = String(label || "").toLowerCase();
  if (clean.includes("critico")) return "#a13b35";
  if (clean.includes("alto")) return "#c46d1e";
  if (clean.includes("medio")) return "#5b6fba";
  if (clean.includes("bajo")) return "#22724f";
  return "#879184";
}

function probabilityBands(rows) {
  const bands = {
    ">= 70%": 0,
    "50% - 69%": 0,
    "30% - 49%": 0,
    "< 30%": 0,
  };
  rows.forEach((row) => {
    const value = Number(row.desertion_probability || 0);
    if (value >= 0.7) bands[">= 70%"] += 1;
    else if (value >= 0.5) bands["50% - 69%"] += 1;
    else if (value >= 0.3) bands["30% - 49%"] += 1;
    else bands["< 30%"] += 1;
  });
  return bands;
}

function fileLink(runId, filename) {
  const a = document.createElement("a");
  a.href = `/api/runs/${runId}/files/${encodeURIComponent(filename)}`;
  a.textContent = filename;
  return a;
}

function renderFiles(run) {
  files.replaceChildren();
  fileCount.textContent = String((run.files || []).length);
  (run.files || []).forEach((filename) => files.appendChild(fileLink(run.run_id, filename)));
}

function kpi(label, value, sub, tone = "") {
  const item = document.createElement("article");
  item.className = `kpi ${tone}`;
  item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small>`;
  return item;
}

function distribution(rows, field) {
  const out = {};
  rows.forEach((row) => {
    const key = row[field] || "Sin dato";
    out[key] = (out[key] || 0) + 1;
  });
  return out;
}

function renderBars(target, dist, order) {
  target.replaceChildren();
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  order.forEach((label) => {
    const value = dist[label] || 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
      <div class="bar-track"><div class="bar-fill ${labelClass(label)}" style="width: ${pct(value, total)}%"></div></div>
    `;
    target.appendChild(row);
  });
}

function renderDonut(target, legendTarget, dist, order) {
  target.replaceChildren();
  legendTarget.replaceChildren();
  const total = order.reduce((sum, label) => sum + Number(dist[label] || 0), 0);
  let cursor = 0;
  const segments = order
    .map((label) => {
      const value = Number(dist[label] || 0);
      const start = cursor;
      const end = total ? cursor + (value / total) * 360 : cursor;
      cursor = end;
      return `${riskColor(label)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    })
    .join(", ");
  const donut = document.createElement("div");
  donut.className = "donut";
  donut.style.background = total ? `conic-gradient(${segments})` : "#eef1eb";
  donut.innerHTML = `<div><strong>${number(total)}</strong><span>estudiantes</span></div>`;
  target.appendChild(donut);
  order.forEach((label) => {
    const value = Number(dist[label] || 0);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span style="background:${riskColor(label)}"></span><strong>${escapeHtml(label)}</strong><em>${number(value)}</em>`;
    legendTarget.appendChild(item);
  });
}

function renderScatter(target, rows) {
  target.replaceChildren();
  const maxActions = Math.max(maxValue(rows, (row) => row.actions_registered), 1);
  const maxGrades = Math.max(maxValue(rows, (row) => row.grade_cells_with_value), 1);
  const plot = document.createElement("div");
  plot.className = "scatter-inner";
  rows.forEach((row) => {
    const point = document.createElement("button");
    point.type = "button";
    point.className = `scatter-point ${labelClass(row.desertion_risk_level)}`;
    const x = Math.min(96, Math.max(4, (Number(row.actions_registered || 0) / maxActions) * 92 + 4));
    const y = 96 - Math.min(92, Math.max(4, (Number(row.grade_cells_with_value || 0) / maxGrades) * 92));
    point.style.left = `${x}%`;
    point.style.top = `${y}%`;
    point.title = `${row.name || "Sin nombre"} | acciones ${row.actions_registered || 0} | evaluaciones ${row.grade_cells_with_value || 0} | riesgo ${probability(row.desertion_probability)}`;
    point.addEventListener("click", () => {
      selectedStudentKey = studentKey(row);
      switchTab("students");
      renderStudents();
    });
    plot.appendChild(point);
  });
  target.appendChild(plot);
}

function renderModelKpis(rows) {
  const model = rows.find((row) => row.risk_model_version)?.risk_model_version || "Sin modelo";
  const avgPosterior = average(rows, (row) => row.bayesian_posterior_probability ?? row.desertion_probability);
  const avgPrior = average(rows, (row) => row.bayesian_prior_probability);
  const maxPosterior = maxValue(rows, (row) => row.bayesian_posterior_probability ?? row.desertion_probability);
  const evidenceItems = rows.reduce((sum, row) => sum + (row.bayesian_evidence_factors || row.desertion_risk_factors || []).length, 0);
  risk.modelKpis.replaceChildren(
    kpi("Modelo", model, "version aplicada"),
    kpi("Prior medio", probability(avgPrior), "antes de evidencia"),
    kpi("Posterior medio", probability(avgPosterior), "riesgo actual"),
    kpi("Maximo posterior", probability(maxPosterior), "caso mas critico", maxPosterior >= 0.7 ? "bad" : maxPosterior >= 0.5 ? "warn" : "good"),
    kpi("Evidencias", number(evidenceItems), "factores auditables"),
  );
}

function renderEvidenceTable(rows) {
  risk.evidenceTable.replaceChildren();
  const visible = [...rows]
    .sort((a, b) => Number(b.desertion_probability) - Number(a.desertion_probability))
    .slice(0, 12);
  risk.evidenceCount.textContent = number(visible.length);
  visible.forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "evidence-row";
    const factors = row.bayesian_evidence_factors || row.desertion_risk_factors || [];
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name, "Sin nombre")}</strong><small>${escapeHtml(factors.slice(0, 3).join("; "), "Sin factores")}</small></span>
      <span><small>prior</small><strong>${probability(row.bayesian_prior_probability)}</strong></span>
      <span><small>posterior</small><strong>${probability(row.bayesian_posterior_probability ?? row.desertion_probability)}</strong></span>
      <span><small>log LR</small><strong>${escapeHtml(row.bayesian_log_likelihood_ratio ?? "--")}</strong></span>
    `;
    item.addEventListener("click", () => {
      selectedStudentKey = studentKey(row);
      switchTab("students");
      renderStudents();
    });
    risk.evidenceTable.appendChild(item);
  });
}

function renderActivityList(target, rows) {
  const visibleRows = [...(rows || [])]
    .filter((row) => Number(row.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 12);
  const max = Math.max(...visibleRows.map((row) => Number(row.count)), 1);
  target.replaceChildren();
  visibleRows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "activity-row";
    item.innerHTML = `
      <div class="activity-copy">
        <strong>${escapeHtml(row.activity_name, "Actividad")}</strong>
        <span>${escapeHtml(row.action, "accion")} · ${number(row.count)}</span>
      </div>
      <div class="thin-track"><div style="width: ${Math.max(4, Math.round((Number(row.count) / max) * 100))}%"></div></div>
    `;
    target.appendChild(item);
  });
}

function renderDashboard(report) {
  activeReport = report;
  const allSummaries = report.summaries || [];
  const summaries = globalFilteredSummaries();
  const participantsCount = report.participants_count || allSummaries.length;
  const totalActions = summaries.reduce((sum, row) => sum + Number(row.actions_registered || 0), 0);
  const forumPosts = summaries.reduce((sum, row) => sum + Number(row.forum_posts || 0), 0);
  const alerts = summaries.filter((row) => row.follow_up_alert).length;
  const highRisk = summaries.filter((row) => ["Critico", "Alto"].includes(row.desertion_risk_level)).length;
  const graded = summaries.filter((row) => Number(row.grade_cells_with_value || 0) > 0).length;
  const avgRisk = average(summaries, (row) => row.desertion_probability);
  const noEvidence = summaries.filter((row) => row.platform_level === "Sin evidencia" || row.evaluative_level === "Sin evaluaciones").length;
  const tutorSummary = report.tutor_summary || {};

  dashboard.courseTitle.textContent = report.course_title || "Aula Moodle";
  dashboard.reportRunId.textContent = report.run_id || "--";
  dashboard.courseId.textContent = `Curso ${report.course_id || "--"}`;
  dashboard.generatedAt.textContent = dateText(report.generated_at);
  dashboard.moodleBase.textContent = report.moodle_base_url || "Moodle";

  dashboard.kpiGrid.replaceChildren(
    kpi("Estudiantes", `${number(summaries.length)}/${number(participantsCount)}`, "filtrados / matriculados"),
    kpi("Acciones", number(totalActions), "registros de participacion"),
    kpi("Foros", number(forumPosts), "mensajes o interacciones"),
    kpi("Con calificación", number(graded), "con evidencia evaluativa", "good"),
    kpi("Alertas", number(alerts), "requieren seguimiento", alerts ? "warn" : "good"),
    kpi("Riesgo medio", probability(avgRisk), "posterior promedio", avgRisk >= 0.7 ? "bad" : avgRisk >= 0.5 ? "warn" : "good"),
    kpi("Riesgo alto", number(highRisk), "critico o alto", highRisk ? "bad" : "good"),
    kpi("Sin evidencia", number(noEvidence), "requieren verificacion", noEvidence ? "warn" : "good"),
    kpi("Tutoría", number(tutorSummary.actions_registered), tutorSummary.participation_level || "sin dato", labelClass(tutorSummary.participation_level)),
  );

  dashboard.platformTotal.textContent = number(summaries.length);
  dashboard.evaluativeTotal.textContent = number(summaries.length);
  dashboard.riskDonutTotal.textContent = number(summaries.length);
  dashboard.scatterTotal.textContent = number(summaries.length);
  const riskSummary = distribution(summaries, "desertion_risk_level");
  renderDonut(dashboard.riskDonut, dashboard.riskDonutLegend, riskSummary, ["Critico", "Alto", "Medio", "Bajo", "Sin dato"]);
  renderScatter(dashboard.scatterPlot, summaries);
  renderBars(dashboard.platformBars, distribution(summaries, "platform_level"), ["Alta", "Media", "Baja", "Sin evidencia"]);
  renderBars(dashboard.evaluativeBars, distribution(summaries, "evaluative_level"), ["Alta", "Media", "Baja", "Sin evaluaciones"]);
  dashboard.activityCount.textContent = String((report.activity_summary || []).length);
  renderActivityList(dashboard.activityBars, report.activity_summary || []);
  renderRisk(report);
  renderTutor(report);
  renderStudents();
}

function renderRisk(report) {
  const summaries = globalFilteredSummaries();
  const riskSummary = distribution(summaries, "desertion_risk_level");
  const high = (riskSummary.Critico || 0) + (riskSummary.Alto || 0);
  risk.total.textContent = number(summaries.length);
  risk.highCount.textContent = number(high);
  renderBars(risk.bars, riskSummary, ["Critico", "Alto", "Medio", "Bajo", "Sin dato"]);
  risk.probabilityBandTotal.textContent = number(summaries.length);
  renderBars(risk.probabilityBands, probabilityBands(summaries), [">= 70%", "50% - 69%", "30% - 49%", "< 30%"]);
  renderModelKpis(summaries);
  renderEvidenceTable(summaries);
  risk.table.replaceChildren();
  summaries
    .filter((row) => row.desertion_risk_level)
    .sort((a, b) => Number(b.desertion_probability) - Number(a.desertion_probability))
    .forEach((row) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `risk-row ${labelClass(row.desertion_risk_level)}`;
      item.innerHTML = `
        <span class="student-main"><strong>${escapeHtml(row.name, "Sin nombre")}</strong><small>${escapeHtml((row.desertion_risk_factors || []).join("; "), "Sin factores críticos")}</small></span>
        <strong>${probability(row.desertion_probability)}</strong>
        <span class="pill ${labelClass(row.desertion_risk_level)}">${escapeHtml(row.desertion_risk_level)}</span>
      `;
      item.addEventListener("click", () => {
        selectedStudentKey = studentKey(row);
        switchTab("students");
        renderStudents();
      });
      risk.table.appendChild(item);
    });
}

function renderTutor(report) {
  const summary = report.tutor_summary || {};
  tutor.level.textContent = summary.participation_level || "Sin dato";
  tutor.level.className = `pill ${labelClass(summary.participation_level)}`;
  tutor.kpis.replaceChildren(
    kpi("Tutores", number(summary.active_tutors), "con actividad registrada"),
    kpi("Acciones", number(summary.actions_registered), "participacion tutorial"),
    kpi("Foros", number(summary.forum_posts), "mensajes o interacciones"),
    kpi("Cobertura", probability(summary.activity_coverage), "actividades con evidencia"),
  );
  tutor.activityCount.textContent = String((report.tutor_activity_summary || []).length);
  renderActivityList(tutor.activityBars, report.tutor_activity_summary || []);
}

function renderStudents() {
  const rows = globalFilteredSummaries();
  const query = students.search.value.trim().toLowerCase();
  const filter = students.filter.value;
  const filtered = rows.filter((row) => {
    const haystack = `${row.name || ""} ${row.email || ""} ${row.user_id || ""}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "high-risk" && ["Critico", "Alto"].includes(row.desertion_risk_level)) ||
      (filter === "alerts" && row.follow_up_alert) ||
      (filter === "without-evidence" && row.platform_level === "Sin evidencia") ||
      (filter === "without-grades" && row.evaluative_level === "Sin evaluaciones");
    return matchesQuery && matchesFilter;
  });

  students.count.textContent = `${filtered.length}/${rows.length}`;
  students.table.replaceChildren();
  filtered
    .sort((a, b) => Number(b.desertion_probability) - Number(a.desertion_probability) || Number(b.actions_registered) - Number(a.actions_registered))
    .forEach((row) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `student-row ${row.follow_up_alert ? "needs-attention" : ""}`;
      item.dataset.key = studentKey(row);
      item.innerHTML = `
        <span class="student-main"><strong>${escapeHtml(row.name, "Sin nombre")}</strong><small>${escapeHtml(row.email || row.user_id)}</small></span>
        <span>${number(row.actions_registered)}</span>
        <span>${escapeHtml(row.platform_level)}</span>
        <span>${escapeHtml(row.evaluative_level)}</span>
        <span class="pill ${labelClass(row.desertion_risk_level)}">${escapeHtml(row.desertion_risk_level || "OK")}</span>
      `;
      item.addEventListener("click", () => selectStudent(row));
      students.table.appendChild(item);
    });

  const selected = filtered.find((row) => studentKey(row) === selectedStudentKey) || filtered[0];
  if (selected) selectStudent(selected, false);
  if (!selected) renderEmptyDetail();
}

function selectStudent(row, updateKey = true) {
  if (updateKey) selectedStudentKey = studentKey(row);
  document.querySelectorAll(".student-row").forEach((item) => item.classList.toggle("selected", item.dataset.key === studentKey(row)));
  const evidence = row.bayesian_evidence_factors || row.desertion_risk_factors || [];
  students.detailAlert.textContent = row.follow_up_alert ? "Seguimiento" : "OK";
  students.detailAlert.className = `pill ${row.follow_up_alert ? "error" : "muted"}`;
  students.detail.innerHTML = `
    <div class="detail-name">
      <strong>${escapeHtml(row.name, "Sin nombre")}</strong>
      <span>${escapeHtml(row.email, "Sin correo registrado")}</span>
    </div>
    <div class="detail-grid">
      <div><span>Último acceso</span><strong>${escapeHtml(row.last_access, "--")}</strong></div>
      <div><span>Acciones</span><strong>${number(row.actions_registered)}</strong></div>
      <div><span>Foros</span><strong>${number(row.forum_posts)}</strong></div>
      <div><span>Evaluaciones</span><strong>${number(row.grade_cells_with_value)}</strong></div>
      <div><span>Total curso</span><strong>${escapeHtml(row.course_total, "--")}</strong></div>
      <div><span>ID Moodle</span><strong>${escapeHtml(row.user_id, "--")}</strong></div>
      <div><span>Prior bayesiano</span><strong>${probability(row.bayesian_prior_probability)}</strong></div>
      <div><span>Posterior</span><strong>${probability(row.bayesian_posterior_probability ?? row.desertion_probability)}</strong></div>
      <div><span>Log LR</span><strong>${escapeHtml(row.bayesian_log_likelihood_ratio ?? "--")}</strong></div>
      <div><span>Modelo</span><strong>${escapeHtml(row.risk_model_version, "--")}</strong></div>
      <div><span>Riesgo</span><strong>${probability(row.desertion_probability)} · ${escapeHtml(row.desertion_risk_level, "--")}</strong></div>
      <div><span>Tutoría</span><strong>${escapeHtml(row.tutor_activity_signal, "--")}</strong></div>
    </div>
    <div class="student-badges">
      <span class="pill ${labelClass(row.platform_level)}">${escapeHtml(row.platform_level)}</span>
      <span class="pill ${labelClass(row.evaluative_level)}">${escapeHtml(row.evaluative_level)}</span>
      <span class="pill ${labelClass(row.desertion_risk_level)}">${escapeHtml(evidence[0], "Sin factor critico")}</span>
    </div>
  `;
}

function renderEmptyDetail() {
  students.detailAlert.textContent = "--";
  students.detailAlert.className = "pill muted";
  students.detail.innerHTML = `<div class="empty-state">Sin estudiante seleccionado.</div>`;
}

async function loadDefaults() {
  const res = await fetch("/api/defaults");
  const defaults = await res.json();
  form.elements.moodle_base_url.value = defaults.moodle_base_url || "";
  form.elements.course_id.value = defaults.course_id || "";
  sheetTarget.textContent = defaults.spreadsheet_id ? `Hoja ${defaults.spreadsheet_id}` : "Hoja sin configurar";
  googleState.textContent = defaults.has_google_sink ? "Sheets activo" : "Sheets pendiente";
  authState.textContent = defaults.has_basic_auth ? "Acceso protegido" : "Acceso local";
}

async function loadLatestReport() {
  const res = await fetch("/api/reports/latest/dashboard");
  if (!res.ok) {
    renderNoReport();
    return;
  }
  renderDashboard(await res.json());
}

function renderNoReport() {
  dashboard.kpiGrid.replaceChildren(kpi("Estudiantes", "--", "sin datos"), kpi("Acciones", "--", "sin datos"), kpi("Alertas", "--", "sin datos"));
  dashboard.platformBars.replaceChildren();
  dashboard.evaluativeBars.replaceChildren();
  dashboard.activityBars.replaceChildren();
  dashboard.riskDonut.replaceChildren();
  dashboard.riskDonutLegend.replaceChildren();
  dashboard.scatterPlot.replaceChildren();
  risk.modelKpis.replaceChildren();
  risk.bars.replaceChildren();
  risk.probabilityBands.replaceChildren();
  risk.table.replaceChildren();
  risk.evidenceTable.replaceChildren();
  tutor.kpis.replaceChildren();
  tutor.activityBars.replaceChildren();
  students.table.replaceChildren();
  renderEmptyDetail();
}

async function loadAutomation() {
  const res = await fetch("/api/automation");
  if (!res.ok) return;
  const config = await res.json();
  automationForm.elements.enabled.checked = Boolean(config.enabled);
  automationForm.elements.interval_minutes.value = config.interval_minutes || 10080;
  automationForm.elements.sync_to_google.checked = Boolean(config.sync_to_google);
  automationForm.elements.include_tutor_participation.checked = Boolean(config.include_tutor_participation);
  automationForm.elements.notes.value = config.notes || "";
  automation.state.textContent = config.enabled ? "Activa" : "Inactiva";
  automation.state.className = `pill ${config.enabled ? "good" : "muted"}`;
  automation.detail.innerHTML = `
    <div><span>Última corrida</span><strong>${escapeHtml(dateText(config.last_run_at))}</strong></div>
    <div><span>Próxima corrida</span><strong>${escapeHtml(dateText(config.next_run_at))}</strong></div>
    <div><span>Intervalo</span><strong>${number(config.interval_minutes)} min</strong></div>
    <div><span>Actualizado</span><strong>${escapeHtml(dateText(config.updated_at))}</strong></div>
  `;
}

async function saveAutomation(event) {
  event.preventDefault();
  const payload = {
    enabled: automationForm.elements.enabled.checked,
    interval_minutes: Number(automationForm.elements.interval_minutes.value || 10080),
    sync_to_google: automationForm.elements.sync_to_google.checked,
    include_tutor_participation: automationForm.elements.include_tutor_participation.checked,
    notes: automationForm.elements.notes.value || "Corrida automatica programada.",
  };
  const res = await fetch("/api/automation", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    setStatus("Error", "No se pudo guardar la automatización.", true);
    return;
  }
  setStatus("Guardado", "La automatización quedó configurada.");
  await loadAutomation();
}

async function loadAudit() {
  const res = await fetch("/api/audit/access?limit=80");
  if (!res.ok) return;
  const rows = await res.json();
  audit.count.textContent = number(rows.length);
  audit.table.replaceChildren();
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "audit-row";
    item.innerHTML = `
      <span>${escapeHtml(dateText(row.timestamp))}</span>
      <strong>${escapeHtml(row.username)}</strong>
      <code>${escapeHtml(row.method)} ${escapeHtml(row.path)}</code>
      <span class="pill ${Number(row.status_code) >= 400 ? "error" : "muted"}">${escapeHtml(row.status_code)}</span>
    `;
    audit.table.appendChild(item);
  });
}

async function loadRuns() {
  const res = await fetch("/api/runs");
  const runs = await res.json();
  runCount.textContent = String(runs.length);
  runsTable.replaceChildren();
  runs.slice(0, 14).forEach((run) => {
    const row = document.createElement("div");
    row.className = "run-row";
    row.innerHTML = `
      <code>${escapeHtml(run.run_id)}</code>
      <span class="pill ${run.status === "error" ? "error" : "muted"}">${escapeHtml(run.status)}</span>
      <span class="run-message">${escapeHtml(run.message)}</span>
    `;
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Abrir";
    open.addEventListener("click", async () => {
      activeRun = run.run_id;
      renderRun(run);
      if (run.status === "done") await loadReport(run.run_id);
      switchTab("dashboard");
    });
    row.appendChild(open);
    runsTable.appendChild(row);
  });
}

async function loadReport(runId) {
  const res = await fetch(`/api/runs/${runId}/dashboard`);
  if (res.ok) renderDashboard(await res.json());
}

function renderRun(run) {
  const isError = run.status === "error";
  setStatus(run.status, run.message || "", isError);
  renderFiles(run);
  runButton.disabled = run.status === "running" || run.status === "queued";
}

async function pollRun(runId) {
  const res = await fetch(`/api/runs/${runId}`);
  const run = await res.json();
  renderRun(run);
  await loadRuns();
  if (run.status === "done" || run.status === "error") {
    clearInterval(pollTimer);
    pollTimer = null;
    runButton.disabled = false;
    if (run.status === "done") await loadReport(runId);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  files.replaceChildren();
  fileCount.textContent = "0";
  runButton.disabled = true;
  switchTab("dashboard");
  setStatus("En cola", "Preparando corrida.");

  const payload = {
    moodle_base_url: form.elements.moodle_base_url.value,
    course_id: Number(form.elements.course_id.value),
    username: form.elements.username.value || null,
    password: form.elements.password.value || null,
    notes: form.elements.notes.value || null,
    sync_to_google: form.elements.sync_to_google.checked,
    include_tutor_participation: form.elements.include_tutor_participation.checked,
  };

  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    setStatus("Error", text, true);
    runButton.disabled = false;
    return;
  }

  const run = await res.json();
  activeRun = run.run_id;
  renderRun(run);
  pollTimer = setInterval(() => pollRun(activeRun), 2500);
});

tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
refreshRuns.addEventListener("click", async () => {
  await loadRuns();
  await loadLatestReport();
  await loadAutomation();
  await loadAudit();
});
students.search.addEventListener("input", renderStudents);
students.filter.addEventListener("change", renderStudents);
globalFilters.search.addEventListener("input", rerenderActiveReport);
globalFilters.risk.addEventListener("change", rerenderActiveReport);
globalFilters.platform.addEventListener("change", rerenderActiveReport);
globalFilters.evaluative.addEventListener("change", rerenderActiveReport);
globalFilters.alertOnly.addEventListener("change", rerenderActiveReport);
globalFilters.clear.addEventListener("click", clearGlobalFilters);
automationForm.addEventListener("submit", saveAutomation);
intervalPreset.addEventListener("change", () => {
  if (intervalPreset.value !== "custom") automationForm.elements.interval_minutes.value = intervalPreset.value;
});
runAutomationNow.addEventListener("click", async () => {
  const res = await fetch("/api/automation/run-now", { method: "POST" });
  if (!res.ok) {
    setStatus("Error", "No se pudo iniciar la corrida programada.", true);
    return;
  }
  const run = await res.json();
  activeRun = run.run_id;
  renderRun(run);
  switchTab("dashboard");
  pollTimer = setInterval(() => pollRun(activeRun), 2500);
});

loadDefaults()
  .then(loadRuns)
  .then(loadLatestReport)
  .then(loadAutomation)
  .then(loadAudit)
  .catch((error) => setStatus("Error", error.message, true));
