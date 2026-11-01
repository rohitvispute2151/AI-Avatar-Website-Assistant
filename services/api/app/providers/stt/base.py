from typing import Protocol, Optional, Dict, Any

class STTProvider(Protocol):
    async def transcribe(
        self,
        audio: bytes,
        *,
        mime_type: str,
        locale: Optional[str] = None
    ) -> Dict[str, Any]:
        ...

