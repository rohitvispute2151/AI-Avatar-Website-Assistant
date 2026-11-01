import uuid
from typing import Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse

class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        retryable: bool = False,
        request_id: Optional[str] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.request_id = request_id or f"req_{uuid.uuid4().hex[:12]}"

class SessionExpiredError(AppError):
    def __init__(self, message: str = "The session has expired or is invalid.", request_id: Optional[str] = None):
        super().__init__(
            code="SESSION_EXPIRED",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            retryable=True,
            request_id=request_id,
        )

class PageRevisionStaleError(AppError):
    def __init__(self, current_revision: int, request_id: Optional[str] = None):
        super().__init__(
            code="PAGE_REVISION_STALE",
            message=f"The page changed. Refreshing structure is required (server has revision {current_revision}).",
            status_code=status.HTTP_409_CONFLICT,
            retryable=True,
            request_id=request_id,
        )
        self.current_revision = current_revision

class RevisionConflictError(AppError):
    def __init__(self, message: str = "Manifest revision conflict detected.", request_id: Optional[str] = None):
        super().__init__(
            code="REVISION_CONFLICT",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            retryable=False,
            request_id=request_id,
        )

class OriginNotAllowedError(AppError):
    def __init__(self, origin: str, request_id: Optional[str] = None):
        super().__init__(
            code="ORIGIN_NOT_ALLOWED",
            message=f"Origin '{origin}' is not authorized for this widget integration.",
            status_code=status.HTTP_403_FORBIDDEN,
            retryable=False,
            request_id=request_id,
        )

class InvalidPlanError(AppError):
    def __init__(self, message: str = "Action plan failed validation constraints.", request_id: Optional[str] = None):
        super().__init__(
            code="INVALID_PLAN",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            retryable=False,
            request_id=request_id,
        )

class InvalidWidgetError(AppError):
    def __init__(self, message: str = "Invalid or unregistered widget identifier.", request_id: Optional[str] = None):
        super().__init__(
            code="INVALID_WIDGET",
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            retryable=False,
            request_id=request_id,
        )

class ManifestTooLargeError(AppError):
    def __init__(self, message: str = "Page manifest payload exceeds maximum allowed size.", request_id: Optional[str] = None):
        super().__init__(
            code="MANIFEST_TOO_LARGE",
            message=message,
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            retryable=False,
            request_id=request_id,
        )

class ProviderTimeoutError(AppError):
    def __init__(self, message: str = "Upstream AI provider timed out.", request_id: Optional[str] = None):
        super().__init__(
            code="PROVIDER_TIMEOUT",
            message=message,
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            retryable=True,
            request_id=request_id,
        )

class ProviderRateLimitedError(AppError):
    def __init__(self, message: str = "Upstream AI provider rate limit reached.", request_id: Optional[str] = None):
        super().__init__(
            code="PROVIDER_RATE_LIMITED",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            retryable=True,
            request_id=request_id,
        )

class VoiceUnavailableError(AppError):
    def __init__(self, message: str = "Voice processing service is currently unavailable.", request_id: Optional[str] = None):
        super().__init__(
            code="VOICE_UNAVAILABLE",
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            retryable=False,
            request_id=request_id,
        )

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    content = {
        "error": {
            "code": exc.code,
            "message": exc.message,
            "retryable": exc.retryable,
            "request_id": exc.request_id,
        }
    }
    return JSONResponse(status_code=exc.status_code, content=content)

async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    req_id = f"req_{uuid.uuid4().hex[:12]}"
    content = {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected server error occurred.",
            "retryable": True,
            "request_id": req_id,
        }
    }
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=content)

