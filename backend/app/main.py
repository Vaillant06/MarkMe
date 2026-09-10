import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import auth, drive, workbooks, attendance

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
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
        "authorized_domain": settings.AUTHORIZED_DOMAIN,
        "dev_mode": settings.DEV_MODE
    }
