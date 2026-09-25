import os
import json
import time
import logging
from contextlib import contextmanager
from typing import Optional, Dict, Any
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.config import settings

try:
    import psycopg2
    from psycopg2 import pool as pg_pool
except ImportError:
    psycopg2 = None
    pg_pool = None

logger = logging.getLogger(__name__)

serializer = URLSafeTimedSerializer(settings.SESSION_SECRET)

# In-memory fast cache
_session_store: Dict[str, Dict[str, Any]] = {}

# PostgreSQL connection pool singleton
_pg_pool: Optional[Any] = None

def is_postgres_url(url: Optional[str] = None) -> bool:
    """
    Returns True if database URL represents a PostgreSQL connection string.
    """
    target = url if url is not None else settings.DATABASE_URL
    if not target:
        return False
    clean = target.strip()
    return clean.startswith("postgres://") or clean.startswith("postgresql://")

def normalize_db_url(url: Optional[str] = None) -> str:
    """
    Normalizes PostgreSQL URL (e.g. replacing postgres:// with postgresql://).
    """
    target = url if url is not None else settings.DATABASE_URL
    if not target:
        return ""
    clean = target.strip()
    if clean.startswith("postgres://"):
        return clean.replace("postgres://", "postgresql://", 1)
    return clean

def _get_pg_pool():
    global _pg_pool
    if psycopg2 is None or pg_pool is None:
        raise ImportError("psycopg2 is required for PostgreSQL connections. Install psycopg2-binary.")
    if _pg_pool is None or _pg_pool.closed:
        url = normalize_db_url()
        if not url:
            raise ValueError("DATABASE_URL is not set. Please configure PostgreSQL connection string.")
        _pg_pool = pg_pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=url,
            connect_timeout=10
        )
    return _pg_pool

@contextmanager
def _get_postgres_connection():
    pool_obj = _get_pg_pool()
    try:
        conn = pool_obj.getconn()
    except Exception:
        # Reset and retry pool once in case connections went stale
        global _pg_pool
        try:
            if _pg_pool:
                _pg_pool.closeall()
        except Exception:
            pass
        _pg_pool = None
        pool_obj = _get_pg_pool()
        conn = pool_obj.getconn()

    is_bad = False
    try:
        if conn.closed:
            try:
                pool_obj.putconn(conn, close=True)
            except Exception:
                pass
            conn = pool_obj.getconn()
        yield conn
        conn.commit()
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        is_bad = True
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            pool_obj.putconn(conn, close=is_bad)
        except Exception:
            pass

@contextmanager
def _get_connection():
    with _get_postgres_connection() as conn:
        yield conn

def _exec(conn, query: str, params: tuple = ()):
    """
    Executes a SQL query on PostgreSQL using %s parameter placeholders.
    """
    adapted_query = query.replace("?", "%s")
    cursor = conn.cursor()
    cursor.execute(adapted_query, params)
    return cursor

def close_db_connections() -> None:
    """Closes all pooled database connections (useful on shutdown or during tests)."""
    global _pg_pool
    if _pg_pool is not None:
        try:
            _pg_pool.closeall()
        except Exception:
            pass
        _pg_pool = None

def init_session_db() -> None:
    """
    Initializes PostgreSQL database table for 1-month persistent session management.
    """
    if not settings.DATABASE_URL:
        logger.info("DATABASE_URL not set; skipping PostgreSQL session table init.")
        return
    try:
        with _get_connection() as conn:
            _exec(conn, """
                CREATE TABLE IF NOT EXISTS sessions (
                    user_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at DOUBLE PRECISION NOT NULL,
                    expires_at DOUBLE PRECISION NOT NULL
                );
            """)
            _exec(conn, """
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
            """)
    except Exception as e:
        logger.warning(f"Could not initialize session database: {e}")

# Initialize schema on module import if DATABASE_URL is set
init_session_db()

def create_session_token(user_data: Dict[str, Any]) -> str:
    """
    Creates a signed session token containing user ID and expiration,
    persisting the session to PostgreSQL database for 1-month retention across restarts.
    """
    user_id = user_data.get("id") or user_data.get("email")
    if not user_id:
        raise ValueError("User data must have 'id' or 'email'")

    now = time.time()
    max_age_seconds = settings.SESSION_EXPIRE_HOURS * 3600
    expires_at = now + max_age_seconds

    _session_store[user_id] = user_data

    if settings.DATABASE_URL:
        try:
            with _get_connection() as conn:
                # Purge expired sessions
                _exec(conn, "DELETE FROM sessions WHERE expires_at < %s", (now,))
                _exec(conn, """
                    INSERT INTO sessions (user_id, data, updated_at, expires_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT(user_id) DO UPDATE SET
                        data = EXCLUDED.data,
                        updated_at = EXCLUDED.updated_at,
                        expires_at = EXCLUDED.expires_at
                """, (user_id, json.dumps(user_data), now, expires_at))
        except Exception as e:
            logger.warning(f"Failed to persist session to DB: {e}")

    return serializer.dumps({"user_id": user_id, "created_at": now})

def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies signed session token and returns user data if valid and unexpired (1 month).
    Restores session from PostgreSQL DB if server was restarted.
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

        # 2. Database persistent lookup (if server restarted or cache evicted)
        if settings.DATABASE_URL:
            now = time.time()
            try:
                with _get_connection() as conn:
                    cursor = _exec(
                        conn,
                        "SELECT data, expires_at FROM sessions WHERE user_id = %s",
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
                            _exec(conn, "DELETE FROM sessions WHERE user_id = %s", (user_id,))
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
    Updates session data in both memory and PostgreSQL DB persistence.
    """
    user_data = None
    if user_id in _session_store:
        _session_store[user_id].update(updates)
        user_data = _session_store[user_id]
    elif settings.DATABASE_URL:
        try:
            with _get_connection() as conn:
                cursor = _exec(conn, "SELECT data FROM sessions WHERE user_id = %s", (user_id,))
                row = cursor.fetchone()
                if row:
                    user_data = json.loads(row[0])
                    user_data.update(updates)
                    _session_store[user_id] = user_data
        except Exception as e:
            logger.warning(f"Error reading session for update: {e}")

    if user_data is not None and settings.DATABASE_URL:
        now = time.time()
        max_age_seconds = settings.SESSION_EXPIRE_HOURS * 3600
        expires_at = now + max_age_seconds
        try:
            with _get_connection() as conn:
                _exec(conn, """
                    UPDATE sessions
                    SET data = %s, updated_at = %s, expires_at = %s
                    WHERE user_id = %s
                """, (json.dumps(user_data), now, expires_at, user_id))
        except Exception as e:
            logger.warning(f"Failed to update session in DB: {e}")

def remove_session(token: str) -> None:
    """
    Removes session from both memory and PostgreSQL DB on logout.
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
        if settings.DATABASE_URL:
            try:
                with _get_connection() as conn:
                    _exec(conn, "DELETE FROM sessions WHERE user_id = %s", (user_id,))
            except Exception as e:
                logger.warning(f"Failed to delete session from DB: {e}")

def remove_session_by_user_id(user_id: str) -> None:
    """
    Removes session by user ID.
    """
    _session_store.pop(user_id, None)
    if settings.DATABASE_URL:
        try:
            with _get_connection() as conn:
                _exec(conn, "DELETE FROM sessions WHERE user_id = %s", (user_id,))
        except Exception as e:
            logger.warning(f"Failed to delete session from DB: {e}")
