class MockTTSProvider:
    async def synthesize(
        self,
        text: str,
        *,
        locale: str = "en-US",
        voice_profile: str = "default"
    ) -> bytes:
        # Minimal valid 1-second silent MP3 frame header / byte sequence
        return b"\xff\xfb\x90d\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"

