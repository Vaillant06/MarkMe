import logging
import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import auth, drive, workbooks, attendance

# Set global socket timeout to prevent indefinite hangs in cloud environments
socket.setdefaulttimeout(60.0)

# Configure audit and app logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

app = FastAPI(
    title=settings.APP_NAME,
    description="Automated Attendance Marking for College Excel Workbooks on Google Drive",
    version="1.0.0"
)

# CORS configuration
origins = set()
if settings.FRONTEND_URL:
    origins.add(settings.FRONTEND_URL.strip().rstrip("/"))
if settings.ALLOWED_ORIGINS:
    for o in settings.ALLOWED_ORIGINS.split(","):
        cleaned = o.strip().rstrip("/")
        if cleaned:
            origins.add(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(drive.router)
app.include_router(workbooks.router)
app.include_router(attendance.router)

# Also expose /google/callback at root level to match redirect URI configured in Google Cloud
app.add_api_route("/google/callback", auth.google_callback, methods=["GET"], include_in_schema=False)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "authorized_domain": settings.AUTHORIZED_DOMAIN
    }
