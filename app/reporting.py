from __future__ import annotations

import re
from collections import defaultdict
from typing import Optional, Tuple, Union

from app.models import Participant, ParticipationRow, StudentSummary, TableRow, TutorSummary
from app.moodle_client import key_norm


def _identity(user_id: Optional[str], name: Optional[str]) -> str:
    return user_id or key_norm(name or "")


def _student_name_from_grade(row: TableRow) -> Optional[str]:
    for key, value in row.cells.items():
        if any(token in key_norm(key) for token in ["nombre", "name", "usuario", "student"]):
            return value
    return None


def _course_total(row: TableRow) -> Optional[str]:
    for key, value in row.cells.items():
        clean = key_norm(key)
        if "total" in clean or "curso" in clean:
            return value or None
    return None


def _grade_count(row: TableRow) -> int:
    count = 0
    for key, value in row.cells.items():
        clean = key_norm(key)
        if any(token in clean for token in ["nombre", "name", "usuario", "email", "correo", "rango"]):
            continue
        if re.search(r"\d", value):
            count += 1
    return count


def _score_from_course_total(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    match = re.search(r"\d+(?:[,.]\d+)?", value)
    if not match:
        return None
    return float(match.group(0).replace(",", "."))


def _last_access_is_missing(value: Optional[str]) -> bool:
    if not value:
        return True
    clean = key_norm(value)
    return "nunca" in clean or "never" in clean or clean in {"-", "--"}


def build_student_summaries(
    participants: list[Participant],
    grade_rows: list[TableRow],
    participation_rows: list[ParticipationRow],
) -> list[StudentSummary]:
    action_counts: dict[str, int] = defaultdict(int)
    forum_posts: dict[str, int] = defaultdict(int)
    for row in participation_rows:
        key = _identity(row.user_id, row.student_name)
        action_counts[key] += row.count
        haystack = key_norm(f"{row.activity_name or ''} {row.action or ''}")
        if "foro" in haystack or "forum" in haystack or "mensaje" in haystack or "post" in haystack:
            forum_posts[key] += row.count

    grades_by_key: dict[str, TableRow] = {}
    for row in grade_rows:
        key = _identity(row.user_id, _student_name_from_grade(row))
        if key:
            grades_by_key[key] = row

    summaries: list[StudentSummary] = []
    for participant in participants:
        key = _identity(participant.user_id, participant.name)
        grade_row = grades_by_key.get(key)
        grade_cells = _grade_count(grade_row) if grade_row else 0
        actions = action_counts.get(key, 0)
        platform_level = "Sin evidencia"
        if actions >= 80:
            platform_level = "Alta"
        elif actions >= 25:
            platform_level = "Media"
        elif actions > 0:
            platform_level = "Baja"

        evaluative_level = "Sin evaluaciones"
        if grade_cells >= 5:
            evaluative_level = "Alta"
        elif grade_cells >= 2:
            evaluative_level = "Media"
        elif grade_cells > 0:
            evaluative_level = "Baja"

        summaries.append(
            StudentSummary(
                user_id=participant.user_id,
                name=participant.name,
                email=participant.email,
                last_access=participant.last_access,
                actions_registered=actions,
                forum_posts=forum_posts.get(key, 0),
                grade_cells_with_value=grade_cells,
                course_total=_course_total(grade_row) if grade_row else None,
                platform_level=platform_level,
                evaluative_level=evaluative_level,
                follow_up_alert=platform_level in {"Sin evidencia", "Baja"} or evaluative_level in {"Sin evaluaciones", "Baja"},
            )
        )
    return summaries


def build_tutor_summary(tutor_rows: list[ParticipationRow], activities_count: int) -> TutorSummary:
    active_tutors = {row.user_id or key_norm(row.student_name or "") for row in tutor_rows if row.count > 0 and (row.user_id or row.student_name)}
    activities_with_evidence = {row.activity_cmid or row.activity_name for row in tutor_rows if row.count > 0 and (row.activity_cmid or row.activity_name)}
    actions = sum(row.count for row in tutor_rows)
    forum_posts = 0
    for row in tutor_rows:
        haystack = key_norm(f"{row.activity_name or ''} {row.action or ''}")
        if "foro" in haystack or "forum" in haystack or "mensaje" in haystack or "post" in haystack:
            forum_posts += row.count
    coverage = len(activities_with_evidence) / activities_count if activities_count else 0.0
    level = "Sin evidencia"
    if actions >= 80 and coverage >= 0.5:
        level = "Alta"
    elif actions >= 25 or coverage >= 0.25:
        level = "Media"
    elif actions > 0:
        level = "Baja"
    return TutorSummary(
        active_tutors=len(active_tutors),
        actions_registered=actions,
        forum_posts=forum_posts,
        activities_with_evidence=len(activities_with_evidence),
        activity_coverage=round(coverage, 3),
        participation_level=level,
    )


def apply_desertion_risk(summaries: list[StudentSummary], tutor_summary: TutorSummary) -> list[StudentSummary]:
    enriched: list[StudentSummary] = []
    tutor_signal = tutor_summary.participation_level
    for summary in summaries:
        score = 0.08
        factors: list[str] = []

        if summary.platform_level == "Sin evidencia":
            score += 0.34
            factors.append("Sin evidencia de actividad en plataforma")
        elif summary.platform_level == "Baja":
            score += 0.22
            factors.append("Baja actividad en plataforma")
        elif summary.platform_level == "Media":
            score += 0.08

        if summary.evaluative_level == "Sin evaluaciones":
            score += 0.3
            factors.append("Sin evaluaciones registradas")
        elif summary.evaluative_level == "Baja":
            score += 0.18
            factors.append("Baja participacion evaluativa")
        elif summary.evaluative_level == "Media":
            score += 0.07

        if summary.grade_cells_with_value == 0:
            score += 0.12
        if summary.forum_posts == 0:
            score += 0.05
            factors.append("Sin participacion registrada en foros")
        if _last_access_is_missing(summary.last_access):
            score += 0.08
            factors.append("Ultimo acceso no registrado o nunca ingresado")

        course_total = _score_from_course_total(summary.course_total)
        if course_total is not None and course_total < 60:
            score += 0.18
            factors.append("Total del curso por debajo de 60")
        elif course_total is not None and course_total < 70:
            score += 0.08

        if tutor_summary.actions_registered == 0:
            score += 0.08
            factors.append("Sin evidencia de acompanamiento del tutor en el reporte")
        elif tutor_summary.activity_coverage < 0.25:
            score += 0.04
            factors.append("Baja cobertura de acompanamiento del tutor")
        elif tutor_summary.activity_coverage >= 0.5:
            score -= 0.03

        probability = max(0.02, min(0.98, score))
        level = "Bajo"
        if probability >= 0.7:
            level = "Critico"
        elif probability >= 0.5:
            level = "Alto"
        elif probability >= 0.3:
            level = "Medio"

        enriched.append(
            summary.model_copy(
                update={
                    "follow_up_alert": summary.follow_up_alert or probability >= 0.5,
                    "tutor_activity_signal": tutor_signal,
                    "desertion_probability": round(probability, 2),
                    "desertion_risk_level": level,
                    "desertion_risk_factors": factors[:6],
                }
            )
        )
    return enriched


def build_activity_summary(rows: list[ParticipationRow]) -> list[dict[str, Union[str, int, None]]]:
    grouped: dict[Tuple[Optional[str], Optional[str], Optional[str]], int] = defaultdict(int)
    for row in rows:
        grouped[(row.activity_cmid, row.activity_name, row.action)] += row.count
    return [
        {"activity_cmid": cmid, "activity_name": name, "action": action, "count": count}
        for (cmid, name, action), count in sorted(grouped.items(), key=lambda item: (item[0][1] or "", item[0][2] or ""))
    ]


def build_desertion_risk_summary(summaries: list[StudentSummary]) -> dict[str, int]:
    levels = {"Critico": 0, "Alto": 0, "Medio": 0, "Bajo": 0, "Sin dato": 0}
    for summary in summaries:
        levels[summary.desertion_risk_level or "Sin dato"] = levels.get(summary.desertion_risk_level or "Sin dato", 0) + 1
    return levels
