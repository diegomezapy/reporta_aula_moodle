const form = document.querySelector("#runForm");
const runButton = document.querySelector("#runButton");
const currentStatus = document.querySelector("#currentStatus");
const statusMessage = document.querySelector("#statusMessage");
const files = document.querySelector("#files");
const runsTable = document.querySelector("#runsTable");
const runCount = document.querySelector("#runCount");
const refreshRuns = document.querySelector("#refreshRuns");
const sheetTarget = document.querySelector("#sheetTarget");
const googleState = document.querySelector("#googleState");

let activeRun = null;
let pollTimer = null;

function setStatus(status, message, isError = false) {
  currentStatus.textContent = status;
  currentStatus.classList.toggle("error", isError);
  currentStatus.classList.toggle("muted", !isError && status === "Listo");
  statusMessage.textContent = message || "";
}

function fileLink(runId, filename) {
  const a = document.createElement("a");
  a.href = `/api/runs/${runId}/files/${encodeURIComponent(filename)}`;
  a.textContent = filename;
  return a;
}

function renderFiles(run) {
  files.replaceChildren();
  (run.files || []).forEach((filename) => files.appendChild(fileLink(run.run_id, filename)));
}

async function loadDefaults() {
  const res = await fetch("/api/defaults");
  const defaults = await res.json();
  form.elements.moodle_base_url.value = defaults.moodle_base_url || "";
  form.elements.course_id.value = defaults.course_id || "";
  sheetTarget.textContent = defaults.spreadsheet_id ? `Hoja ${defaults.spreadsheet_id}` : "Hoja sin configurar";
  googleState.textContent = defaults.has_google_sink ? "Sheets activo" : "Sheets pendiente";
}

async function loadRuns() {
  const res = await fetch("/api/runs");
  const runs = await res.json();
  runCount.textContent = String(runs.length);
  runsTable.replaceChildren();
  runs.slice(0, 12).forEach((run) => {
    const row = document.createElement("div");
    row.className = "run-row";
    row.innerHTML = `
      <code>${run.run_id}</code>
      <span class="pill ${run.status === "error" ? "error" : "muted"}">${run.status}</span>
      <span class="run-message">${run.message || ""}</span>
    `;
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Ver";
    open.addEventListener("click", () => {
      activeRun = run.run_id;
      renderRun(run);
    });
    row.appendChild(open);
    runsTable.appendChild(row);
  });
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
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  files.replaceChildren();
  runButton.disabled = true;
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

refreshRuns.addEventListener("click", loadRuns);

loadDefaults().then(loadRuns).catch((error) => setStatus("Error", error.message, true));

