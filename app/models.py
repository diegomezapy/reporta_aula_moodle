from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, SecretStr, field_validator


class RunRequest(BaseModel):
    moodle_base_url: Optional[str] = None
    course_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    sync_to_google: bool = True
    include_tutor_participation: bool = True
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
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    user_id: Optional[str] = None
    student_name: Optional[str] = None
    count: int = 0
    raw: dict[str, str] = Field(default_factory=dict)


class StudentSummary(BaseModel):
    user_id: Optional[str] = None
    student_moodle_id: Optional[str] = None
    student_document_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    cohort: Optional[str] = None
    career: Optional[str] = None
    semester_number: Optional[int] = None
    enrollment_status: Optional[str] = None
    academic_load: Optional[int] = None
    failed_previous_subjects: Optional[int] = None
    program_progress_percent: Optional[float] = None
    scholarship_status: Optional[str] = None
    work_shift: Optional[str] = None
    last_access: Optional[str] = None
    days_since_last_access: Optional[float] = None
    last_access_text: Optional[str] = None
    tutor_id: Optional[str] = None
    tutor_name: Optional[str] = None
    tutor_email: Optional[str] = None
    tutor_role: Optional[str] = None
    tutor_actions_registered: int = 0
    tutor_forum_replies: int = 0
    tutor_feedback_count: int = 0
    tutor_response_hours: Optional[float] = None
    tutor_activity_coverage: Optional[float] = None
    tutor_followup_signal: str = "Sin dato"
    actions_registered: int = 0
    forum_posts: int = 0
    grade_cells_with_value: int = 0
    course_total: Optional[str] = None
    platform_level: str = "Sin evidencia"
    evaluative_level: str = "Sin evaluaciones"
    follow_up_alert: bool = False
    tutor_activity_signal: str = "Sin dato"
    risk_model_version: str = "heuristic_v1"
    heuristic_probability: Optional[float] = None
    semester_bayesian_prior_probability: Optional[float] = None
    semester_bayesian_posterior_probability: Optional[float] = None
    semester_bayesian_log_likelihood_ratio: Optional[float] = None
    semester_desertion_probability: Optional[float] = None
    semester_desertion_risk_level: str = "Sin dato"
    semester_desertion_risk_factors: list[str] = Field(default_factory=list)
    career_bayesian_prior_probability: Optional[float] = None
    career_bayesian_posterior_probability: Optional[float] = None
    career_bayesian_log_likelihood_ratio: Optional[float] = None
    career_desertion_probability: Optional[float] = None
    career_desertion_risk_level: str = "Sin dato"
    career_desertion_risk_factors: list[str] = Field(default_factory=list)
    bayesian_prior_probability: Optional[float] = None
    bayesian_posterior_probability: Optional[float] = None
    bayesian_log_likelihood_ratio: Optional[float] = None
    bayesian_evidence_factors: list[str] = Field(default_factory=list)
    desertion_probability: float = 0.0
    desertion_risk_level: str = "Sin dato"
    desertion_risk_factors: list[str] = Field(default_factory=list)


class TutorSummary(BaseModel):
    active_tutors: int = 0
    actions_registered: int = 0
    forum_posts: int = 0
    activities_with_evidence: int = 0
    activity_coverage: float = 0.0
    participation_level: str = "Sin evidencia"


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
    tutor_participation_rows: list[ParticipationRow] = Field(default_factory=list)
    summaries: list[StudentSummary] = Field(default_factory=list)
    activity_summary: list[dict[str, Any]] = Field(default_factory=list)
    tutor_activity_summary: list[dict[str, Any]] = Field(default_factory=list)
    tutor_summary: TutorSummary = Field(default_factory=TutorSummary)
    notes: Optional[str] = None


class RunStatus(BaseModel):
    run_id: str
    status: Literal["queued", "running", "done", "error"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    message: Optional[str] = None
    files: list[str] = Field(default_factory=list)
    google_sync: Optional[str] = None


class AutomationConfig(BaseModel):
    enabled: bool = False
    interval_minutes: int = 10080
    sync_to_google: bool = True
    include_tutor_participation: bool = True
    notes: Optional[str] = "Corrida automatica programada."
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None


class AccessLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    username: str = "sin_autenticacion"
    method: str
    path: str
    status_code: int
    client_host: Optional[str] = None
    user_agent: Optional[str] = None
