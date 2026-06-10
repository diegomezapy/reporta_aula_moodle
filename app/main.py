from __future__ import annotations

import threading
import time
import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import ReportPackage, RunRequest, RunStatus
from app.runner import make_run_id, run_extraction
from app.storage import ensure_run_dir, latest_completed_report, list_statuses, read_report, read_status, write_status

settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Reporta Aula Moodle", version="0.1.0")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.middleware("http")
async def protect_private_app(request: Request, call_next):
    if not settings.app_username or not settings.app_password:
        return await call_next(request)
    auth = request.headers.get("authorization", "")
    scheme, _, encoded = auth.partition(" ")
    valid = False
    if scheme.lower() == "basic" and encoded:
        import base64

        try:
            decoded = base64.b64decode(encoded).decode("utf-8")
            username, _, password = decoded.partition(":")
            valid = secrets.compare_digest(username, settings.app_username) and secrets.compare_digest(
                password, settings.app_password.get_secret_value()
            )
        except Exception:
            valid = False
    if valid:
        return await call_next(request)
    from fastapi.responses import Response

    return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Reporta Aula Moodle"'})


def _dashboard_payload(report: ReportPackage) -> dict[str, object]:
    return {
        "run_id": report.run_id,
        "generated_at": report.generated_at,
        "moodle_base_url": report.moodle_base_url,
        "course_id": report.course_id,
        "course_title": report.course_title,
        "participants_count": len(report.participants),
        "summaries": [summary.model_dump(mode="json") for summary in report.summaries],
        "activity_summary": report.activity_summary,
        "notes": report.notes,
    }


def _execute_background_run(run_id: str, request: RunRequest, initial_status: RunStatus) -> None:
    running = RunStatus(run_id=run_id, status="running", created_at=initial_status.created_at, message="Extrayendo datos desde Moodle.")
    write_status(settings.data_dir, running)
    try:
        _, files, google_sync = run_extraction(run_id, request, settings)
        done = RunStatus(
            run_id=run_id,
            status="done",
            created_at=initial_status.created_at,
            finished_at=datetime.now(timezone.utc),
            message="Extraccion completada.",
            files=files,
            google_sync=google_sync,
        )
        write_status(settings.data_dir, done)
    except Exception as exc:
        error = RunStatus(
            run_id=run_id,
            status="error",
            created_at=initial_status.created_at,
            finished_at=datetime.now(timezone.utc),
            message=str(exc),
        )
        write_status(settings.data_dir, error)


def _schedule_run(notes: str) -> RunStatus:
    run_id = make_run_id()
    ensure_run_dir(settings.data_dir, run_id)
    request = RunRequest(sync_to_google=True, notes=notes)
    status = RunStatus(run_id=run_id, status="queued", message="Corrida automatica en cola.")
    write_status(settings.data_dir, status)
    threading.Thread(target=_execute_background_run, args=(run_id, request, status), daemon=True).start()
    return status


def _automation_loop() -> None:
    while True:
        _schedule_run("Corrida automatica programada.")
        time.sleep(max(settings.auto_run_interval_minutes, 5) * 60)


@app.on_event("startup")
def start_automation() -> None:
    if settings.auto_run_enabled:
        threading.Thread(target=_automation_loop, daemon=True).start()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/api/defaults")
def defaults() -> dict[str, object]:
    return {
        "moodle_base_url": settings.moodle_base_url,
        "course_id": settings.moodle_course_id,
        "spreadsheet_id": settings.google_spreadsheet_id,
        "has_env_moodle_user": bool(settings.moodle_username),
        "has_google_sink": bool(settings.gas_webapp_url or settings.google_service_account_file or settings.google_service_account_json),
    }


@app.get("/api/runs")
def runs() -> list[RunStatus]:
    return list_statuses(settings.data_dir)


@app.get("/api/runs/{run_id}")
def run_status(run_id: str) -> RunStatus:
    status = read_status(settings.data_dir / run_id)
    if not status:
        raise HTTPException(status_code=404, detail="Corrida no encontrada.")
    return status


@app.get("/api/runs/{run_id}/report")
def run_report(run_id: str) -> ReportPackage:
    report = read_report(settings.data_dir / run_id)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado para esta corrida.")
    return report


@app.get("/api/runs/{run_id}/dashboard")
def run_dashboard(run_id: str) -> dict[str, object]:
    report = read_report(settings.data_dir / run_id)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado para esta corrida.")
    return _dashboard_payload(report)


@app.get("/api/reports/latest")
def latest_report() -> ReportPackage:
    report = latest_completed_report(settings.data_dir)
    if not report:
        raise HTTPException(status_code=404, detail="Todavia no hay reportes completados.")
    return report


@app.get("/api/reports/latest/dashboard")
def latest_dashboard() -> dict[str, object]:
    report = latest_completed_report(settings.data_dir)
    if not report:
        raise HTTPException(status_code=404, detail="Todavia no hay reportes completados.")
    return _dashboard_payload(report)


@app.get("/api/runs/{run_id}/files/{filename}")
def run_file(run_id: str, filename: str) -> FileResponse:
    run_dir = settings.data_dir / run_id
    path = (run_dir / filename).resolve()
    if not str(path).startswith(str(run_dir.resolve())) or not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    return FileResponse(path)


@app.post("/api/runs")
def create_run(request: RunRequest) -> RunStatus:
    run_id = make_run_id()
    ensure_run_dir(settings.data_dir, run_id)
    status = RunStatus(run_id=run_id, status="queued", message="Corrida en cola.")
    write_status(settings.data_dir, status)

    threading.Thread(target=_execute_background_run, args=(run_id, request, status), daemon=True).start()
    return status
