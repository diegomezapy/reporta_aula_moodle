from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Optional

from app.models import StudentSummary, TutorSummary


BAYESIAN_MODEL_VERSION = "bayes_lr_expert_v0.2_dual_desertion"
DEFAULT_SEMESTER_DESERTION_PRIOR = 0.22
DEFAULT_CAREER_DESERTION_PRIOR = 0.16
DEFAULT_DESERTION_PRIOR = DEFAULT_SEMESTER_DESERTION_PRIOR


@dataclass(frozen=True)
class BayesianRiskEstimate:
    prior_probability: float
    posterior_probability: float
    log_likelihood_ratio: float
    evidence_factors: list[str]


def _clamp_probability(value: float) -> float:
    return max(0.02, min(0.98, value))


def _odds(probability: float) -> float:
    probability = _clamp_probability(probability)
    return probability / (1.0 - probability)


def _probability_from_odds(odds: float) -> float:
    return odds / (1.0 + odds)


def _add_evidence(items: list[tuple[float, str]], likelihood_ratio: float, label: str) -> None:
    items.append((likelihood_ratio, label))


def days_since_last_access(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    text = value.lower()
    if "nunca" in text or "never" in text:
        return None
    days = 0.0
    matched = False
    patterns = [
        (r"(\d+)\s*d[iíÃ­]a", 1.0),
        (r"(\d+)\s*day", 1.0),
        (r"(\d+)\s*hora", 1 / 24),
        (r"(\d+)\s*hour", 1 / 24),
        (r"(\d+)\s*minuto", 1 / 1440),
        (r"(\d+)\s*minute", 1 / 1440),
        (r"(\d+)\s*segundo", 1 / 86400),
        (r"(\d+)\s*second", 1 / 86400),
    ]
    for pattern, factor in patterns:
        match = re.search(pattern, text)
        if match:
            days += int(match.group(1)) * factor
            matched = True
    return round(days, 2) if matched else None


def _score_from_course_total(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    match = re.search(r"\d+(?:[,.]\d+)?", value)
    if not match:
        return None
    return float(match.group(0).replace(",", "."))


def _estimate_from_evidence(prior: float, evidence: list[tuple[float, str]]) -> BayesianRiskEstimate:
    log_likelihood_ratio = sum(math.log(max(lr, 0.05)) for lr, _ in evidence)
    posterior_odds = _odds(prior) * math.exp(log_likelihood_ratio)
    posterior = _clamp_probability(_probability_from_odds(posterior_odds))
    return BayesianRiskEstimate(
        prior_probability=round(prior, 4),
        posterior_probability=round(posterior, 4),
        log_likelihood_ratio=round(log_likelihood_ratio, 4),
        evidence_factors=[label for _, label in evidence],
    )


def estimate_semester_desertion_probability(
    summary: StudentSummary,
    tutor_summary: TutorSummary,
    prior_probability: Optional[float] = None,
) -> BayesianRiskEstimate:
    """Estimate semester dropout risk with auditable expert likelihood ratios.

    This is an initial Bayesian layer for weekly monitoring. The prior can be the
    previous week's posterior for the same student; otherwise a conservative
    course-level prior is used.
    """

    prior = _clamp_probability(prior_probability if prior_probability is not None else DEFAULT_SEMESTER_DESERTION_PRIOR)
    evidence: list[tuple[float, str]] = []

    if summary.platform_level == "Sin evidencia":
        _add_evidence(evidence, 4.0, "Sin evidencia de actividad en plataforma")
    elif summary.platform_level == "Baja":
        _add_evidence(evidence, 2.2, "Baja actividad en plataforma")
    elif summary.platform_level == "Media":
        _add_evidence(evidence, 1.15, "Actividad en plataforma media")
    elif summary.platform_level == "Alta":
        _add_evidence(evidence, 0.65, "Alta actividad en plataforma")

    if summary.evaluative_level == "Sin evaluaciones":
        _add_evidence(evidence, 4.5, "Sin evaluaciones registradas")
    elif summary.evaluative_level == "Baja":
        _add_evidence(evidence, 2.1, "Baja participacion evaluativa")
    elif summary.evaluative_level == "Media":
        _add_evidence(evidence, 1.05, "Participacion evaluativa media")
    elif summary.evaluative_level == "Alta":
        _add_evidence(evidence, 0.55, "Alta participacion evaluativa")

    if summary.forum_posts == 0:
        _add_evidence(evidence, 1.25, "Sin participacion registrada en foros")
    elif summary.forum_posts >= 3:
        _add_evidence(evidence, 0.8, "Participacion frecuente en foros")

    days = days_since_last_access(summary.last_access)
    if days is None:
        _add_evidence(evidence, 1.55, "Ultimo acceso no registrado o nunca ingresado")
    elif days >= 30:
        _add_evidence(evidence, 2.4, "Ultimo acceso mayor o igual a 30 dias")
    elif days >= 14:
        _add_evidence(evidence, 1.55, "Ultimo acceso mayor o igual a 14 dias")
    elif days <= 7:
        _add_evidence(evidence, 0.85, "Acceso reciente al aula")

    course_total = _score_from_course_total(summary.course_total)
    if course_total is not None and course_total < 60:
        _add_evidence(evidence, 2.2, "Total del curso por debajo de 60")
    elif course_total is not None and course_total < 70:
        _add_evidence(evidence, 1.35, "Total del curso por debajo de 70")
    elif course_total is not None and course_total >= 80:
        _add_evidence(evidence, 0.75, "Total del curso igual o superior a 80")

    if summary.academic_load is not None and summary.academic_load <= 1:
        _add_evidence(evidence, 1.25, "Carga academica actual muy baja")

    if tutor_summary.actions_registered == 0:
        _add_evidence(evidence, 1.25, "Sin evidencia de acompanamiento del tutor en el reporte")
    elif tutor_summary.activity_coverage < 0.25:
        _add_evidence(evidence, 1.1, "Baja cobertura de acompanamiento del tutor")
    elif tutor_summary.activity_coverage >= 0.5:
        _add_evidence(evidence, 0.9, "Cobertura tutorial amplia")

    if summary.tutor_feedback_count == 0 and summary.tutor_id:
        _add_evidence(evidence, 1.35, "Sin retroalimentacion tutorial individual registrada")
    if summary.tutor_response_hours is not None and summary.tutor_response_hours >= 72:
        _add_evidence(evidence, 1.35, "Respuesta tutorial mayor o igual a 72 horas")
    if summary.tutor_activity_coverage is not None and summary.tutor_activity_coverage < 0.35:
        _add_evidence(evidence, 1.3, "Cobertura tutorial individual baja")
    elif summary.tutor_activity_coverage is not None and summary.tutor_activity_coverage >= 0.75:
        _add_evidence(evidence, 0.78, "Cobertura tutorial individual amplia")

    return _estimate_from_evidence(prior, evidence)


def estimate_career_desertion_probability(
    summary: StudentSummary,
    semester_estimate: BayesianRiskEstimate,
    prior_probability: Optional[float] = None,
) -> BayesianRiskEstimate:
    """Estimate career dropout risk from academic trajectory and support signals."""

    prior = _clamp_probability(prior_probability if prior_probability is not None else DEFAULT_CAREER_DESERTION_PRIOR)
    evidence: list[tuple[float, str]] = []
    semester = summary.semester_number or 0
    failed = summary.failed_previous_subjects or 0
    progress = summary.program_progress_percent
    load = summary.academic_load

    if failed >= 4:
        _add_evidence(evidence, 2.4, "Cuatro o mas materias previas no aprobadas")
    elif failed >= 2:
        _add_evidence(evidence, 1.6, "Dos o mas materias previas no aprobadas")
    elif failed == 0:
        _add_evidence(evidence, 0.75, "Sin materias previas no aprobadas")

    if progress is not None and semester >= 6 and progress < 55:
        _add_evidence(evidence, 2.1, "Avance de carrera bajo para el semestre cursado")
    elif progress is not None and semester >= 4 and progress < 35:
        _add_evidence(evidence, 1.75, "Avance acumulado rezagado")
    elif progress is not None and progress >= 60:
        _add_evidence(evidence, 0.78, "Avance de carrera consistente")

    if load is not None and load <= 1:
        _add_evidence(evidence, 1.7, "Carga academica reducida")
    elif load is not None and load >= 4:
        _add_evidence(evidence, 0.85, "Carga academica activa")

    if summary.enrollment_status and summary.enrollment_status != "Regular":
        _add_evidence(evidence, 2.0, "Estado de matricula requiere revision academica")
    if summary.scholarship_status == "Beca activa":
        _add_evidence(evidence, 0.85, "Beca activa registrada")

    if summary.tutor_followup_signal == "Bajo":
        _add_evidence(evidence, 1.35, "Acompanamiento tutorial bajo")
    elif summary.tutor_followup_signal == "Alta":
        _add_evidence(evidence, 0.85, "Acompanamiento tutorial alto")

    if semester_estimate.posterior_probability >= 0.7:
        _add_evidence(evidence, 1.5, "Riesgo alto durante el semestre actual")
    elif semester_estimate.posterior_probability < 0.3:
        _add_evidence(evidence, 0.85, "Riesgo bajo durante el semestre actual")

    return _estimate_from_evidence(prior, evidence)


def estimate_desertion_probability(
    summary: StudentSummary,
    tutor_summary: TutorSummary,
    prior_probability: Optional[float] = None,
) -> BayesianRiskEstimate:
    """Backward-compatible alias for semester dropout risk."""

    return estimate_semester_desertion_probability(summary, tutor_summary, prior_probability)
