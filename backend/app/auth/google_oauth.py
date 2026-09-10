import httpx
from typing import Dict, Any, Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.config import settings

OAUTH_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive"
]

class DomainNotAuthorizedError(Exception):
    pass

class OAuthExchangeError(Exception):
    pass

def get_google_auth_url(state: str) -> str:
    """
    Constructs Google OAuth 2.0 authorization URL.
    """
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
        "hd": settings.AUTHORIZED_DOMAIN
    }
    encoded = "&".join(f"{k}={httpx.URL(v)}" for k, v in params.items())
    return f"{base_url}?{encoded}"

async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """
    Exchanges authorization code for Google access, refresh, and ID tokens.
    """
    token_endpoint = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_endpoint, data=data)
        if response.status_code != 200:
            raise OAuthExchangeError(f"Failed to exchange token: {response.text}")
        return response.json()

def verify_and_extract_user(tokens: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verifies Google ID token and enforces @ssn.edu.in domain restriction.
    """
    raw_id_token = tokens.get("id_token")
    if not raw_id_token:
        raise OAuthExchangeError("No id_token in Google response.")
        
    try:
        req = google_requests.Request()
        id_info = id_token.verify_oauth2_token(
            raw_id_token, req, settings.GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise OAuthExchangeError(f"ID token verification failed: {str(e)}")
        
    email = id_info.get("email", "").strip().lower()
    hd = id_info.get("hd", "").strip().lower()
    
    # Strictly enforce @ssn.edu.in
    if not email.endswith(f"@{settings.AUTHORIZED_DOMAIN.lower()}"):
        raise DomainNotAuthorizedError(
            f"Access denied: {email} does not belong to @{settings.AUTHORIZED_DOMAIN}."
        )
        
    return {
        "id": id_info.get("sub"),
        "email": email,
        "name": id_info.get("name", email.split("@")[0]),
        "picture": id_info.get("picture"),
        "hd": hd,
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "is_authorized": True
    }
