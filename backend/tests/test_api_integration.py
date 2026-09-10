import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_unauthenticated_access_denied():
    response = client.get("/api/drive/folders")
    assert response.status_code == 401

def test_complete_api_flow():
    # 1. Login with dev mock
    login_res = client.post("/api/auth/mock-login")
    assert login_res.status_code == 200
    user_data = login_res.json()["user"]
    assert user_data["email"] == "faculty@ssn.edu.in"
    assert user_data["is_authorized"] is True

    # 2. Get Me
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "faculty@ssn.edu.in"

    # 3. List Folders
    folders_res = client.get("/api/drive/folders")
    assert folders_res.status_code == 200
    folders = folders_res.json()
    assert len(folders) >= 1
    folder_id = folders[0]["id"]

    # 3b. Resolve Custom Folder (Drive link or local directory)
    resolve_res = client.post("/api/drive/folders/resolve", json={
        "input": "https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
    })
    assert resolve_res.status_code == 200
    assert "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" in resolve_res.json()["id"]

    # 3c. Remove a folder from list
    if len(folders) > 1:
        to_remove = folders[-1]["id"]
        remove_res = client.post("/api/drive/folders/remove", json={"folder_id": to_remove})
        assert remove_res.status_code == 200
        
        # Verify it is no longer returned
        refreshed = client.get("/api/drive/folders").json()
        assert not any(f["id"] == to_remove for f in refreshed)
        
        # Restore folders
        restore_res = client.post("/api/drive/folders/restore")
        assert restore_res.status_code == 200
        restored = client.get("/api/drive/folders").json()
        assert any(f["id"] == to_remove for f in restored)

    # 4. Select Folder
    select_res = client.post("/api/drive/folders/select", json={
        "folder_id": folder_id,
        "folder_name": folders[0]["name"]
    })
    assert select_res.status_code == 200

    # 4b. Disconnect Active Folder
    disconnect_res = client.post("/api/drive/folders/disconnect")
    assert disconnect_res.status_code == 200
    me_after = client.get("/api/auth/me").json()
    assert me_after["selected_folder_id"] is None

    # Re-select for remaining tests
    client.post("/api/drive/folders/select", json={
        "folder_id": folder_id,
        "folder_name": folders[0]["name"]
    })

    # 5. List Files in Folder
    files_res = client.get("/api/drive/files")
    assert files_res.status_code == 200
    files = files_res.json()
    assert len(files) >= 1
    file_id = files[0]["id"]

    # 6. Get Workbook Details
    wb_res = client.get(f"/api/workbooks/{file_id}/details")
    assert wb_res.status_code == 200
    wb_details = wb_res.json()
    assert wb_details["class_name"] == "V SEM"
    assert wb_details["section"] == "B"
    assert len(wb_details["subjects"]) == 7

    # 7. Attendance Preview - Valid Case
    preview_res = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "10/09/2026",
        "period": "3",
        "absent_input": "067, 080, 114, 129"
    })
    assert preview_res.status_code == 200
    p_data = preview_res.json()
    assert p_data["total_students"] == 71
    assert p_data["absent_count"] == 4
    assert p_data["present_count"] == 67
    assert p_data["duplicate_warning"] is False
    assert p_data["entry_mode"] == "ABSENT"

    # 7b. Attendance Preview - PRESENT mode (marking presentees)
    preview_present_res = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "10/09/2026",
        "period": "3",
        "student_input": "067, 080",
        "entry_mode": "PRESENT"
    })
    assert preview_present_res.status_code == 200
    p_pres_data = preview_present_res.json()
    assert p_pres_data["total_students"] == 71
    assert p_pres_data["present_count"] == 2
    assert p_pres_data["absent_count"] == 69
    assert p_pres_data["entry_mode"] == "PRESENT"
    assert len(p_pres_data["absent_suffixes"]) == 69
    assert "067" not in p_pres_data["absent_suffixes"]
    assert "080" not in p_pres_data["absent_suffixes"]

    # 8. Attendance Preview - Validation Errors
    # Invalid character
    err_res1 = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "10/09/2026",
        "period": "3",
        "absent_input": "067, abc, 080"
    })
    assert err_res1.status_code == 422

    # Nonexistent suffix
    err_res2 = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "10/09/2026",
        "period": "3",
        "absent_input": "067, 999"
    })
    assert err_res2.status_code == 422

    # Duplicate suffix
    err_res3 = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "10/09/2026",
        "period": "3",
        "absent_input": "067, 080, 080"
    })
    assert err_res3.status_code == 422

    # 9. Attendance Preview - Duplicate Session Detection
    dup_preview = client.post("/api/attendance/preview", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "29/06/2026",
        "period": "1",
        "absent_input": "067"
    })
    assert dup_preview.status_code == 200
    assert dup_preview.json()["duplicate_warning"] is True

    # 10. Commit Attendance - Duplicate Protection Block
    dup_commit = client.post("/api/attendance/commit", json={
        "file_id": file_id,
        "sheet_name": "UIT3562",
        "date": "29/06/2026",
        "period": "1",
        "absent_suffixes": ["067"],
        "allow_overwrite": False
    })
    assert dup_commit.status_code == 409
    assert dup_commit.json()["detail"]["is_duplicate"] is True

    # 11. Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    
    # After logout, should be 401
    assert client.get("/api/drive/folders").status_code == 401
