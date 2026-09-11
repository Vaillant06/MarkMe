import os
import json
import time
import sqlite3
import logging
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, Any
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.config import settings

logger = logging.getLogger(__name__)

serializer = URLSafeTimedSerializer(settings.SESSION_SECRET)

# In-memory fast cache
_session_store: Dict[str, Dict[str, Any]] = {}

def _get_db_path() -> str:
    url = settings.DATABASE_URL
    if url.startswith("sqlite:///"):
        rel_or_abs = url[len("sqlite:///"):]
        if os.path.isabs(rel_or_abs):
            return rel_or_abs
        base_dir = Path(__file__).resolve().parent.parent.parent
        return str(base_dir / rel_or_abs)
    return "markme.db"

@contextmanager
def _get_connection():
    db_path = _get_db_path()
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=15.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_session_db() -> None:
    """
    Initializes SQLite table for 1-month persistent session management.
    """
    try:
        with _get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    user_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                );
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
            """)
    except Exception as e:
        logger.warning(f"Could not initialize session database: {e}")

# Initialize schema on module import
init_session_db()

def create_session_token(user_data: Dict[str, Any]) -> str:
    """
    Creates a signed session token containing user ID and expiration,
    persisting the session to SQLite for 1-month retention across restarts.
    """
    user_id = user_data.get("id") or user_data.get("email")
    if not user_id:
        raise ValueError("User data must have 'id' or 'email'")

    now = time.time()
    max_age_seconds = settings.SESSION_EXPIRE_HOURS * 3600
    expires_at = now + max_age_seconds

    _session_store[user_id] = user_data

    try:
        with _get_connection() as conn:
            # Purge expired sessions
            conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
            conn.execute("""
                INSERT INTO sessions (user_id, data, updated_at, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    data = excluded.data,
                    updated_at = excluded.updated_at,
                    expires_at = excluded.expires_at
            """, (user_id, json.dumps(user_data), now, expires_at))
    except Exception as e:
        logger.warning(f"Failed to persist session to DB: {e}")

    return serializer.dumps({"user_id": user_id, "created_at": now})

def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies signed session token and returns user data if valid and unexpired (1 month).
    Restores session from SQLite if server was restarted.
    """
    if not token:
        return None
    try:
        max_age = settings.SESSION_EXPIRE_HOURS * 3600
        payload = serializer.loads(token, max_age=max_age)
        user_id = payload.get("user_id")
        if not user_id:
            return None

        # 1. Fast in-memory cache lookup
        if user_id in _session_store:
            return _session_store[user_id]

        # 2. SQLite persistent lookup (if server restarted or cache evicted)
        now = time.time()
        try:
            with _get_connection() as conn:
                cursor = conn.execute(
                    "SELECT data, expires_at FROM sessions WHERE user_id = ?",
                    (user_id,)
                )
                row = cursor.fetchone()
                if row:
                    stored_json, expires_at = row
                    if expires_at > now:
                        user_data = json.loads(stored_json)
                        _session_store[user_id] = user_data
                        return user_data
                    else:
                        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        except Exception as db_err:
            logger.warning(f"Error querying session DB: {db_err}")

    except (BadSignature, SignatureExpired):
        return None
    except Exception as e:
        logger.warning(f"Error verifying session token: {e}")
        return None
    return None

def update_session_data(user_id: str, updates: Dict[str, Any]) -> None:
    """
    Updates session data in both memory and SQLite persistence.
    """
    user_data = None
    if user_id in _session_store:
        _session_store[user_id].update(updates)
        user_data = _session_store[user_id]
    else:
        try:
            with _get_connection() as conn:
                cursor = conn.execute("SELECT data FROM sessions WHERE user_id = ?", (user_id,))
                row = cursor.fetchone()
                if row:
                    user_data = json.loads(row[0])
                    user_data.update(updates)
                    _session_store[user_id] = user_data
        except Exception as e:
            logger.warning(f"Error reading session for update: {e}")

    if user_data is not None:
        now = time.time()
        max_age_seconds = settings.SESSION_EXPIRE_HOURS * 3600
        expires_at = now + max_age_seconds
        try:
            with _get_connection() as conn:
                conn.execute("""
                    UPDATE sessions
                    SET data = ?, updated_at = ?, expires_at = ?
                    WHERE user_id = ?
                """, (json.dumps(user_data), now, expires_at, user_id))
        except Exception as e:
            logger.warning(f"Failed to update session in DB: {e}")

def remove_session(token: str) -> None:
    """
    Removes session from both memory and SQLite on logout.
    """
    user_id = None
    try:
        payload = serializer.loads(token, max_age=settings.SESSION_EXPIRE_HOURS * 3600)
        user_id = payload.get("user_id")
    except Exception:
        try:
            payload = serializer.load_payload(token)
            if isinstance(payload, dict):
                user_id = payload.get("user_id")
        except Exception:
            pass

    if user_id:
        _session_store.pop(user_id, None)
        try:
            with _get_connection() as conn:
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        except Exception as e:
            logger.warning(f"Failed to delete session from DB: {e}")

def remove_session_by_user_id(user_id: str) -> None:
    """
    Removes session by user ID.
    """
    _session_store.pop(user_id, None)
    try:
        with _get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    except Exception as e:
        logger.warning(f"Failed to delete session from DB: {e}")
