import uuid
import time
from typing import Optional
from fastapi import APIRouter, Header, Depends, UploadFile, File, Form, Response, status
from app.core.config import settings
from app.core.errors import (
    AppError,
    OriginNotAllowedError,
    SessionExpiredError,
    ManifestTooLargeError,
)
from app.auth.security import (
    validate_origin_or_raise,
    create_session_token,
    verify_session_token,
    extract_bearer_token,
)
from app.page.schemas import (
    SessionCreateIn,
    SessionCreateOut,
    SessionCapabilities,
    PageManifestIn,
    PageManifestAcceptedOut,
    TurnRequest,
    TurnPlanOut,
    TranscriptionOut,
    SpeechRequestIn,
)
from app.page.sanitizer import sanitize_manifest
from app.page.store import session_store
from app.conversation.service import conversation_service

router = APIRouter(prefix="/v1", tags=["v1"])

def require_valid_session(
    session_id: str,
    authorization: Optional[str] = Header(None),
) -> str:
    token = extract_bearer_token(authorization)
    if not token or not verify_session_token(token, session_id):
        raise SessionExpiredError("Invalid or expired session token.")
    return session_id

@router.post("/sessions", response_model=SessionCreateOut)
async def create_session(
    payload: SessionCreateIn,
    origin: Optional[str] = Header(None),
):
    validate_origin_or_raise(origin)
    session_id = f"sess_{uuid.uuid4().hex}"
    ttl = int(settings.session_ttl_seconds)
    now_epoch = int(time.time())
    expires_epoch = now_epoch + ttl
    
    session_store.create_session(
        session_id=session_id,
        tenant_id=payload.widget_id,
        origin=origin or "localhost",
        ttl_seconds=ttl,
    )
    
    token = create_session_token(
        session_id=session_id,
        tenant_id=payload.widget_id,
        expires_at=expires_epoch,
    )

    return SessionCreateOut(
        session_id=session_id,
        session_token=token,
        expires_in_seconds=ttl,
        capabilities=SessionCapabilities(
            text=True,
            voice=True,
            tts=True,
            guided_tour=True,
        ),
    )

@router.put("/sessions/{session_id}/page-manifest", response_model=PageManifestAcceptedOut)
async def upsert_page_manifest(
    session_id: str,
    manifest: PageManifestIn,
    auth_session: str = Depends(require_valid_session),
):
    # Revalidate URL origin against session origin (LLD §6.2)
    session = session_store.get_session(session_id)
    if session.origin != "localhost" and manifest.url:
        from urllib.parse import urlparse
        parsed = urlparse(manifest.url)
        man_origin = f"{parsed.scheme}://{parsed.netloc}"
        sess_origin = session.origin.rstrip("/")
        if man_origin and sess_origin and man_origin != sess_origin and "localhost" not in sess_origin and "127.0.0.1" not in sess_origin:
            raise OriginNotAllowedError(f"Manifest URL origin '{man_origin}' does not match session origin '{sess_origin}'.")

    # Enforce maximum manifest byte size (LLD §4.5, §6.2)
    raw_bytes_len = len(manifest.model_dump_json().encode("utf-8"))
    if raw_bytes_len > settings.max_manifest_bytes:
        raise ManifestTooLargeError(f"Manifest size ({raw_bytes_len} bytes) exceeds limit of {settings.max_manifest_bytes} bytes.")

    # Sanitize and validate limits
    sanitized = sanitize_manifest(manifest)
    session_store.upsert_manifest(session_id, sanitized)
    
    return PageManifestAcceptedOut(
        accepted=True,
        revision=sanitized.revision,
        content_hash=sanitized.content_hash,
        node_count=len(sanitized.nodes),
    )

@router.post("/sessions/{session_id}/turns", response_model=TurnPlanOut)
async def submit_turn(
    session_id: str,
    payload: TurnRequest,
    auth_session: str = Depends(require_valid_session),
):
    plan = await conversation_service.handle_turn(session_id, payload)
    return plan

@router.post("/sessions/{session_id}/audio/transcriptions", response_model=TranscriptionOut)
async def transcribe_audio(
    session_id: str,
    file: UploadFile = File(...),
    locale: Optional[str] = Form(None),
    auth_session: str = Depends(require_valid_session),
):
    audio_bytes = await file.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise AppError("AUDIO_TOO_LARGE", "Audio payload exceeds maximum permitted size of 25MB.")
    
    result = await conversation_service.stt_provider.transcribe(
        audio=audio_bytes,
        mime_type=file.content_type or "audio/webm",
        locale=locale,
    )
    return TranscriptionOut(
        transcript=result["transcript"],
        language=result.get("language", "en"),
        duration_ms=result.get("duration_ms", 1000),
    )

@router.post("/sessions/{session_id}/audio/speech")
async def generate_speech(
    session_id: str,
    payload: SpeechRequestIn,
    auth_session: str = Depends(require_valid_session),
):
    audio_bytes = await conversation_service.tts_provider.synthesize(
        text=payload.text,
        locale=payload.locale or "en-US",
        voice_profile=payload.voice_profile or "default",
    )
    return Response(content=audio_bytes, media_type="audio/mpeg")

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    auth_session: str = Depends(require_valid_session),
):
    session_store.delete_session(session_id)
    return {"status": "deleted"}

