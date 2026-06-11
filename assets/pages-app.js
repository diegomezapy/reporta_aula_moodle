const GAS_REPORT_URL = "https://script.google.com/macros/s/AKfycbxuC1G3DN8tRh__ytHyaYYr24jWK_8-sxRuuuwl2jtMPzTMyLfFAcBkZ32xGdF0FtLTDA/exec";
const MODEL_VERSION = "github_pages_gas_bayes_v0.3_dual_desertion";
const APP_VERSION = "2026.06.11-bayes-path";
const APP_BUILD_DATE = "2026-06-11";
const APP_CACHE_PREFIX = "reporta-aula-moodle-pages-";
const RISK_MODES = {
  semester: {
    label: "Semestre",
    shortLabel: "Semestre",
    description: "desercion durante el semestre",
    prefix: "semester",
  },
  career: {
    label: "Carrera",
    shortLabel: "Carrera",
    description: "desercion en la carrera",
    prefix: "career",
  },
};

const state = {
  report: null,
  selectedStudentKey: null,
  source: "local",
  riskMode: "semester",
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
  bayesStepCount: $("#bayesStepCount"),
  bayesSubject: $("#bayesSubject"),
  bayesPrior: $("#bayesPrior"),
  bayesPosterior: $("#bayesPosterior"),
  bayesDelta: $("#bayesDelta"),
  bayesFlow: $("#bayesFlow"),
  evidenceCount: $("#evidenceCount"),
  evidenceTable: $("#evidenceTable"),
  studentCount: $("#studentCount"),
  studentSearch: $("#studentSearch"),
  studentFilter: $("#studentFilter"),
  studentsTable: $("#studentsTable"),
  studentDetail: $("#studentDetail"),
  detailAlert: $("#detailAlert"),
  riskModeButtons: $$("#riskModeSwitch button"),
  activeRiskMode: $("#activeRiskMode"),
  tutorLevel: $("#tutorLevel"),
  tutorKpis: $("#tutorKpis"),
  tutorRosterCount: $("#tutorRosterCount"),
  tutorRoster: $("#tutorRoster"),
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
  generateDemo: $("#generateDemo"),
  checkMoodleCredentials: $("#checkMoodleCredentials"),
  credentialStatus: $("#credentialStatus"),
  gasExtractorFrame: $("#gasExtractorFrame"),
  openSecureExtractor: $("#openSecureExtractor"),
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
  return row.student_moodle_id || row.user_id || row.name || "";
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").toLowerCase();
  return ["true", "1", "si", "yes"].includes(text);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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

function activeRiskConfig() {
  return RISK_MODES[state.riskMode] || RISK_MODES.semester;
}

function riskField(row, suffix, fallback) {
  const prefix = activeRiskConfig().prefix;
  const value = row?.[`${prefix}_${suffix}`];
  return value ?? fallback;
}

function activeRiskProbability(row) {
  return parseNumber(riskField(row, "desertion_probability", row?.desertion_probability), 0);
}

function activeRiskLevel(row) {
  return riskField(row, "desertion_risk_level", row?.desertion_risk_level || riskLevel(activeRiskProbability(row)));
}

function activeRiskFactors(row) {
  return parseFactors(riskField(row, "desertion_risk_factors", row?.desertion_risk_factors));
}

function activePrior(row) {
  return parseNumber(riskField(row, "bayesian_prior_probability", row?.bayesian_prior_probability), 0);
}

function activePosterior(row) {
  return parseNumber(riskField(row, "bayesian_posterior_probability", row?.bayesian_posterior_probability), activeRiskProbability(row));
}

function activeLogLikelihoodRatio(row) {
  return parseNumber(riskField(row, "bayesian_log_likelihood_ratio", row?.bayesian_log_likelihood_ratio), 0);
}

function activeEvidenceFactors(row) {
  return activeRiskFactors(row);
}

function parseFactors(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return value.split(";").map((x) => x.trim()).filter(Boolean);
  return [];
}

function evidenceLabel(items) {
  return items.slice(0, 3).join("; ") || "Sin factores";
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
  if (typeof row.desertion_risk_factors === "string") return parseFactors(row.desertion_risk_factors);
  if (typeof row.evidence === "string" && row.evidence.trim()) return row.evidence.split(";").map((x) => x.trim()).filter(Boolean);
  return [];
}

function addEvidence(items, likelihoodRatio, label) {
  items.push({ likelihoodRatio, label });
}

function probabilityToOdds(value) {
  const safe = Math.max(0.01, Math.min(0.99, Number(value || 0)));
  return safe / (1 - safe);
}

function oddsToProbability(value) {
  const safe = Math.max(0.01, Number(value || 0));
  return safe / (1 + safe);
}

function estimateFromEvidence(prior, evidence) {
  const likelihood = evidence.reduce((acc, item) => acc * Number(item.likelihoodRatio || 1), 1);
  const priorOdds = prior / (1 - prior);
  const posteriorOdds = priorOdds * likelihood;
  const posterior = Math.max(0.02, Math.min(0.98, posteriorOdds / (1 + posteriorOdds)));
  return {
    prior: Number(prior.toFixed(4)),
    posterior: Number(posterior.toFixed(4)),
    logLr: Number(Math.log(likelihood || 1).toFixed(4)),
    factors: evidence.map((item) => item.label),
  };
}

function estimateSemesterRisk(row) {
  return estimateFromEvidence(0.22, semesterEvidenceItems(row));
}

function semesterEvidenceItems(row) {
  const evidence = [];
  const actions = parseNumber(row.actions_registered);
  const forums = parseNumber(row.forum_posts);
  const grades = parseNumber(row.grade_cells_with_value);
  const days = parseNumber(row.days_since_last_access);

  if (days >= 45) addEvidence(evidence, 2.3, "Ultimo acceso mayor o igual a 45 dias");
  else if (days <= 7) addEvidence(evidence, 0.55, "Acceso reciente al aula");

  if (actions === 0) addEvidence(evidence, 2.8, "Sin actividad en plataforma");
  else if (actions < 5) addEvidence(evidence, 1.7, "Baja actividad en plataforma");
  else if (actions >= 15) addEvidence(evidence, 0.55, "Alta actividad en plataforma");

  if (grades === 0) addEvidence(evidence, 2.4, "Sin evaluaciones registradas");
  else if (grades >= 3) addEvidence(evidence, 0.55, "Evaluaciones registradas");

  if (forums === 0) addEvidence(evidence, 1.35, "Sin participacion registrada en foros");
  else if (forums >= 3) addEvidence(evidence, 0.65, "Participacion frecuente en foros");

  if (hasValue(row.academic_load) && parseNumber(row.academic_load) <= 1) addEvidence(evidence, 1.25, "Carga academica actual muy baja");
  if (hasValue(row.tutor_feedback_count) && parseNumber(row.tutor_feedback_count) === 0) addEvidence(evidence, 1.4, "Sin retroalimentacion tutorial registrada");
  if (hasValue(row.tutor_response_hours) && parseNumber(row.tutor_response_hours) >= 72) addEvidence(evidence, 1.45, "Respuesta tutorial mayor o igual a 72 horas");
  if (hasValue(row.tutor_activity_coverage) && parseNumber(row.tutor_activity_coverage) < 0.35) addEvidence(evidence, 1.35, "Cobertura tutorial baja");
  else if (hasValue(row.tutor_activity_coverage) && parseNumber(row.tutor_activity_coverage) >= 0.75) addEvidence(evidence, 0.78, "Cobertura tutorial amplia");

  return evidence;
}

function estimateCareerRisk(row, semesterPosterior) {
  return estimateFromEvidence(0.16, careerEvidenceItems(row, semesterPosterior));
}

function careerEvidenceItems(row, semesterPosterior) {
  const evidence = [];
  const semester = parseNumber(row.semester_number);
  const failed = parseNumber(row.failed_previous_subjects);
  const progress = parseNumber(row.program_progress_percent);
  const load = parseNumber(row.academic_load);

  if (failed >= 4) addEvidence(evidence, 2.4, "Cuatro o mas materias previas no aprobadas");
  else if (failed >= 2) addEvidence(evidence, 1.6, "Dos o mas materias previas no aprobadas");
  else if (failed === 0) addEvidence(evidence, 0.75, "Sin materias previas no aprobadas");

  if (hasValue(row.program_progress_percent) && semester >= 6 && progress < 55) addEvidence(evidence, 2.1, "Avance de carrera bajo para el semestre cursado");
  else if (hasValue(row.program_progress_percent) && semester >= 4 && progress < 35) addEvidence(evidence, 1.75, "Avance acumulado rezagado");
  else if (hasValue(row.program_progress_percent) && progress >= 60) addEvidence(evidence, 0.78, "Avance de carrera consistente");

  if (hasValue(row.academic_load) && load <= 1) addEvidence(evidence, 1.7, "Carga academica reducida");
  else if (hasValue(row.academic_load) && load >= 4) addEvidence(evidence, 0.85, "Carga academica activa");

  if (row.enrollment_status && row.enrollment_status !== "Regular") addEvidence(evidence, 2.0, "Estado de matricula requiere revision academica");
  if (row.scholarship_status === "Beca activa") addEvidence(evidence, 0.85, "Beca activa registrada");
  if (row.tutor_followup_signal === "Bajo") addEvidence(evidence, 1.35, "Acompanamiento tutorial bajo");
  else if (row.tutor_followup_signal === "Alta") addEvidence(evidence, 0.85, "Acompanamiento tutorial alto");

  if (semesterPosterior >= 0.7) addEvidence(evidence, 1.5, "Riesgo alto durante el semestre actual");
  else if (semesterPosterior < 0.3) addEvidence(evidence, 0.85, "Riesgo bajo durante el semestre actual");

  return evidence;
}

function activeEvidenceItems(row) {
  const mode = activeRiskConfig();
  const modeled = mode.prefix === "career"
    ? careerEvidenceItems(row, parseNumber(row.semester_bayesian_posterior_probability ?? row.semester_desertion_probability, 0))
    : semesterEvidenceItems(row);
  const labels = activeEvidenceFactors(row);
  if (!labels.length) return modeled;
  const distributedLr = labels.length ? Math.exp(activeLogLikelihoodRatio(row) / labels.length) : 1;
  return labels.map((label) => {
    const found = modeled.find((item) => String(item.label).toLowerCase() === String(label).toLowerCase());
    return {
      label,
      likelihoodRatio: found ? found.likelihoodRatio : distributedLr,
    };
  });
}

function bayesianFocusRow(rows) {
  if (!rows.length) return null;
  const selected = rows.find((row) => studentKey(row) === state.selectedStudentKey);
  return selected || [...rows].sort((a, b) => activePosterior(b) - activePosterior(a))[0];
}

function bayesianPath(row) {
  if (!row) return [];
  const prior = Math.max(0.01, Math.min(0.99, activePrior(row) || (activeRiskConfig().prefix === "career" ? 0.16 : 0.22)));
  const posterior = Math.max(0.01, Math.min(0.99, activePosterior(row) || activeRiskProbability(row)));
  const evidence = activeEvidenceItems(row);
  const maxItems = 7;
  const visible = evidence.slice(0, maxItems);
  const rest = evidence.slice(maxItems);
  if (rest.length) {
    visible.push({
      label: `${rest.length} senales adicionales`,
      likelihoodRatio: rest.reduce((acc, item) => acc * Number(item.likelihoodRatio || 1), 1),
    });
  }
  let odds = probabilityToOdds(prior);
  let previous = prior;
  const steps = [{
    label: "Prior inicial",
    likelihoodRatio: 1,
    probability: prior,
    delta: 0,
    type: "prior",
  }];
  visible.forEach((item) => {
    odds *= Number(item.likelihoodRatio || 1);
    const current = Math.max(0.01, Math.min(0.99, oddsToProbability(odds)));
    steps.push({
      label: item.label,
      likelihoodRatio: Number(item.likelihoodRatio || 1),
      probability: current,
      delta: current - previous,
      type: Number(item.likelihoodRatio || 1) >= 1 ? "risk" : "protective",
    });
    previous = current;
  });
  if (!visible.length || Math.abs(previous - posterior) >= 0.015) {
    const calibrationLr = probabilityToOdds(posterior) / probabilityToOdds(previous);
    steps.push({
      label: visible.length ? "Ajuste final del modelo" : "Posterior con datos disponibles",
      likelihoodRatio: calibrationLr,
      probability: posterior,
      delta: posterior - previous,
      type: calibrationLr >= 1 ? "risk" : "protective",
    });
  }
  return steps;
}

function convertGasSummary(row) {
  const actions = parseNumber(row.actions ?? row.actions_registered);
  const forums = parseNumber(row.forums ?? row.forum_posts);
  const grades = parseNumber(row.grades ?? row.grade_cells_with_value);
  const days = parseNumber(row.days_since_last_access);
  const index = parseNumber(String(row.userId || row.user_id || "").replace(/\D/g, ""), 1);
  const semesterNumber = parseNumber(row.semester_number, Math.max(1, Math.ceil(index / 4)));
  const progressFallback = Math.min(80, semesterNumber * 12);
  const base = {
    user_id: row.userId || row.user_id,
    student_moodle_id: row.student_moodle_id || row.moodle_id || `MOODLE-STU-${String(index).padStart(2, "0")}`,
    student_document_id: row.student_document_id || row.document_id || `DOC-DEMO-${String(index).padStart(2, "0")}`,
    name: row.name || "Estudiante",
    email: row.email || row.student_email || "",
    cohort: row.cohort || (semesterNumber <= 2 ? "2026" : "2025"),
    career: row.career || "Analitica de Big Data",
    semester_number: semesterNumber,
    enrollment_status: row.enrollment_status || "Regular",
    academic_load: hasValue(row.academic_load) ? parseNumber(row.academic_load) : Math.max(1, Math.min(5, grades + 2)),
    failed_previous_subjects: hasValue(row.failed_previous_subjects) ? parseNumber(row.failed_previous_subjects) : 0,
    program_progress_percent: hasValue(row.program_progress_percent) ? parseNumber(row.program_progress_percent) : progressFallback,
    scholarship_status: row.scholarship_status || "Sin beca registrada",
    work_shift: row.work_shift || "Sin dato",
    tutor_id: row.tutor_id || "TUT-DEMO-01",
    tutor_name: row.tutor_name || "Docente Tutor 01",
    tutor_email: row.tutor_email || "tutor01@example.invalid",
    tutor_role: row.tutor_role || "Tutor academico",
    tutor_actions_registered: parseNumber(row.tutor_actions_registered),
    tutor_forum_replies: parseNumber(row.tutor_forum_replies),
    tutor_feedback_count: hasValue(row.tutor_feedback_count) ? parseNumber(row.tutor_feedback_count) : null,
    tutor_response_hours: hasValue(row.tutor_response_hours) ? parseNumber(row.tutor_response_hours) : null,
    tutor_activity_coverage: hasValue(row.tutor_activity_coverage) ? parseNumber(row.tutor_activity_coverage) : null,
    tutor_followup_signal: row.tutor_followup_signal || "Sin dato",
    actions_registered: actions,
    forum_posts: forums,
    grade_cells_with_value: grades,
    days_since_last_access: days,
  };
  const semesterFallback = estimateSemesterRisk(base);
  const semesterPosterior = parseNumber(
    row.semester_bayesian_posterior_probability ?? row.semester_desertion_probability ?? row.posterior ?? row.desertion_probability ?? row.bayesian_posterior_probability,
    semesterFallback.posterior,
  );
  const careerFallback = estimateCareerRisk(base, semesterPosterior);
  const semesterFactors = parseFactors(row.semester_desertion_risk_factors || row.semester_bayesian_evidence_factors).length
    ? parseFactors(row.semester_desertion_risk_factors || row.semester_bayesian_evidence_factors)
    : evidenceFactors(row).length ? evidenceFactors(row) : semesterFallback.factors;
  const careerFactors = parseFactors(row.career_desertion_risk_factors || row.career_bayesian_evidence_factors).length
    ? parseFactors(row.career_desertion_risk_factors || row.career_bayesian_evidence_factors)
    : careerFallback.factors;
  const careerPosterior = parseNumber(row.career_bayesian_posterior_probability ?? row.career_desertion_probability, careerFallback.posterior);
  const followUp = parseBoolean(row.follow_up_alert) || semesterPosterior >= 0.5 || careerPosterior >= 0.5 || actions === 0 || grades === 0;
  return {
    ...base,
    last_access_text: row.last_access_text || (days <= 1 ? "Ultimo dia" : `${days} dias`),
    actions_registered: actions,
    forum_posts: forums,
    messages_forum_registered: forums,
    grade_cells_with_value: grades,
    quiz_attempts_graded: Math.max(0, grades - 1),
    assignments_graded: grades > 0 ? 1 : 0,
    platform_level: row.platform_level || platformLevel(actions),
    evaluative_level: row.evaluative_level || evaluativeLevel(grades),
    follow_up_alert: followUp,
    semester_bayesian_prior_probability: parseNumber(row.semester_bayesian_prior_probability ?? row.prior ?? row.bayesian_prior_probability, semesterFallback.prior),
    semester_bayesian_posterior_probability: semesterPosterior,
    semester_bayesian_log_likelihood_ratio: parseNumber(row.semester_bayesian_log_likelihood_ratio ?? row.logLr ?? row.bayesian_log_likelihood_ratio, semesterFallback.logLr),
    semester_desertion_probability: parseNumber(row.semester_desertion_probability, semesterPosterior),
    semester_desertion_risk_level: row.semester_desertion_risk_level || row.riskLevel || row.desertion_risk_level || riskLevel(semesterPosterior),
    semester_desertion_risk_factors: semesterFactors,
    career_bayesian_prior_probability: parseNumber(row.career_bayesian_prior_probability, careerFallback.prior),
    career_bayesian_posterior_probability: careerPosterior,
    career_bayesian_log_likelihood_ratio: parseNumber(row.career_bayesian_log_likelihood_ratio, careerFallback.logLr),
    career_desertion_probability: parseNumber(row.career_desertion_probability, careerPosterior),
    career_desertion_risk_level: row.career_desertion_risk_level || riskLevel(careerPosterior),
    career_desertion_risk_factors: careerFactors,
    desertion_probability: semesterPosterior,
    desertion_risk_level: row.riskLevel || row.desertion_risk_level || riskLevel(semesterPosterior),
    desertion_risk_factors: semesterFactors,
    bayesian_prior_probability: parseNumber(row.prior ?? row.bayesian_prior_probability, semesterFallback.prior),
    bayesian_posterior_probability: semesterPosterior,
    bayesian_log_likelihood_ratio: parseNumber(row.logLr ?? row.bayesian_log_likelihood_ratio, semesterFallback.logLr),
    bayesian_evidence_factors: semesterFactors,
    risk_model_version: row.risk_model_version || MODEL_VERSION,
  };
}

function buildLocalRows() {
  return [
    demoStudent("demo-01", "Estudiante 01", 6, 1, 1, 3, 1, 0, 18, 12, 4, 1.0, "Alta"),
    demoStudent("demo-02", "Estudiante 02", 11, 3, 3, 7, 2, 0, 32, 9, 5, 0.88, "Alta"),
    demoStudent("demo-03", "Estudiante 03", 5, 2, 1, 32, 3, 1, 38, 5, 2, 0.63, "Media"),
    demoStudent("demo-04", "Estudiante 04", 0, 0, 0, 72, 5, 4, 36, 1, 0, 0.22, "Bajo"),
    demoStudent("demo-05", "Estudiante 05", 6, 1, 1, 49, 4, 2, 42, 3, 1, 0.43, "Media"),
    demoStudent("demo-06", "Estudiante 06", 2, 0, 0, 82, 6, 5, 44, 1, 0, 0.18, "Bajo"),
    demoStudent("demo-07", "Estudiante 07", 17, 3, 3, 3, 2, 0, 36, 10, 5, 0.92, "Alta"),
    demoStudent("demo-08", "Estudiante 08", 6, 0, 0, 66, 5, 3, 47, 2, 0, 0.34, "Bajo"),
    demoStudent("demo-09", "Estudiante 09", 20, 2, 2, 7, 3, 0, 54, 8, 4, 0.76, "Alta"),
    demoStudent("demo-10", "Estudiante 10", 10, 2, 0, 1, 1, 1, 16, 6, 2, 0.58, "Media"),
    demoStudent("demo-11", "Estudiante 11", 1, 0, 0, 64, 7, 4, 52, 1, 0, 0.25, "Bajo"),
    demoStudent("demo-12", "Estudiante 12", 2, 0, 0, 57, 4, 2, 31, 2, 0, 0.3, "Bajo"),
    demoStudent("demo-13", "Estudiante 13", 15, 1, 1, 15, 2, 0, 40, 7, 3, 0.78, "Alta"),
    demoStudent("demo-14", "Estudiante 14", 18, 3, 3, 0, 1, 0, 20, 12, 6, 1.0, "Alta"),
    demoStudent("demo-15", "Estudiante 15", 23, 5, 3, 2, 3, 0, 58, 13, 6, 0.94, "Alta"),
    demoStudent("demo-16", "Estudiante 16", 13, 2, 2, 50, 6, 2, 62, 4, 2, 0.52, "Media"),
    demoStudent("demo-17", "Estudiante 17", 10, 0, 0, 68, 7, 5, 48, 2, 0, 0.27, "Bajo"),
    demoStudent("demo-18", "Estudiante 18", 7, 1, 1, 67, 5, 3, 45, 3, 1, 0.38, "Media"),
    demoStudent("demo-19", "Estudiante 19", 16, 3, 1, 3, 2, 0, 34, 8, 4, 0.84, "Alta"),
    demoStudent("demo-20", "Estudiante 20", 0, 0, 0, 88, 8, 6, 51, 0, 0, 0.14, "Bajo"),
  ].map(convertGasSummary);
}

function demoStudent(id, name, actions, forums, grades, days, semester, failed, progress, tutorActions, tutorFeedback, coverage, followupSignal) {
  const index = parseNumber(String(id).replace(/\D/g, ""), 1);
  const tutorIndex = ((index - 1) % 3) + 1;
  const padded = String(index).padStart(2, "0");
  return {
    user_id: id,
    student_moodle_id: `MOODLE-STU-${padded}`,
    student_document_id: `DOC-DEMO-${padded}`,
    name,
    email: `estudiante${padded}@example.invalid`,
    cohort: semester <= 2 ? "2026" : semester <= 5 ? "2025" : "2024",
    career: index % 2 === 0 ? "Licenciatura en Ciencia de Datos" : "Analitica de Big Data",
    semester_number: semester,
    enrollment_status: days >= 80 || failed >= 5 ? "Revision academica" : "Regular",
    academic_load: actions === 0 ? 1 : Math.max(1, Math.min(5, grades + 2)),
    failed_previous_subjects: failed,
    program_progress_percent: progress,
    scholarship_status: index % 4 === 0 ? "Beca activa" : "Sin beca registrada",
    work_shift: index % 3 === 0 ? "Nocturno" : "Diurno",
    tutor_id: `TUT-DEMO-${String(tutorIndex).padStart(2, "0")}`,
    tutor_name: `Docente Tutor ${String(tutorIndex).padStart(2, "0")}`,
    tutor_email: `tutor${String(tutorIndex).padStart(2, "0")}@example.invalid`,
    tutor_role: tutorIndex === 1 ? "Docente responsable" : "Tutor academico",
    tutor_actions_registered: tutorActions,
    tutor_forum_replies: Math.max(0, Math.round(tutorActions / 4)),
    tutor_feedback_count: tutorFeedback,
    tutor_response_hours: followupSignal === "Alta" ? 18 : followupSignal === "Media" ? 42 : 96,
    tutor_activity_coverage: coverage,
    tutor_followup_signal: followupSignal,
    actions_registered: actions,
    forum_posts: forums,
    grade_cells_with_value: grades,
    days_since_last_access: days,
  };
}

function buildTutorProfilesFromSummaries(summaries) {
  const grouped = summaries.reduce((acc, row) => {
    const key = row.tutor_id || "SIN-TUTOR";
    if (!acc[key]) {
      acc[key] = {
        tutor_id: key,
        tutor_name: row.tutor_name || "Tutor sin dato",
        tutor_email: row.tutor_email || "",
        tutor_role: row.tutor_role || "Tutor",
        assigned_students: 0,
        tutor_actions_registered: 0,
        tutor_forum_replies: 0,
        tutor_feedback_count: 0,
        tutor_response_hours: 0,
        tutor_activity_coverage: 0,
        tutor_followup_signal: row.tutor_followup_signal || "Sin dato",
      };
    }
    acc[key].assigned_students += 1;
    acc[key].tutor_actions_registered += parseNumber(row.tutor_actions_registered);
    acc[key].tutor_forum_replies += parseNumber(row.tutor_forum_replies);
    acc[key].tutor_feedback_count += parseNumber(row.tutor_feedback_count);
    acc[key].tutor_response_hours += parseNumber(row.tutor_response_hours);
    acc[key].tutor_activity_coverage += parseNumber(row.tutor_activity_coverage);
    return acc;
  }, {});
  return Object.values(grouped).map((tutor) => ({
    ...tutor,
    tutor_response_hours: tutor.assigned_students ? tutor.tutor_response_hours / tutor.assigned_students : 0,
    tutor_activity_coverage: tutor.assigned_students ? tutor.tutor_activity_coverage / tutor.assigned_students : 0,
  }));
}

function buildTutorSummaryFromProfiles(summaries, tutorProfiles) {
  const actions = tutorProfiles.reduce((sum, row) => sum + parseNumber(row.tutor_actions_registered), 0);
  const forums = tutorProfiles.reduce((sum, row) => sum + parseNumber(row.tutor_forum_replies), 0);
  const coverage = summaries.length ? average(summaries, (row) => row.tutor_activity_coverage) : 0;
  return {
    active_tutors: tutorProfiles.length,
    actions_registered: actions,
    forum_posts: forums,
    activity_coverage: coverage,
    participation_level: actions >= 120 && coverage >= 0.6 ? "Alta" : actions >= 45 || coverage >= 0.35 ? "Media" : actions > 0 ? "Baja" : "Sin evidencia",
  };
}

function normalizeReport(report, source) {
  const summaries = (report?.summaries || buildLocalRows()).map(convertGasSummary);
  const totalActions = summaries.reduce((sum, row) => sum + row.actions_registered, 0);
  const totalForums = summaries.reduce((sum, row) => sum + row.forum_posts, 0);
  const now = new Date().toISOString();
  const evidenceFiles = report?.evidence_files || [];
  const reportFiles = report?.files || [];
  const tutorProfiles = (report?.tutor_profiles || buildTutorProfilesFromSummaries(summaries)).map((row) => ({
    tutor_id: row.tutor_id || "SIN-TUTOR",
    tutor_name: row.tutor_name || "Tutor sin dato",
    tutor_email: row.tutor_email || "",
    tutor_role: row.tutor_role || "Tutor",
    assigned_students: parseNumber(row.assigned_students),
    tutor_actions_registered: parseNumber(row.tutor_actions_registered),
    tutor_forum_replies: parseNumber(row.tutor_forum_replies),
    tutor_feedback_count: parseNumber(row.tutor_feedback_count),
    tutor_response_hours: parseNumber(row.tutor_response_hours),
    tutor_activity_coverage: parseNumber(row.tutor_activity_coverage),
    tutor_followup_signal: row.tutor_followup_signal || "Sin dato",
  }));
  const tutorSummary = report?.tutor_summary || buildTutorSummaryFromProfiles(summaries, tutorProfiles);
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
    tutor_profiles: tutorProfiles,
    tutor_summary: tutorSummary,
    tutor_activity_summary: report?.tutor_activity_summary || [
      { activity_name: "Acciones tutoriales identificadas", action: "registered", count: tutorSummary.actions_registered },
      { activity_name: "Retroalimentaciones a estudiantes", action: "feedback", count: tutorProfiles.reduce((sum, row) => sum + row.tutor_feedback_count, 0) },
      { activity_name: "Foros o mensajes del tutor", action: "reply", count: tutorSummary.forum_posts },
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

function loadCredentialStatus(endpoint = GAS_REPORT_URL) {
  return new Promise((resolve, reject) => {
    const callbackName = `reportaAulaCreds_${Date.now()}_${Math.round(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al consultar credenciales GAS"));
    }, 10000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (payload) => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(new Error("GAS no devolvio estado de credenciales"));
        return;
      }
      resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo consultar credentialStatus en GAS"));
    };
    script.src = gasEndpoint(endpoint, { api: "credentialStatus", callback: callbackName, ts: Date.now() });
    document.head.appendChild(script);
  });
}

function runGasExtraction(endpoint = GAS_REPORT_URL, api = "runMoodleExtraction") {
  return new Promise((resolve, reject) => {
    const callbackName = `reportaAulaRun_${Date.now()}_${Math.round(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al generar la extraccion"));
    }, api === "runMoodleExtraction" ? 90000 : 20000);
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
    const maxActivities = document.querySelector("[name='max_activities']")?.value || "25";
    script.src = gasEndpoint(endpoint, {
      api,
      callback: callbackName,
      courseId,
      spreadsheetId,
      maxActivities,
      courseTitle: state.report?.course_title || "Analitica de Big Data - Extraccion GAS",
      ts: Date.now(),
    });
    document.head.appendChild(script);
  });
}

function gasExtractorUrl(endpoint = GAS_REPORT_URL) {
  const base = String(endpoint || GAS_REPORT_URL).trim().replace(/\/+$/, "");
  try {
    const url = new URL(base);
    url.searchParams.set("view", "extractor");
    url.searchParams.set("embed", "1");
    url.searchParams.set("ts", Date.now());
    return url.toString();
  } catch (error) {
    return `${GAS_REPORT_URL}?view=extractor&embed=1&ts=${Date.now()}`;
  }
}

function refreshGasExtractorFrame() {
  if (!els.gasExtractorFrame) return;
  const base = String(els.gasUrl.value || GAS_REPORT_URL).trim().replace(/\/+$/, "");
  const url = gasExtractorUrl(base);
  if (els.gasExtractorFrame.src !== url) els.gasExtractorFrame.src = url;
  if (els.openSecureExtractor) els.openSecureExtractor.href = url;
}

function handleExtractorMessage(event) {
  const data = event.data || {};
  if (data.type !== "reporta-aula-moodle-extraction") return;
  const payload = data.payload || {};
  if (!payload.ok || !payload.report) {
    setStatus("Extraccion Moodle no generada", payload.error || "GAS no devolvio una extraccion valida", true);
    return;
  }
  const report = normalizeReport({
    ...payload.report,
    spreadsheet_id: payload.spreadsheetId,
    drive_folder_id: payload.driveFolderId,
    drive_folder_url: payload.driveFolderUrl,
    evidence_files: payload.evidence ? [payload.evidence] : [],
  }, "gas");
  state.report = report;
  state.source = "gas";
  els.googleState.textContent = "GAS conectado";
  els.googleState.className = "pill good";
  els.authState.textContent = "Moodle extraido";
  const evidence = payload.evidence?.file_name ? ` Evidencia: ${payload.evidence.file_name}.` : "";
  const user = payload.moodleUsernameMasked ? ` Usuario ${payload.moodleUsernameMasked}.` : "";
  setStatus("Extraccion Moodle generada", `La corrida fue guardada y acumulada en Sheets/Drive.${user}${evidence}`);
  renderDashboard();
}

function riskMatches(row, filter) {
  const level = String(activeRiskLevel(row) || "").toLowerCase();
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
    const haystack = [
      row.name,
      row.email,
      row.user_id,
      row.student_moodle_id,
      row.student_document_id,
      row.career,
      row.cohort,
      row.tutor_name,
      row.tutor_email,
      row.tutor_id,
    ].join(" ").toLowerCase();
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
    point.className = `scatter-point ${labelClass(activeRiskLevel(row))}`;
    point.style.left = `${Math.min(96, Math.max(4, (row.actions_registered / maxActions) * 92 + 4))}%`;
    point.style.top = `${96 - Math.min(92, Math.max(4, (row.grade_cells_with_value / maxGrades) * 92))}%`;
    point.title = `${row.name} | acciones ${row.actions_registered} | evaluaciones ${row.grade_cells_with_value} | ${activeRiskConfig().shortLabel} ${probability(activeRiskProbability(row))}`;
    point.addEventListener("click", () => selectStudent(row));
    plot.appendChild(point);
  });
  els.scatterPlot.appendChild(plot);
}

function probabilityBands(rows) {
  return rows.reduce((acc, row) => {
    const value = activeRiskProbability(row);
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
  els.riskModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.riskMode === state.riskMode));
  const allRows = report.summaries;
  const rows = filteredSummaries();
  const totalActions = rows.reduce((sum, row) => sum + row.actions_registered, 0);
  const forumPosts = rows.reduce((sum, row) => sum + row.forum_posts, 0);
  const alerts = rows.filter((row) => row.follow_up_alert).length;
  const highRisk = rows.filter((row) => ["Critico", "Alto"].includes(activeRiskLevel(row))).length;
  const graded = rows.filter((row) => row.grade_cells_with_value > 0).length;
  const avgRisk = average(rows, activeRiskProbability);
  const noEvidence = rows.filter((row) => row.platform_level === "Sin evidencia" || row.evaluative_level === "Sin evaluaciones").length;
  const mode = activeRiskConfig();

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
    kpi("Modalidad", mode.shortLabel, mode.description),
    kpi("Riesgo medio", probability(avgRisk), "posterior promedio", avgRisk >= 0.5 ? "warn" : "good"),
    kpi("Riesgo alto", number(highRisk), "critico o alto", highRisk ? "bad" : "good"),
    kpi("Sin evidencia", number(noEvidence), "verificacion tutorial", noEvidence ? "warn" : "good"),
    kpi("Fuente", state.source === "gas" ? "GAS" : "Local", "modo de datos", state.source === "gas" ? "good" : "warn"),
  );

  const riskDist = rows.reduce((acc, row) => {
    const level = activeRiskLevel(row) || "Sin dato";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
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
  const mode = activeRiskConfig();
  const riskDist = rows.reduce((acc, row) => {
    const level = activeRiskLevel(row) || "Sin dato";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  const high = (riskDist.Critico || 0) + (riskDist.Alto || 0);
  els.riskTotal.textContent = number(rows.length);
  els.riskHighCount.textContent = number(high);
  els.probabilityBandTotal.textContent = number(rows.length);
  if (els.activeRiskMode) els.activeRiskMode.textContent = mode.label;
  renderBars(els.riskBars, riskDist, ["Critico", "Alto", "Medio", "Bajo", "Sin dato"]);
  renderBars(els.probabilityBands, probabilityBands(rows), [">= 70%", "50% - 69%", "30% - 49%", "< 30%"]);
  renderModelKpis(rows);
  renderBayesianPath(rows);
  renderEvidenceTable(rows);
  renderRiskTable(rows);
}

function renderModelKpis(rows) {
  const mode = activeRiskConfig();
  const avgPosterior = average(rows, activePosterior);
  const avgPrior = average(rows, activePrior);
  const maxPosterior = maxValue(rows, activePosterior);
  const evidenceItems = rows.reduce((sum, row) => sum + activeEvidenceFactors(row).length, 0);
  els.modelKpis.replaceChildren(
    kpi("Modelo", MODEL_VERSION, "version publica"),
    kpi("Modalidad", mode.shortLabel, mode.description),
    kpi("Prior medio", probability(avgPrior), "antes de evidencia"),
    kpi("Posterior medio", probability(avgPosterior), "riesgo actual"),
    kpi("Maximo posterior", probability(maxPosterior), "caso mas critico", maxPosterior >= 0.7 ? "bad" : maxPosterior >= 0.5 ? "warn" : "good"),
    kpi("Evidencias", number(evidenceItems), "factores auditables"),
  );
}

function renderEvidenceTable(rows) {
  els.evidenceTable.replaceChildren();
  const visible = [...rows].sort((a, b) => activeRiskProbability(b) - activeRiskProbability(a)).slice(0, 12);
  els.evidenceCount.textContent = number(visible.length);
  visible.forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "evidence-row";
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(evidenceLabel(activeEvidenceFactors(row)))}</small></span>
      <span><small>prior</small><strong>${probability(activePrior(row))}</strong></span>
      <span><small>posterior</small><strong>${probability(activePosterior(row))}</strong></span>
      <span><small>log LR</small><strong>${escapeHtml(activeLogLikelihoodRatio(row).toFixed(2))}</strong></span>
    `;
    item.addEventListener("click", () => selectStudent(row));
    els.evidenceTable.appendChild(item);
  });
}

function renderBayesianPath(rows) {
  if (!els.bayesFlow) return;
  const row = bayesianFocusRow(rows);
  els.bayesFlow.replaceChildren();
  if (!row) {
    els.bayesSubject.textContent = "Sin estudiantes filtrados";
    els.bayesPrior.textContent = "0%";
    els.bayesPosterior.textContent = "0%";
    els.bayesDelta.textContent = "0 pp";
    els.bayesStepCount.textContent = "0";
    return;
  }
  const steps = bayesianPath(row);
  const prior = steps[0]?.probability ?? activePrior(row);
  const posterior = steps[steps.length - 1]?.probability ?? activePosterior(row);
  const delta = posterior - prior;
  els.bayesSubject.textContent = `${row.name} | ${activeRiskConfig().shortLabel}`;
  els.bayesPrior.textContent = probability(prior);
  els.bayesPosterior.textContent = probability(posterior);
  els.bayesDelta.textContent = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} pp`;
  els.bayesDelta.className = delta >= 0 ? "bayes-delta-up" : "bayes-delta-down";
  els.bayesStepCount.textContent = number(Math.max(0, steps.length - 1));

  steps.forEach((step, index) => {
    const item = document.createElement("article");
    const tone = step.type === "prior" ? "neutral" : step.delta >= 0 ? "risk-up" : "risk-down";
    const lrLabel = step.type === "prior" ? "base" : `LR x${Number(step.likelihoodRatio || 1).toFixed(2)}`;
    const deltaLabel = step.type === "prior" ? "sin evidencia" : `${step.delta >= 0 ? "+" : ""}${Math.round(step.delta * 100)} pp`;
    item.className = `bayes-node ${tone}`;
    item.innerHTML = `
      <div class="bayes-node-head">
        <span>${index + 1}</span>
        <strong>${escapeHtml(step.label)}</strong>
      </div>
      <div class="bayes-node-meta">
        <small>${escapeHtml(lrLabel)}</small>
        <small>${escapeHtml(deltaLabel)}</small>
      </div>
      <div class="bayes-meter" aria-hidden="true">
        <div class="${labelClass(riskLevel(step.probability))}" style="width:${Math.max(4, Math.round(step.probability * 100))}%"></div>
      </div>
      <strong class="bayes-probability">${probability(step.probability)}</strong>
    `;
    els.bayesFlow.appendChild(item);
  });
}

function renderRiskTable(rows) {
  els.riskTable.replaceChildren();
  [...rows].sort((a, b) => activeRiskProbability(b) - activeRiskProbability(a)).forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `risk-row ${labelClass(activeRiskLevel(row))}`;
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(activeRiskFactors(row).join("; "), "Sin factores criticos")}</small></span>
      <strong>${probability(activeRiskProbability(row))}</strong>
      <span class="pill ${labelClass(activeRiskLevel(row))}">${escapeHtml(activeRiskLevel(row))}</span>
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
    const haystack = `${row.name} ${row.user_id} ${row.student_moodle_id} ${row.student_document_id} ${row.tutor_name} ${row.career}`.toLowerCase();
    return (!query || haystack.includes(query)) &&
      (filter === "all" ||
      (filter === "high-risk" && ["Critico", "Alto"].includes(activeRiskLevel(row))) ||
      (filter === "alerts" && row.follow_up_alert) ||
      (filter === "without-evidence" && row.platform_level === "Sin evidencia") ||
      (filter === "without-grades" && row.evaluative_level === "Sin evaluaciones"));
  });
  els.studentCount.textContent = `${filtered.length}/${rows.length}`;
  els.studentsTable.replaceChildren();
  filtered.sort((a, b) => activeRiskProbability(b) - activeRiskProbability(a)).forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `student-row ${row.follow_up_alert ? "needs-attention" : ""}`;
    item.dataset.key = studentKey(row);
    item.innerHTML = `
      <span class="student-main"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.student_moodle_id || row.user_id)} | ${escapeHtml(row.student_document_id || "sin documento")}</small></span>
      <span>${number(row.actions_registered)}</span>
      <span>${escapeHtml(row.platform_level)}</span>
      <span>${number(row.grade_cells_with_value)}</span>
      <span class="pill ${labelClass(activeRiskLevel(row))}">${probability(activeRiskProbability(row))}</span>
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

function detailPairs(pairs) {
  return pairs.map(([label, value]) => `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`).join("");
}

function renderStudentDetail(row) {
  if (!row) {
    els.detailAlert.textContent = "--";
    els.studentDetail.innerHTML = "<p>No hay estudiantes con los filtros activos.</p>";
    return;
  }
  const mode = activeRiskConfig();
  const activeFactors = activeEvidenceFactors(row);
  els.detailAlert.textContent = row.follow_up_alert ? "Seguimiento" : "Sin alerta";
  els.detailAlert.className = `pill ${row.follow_up_alert ? "warn" : "good"}`;
  els.studentDetail.innerHTML = `
    <div class="detail-name">
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(row.student_moodle_id || row.user_id)} | ${escapeHtml(row.student_document_id || "sin documento")} | ${escapeHtml(row.email || "sin correo")}</span>
    </div>
    <div class="student-badges">
      <span class="pill ${labelClass(row.semester_desertion_risk_level)}">Semestre ${escapeHtml(row.semester_desertion_risk_level)} - ${probability(row.semester_desertion_probability)}</span>
      <span class="pill ${labelClass(row.career_desertion_risk_level)}">Carrera ${escapeHtml(row.career_desertion_risk_level)} - ${probability(row.career_desertion_probability)}</span>
      <span class="pill muted">Activo: ${escapeHtml(mode.shortLabel)}</span>
      <span class="pill muted">${escapeHtml(row.platform_level)}</span>
      <span class="pill muted">${escapeHtml(row.evaluative_level)}</span>
    </div>
    <h4>Identificacion y trayectoria</h4>
    <div class="detail-grid">
      ${detailPairs([
        ["ID Moodle", row.student_moodle_id || row.user_id || "sin dato"],
        ["Documento", row.student_document_id || "sin dato"],
        ["Carrera", row.career || "sin dato"],
        ["Cohorte", row.cohort || "sin dato"],
        ["Semestre", row.semester_number || "sin dato"],
        ["Estado matricula", row.enrollment_status || "sin dato"],
        ["Carga academica", row.academic_load || "sin dato"],
        ["Previas no aprobadas", row.failed_previous_subjects ?? "sin dato"],
        ["Avance carrera", `${number(row.program_progress_percent)}%`],
        ["Turno", row.work_shift || "sin dato"],
      ])}
    </div>
    <h4>Actividad Moodle</h4>
    <div class="detail-grid">
      ${detailPairs([
        ["Acciones Moodle", number(row.actions_registered)],
        ["Foros", number(row.forum_posts)],
        ["Evaluaciones", number(row.grade_cells_with_value)],
        ["Ultimo acceso", `${number(row.days_since_last_access)} dias`],
      ])}
    </div>
    <h4>Tutor asignado</h4>
    <div class="detail-grid">
      ${detailPairs([
        ["Tutor", row.tutor_name || "sin dato"],
        ["ID tutor", row.tutor_id || "sin dato"],
        ["Rol", row.tutor_role || "sin dato"],
        ["Correo tutor", row.tutor_email || "sin dato"],
        ["Acciones tutor", number(row.tutor_actions_registered)],
        ["Retroalimentaciones", number(row.tutor_feedback_count)],
        ["Respuesta promedio", `${number(row.tutor_response_hours)} h`],
        ["Cobertura tutor", probability(row.tutor_activity_coverage)],
      ])}
    </div>
    <h4>Factores bayesianos (${escapeHtml(mode.shortLabel)})</h4>
    <ul>${activeFactors.map((factor) => `<li>${escapeHtml(factor)}</li>`).join("") || "<li>Sin factores registrados</li>"}</ul>
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
  if (els.tutorRoster && els.tutorRosterCount) {
    const tutors = state.report.tutor_profiles || [];
    els.tutorRosterCount.textContent = number(tutors.length);
    els.tutorRoster.replaceChildren();
    tutors.forEach((tutor) => {
      const item = document.createElement("article");
      item.className = "tutor-card";
      item.innerHTML = `
        <div class="student-main">
          <strong>${escapeHtml(tutor.tutor_name)}</strong>
          <small>${escapeHtml(tutor.tutor_id)} | ${escapeHtml(tutor.tutor_email || "sin correo")}</small>
        </div>
        <div class="detail-grid single">
          ${detailPairs([
            ["Rol", tutor.tutor_role || "sin dato"],
            ["Estudiantes", number(tutor.assigned_students)],
            ["Acciones", number(tutor.tutor_actions_registered)],
            ["Foros", number(tutor.tutor_forum_replies)],
            ["Feedback", number(tutor.tutor_feedback_count)],
            ["Respuesta", `${number(tutor.tutor_response_hours)} h`],
            ["Cobertura", probability(tutor.tutor_activity_coverage)],
            ["Senal", tutor.tutor_followup_signal || "sin dato"],
          ])}
        </div>
      `;
      els.tutorRoster.appendChild(item);
    });
  }
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
    <span>Credenciales</span><strong>Panel seguro GAS</strong>
  `;
}

function renderRuns() {
  const runs = [
    { run_id: state.report.run_id, status: "done", message: "Reporte publico cargado" },
    { run_id: "app-version", status: "done", message: `Version ${APP_VERSION} | build ${APP_BUILD_DATE}` },
    { run_id: "risk-mode", status: "done", message: `Modalidad activa: ${activeRiskConfig().description}` },
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
    ["2026-06-11", "Modelo con modalidades semestre y carrera e identificadores anonimizados"],
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

function setRiskMode(mode) {
  if (!RISK_MODES[mode]) return;
  state.riskMode = mode;
  els.riskModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.riskMode === mode));
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

function renderCredentialStatus(payload) {
  if (!els.credentialStatus) return;
  if (!payload) {
    els.credentialStatus.textContent = "Sin verificar";
    return;
  }
  if (payload.configured) {
    els.credentialStatus.textContent = `Institucionales disponibles: ${payload.usernameMasked || "usuario Moodle"}`;
    els.credentialStatus.className = "good";
    els.authState.textContent = "Moodle real";
    return;
  }
  els.credentialStatus.textContent = "Cada usuario carga en GAS";
  els.credentialStatus.className = "good";
}

async function checkMoodleCredentials() {
  const base = String(els.gasUrl.value || GAS_REPORT_URL).trim().replace(/\/+$/, "");
  localStorage.setItem("reportaAulaGasUrl", base);
  setStatus("Verificando credenciales", "Consultando Script Properties desde Apps Script.");
  try {
    const status = await loadCredentialStatus(base);
    renderCredentialStatus(status);
    setStatus(
      status.configured ? "Credenciales configuradas" : "Credenciales pendientes",
      status.configured
        ? `GAS tiene credenciales institucionales para ${status.usernameMasked}.`
        : "Modo multiusuario activo: cargue credenciales en el modulo seguro.",
      false,
    );
  } catch (error) {
    setStatus("Credenciales no verificadas", error.message || String(error), true);
  }
}

async function generateExtraction(api = "runMoodleExtraction") {
  const base = String(els.gasUrl.value || GAS_REPORT_URL).trim().replace(/\/+$/, "");
  localStorage.setItem("reportaAulaGasUrl", base);
  refreshGasExtractorFrame();
  if (api === "runMoodleExtraction") {
    els.gasExtractorFrame?.scrollIntoView({ behavior: "smooth", block: "center" });
    setStatus("Carga segura Moodle", "Ingrese sus credenciales en el modulo GAS y pulse Generar extraccion Moodle.");
    return;
  }
  els.generateExtraction.disabled = true;
  if (els.generateDemo) els.generateDemo.disabled = true;
  const isMoodle = api === "runMoodleExtraction";
  setStatus(
    isMoodle ? "Extrayendo Moodle" : "Generando muestra",
    isMoodle
      ? "Apps Script esta iniciando sesion en Moodle, leyendo evidencias y guardando en Sheets/Drive."
      : "Apps Script esta escribiendo una muestra anonima en Sheets/Drive.",
  );
  try {
    const result = await runGasExtraction(base, api);
    state.report = result.report;
    state.source = "gas";
    els.googleState.textContent = "GAS conectado";
    els.googleState.className = "pill good";
    els.authState.textContent = isMoodle ? "Moodle extraido" : "Muestra generada";
    const evidence = result.payload.evidence?.file_name ? ` Evidencia: ${result.payload.evidence.file_name}.` : "";
    setStatus(isMoodle ? "Extraccion Moodle generada" : "Muestra generada", `La corrida fue guardada en Sheets/Drive.${evidence}`);
    renderDashboard();
  } catch (error) {
    setStatus(isMoodle ? "Extraccion Moodle no generada" : "Muestra no generada", error.message || String(error), true);
    if (isMoodle) checkMoodleCredentials();
  } finally {
    els.generateExtraction.disabled = false;
    if (els.generateDemo) els.generateDemo.disabled = false;
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
  els.riskModeButtons.forEach((button) => button.addEventListener("click", () => setRiskMode(button.dataset.riskMode)));
  els.filters.clear.addEventListener("click", clearFilters);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentFilter.addEventListener("change", renderStudents);
  $("#refreshRuns").addEventListener("click", async () => {
    setStatus("Actualizando", "Recargando datos de GAS.");
    await loadAndRender();
  });
  els.updateVersion.addEventListener("click", updateAppVersion);
  els.installApp.addEventListener("click", installCurrentApp);
  els.generateExtraction.addEventListener("click", () => generateExtraction("runMoodleExtraction"));
  if (els.generateDemo) els.generateDemo.addEventListener("click", () => generateExtraction("runSample"));
  if (els.checkMoodleCredentials) els.checkMoodleCredentials.addEventListener("click", checkMoodleCredentials);
  window.addEventListener("message", handleExtractorMessage);
  els.gasUrl.addEventListener("change", refreshGasExtractorFrame);
  els.gasUrl.addEventListener("blur", refreshGasExtractorFrame);
  els.runForm.addEventListener("submit", testGas);
  els.gasUrl.value = localStorage.getItem("reportaAulaGasUrl") || GAS_REPORT_URL;
  refreshGasExtractorFrame();
  await registerServiceWorker();
  checkMoodleCredentials();
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
