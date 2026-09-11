import time
import pytest
from app.config import settings
from app.auth.session import (
    create_session_token,
    verify_session_token,
    update_session_data,
    remove_session,
    _session_store
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_settings_session_duration():
    """Verify session settings default to 30 days (1 month)."""
    assert settings.SESSION_EXPIRE_DAYS == 30
    assert settings.SESSION_EXPIRE_HOURS == 30 * 24  # 720 hours
    assert settings.SESSION_EXPIRE_HOURS * 3600 == 2592000  # 30 days in seconds

def test_session_lifecycle_and_db_persistence():
    """Verify session creation, persistence to SQLite, and restoration after server restart."""
    test_user = {
        "id": "persisted_faculty_1",
        "email": "faculty1@ssn.edu.in",
        "name": "Persistent Faculty",
        "role": "Instructor"
    }

    # 1. Create session
    token = create_session_token(test_user)
    assert token is not None

    # 2. Verify in memory
    user_cached = verify_session_token(token)
    assert user_cached is not None
    assert user_cached["email"] == "faculty1@ssn.edu.in"

    # 3. Simulate backend restart by wiping in-memory cache
    _session_store.clear()
    assert "persisted_faculty_1" not in _session_store

    # 4. Verify that session is restored from SQLite
    user_restored = verify_session_token(token)
    assert user_restored is not None
    assert user_restored["email"] == "faculty1@ssn.edu.in"
    assert user_restored["id"] == "persisted_faculty_1"
    # Cache should be re-populated
    assert "persisted_faculty_1" in _session_store

    # 5. Update session data
    update_session_data("persisted_faculty_1", {"selected_folder_id": "test_folder_123"})
    _session_store.clear()  # Simulate restart again

    user_updated = verify_session_token(token)
    assert user_updated is not None
    assert user_updated["selected_folder_id"] == "test_folder_123"

    # 6. Remove session (logout)
    remove_session(token)
    _session_store.clear()

    # Should no longer be retrievable
    assert verify_session_token(token) is None

def test_api_cookie_and_restart_flow():
    """Verify API endpoints set 1-month cookie and survive server restarts."""
    # 1. Mock Login
    login_res = client.post("/api/auth/mock-login")
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    assert token is not None

    # Verify cookie Max-Age is 30 days (2,592,000 seconds)
    cookie_header = login_res.headers.get("set-cookie", "")
    assert f"Max-Age={settings.SESSION_EXPIRE_HOURS * 3600}" in cookie_header or f"max-age={settings.SESSION_EXPIRE_HOURS * 3600}" in cookie_header.lower()

    # 2. Access /api/auth/me
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "faculty@ssn.edu.in"

    # 3. Simulate server restart
    _session_store.clear()

    # 4. Access /api/auth/me again with cookie - must succeed because of SQLite persistence!
    me_after_restart = client.get("/api/auth/me")
    assert me_after_restart.status_code == 200
    assert me_after_restart.json()["user"]["email"] == "faculty@ssn.edu.in"

    # 5. Also test with Bearer header
    _session_store.clear()
    header_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert header_res.status_code == 200
    assert header_res.json()["user"]["email"] == "faculty@ssn.edu.in"

    # 6. Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    _session_store.clear()

    # Access after logout should fail
    assert client.get("/api/auth/me").status_code == 401
