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
    GOOGLE_REDIRECT_URI: str = "https://markme-zrfk.onrender.com/google/callback"
    
    # Session & Security (remember authentication for 1 month / 30 days)
    SESSION_SECRET: str = "markme-production-session-key-change-via-env"
    SESSION_COOKIE_NAME: str = "markme_session"
    SESSION_EXPIRE_DAYS: int = 30
    SESSION_EXPIRE_HOURS: int = 30 * 24  # 720 hours (1 month)
    # Session Cookie Security & Dynamic Flags
    SESSION_COOKIE_SECURE: bool = True
    SESSION_COOKIE_SAMESITE: str = "lax"
    
    # Storage
    DATABASE_URL: str = "sqlite:///./markme.db"
    
    # Front-end origin(s) for CORS (comma-separated if multiple)
    FRONTEND_URL: str = "https://markme-frontend.vercel.app"
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
        return self

settings = Settings()
