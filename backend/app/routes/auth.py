import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from app.config import settings
from app.models.schemas import UserProfile
from app.auth.session import create_session_token, remove_session
from app.auth.google_oauth import (
    get_google_auth_url,
    exchange_code_for_tokens,
    verify_and_extract_user,
    DomainNotAuthorizedError,
    OAuthExchangeError
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/google/login")
async def google_login():
    """
    Initiates Google OAuth 2.0 flow.
    """
    if not settings.GOOGLE_CLIENT_ID:
        if settings.DEV_MODE:
            return {"auth_url": None, "dev_mode": True, "message": "Google Client ID not configured. Use /api/auth/mock-login in dev mode."}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth credentials are not configured on the server."
        )
    state = secrets.token_urlsafe(16)
    auth_url = get_google_auth_url(state)
    return {"auth_url": auth_url, "dev_mode": settings.DEV_MODE}

@router.get("/google/callback")
async def google_callback(code: str, response: Response):
    """
    Google OAuth callback endpoint.
    """
    try:
        tokens = await exchange_code_for_tokens(code)
        user_data = verify_and_extract_user(tokens)
        session_token = create_session_token(user_data)
        
        # Set HTTP-only secure cookie and pass token query param for cross-port robustness
        session_max_age = settings.SESSION_EXPIRE_HOURS * 3600
        redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}/drive-setup?token={session_token}")
        redirect.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=False,  # Set to True in production HTTPS
            samesite="lax",
            max_age=session_max_age,
            expires=session_max_age
        )
        return redirect
    except DomainNotAuthorizedError as e:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=domain_unauthorized&msg={str(e)}"
        )
    except Exception as e:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=oauth_failed&msg={str(e)}"
        )

@router.post("/mock-login")
async def mock_login(response: Response):
    """
    Development endpoint to login as test faculty with @ssn.edu.in account.
    """
    if not settings.DEV_MODE:
        raise HTTPException(status_code=403, detail="Mock login only permitted in DEV_MODE.")
        
    mock_user = {
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
    session_token = create_session_token(mock_user)
    session_max_age = settings.SESSION_EXPIRE_HOURS * 3600
    
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=session_max_age,
        expires=session_max_age
    )
    
    return {
        "success": True,
        "user": UserProfile(
            id=mock_user["id"],
            email=mock_user["email"],
            name=mock_user["name"],
            picture=mock_user["picture"],
            hd=mock_user["hd"],
            is_authorized=True
        ),
        "token": session_token
    }

@router.get("/me")
async def get_me(request: Request, response: Response, user: dict = Depends(get_current_user)):
    """
    Returns current authenticated user details and refreshes session cookie.
    """
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if token:
        session_max_age = settings.SESSION_EXPIRE_HOURS * 3600
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=session_max_age,
            expires=session_max_age
        )

    return {
        "user": UserProfile(
            id=user.get("id", ""),
            email=user.get("email", ""),
            name=user.get("name", ""),
            picture=user.get("picture"),
            hd=user.get("hd"),
            is_authorized=user.get("is_authorized", False)
        ),
        "selected_folder_id": user.get("selected_folder_id"),
        "selected_folder_name": user.get("selected_folder_name"),
        "selected_file_id": user.get("selected_file_id"),
        "selected_file_name": user.get("selected_file_name")
    }

@router.post("/logout")
async def logout(request: Request, response: Response):
    """
    Logs out the user and clears session cookie.
    """
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if token:
        remove_session(token)
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    return {"success": True, "message": "Logged out successfully."}
