from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Tuple

from app.config import Settings
from app.models import ReportPackage, RunRequest
from app.moodle_client import MoodleClient
from app.reporting import apply_desertion_risk, build_activity_summary, build_student_summaries, build_tutor_summary
from app.sheets import sync_with_google
from app.storage import write_report


def make_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def run_extraction(run_id: str, request: RunRequest, settings: Settings) -> Tuple[ReportPackage, list[str], Optional[str]]:
    base_url = (request.moodle_base_url or settings.moodle_base_url).rstrip("/")
    course_id = request.course_id or settings.moodle_course_id
    username = request.username or settings.moodle_username
    password = request.password.get_secret_value() if request.password else None
    if not password and settings.moodle_password:
        password = settings.moodle_password.get_secret_value()
    if not username or not password:
        raise RuntimeError("Faltan credenciales Moodle. Ingresalas en el formulario o en variables de entorno.")

    client = MoodleClient(base_url=base_url, username=username, password=password, timeout=settings.request_timeout_seconds)
    client.login()
    course_title = client.course_title(course_id)
    participants = client.get_participants(course_id)
    grade_rows = client.get_grade_rows(course_id)
    activities = client.get_course_activities(course_id)
    participation_rows = client.get_participation_rows(course_id, activities)
    tutor_participation_rows = client.get_tutor_participation_rows(course_id, activities) if request.include_tutor_participation else []
    tutor_summary = build_tutor_summary(tutor_participation_rows, len(activities))
    summaries = build_student_summaries(participants, grade_rows, participation_rows)
    summaries = apply_desertion_risk(summaries, tutor_summary)
    activity_summary = build_activity_summary(participation_rows)
    tutor_activity_summary = build_activity_summary(tutor_participation_rows)

    package = ReportPackage(
        run_id=run_id,
        moodle_base_url=base_url,
        course_id=course_id,
        course_title=course_title,
        participants=participants,
        grade_rows=grade_rows,
        activities=activities,
        participation_rows=participation_rows,
        tutor_participation_rows=tutor_participation_rows,
        summaries=summaries,
        activity_summary=activity_summary,
        tutor_activity_summary=tutor_activity_summary,
        tutor_summary=tutor_summary,
        notes=request.notes,
    )
    files = write_report(settings.data_dir, package)
    google_sync = sync_with_google(package, settings) if request.sync_to_google else "omitido por solicitud"
    return package, files, google_sync
