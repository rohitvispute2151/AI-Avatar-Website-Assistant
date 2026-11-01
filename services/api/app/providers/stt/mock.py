from typing import Optional, Dict, Any

class MockSTTProvider:
    async def transcribe(
        self,
        audio: bytes,
        *,
        mime_type: str,
        locale: Optional[str] = None
    ) -> Dict[str, Any]:
        return {
            "transcript": "Where can I sign up?",
            "language": locale or "en",
            "duration_ms": 1500,
        }

