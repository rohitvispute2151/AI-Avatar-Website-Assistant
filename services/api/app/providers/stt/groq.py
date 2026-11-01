import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

class GroqSTTProvider:
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key or settings.groq_api_key
        self.model = model or settings.stt_model

    async def transcribe(
        self,
        audio: bytes,
        *,
        mime_type: str,
        locale: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not set.")

        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        files = {
            "file": ("audio.webm", audio, mime_type),
        }
        data = {
            "model": self.model,
            "response_format": "json",
        }
        if locale:
            data["language"] = locale[:2]

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            resp.raise_for_status()
            res_json = resp.json()

        return {
            "transcript": res_json.get("text", "").strip(),
            "language": locale or "en",
            "duration_ms": 2000,
        }

