import hashlib
import hmac
import time
from typing import Optional
from fastapi import Header
from app.core.config import settings
from app.core.errors import AppError, OriginNotAllowedError, SessionExpiredError

def check_origin(origin: Optional[str]) -> bool:
    if not origin:
        # Allow requests with no Origin header in development (e.g. curl / internal)
        return settings.app_env == "development"
    origin_clean = origin.rstrip("/")
    for allowed in settings.allowed_origins:
        if origin_clean == allowed.rstrip("/"):
            return True
    return False

def validate_origin_or_raise(origin: Optional[str]):
    if not check_origin(origin):
        raise OriginNotAllowedError(origin or "unknown")

def create_session_token(session_id: str, tenant_id: str, expires_at: int) -> str:
    payload = f"{session_id}:{tenant_id}:{expires_at}"
    sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"

def verify_session_token(token: str, session_id: str) -> bool:
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return False
        tok_session_id, tenant_id, expires_at_str, sig = parts
        if tok_session_id != session_id:
            return False
        expires_at = int(expires_at_str)
        if time.time() > expires_at:
            return False
        payload = f"{tok_session_id}:{tenant_id}:{expires_at_str}"
        expected_sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False

def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

