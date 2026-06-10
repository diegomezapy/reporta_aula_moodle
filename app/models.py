from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, SecretStr, field_validator


class RunRequest(BaseModel):
    moodle_base_url: Optional[str] = None
    course_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    sync_to_google: bool = True
    notes: Optional[str] = None

    @field_validator("moodle_base_url")
    @classmethod
    def clean_base_url(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        return value.rstrip("/")


class TableRow(BaseModel):
    cells: dict[str, str] = Field(default_factory=dict)
    links: list[str] = Field(default_factory=list)
    user_id: Optional[str] = None


class Participant(BaseModel):
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    roles: Optional[str] = None
    last_access: Optional[str] = None
    raw: dict[str, str] = Field(default_factory=dict)


class Activity(BaseModel):
    cmid: str
    module: Optional[str] = None
    name: str
    url: str


class ParticipationRow(BaseModel):
    activity_cmid: Optional[str] = None
    activity_name: Optional[str] = None
    action: Optional[str] = None
    user_id: Optional[str] = None
    student_name: Optional[str] = None
    count: int = 0
    raw: dict[str, str] = Field(default_factory=dict)


class StudentSummary(BaseModel):
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    last_access: Optional[str] = None
    actions_registered: int = 0
    forum_posts: int = 0
    grade_cells_with_value: int = 0
    course_total: Optional[str] = None
    platform_level: str = "Sin evidencia"
    evaluative_level: str = "Sin evaluaciones"
    follow_up_alert: bool = False


class ReportPackage(BaseModel):
    run_id: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    moodle_base_url: str
    course_id: int
    course_title: Optional[str] = None
    participants: list[Participant] = Field(default_factory=list)
    grade_rows: list[TableRow] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)
    participation_rows: list[ParticipationRow] = Field(default_factory=list)
    summaries: list[StudentSummary] = Field(default_factory=list)
    activity_summary: list[dict[str, Any]] = Field(default_factory=list)
    notes: Optional[str] = None


class RunStatus(BaseModel):
    run_id: str
    status: Literal["queued", "running", "done", "error"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    message: Optional[str] = None
    files: list[str] = Field(default_factory=list)
    google_sync: Optional[str] = None
