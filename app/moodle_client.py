from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

from app.models import Activity, Participant, ParticipationRow, TableRow


def norm(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def key_norm(text: str) -> str:
    text = norm(text).lower()
    return (
        text.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )


def extract_user_id(url: str) -> Optional[str]:
    query = parse_qs(urlparse(url).query)
    value = query.get("id") or query.get("userid")
    return value[0] if value else None


@dataclass
class MoodleClient:
    base_url: str
    username: str
    password: str
    timeout: int = 35

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "reporta-aula-moodle/0.1"})

    def url(self, path: str) -> str:
        return urljoin(f"{self.base_url}/", path.lstrip("/"))

    def get(self, path_or_url: str) -> requests.Response:
        url = path_or_url if path_or_url.startswith("http") else self.url(path_or_url)
        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response

    def post(self, path_or_url: str, data: dict[str, str]) -> requests.Response:
        url = path_or_url if path_or_url.startswith("http") else self.url(path_or_url)
        response = self.session.post(url, data=data, timeout=self.timeout)
        response.raise_for_status()
        return response

    def login(self) -> None:
        login_url = self.url("/login/index.php")
        response = self.get(login_url)
        soup = BeautifulSoup(response.text, "html.parser")
        token = soup.find("input", attrs={"name": "logintoken"})
        payload = {"username": self.username, "password": self.password}
        if token and token.get("value"):
            payload["logintoken"] = token["value"]
        response = self.post(login_url, payload)
        page = response.text.lower()
        if "loginerrormessage" in page or "invalid login" in page or "nombre de usuario" in page and "contraseña" in page:
            raise RuntimeError("No se pudo iniciar sesion en Moodle. Verifica usuario, clave y URL base.")

    def course_title(self, course_id: int) -> Optional[str]:
        soup = BeautifulSoup(self.get(f"/course/view.php?id={course_id}").text, "html.parser")
        heading = soup.find(["h1", "h2"], class_=re.compile("page-title|h2|h1", re.I)) or soup.find("h1")
        return norm(heading.get_text(" ")) if heading else None

    def get_participants(self, course_id: int) -> list[Participant]:
        soup = BeautifulSoup(self.get(f"/user/index.php?id={course_id}&perpage=5000").text, "html.parser")
        tables = self._parse_tables(soup)
        rows = self._choose_rows(tables, ["nombre", "name", "correo", "email", "rol", "role", "ultimo", "last"])
        participants: list[Participant] = []
        for row in rows:
            cells_norm = {key_norm(k): v for k, v in row.cells.items()}
            name = self._first_value(cells_norm, ["nombre", "name", "usuario", "user"])
            if not name:
                name = self._name_from_select_label(row) or ""
            if not name or key_norm(name) in {"nombre", "name", "usuario"}:
                continue
            roles = self._first_value(cells_norm, ["roles", "rol", "role"])
            if roles and "estudiante" not in key_norm(roles) and "student" not in key_norm(roles):
                continue
            participants.append(
                Participant(
                    user_id=row.user_id,
                    name=name,
                    email=self._first_value(cells_norm, ["direccion de correo", "correo", "email"]),
                    roles=roles,
                    last_access=self._first_value(cells_norm, ["ultimo acceso al curso", "ultimo acceso", "last access"]),
                    raw=row.cells,
                )
            )
        return self._dedupe_participants(participants)

    def get_grade_rows(self, course_id: int) -> list[TableRow]:
        soup = BeautifulSoup(self.get(f"/grade/report/grader/index.php?id={course_id}").text, "html.parser")
        tables = self._parse_tables(soup)
        return self._choose_rows(tables, ["nombre", "name", "total", "calificacion", "grade"])

    def get_course_activities(self, course_id: int) -> list[Activity]:
        soup = BeautifulSoup(self.get(f"/course/view.php?id={course_id}").text, "html.parser")
        activities: dict[str, Activity] = {}
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "/mod/" not in href or "view.php" not in href:
                continue
            cmid = extract_user_id(href)
            if not cmid:
                continue
            module_match = re.search(r"/mod/([^/]+)/view\.php", href)
            name = norm(link.get_text(" "))
            if not name:
                continue
            activities[cmid] = Activity(
                cmid=cmid,
                module=module_match.group(1) if module_match else None,
                name=name,
                url=urljoin(self.base_url, href),
            )
        return list(activities.values())

    def get_participation_rows(self, course_id: int, activities: list[Activity]) -> list[ParticipationRow]:
        report_html = self.get(f"/report/participation/index.php?id={course_id}").text
        soup = BeautifulSoup(report_html, "html.parser")
        action_options = self._select_options(soup, "actionid")
        if not action_options:
            action_options = {"": "todas_las_acciones"}

        report_instance_options = self._select_options(soup, "instanceid")
        cmids = [activity.cmid for activity in activities]
        if report_instance_options:
            cmids = [cmid for cmid in report_instance_options.keys() if cmid and cmid != "0"]

        activity_by_cmid = {activity.cmid: activity for activity in activities}
        rows: list[ParticipationRow] = []
        for cmid in cmids:
            activity = activity_by_cmid.get(cmid)
            for action_id, action_name in action_options.items():
                query = f"/report/participation/index.php?id={course_id}&roleid=5&instanceid={cmid}&perpage=5000"
                if action_id:
                    query += f"&actionid={action_id}"
                page = self.get(query).text
                for row in self._choose_rows(self._parse_tables(BeautifulSoup(page, "html.parser")), ["nombre", "name", "acciones", "actions", "yes", "si"]):
                    student_name = self._student_name(row)
                    if not student_name:
                        continue
                    rows.append(
                        ParticipationRow(
                            activity_cmid=cmid,
                            activity_name=activity.name if activity else report_instance_options.get(cmid, cmid),
                            action=action_name,
                            user_id=row.user_id,
                            student_name=student_name,
                            count=self._count_from_row(row),
                            raw=row.cells,
                        )
                    )
        return rows

    def _select_options(self, soup: BeautifulSoup, select_name: str) -> dict[str, str]:
        select = soup.find("select", attrs={"name": select_name})
        if not select:
            return {}
        options: dict[str, str] = {}
        for option in select.find_all("option"):
            value = option.get("value", "")
            label = norm(option.get_text(" "))
            if label and key_norm(label) not in {"choose", "seleccionar", "all activities", "todas las actividades"}:
                options[value] = label
        return options

    def _parse_tables(self, soup: BeautifulSoup) -> list[list[TableRow]]:
        parsed: list[list[TableRow]] = []
        for table in soup.find_all("table"):
            headers = self._headers_for_table(table)
            if not headers:
                continue
            rows: list[TableRow] = []
            for tr in table.find_all("tr"):
                cells = tr.find_all(["td", "th"], recursive=False)
                if len(cells) < 2:
                    continue
                values = [norm(cell.get_text(" ")) for cell in cells]
                if values == headers:
                    continue
                row_map = {headers[i] if i < len(headers) else f"col_{i+1}": values[i] for i in range(len(values))}
                links = [urljoin(self.base_url, link["href"]) for cell in cells for link in cell.find_all("a", href=True)]
                user_id = next((extract_user_id(link) for link in links if "/user/" in link and extract_user_id(link)), None)
                rows.append(TableRow(cells=row_map, links=links, user_id=user_id))
            if rows:
                parsed.append(rows)
        return parsed

    def _headers_for_table(self, table: Tag) -> list[str]:
        header_row = table.find("thead")
        if header_row:
            headers = [norm(cell.get_text(" ")) for cell in header_row.find_all(["th", "td"])]
            return [header or f"col_{index+1}" for index, header in enumerate(headers)]
        first_row = table.find("tr")
        if not first_row:
            return []
        headers = [norm(cell.get_text(" ")) for cell in first_row.find_all(["th", "td"], recursive=False)]
        return [header or f"col_{index+1}" for index, header in enumerate(headers)]

    def _choose_rows(self, tables: list[list[TableRow]], hints: list[str]) -> list[TableRow]:
        if not tables:
            return []
        best_rows: list[TableRow] = []
        best_score = -1
        hints_norm = [key_norm(hint) for hint in hints]
        for rows in tables:
            headers = " ".join(key_norm(key) for key in rows[0].cells.keys())
            score = sum(1 for hint in hints_norm if hint in headers)
            score += min(len(rows), 50) / 100
            if score > best_score:
                best_rows = rows
                best_score = score
        return best_rows

    def _first_value(self, cells: dict[str, str], candidates: list[str]) -> Optional[str]:
        for candidate in candidates:
            candidate = key_norm(candidate)
            for key, value in cells.items():
                if candidate in key and value:
                    return value
        return None

    def _name_from_select_label(self, row: TableRow) -> Optional[str]:
        text = " ".join(row.cells.values())
        match = re.search(r"Seleccionar ['\"]([^'\"]+)['\"]", text)
        return norm(match.group(1)) if match else None

    def _student_name(self, row: TableRow) -> Optional[str]:
        cells = {key_norm(k): v for k, v in row.cells.items()}
        return self._first_value(cells, ["nombre", "name", "usuario", "student"]) or self._name_from_select_label(row)

    def _count_from_row(self, row: TableRow) -> int:
        for key, value in row.cells.items():
            key_clean = key_norm(key)
            if any(token in key_clean for token in ["acciones", "actions", "mensajes", "posts", "total", "count"]):
                numbers = re.findall(r"\d+", value)
                if numbers:
                    return int(numbers[0])
        text = " ".join(row.cells.values())
        if re.search(r"\b(si|sí|yes)\b", key_norm(text)):
            return 1
        return 0

    def _dedupe_participants(self, participants: list[Participant]) -> list[Participant]:
        seen: set[str] = set()
        clean: list[Participant] = []
        for participant in participants:
            key = participant.user_id or key_norm(participant.name)
            if key in seen:
                continue
            seen.add(key)
            clean.append(participant)
        return clean
