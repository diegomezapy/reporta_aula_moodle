from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import RunRequest, RunStatus
from app.runner import make_run_id, run_extraction
from app.storage import ensure_run_dir, list_statuses, read_status, write_status

settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Reporta Aula Moodle", version="0.1.0")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


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
