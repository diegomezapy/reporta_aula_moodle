from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    app_secret_key: SecretStr = Field(default=SecretStr("dev-only"))

    moodle_base_url: str = "https://www.virtual.facen.una.py/gradofacen"
    moodle_course_id: int = 1718
    moodle_username: Optional[str] = None
    moodle_password: Optional[SecretStr] = None

    google_spreadsheet_id: str = "1Ro2XmGKp9GH6Hj1zUtn_GW8WaMk4nlfVscO8vLO8a_8"
    gas_webapp_url: Optional[str] = None
    gas_shared_secret: Optional[SecretStr] = None
    google_service_account_file: Optional[Path] = None
    google_service_account_json: Optional[str] = None

    data_dir: Path = Path("data/runs")
    request_timeout_seconds: int = 35
    auto_run_enabled: bool = False
    auto_run_interval_minutes: int = 10080


@lru_cache
def get_settings() -> Settings:
    return Settings()
