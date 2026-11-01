import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from app.page.schemas import PageManifestIn, EvidenceRef
from app.core.errors import SessionExpiredError, RevisionConflictError, PageRevisionStaleError

@dataclass
class ConversationTurn:
    user_message: str
    assistant_answer: str
    evidence: List[EvidenceRef] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)

@dataclass
class SessionRecord:
    session_id: str
    tenant_id: str
    origin: str
    page_id: Optional[str] = None
    page_revision: int = 0
    page_manifest: Optional[PageManifestIn] = None
    recent_turns: List[ConversationTurn] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, SessionRecord] = {}

    def cleanup_expired(self):
        now = time.time()
        expired_keys = [sid for sid, rec in self._sessions.items() if now > rec.expires_at]
        for sid in expired_keys:
            del self._sessions[sid]

    def create_session(self, session_id: str, tenant_id: str, origin: str, ttl_seconds: int) -> SessionRecord:
        self.cleanup_expired()
        rec = SessionRecord(
            session_id=session_id,
            tenant_id=tenant_id,
            origin=origin,
            created_at=time.time(),
            expires_at=time.time() + ttl_seconds,
        )
        self._sessions[session_id] = rec
        return rec

    def get_session(self, session_id: str) -> SessionRecord:
        self.cleanup_expired()
        rec = self._sessions.get(session_id)
        if not rec or rec.is_expired():
            if rec:
                del self._sessions[session_id]
            raise SessionExpiredError()
        return rec

    def upsert_manifest(self, session_id: str, manifest: PageManifestIn) -> None:
        rec = self.get_session(session_id)
        if rec.page_manifest is not None:
            if manifest.revision < rec.page_revision:
                raise RevisionConflictError(f"Supplied revision {manifest.revision} is older than current {rec.page_revision}")
            if manifest.revision == rec.page_revision and manifest.content_hash != rec.page_manifest.content_hash:
                raise RevisionConflictError("Manifest revision matches current revision but content hash differs.")
        
        rec.page_id = manifest.page_id
        rec.page_revision = manifest.revision
        rec.page_manifest = manifest

    def require_revision(self, session_id: str, revision: int) -> PageManifestIn:
        rec = self.get_session(session_id)
        if rec.page_manifest is None:
            raise PageRevisionStaleError(current_revision=0)
        if revision != rec.page_revision:
            raise PageRevisionStaleError(current_revision=rec.page_revision)
        return rec.page_manifest

    def append_turn(self, session_id: str, user_message: str, answer: str, evidence: List[EvidenceRef]):
        rec = self.get_session(session_id)
        rec.recent_turns.append(
            ConversationTurn(
                user_message=user_message,
                assistant_answer=answer,
                evidence=evidence,
                timestamp=time.time(),
            )
        )
        # Bounded turns: max 8
        if len(rec.recent_turns) > 8:
            rec.recent_turns = rec.recent_turns[-8:]

    def delete_session(self, session_id: str):
        self._sessions.pop(session_id, None)

session_store = SessionStore()

