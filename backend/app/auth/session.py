import json
import time
from typing import Optional, Dict, Any
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.config import settings

serializer = URLSafeTimedSerializer(settings.SESSION_SECRET)

# In-memory store for active session data (can be mapped to redis/db in production)
_session_store: Dict[str, Dict[str, Any]] = {}

def create_session_token(user_data: Dict[str, Any]) -> str:
    """
    Creates a signed session token containing user ID and expiration.
    """
    user_id = user_data.get("id") or user_data.get("email")
    _session_store[user_id] = user_data
    return serializer.dumps({"user_id": user_id, "created_at": time.time()})

def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies signed session token and returns user data if valid and unexpired.
    """
    if not token:
        return None
    try:
        max_age = settings.SESSION_EXPIRE_HOURS * 3600
        payload = serializer.loads(token, max_age=max_age)
        user_id = payload.get("user_id")
        if user_id and user_id in _session_store:
            return _session_store[user_id]
    except (BadSignature, SignatureExpired, Exception):
        return None
    return None

def update_session_data(user_id: str, updates: Dict[str, Any]) -> None:
    if user_id in _session_store:
        _session_store[user_id].update(updates)

def remove_session(token: str) -> None:
    try:
        payload = serializer.loads(token)
        user_id = payload.get("user_id")
        if user_id in _session_store:
            del _session_store[user_id]
    except Exception:
        pass
