from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "MarkMe - College Attendance Marking System"
    AUTHORIZED_DOMAIN: str = "ssn.edu.in"
    
    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    
    # Session & Security
    SESSION_SECRET: str = "markme-insecure-dev-session-key-change-in-production-12345678"
    SESSION_COOKIE_NAME: str = "markme_session"
    SESSION_EXPIRE_HOURS: int = 24
    
    # Storage & Local Dev
    DATABASE_URL: str = "sqlite:///./markme.db"
    DEV_MODE: bool = True
    DEV_LOCAL_WORKBOOK_PATH: str = "/home/sreenath/Sree/Projects/MarkMe/V Sem B Attendance sheet.xlsx"
    
    # Front-end origin for CORS
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = [
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env"),
            ".env"
        ]
        extra = "ignore"

settings = Settings()
