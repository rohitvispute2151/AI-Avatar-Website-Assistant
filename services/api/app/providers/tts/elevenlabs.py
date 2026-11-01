import httpx
from app.core.config import settings

class ElevenLabsTTSProvider:
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key or settings.elevenlabs_api_key
        self.model = model or settings.tts_model
        self.default_voice_id = "21m00Tcm4TlvDq8ikWAM" # Rachel / default clean voice

    async def synthesize(
        self,
        text: str,
        *,
        locale: str = "en-US",
        voice_profile: str = "default"
    ) -> bytes:
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY is not set.")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.default_voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": self.model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8,
            }
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.content

