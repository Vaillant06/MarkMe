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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth credentials are not configured on the server."
        )
    state = secrets.token_urlsafe(16)
    auth_url = get_google_auth_url(state)
    return {"auth_url": auth_url}

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
        frontend_base = settings.FRONTEND_URL.strip().rstrip("/")
        session_max_age = settings.SESSION_EXPIRE_HOURS * 3600
        redirect = RedirectResponse(url=f"{frontend_base}/drive-setup?token={session_token}")
        redirect.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=bool(settings.SESSION_COOKIE_SECURE),
            samesite=settings.SESSION_COOKIE_SAMESITE,
            max_age=session_max_age,
            expires=session_max_age
        )
        return redirect
    except DomainNotAuthorizedError as e:
        frontend_base = settings.FRONTEND_URL.strip().rstrip("/")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=domain_unauthorized&msg={str(e)}"
        )
    except Exception as e:
        frontend_base = settings.FRONTEND_URL.strip().rstrip("/")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=oauth_failed&msg={str(e)}"
        )

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
            secure=bool(settings.SESSION_COOKIE_SECURE),
            samesite=settings.SESSION_COOKIE_SAMESITE,
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
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=bool(settings.SESSION_COOKIE_SECURE),
        samesite=settings.SESSION_COOKIE_SAMESITE
    )
    return {"success": True, "message": "Logged out successfully."}
