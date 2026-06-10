from __future__ import annotations

import re
from collections import defaultdict
from typing import Optional, Tuple, Union

from app.models import Participant, ParticipationRow, StudentSummary, TableRow
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


def build_activity_summary(rows: list[ParticipationRow]) -> list[dict[str, Union[str, int, None]]]:
    grouped: dict[Tuple[Optional[str], Optional[str], Optional[str]], int] = defaultdict(int)
    for row in rows:
        grouped[(row.activity_cmid, row.activity_name, row.action)] += row.count
    return [
        {"activity_cmid": cmid, "activity_name": name, "action": action, "count": count}
        for (cmid, name, action), count in sorted(grouped.items(), key=lambda item: (item[0][1] or "", item[0][2] or ""))
    ]
