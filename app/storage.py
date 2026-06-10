from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd

from app.models import ReportPackage, RunStatus


def ensure_run_dir(base_dir: Path, run_id: str) -> Path:
    path = base_dir / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_status(base_dir: Path, status: RunStatus) -> None:
    run_dir = ensure_run_dir(base_dir, status.run_id)
    (run_dir / "status.json").write_text(status.model_dump_json(indent=2), encoding="utf-8")


def read_status(path: Path) -> Optional[RunStatus]:
    status_path = path / "status.json"
    if not status_path.exists():
        return None
    return RunStatus.model_validate_json(status_path.read_text(encoding="utf-8"))


def list_statuses(base_dir: Path) -> list[RunStatus]:
    if not base_dir.exists():
        return []
    statuses = [status for item in base_dir.iterdir() if item.is_dir() for status in [read_status(item)] if status]
    return sorted(statuses, key=lambda item: item.created_at, reverse=True)


def _write_csv(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    rows = list(rows)
    keys: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in keys:
                keys.append(key)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def rows_from_models(items: Iterable[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in items:
        if hasattr(item, "model_dump"):
            rows.append(item.model_dump(mode="json"))
        else:
            rows.append(dict(item))
    return rows


def write_report(base_dir: Path, package: ReportPackage) -> list[str]:
    run_dir = ensure_run_dir(base_dir, package.run_id)
    files: list[str] = []

    json_path = run_dir / "reporte.json"
    json_path.write_text(package.model_dump_json(indent=2), encoding="utf-8")
    files.append(json_path.name)

    tables = {
        "resumen_estudiantes.csv": rows_from_models(package.summaries),
        "matriculados.csv": rows_from_models(package.participants),
        "calificaciones.csv": [row.model_dump(mode="json") for row in package.grade_rows],
        "actividades.csv": rows_from_models(package.activities),
        "resumen_actividades.csv": package.activity_summary,
        "detalle_participacion.csv": rows_from_models(package.participation_rows),
    }

    for filename, rows in tables.items():
        path = run_dir / filename
        _write_csv(path, rows)
        files.append(filename)

    xlsx_path = run_dir / "reporte_aula_moodle.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        for sheet_name, rows in {
            "Resumen": tables["resumen_estudiantes.csv"],
            "Matriculados": tables["matriculados.csv"],
            "Calificaciones": tables["calificaciones.csv"],
            "Actividades": tables["actividades.csv"],
            "Resumen actividades": tables["resumen_actividades.csv"],
            "Detalle participacion": tables["detalle_participacion.csv"],
        }.items():
            pd.DataFrame(rows).to_excel(writer, sheet_name=sheet_name[:31], index=False)
    files.append(xlsx_path.name)
    return files
