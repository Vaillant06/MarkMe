import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.auth.session import verify_session_token

client = TestClient(app)

def test_mock_login_endpoint_is_completely_gone():
    """Ensure POST /api/auth/mock-login returns 404 Not Found."""
    res = client.post("/api/auth/mock-login")
    assert res.status_code == 404

def test_unauthenticated_me_returns_401():
    """Accessing /api/auth/me without a session must return 401."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401

def test_google_login_endpoint_without_client_id(monkeypatch):
    """If GOOGLE_CLIENT_ID is empty, google_login should raise 500 error."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    res = client.get("/api/auth/google/login")
    assert res.status_code == 500
    assert "not configured" in res.json()["detail"].lower()

def test_google_login_endpoint_with_client_id(monkeypatch):
    """Google login returns the OAuth authorization URL with correct parameters."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-google-client-id-12345.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    monkeypatch.setattr(settings, "AUTHORIZED_DOMAIN", "ssn.edu.in")

    res = client.get("/api/auth/google/login")
    assert res.status_code == 200
    data = res.json()
    assert "auth_url" in data
    auth_url = data["auth_url"]
    assert auth_url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "client_id=test-google-client-id-12345.apps.googleusercontent.com" in auth_url
    assert "redirect_uri=" in auth_url
    assert "api/auth/google/callback" in auth_url
    assert "hd=ssn.edu.in" in auth_url
    assert "state=" in auth_url
    assert "response_type=code" in auth_url

@pytest.mark.asyncio
async def test_google_callback_success(monkeypatch):
    """Valid OAuth code with @ssn.edu.in Google user succeeds and redirects to /drive-setup."""
    mock_tokens = {
        "access_token": "mock_google_access_token_abc",
        "id_token": "mock_google_id_token_xyz",
        "refresh_token": "mock_google_refresh_token_123"
    }
    mock_user_data = {
        "id": "google_sub_987654",
        "email": "faculty.ece@ssn.edu.in",
        "name": "ECE Faculty",
        "picture": "https://lh3.googleusercontent.com/a/test",
        "hd": "ssn.edu.in",
        "access_token": "mock_google_access_token_abc",
        "refresh_token": "mock_google_refresh_token_123",
        "is_authorized": True
    }

    with patch("app.routes.auth.exchange_code_for_tokens", new=AsyncMock(return_value=mock_tokens)), \
         patch("app.routes.auth.verify_and_extract_user", return_value=mock_user_data):
        
        callback_res = client.get("/api/auth/google/callback?code=valid_test_code", follow_redirects=False)
        assert callback_res.status_code in (302, 307)
        
        # Verify redirect URL points to frontend drive-setup with token
        location = callback_res.headers["location"]
        assert location.startswith(f"{settings.FRONTEND_URL}/drive-setup?token=")
        
        # Extract token from query params
        token = location.split("token=")[1]
        session_data = verify_session_token(token)
        assert session_data is not None
        assert session_data["email"] == "faculty.ece@ssn.edu.in"
        assert session_data["is_authorized"] is True

        # Verify session cookie was set
        set_cookie = callback_res.headers.get("set-cookie", "")
        assert settings.SESSION_COOKIE_NAME in set_cookie
        assert f"Max-Age={settings.SESSION_EXPIRE_HOURS * 3600}" in set_cookie or f"max-age={settings.SESSION_EXPIRE_HOURS * 3600}" in set_cookie.lower()

@pytest.mark.asyncio
async def test_google_callback_unauthorized_domain():
    """Non-SSN Google account is denied access and redirected to /login with domain_unauthorized."""
    from app.auth.google_oauth import DomainNotAuthorizedError

    with patch("app.routes.auth.exchange_code_for_tokens", new=AsyncMock(return_value={"id_token": "id"})), \
         patch("app.routes.auth.verify_and_extract_user", side_effect=DomainNotAuthorizedError("Access denied: user@gmail.com does not belong to @ssn.edu.in.")):
        
        callback_res = client.get("/api/auth/google/callback?code=unauthorized_domain_code", follow_redirects=False)
        assert callback_res.status_code in (302, 307)
        location = callback_res.headers["location"]
        assert "login?error=domain_unauthorized" in location
        assert "user@gmail.com" in location

@pytest.mark.asyncio
async def test_google_callback_exchange_failure():
    """OAuth network or verification failure redirects to /login with oauth_failed."""
    with patch("app.routes.auth.exchange_code_for_tokens", new=AsyncMock(side_effect=Exception("Connection refused by Google"))):
        callback_res = client.get("/api/auth/google/callback?code=bad_code", follow_redirects=False)
        assert callback_res.status_code in (302, 307)
        location = callback_res.headers["location"]
        assert "login?error=oauth_failed" in location
        assert "Connection+refused" in location or "Connection%20refused" in location

def test_logout_flow():
    """User can log out and their session cookie & server session are cleared."""
    from app.auth.session import create_session_token
    token = create_session_token({
        "id": "faculty_user_logout_test",
        "email": "faculty_logout@ssn.edu.in",
        "name": "Logout Test Faculty",
        "is_authorized": True
    })

    client.cookies.set(settings.SESSION_COOKIE_NAME, token)
    
    # Confirm authenticated
    res_me = client.get("/api/auth/me")
    assert res_me.status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True

    # Next call should be 401
    client.cookies.delete(settings.SESSION_COOKIE_NAME)
    res_after = client.get("/api/auth/me")
    assert res_after.status_code == 401
