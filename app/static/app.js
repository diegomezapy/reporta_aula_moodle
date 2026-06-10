const form = document.querySelector("#runForm");
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
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");

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
};

const students = {
  count: document.querySelector("#studentCount"),
  search: document.querySelector("#studentSearch"),
  filter: document.querySelector("#studentFilter"),
  table: document.querySelector("#studentsTable"),
  detail: document.querySelector("#studentDetail"),
  detailAlert: document.querySelector("#detailAlert"),
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

function labelClass(label) {
  const clean = String(label || "").toLowerCase();
  if (clean.includes("alta")) return "good";
  if (clean.includes("media")) return "mid";
  if (clean.includes("baja")) return "warn";
  if (clean.includes("sin")) return "bad";
  return "neutral";
}

function renderActivityBars(report) {
  const rows = [...(report.activity_summary || [])]
    .filter((row) => Number(row.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 10);
  const max = Math.max(...rows.map((row) => Number(row.count)), 1);
  dashboard.activityBars.replaceChildren();
  dashboard.activityCount.textContent = String((report.activity_summary || []).length);
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "activity-row";
    item.innerHTML = `
      <div class="activity-copy">
        <strong>${escapeHtml(row.activity_name, "Actividad")}</strong>
        <span>${escapeHtml(row.action, "accion")} · ${number(row.count)}</span>
      </div>
      <div class="thin-track"><div style="width: ${Math.max(4, Math.round((Number(row.count) / max) * 100))}%"></div></div>
    `;
    dashboard.activityBars.appendChild(item);
  });
}

function renderDashboard(report) {
  activeReport = report;
  const summaries = report.summaries || [];
  const participantsCount = report.participants_count || (report.participants || []).length || summaries.length;
  const totalActions = summaries.reduce((sum, row) => sum + Number(row.actions_registered || 0), 0);
  const forumPosts = summaries.reduce((sum, row) => sum + Number(row.forum_posts || 0), 0);
  const alerts = summaries.filter((row) => row.follow_up_alert).length;
  const withoutEvidence = summaries.filter((row) => row.platform_level === "Sin evidencia").length;
  const withoutGrades = summaries.filter((row) => row.evaluative_level === "Sin evaluaciones").length;
  const graded = summaries.filter((row) => Number(row.grade_cells_with_value || 0) > 0).length;

  dashboard.courseTitle.textContent = report.course_title || "Aula Moodle";
  dashboard.reportRunId.textContent = report.run_id || "--";
  dashboard.courseId.textContent = `Curso ${report.course_id || "--"}`;
  dashboard.generatedAt.textContent = dateText(report.generated_at);
  dashboard.moodleBase.textContent = report.moodle_base_url || "Moodle";

  dashboard.kpiGrid.replaceChildren(
    kpi("Estudiantes", number(participantsCount), "matriculados con rol estudiante"),
    kpi("Acciones", number(totalActions), "registros de participacion"),
    kpi("Foros", number(forumPosts), "mensajes o interacciones"),
    kpi("Con calificación", number(graded), "con evidencia evaluativa", "good"),
    kpi("Alertas", number(alerts), "requieren seguimiento", alerts ? "warn" : "good"),
    kpi("Sin evidencia", number(withoutEvidence + withoutGrades), "plataforma o evaluaciones", withoutEvidence + withoutGrades ? "bad" : "good"),
  );

  const platformDist = distribution(summaries, "platform_level");
  const evaluativeDist = distribution(summaries, "evaluative_level");
  dashboard.platformTotal.textContent = number(summaries.length);
  dashboard.evaluativeTotal.textContent = number(summaries.length);
  renderBars(dashboard.platformBars, platformDist, ["Alta", "Media", "Baja", "Sin evidencia"]);
  renderBars(dashboard.evaluativeBars, evaluativeDist, ["Alta", "Media", "Baja", "Sin evaluaciones"]);
  renderActivityBars(report);
  renderStudents();
}

function renderStudents() {
  const rows = activeReport?.summaries || [];
  const query = students.search.value.trim().toLowerCase();
  const filter = students.filter.value;
  const filtered = rows.filter((row) => {
    const haystack = `${row.name || ""} ${row.email || ""} ${row.user_id || ""}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "alerts" && row.follow_up_alert) ||
      (filter === "without-evidence" && row.platform_level === "Sin evidencia") ||
      (filter === "without-grades" && row.evaluative_level === "Sin evaluaciones");
    return matchesQuery && matchesFilter;
  });

  students.count.textContent = `${filtered.length}/${rows.length}`;
  students.table.replaceChildren();
  filtered
    .sort((a, b) => Number(b.follow_up_alert) - Number(a.follow_up_alert) || Number(b.actions_registered) - Number(a.actions_registered))
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
        <span class="pill ${row.follow_up_alert ? "error" : "muted"}">${row.follow_up_alert ? "Alerta" : "OK"}</span>
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
    </div>
    <div class="student-badges">
      <span class="pill ${labelClass(row.platform_level)}">${escapeHtml(row.platform_level)}</span>
      <span class="pill ${labelClass(row.evaluative_level)}">${escapeHtml(row.evaluative_level)}</span>
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
  dashboard.kpiGrid.replaceChildren(
    kpi("Estudiantes", "--", "sin datos"),
    kpi("Acciones", "--", "sin datos"),
    kpi("Alertas", "--", "sin datos"),
  );
  dashboard.platformBars.replaceChildren();
  dashboard.evaluativeBars.replaceChildren();
  dashboard.activityBars.replaceChildren();
  students.table.replaceChildren();
  renderEmptyDetail();
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
});
students.search.addEventListener("input", renderStudents);
students.filter.addEventListener("change", renderStudents);

loadDefaults()
  .then(loadRuns)
  .then(loadLatestReport)
  .catch((error) => setStatus("Error", error.message, true));
