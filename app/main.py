from __future__ import annotations

import base64
import threading
import time
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import AccessLogEntry, AutomationConfig, ReportPackage, RunRequest, RunStatus
from app.reporting import build_desertion_risk_summary
from app.runner import make_run_id, run_extraction
from app.storage import (
    append_access_log,
    ensure_run_dir,
    latest_completed_report,
    list_access_logs,
    list_statuses,
    read_automation_config,
    read_report,
    read_status,
    write_automation_config,
    write_status,
)

settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Reporta Aula Moodle", version="0.1.0")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.middleware("http")
async def audit_and_protect_private_app(request: Request, call_next):
    if request.url.path == "/healthz":
        return await call_next(request)

    username = request.headers.get("x-forwarded-user") or request.headers.get("x-user-email") or "sin_autenticacion"
    if settings.app_username and settings.app_password:
        username, password = _basic_credentials(request)
        valid = bool(
            username
            and password
            and secrets.compare_digest(username, settings.app_username)
            and secrets.compare_digest(password, settings.app_password.get_secret_value())
        )
        if not valid:
            response = Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Reporta Aula Moodle"'})
            _log_access(request, response.status_code, username or "intento_no_autenticado")
            return response

    response = await call_next(request)
    _log_access(request, response.status_code, username or "sin_autenticacion")
    return response


def _basic_credentials(request: Request) -> tuple[Optional[str], Optional[str]]:
    auth = request.headers.get("authorization", "")
    scheme, _, encoded = auth.partition(" ")
    if scheme.lower() == "basic" and encoded:
        try:
            decoded = base64.b64decode(encoded).decode("utf-8")
            username, _, password = decoded.partition(":")
            return username, password
        except Exception:
            return None, None
    return None, None


def _log_access(request: Request, status_code: int, username: str) -> None:
    if request.url.path.startswith("/static/"):
        return
    entry = AccessLogEntry(
        username=username,
        method=request.method,
        path=request.url.path,
        status_code=status_code,
        client_host=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    try:
        append_access_log(settings.access_log_file, entry)
    except Exception:
        pass


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
        "tutor_summary": report.tutor_summary.model_dump(mode="json"),
        "tutor_activity_summary": report.tutor_activity_summary,
        "desertion_risk_summary": build_desertion_risk_summary(report.summaries),
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


def _schedule_run(notes: str, sync_to_google: bool = True, include_tutor_participation: bool = True) -> RunStatus:
    run_id = make_run_id()
    ensure_run_dir(settings.data_dir, run_id)
    request = RunRequest(sync_to_google=sync_to_google, include_tutor_participation=include_tutor_participation, notes=notes)
    status = RunStatus(run_id=run_id, status="queued", message="Corrida automatica en cola.")
    write_status(settings.data_dir, status)
    threading.Thread(target=_execute_background_run, args=(run_id, request, status), daemon=True).start()
    return status


def _default_automation_config() -> AutomationConfig:
    next_run = datetime.now(timezone.utc) if settings.auto_run_enabled else None
    return AutomationConfig(
        enabled=settings.auto_run_enabled,
        interval_minutes=settings.auto_run_interval_minutes,
        next_run_at=next_run,
    )


def _automation_config() -> AutomationConfig:
    return read_automation_config(settings.automation_config_file, _default_automation_config())


def _has_active_run() -> bool:
    return any(status.status in {"queued", "running"} for status in list_statuses(settings.data_dir))


def _automation_loop() -> None:
    while True:
        try:
            config = _automation_config()
            now = datetime.now(timezone.utc)
            next_run_at = config.next_run_at or now
            if config.enabled and next_run_at <= now and not _has_active_run():
                _schedule_run(
                    config.notes or "Corrida automatica programada.",
                    sync_to_google=config.sync_to_google,
                    include_tutor_participation=config.include_tutor_participation,
                )
                config = config.model_copy(
                    update={
                        "last_run_at": now,
                        "next_run_at": now + timedelta(minutes=max(config.interval_minutes, 5)),
                        "updated_at": now,
                    }
                )
                write_automation_config(settings.automation_config_file, config)
        except Exception:
            pass
        time.sleep(30)


@app.on_event("startup")
def start_automation() -> None:
    threading.Thread(target=_automation_loop, daemon=True).start()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/defaults")
def defaults() -> dict[str, object]:
    return {
        "moodle_base_url": settings.moodle_base_url,
        "course_id": settings.moodle_course_id,
        "spreadsheet_id": settings.google_spreadsheet_id,
        "has_env_moodle_user": bool(settings.moodle_username),
        "has_google_sink": bool(settings.gas_webapp_url or settings.google_service_account_file or settings.google_service_account_json),
        "has_basic_auth": bool(settings.app_username and settings.app_password),
    }


@app.get("/api/automation")
def automation_config() -> AutomationConfig:
    return _automation_config()


@app.put("/api/automation")
def update_automation_config(config: AutomationConfig) -> AutomationConfig:
    now = datetime.now(timezone.utc)
    interval = max(config.interval_minutes, 5)
    saved = config.model_copy(
        update={
            "interval_minutes": interval,
            "updated_at": now,
            "next_run_at": now + timedelta(minutes=interval) if config.enabled else None,
        }
    )
    write_automation_config(settings.automation_config_file, saved)
    return saved


@app.post("/api/automation/run-now")
def run_automation_now() -> RunStatus:
    if _has_active_run():
        raise HTTPException(status_code=409, detail="Ya hay una corrida en cola o en ejecucion.")
    config = _automation_config()
    return _schedule_run(
        config.notes or "Corrida manual desde automatizacion.",
        sync_to_google=config.sync_to_google,
        include_tutor_participation=config.include_tutor_participation,
    )


@app.get("/api/audit/access")
def access_logs(limit: int = 80) -> list[AccessLogEntry]:
    return list_access_logs(settings.access_log_file, max(1, min(limit, 300)))


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
