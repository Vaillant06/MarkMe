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

def make_test_auth_token():
    test_user = {
        "id": "faculty_dev_1",
        "email": "faculty@ssn.edu.in",
        "name": "Faculty Instructor",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=ssn",
        "hd": "ssn.edu.in",
        "access_token": None,
        "is_authorized": True,
        "selected_folder_id": "local_attendance_folder",
        "selected_folder_name": "📁 College Attendance Folder (Local Dev)",
        "selected_file_id": None,
        "selected_file_name": None
    }
    return create_session_token(test_user)

def test_api_cookie_and_restart_flow():
    """Verify API endpoints set 1-month cookie and survive server restarts."""
    # 1. Establish session token
    token = make_test_auth_token()
    assert token is not None

    # Set session cookie on test client
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 2. Access /api/auth/me
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "faculty@ssn.edu.in"

    # Verify cookie Max-Age is refreshed to 30 days (2,592,000 seconds)
    cookie_header = me_res.headers.get("set-cookie", "")
    assert f"Max-Age={settings.SESSION_EXPIRE_HOURS * 3600}" in cookie_header or f"max-age={settings.SESSION_EXPIRE_HOURS * 3600}" in cookie_header.lower()

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

def test_workbook_selection_persistence_and_restart():
    """Verify selecting a workbook persists in session and survives server restarts."""
    token = make_test_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Select workbook via API
    sel_res = client.post(
        "/api/workbooks/select",
        json={"file_id": "test_wb_file_123", "file_name": "Test_Workbook.xlsx"},
        headers=headers
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["file_id"] == "test_wb_file_123"

    # Verify in /api/auth/me
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["selected_file_id"] == "test_wb_file_123"
    assert me_res.json()["selected_file_name"] == "Test_Workbook.xlsx"

    # Simulate server restart
    _session_store.clear()

    # Verify state survived restart from SQLite DB
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.status_code == 200
    assert me_after.json()["selected_file_id"] == "test_wb_file_123"
    assert me_after.json()["selected_file_name"] == "Test_Workbook.xlsx"

    # Clear workbook
    clear_res = client.post("/api/workbooks/clear", headers=headers)
    assert clear_res.status_code == 200

    me_cleared = client.get("/api/auth/me", headers=headers)
    assert me_cleared.json()["selected_file_id"] is None

def test_folder_disconnect_clears_workbook():
    """Verify disconnecting active folder also clears any selected workbook."""
    token = make_test_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Set workbook
    client.post(
        "/api/workbooks/select",
        json={"file_id": "wb_to_be_cleared", "file_name": "WB.xlsx"},
        headers=headers
    )

    # Disconnect active folder
    disc_res = client.post("/api/drive/folders/disconnect", headers=headers)
    assert disc_res.status_code == 200

    # Verify both folder and file are cleared in session
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.json()["selected_folder_id"] is None
    assert me_res.json()["selected_file_id"] is None

def test_inaccessible_workbook_returns_404():
    """Verify attempting to get details for nonexistent workbook returns 404."""
    token = make_test_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/workbooks/non_existent_file_9999/details", headers=headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
