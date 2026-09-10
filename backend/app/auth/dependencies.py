from fastapi import Request, HTTPException, status, Depends
from typing import Dict, Any, Optional
from app.config import settings
from app.auth.session import verify_session_token

async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency to extract and verify the logged-in user from session cookie or Authorization header.
    Rejects with 401 if unauthenticated, 403 if unauthorized domain.
    """
    token: Optional[str] = request.cookies.get(settings.SESSION_COOKIE_NAME)
    
    # Check Authorization header if cookie not present
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with your @ssn.edu.in Google account."
        )
        
    user_data = verify_session_token(token)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again."
        )
        
    email = user_data.get("email", "")
    if not email.endswith(f"@{settings.AUTHORIZED_DOMAIN.lower()}"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Only @{settings.AUTHORIZED_DOMAIN} accounts are permitted."
        )
        
    return user_data
