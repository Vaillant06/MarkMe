from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "MarkMe - College Attendance Marking System"
    AUTHORIZED_DOMAIN: str = "ssn.edu.in"
    
    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    
    # Session & Security (remember authentication for 1 month / 30 days)
    SESSION_SECRET: str = "markme-insecure-dev-session-key-change-in-production-12345678"
    SESSION_COOKIE_NAME: str = "markme_session"
    SESSION_EXPIRE_DAYS: int = 30
    SESSION_EXPIRE_HOURS: int = 30 * 24  # 720 hours (1 month)
    # Session Cookie Security & Dynamic Flags
    SESSION_COOKIE_SECURE: Optional[bool] = None
    SESSION_COOKIE_SAMESITE: str = "lax"
    
    # Storage & Local Dev
    DATABASE_URL: str = "sqlite:///./markme.db"
    DEV_MODE: bool = True
    DEV_LOCAL_WORKBOOK_PATH: str = "/home/sreenath/Sree/Projects/MarkMe/V Sem B Attendance sheet.xlsx"
    
    # Front-end origin(s) for CORS (comma-separated if multiple)
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=[
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env"),
            ".env"
        ],
        extra="ignore"
    )

    @model_validator(mode="after")
    def sync_session_expiry(self):
        if "SESSION_EXPIRE_DAYS" in self.model_fields_set and "SESSION_EXPIRE_HOURS" not in self.model_fields_set:
            self.SESSION_EXPIRE_HOURS = self.SESSION_EXPIRE_DAYS * 24
        if self.SESSION_COOKIE_SECURE is None:
            self.SESSION_COOKIE_SECURE = not self.DEV_MODE
        return self

settings = Settings()
