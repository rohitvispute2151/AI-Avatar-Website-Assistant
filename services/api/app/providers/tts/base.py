from typing import Protocol

class TTSProvider(Protocol):
    async def synthesize(
        self,
        text: str,
        *,
        locale: str = "en-US",
        voice_profile: str = "default"
    ) -> bytes:
        ...

