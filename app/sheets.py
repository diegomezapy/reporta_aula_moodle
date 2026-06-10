from __future__ import annotations

import json
from typing import Any

import gspread
import httpx

from app.config import Settings
from app.models import ReportPackage
from app.storage import report_tables


def _table(rows: list[dict[str, Any]]) -> list[list[Any]]:
    headers: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in headers:
                headers.append(key)
    return [headers] + [[row.get(header, "") for header in headers] for row in rows]


def package_tables(package: ReportPackage) -> dict[str, list[list[Any]]]:
    tables = report_tables(package)
    return {
        "Resumen": _table(tables["resumen_estudiantes.csv"]),
        "Riesgo desercion": _table(tables["riesgo_desercion.csv"]),
        "Resumen tutor": _table(tables["resumen_tutor.csv"]),
        "Matriculados": _table(tables["matriculados.csv"]),
        "Calificaciones": _table(tables["calificaciones.csv"]),
        "Actividades": _table(tables["actividades.csv"]),
        "Resumen actividades": _table(tables["resumen_actividades.csv"]),
        "Detalle participacion": _table(tables["detalle_participacion.csv"]),
        "Resumen act tutor": _table(tables["resumen_actividades_tutor.csv"]),
        "Detalle tutor": _table(tables["detalle_participacion_tutor.csv"]),
    }


def sync_with_google(package: ReportPackage, settings: Settings) -> str:
    if settings.gas_webapp_url:
        return sync_via_apps_script(package, settings)
    if settings.google_service_account_file or settings.google_service_account_json:
        return sync_via_service_account(package, settings)
    return "omitido: no hay GAS_WEBAPP_URL ni credenciales de service account"


def sync_via_apps_script(package: ReportPackage, settings: Settings) -> str:
    payload = {
        "secret": settings.gas_shared_secret.get_secret_value() if settings.gas_shared_secret else "",
        "spreadsheetId": settings.google_spreadsheet_id,
        "run": {
            "run_id": package.run_id,
            "generated_at": package.generated_at.isoformat(),
            "course_id": package.course_id,
            "course_title": package.course_title,
            "moodle_base_url": package.moodle_base_url,
        },
        "sheets": [{"name": name, "values": values} for name, values in package_tables(package).items()],
    }
    response = httpx.post(settings.gas_webapp_url, json=payload, timeout=60, follow_redirects=True)
    response.raise_for_status()
    return f"apps-script: {response.text[:180]}"


def sync_via_service_account(package: ReportPackage, settings: Settings) -> str:
    if settings.google_service_account_json:
        credentials = json.loads(settings.google_service_account_json)
        client = gspread.service_account_from_dict(credentials)
    elif settings.google_service_account_file:
        client = gspread.service_account(filename=str(settings.google_service_account_file))
    else:
        raise RuntimeError("Faltan credenciales de Google Sheets.")

    spreadsheet = client.open_by_key(settings.google_spreadsheet_id)
    for name, values in package_tables(package).items():
        try:
            worksheet = spreadsheet.worksheet(name)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=name, rows=max(len(values), 10), cols=max(len(values[0]) if values else 1, 10))
        worksheet.clear()
        if values:
            worksheet.update(values=values, range_name="A1")
    return "google-sheets-api: sincronizado"
