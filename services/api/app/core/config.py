import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load environment variables from .env
for env_candidate in [
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path.cwd() / ".env",
    Path(__file__).resolve().parents[4] / ".env",
]:
    if env_candidate.exists():
        load_dotenv(env_candidate, override=False)
        # Ensure any non-empty variable in .env populates empty os.getenv
        from dotenv import dotenv_values
        for k, v in dotenv_values(env_candidate).items():
            if v and not os.environ.get(k):
                os.environ[k] = str(v)

class Settings(BaseModel):
    app_env: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    api_host: str = Field(default_factory=lambda: os.getenv("API_HOST", "0.0.0.0"))
    api_port: int = Field(default_factory=lambda: int(os.getenv("API_PORT", "8000")))
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
            ).split(",")
            if origin.strip()
        ]
    )
    secret_key: str = Field(
        default_factory=lambda: os.getenv("SECRET_KEY", "dev-insecure-secret-key-32-chars-minimum")
    )
    session_ttl_seconds: int = Field(
        default_factory=lambda: int(os.getenv("SESSION_TTL_SECONDS", "1800"))
    )
    max_manifest_bytes: int = Field(
        default_factory=lambda: int(os.getenv("MAX_MANIFEST_BYTES", "80000"))
    )
    max_audio_seconds: int = Field(
        default_factory=lambda: int(os.getenv("MAX_AUDIO_SECONDS", "30"))
    )
    
    # LLM Settings
    llm_provider: str = Field(default_factory=lambda: os.getenv("LLM_PROVIDER", "groq"))
    llm_model: str = Field(default_factory=lambda: os.getenv("LLM_MODEL", "qwen/qwen3.8-27b"))
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    
    # STT / TTS Settings
    groq_llm_model: str = Field(default_factory=lambda: os.getenv("GROQ_LLM_MODEL", "qwen/qwen3.8-27b"))
    stt_provider: str = Field(default_factory=lambda: os.getenv("STT_PROVIDER", "browser"))
    stt_model: str = Field(default_factory=lambda: os.getenv("STT_MODEL", "whisper-large-v3-turbo"))
    groq_api_key: str = Field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    tts_provider: str = Field(default_factory=lambda: os.getenv("TTS_PROVIDER", "browser"))
    tts_model: str = Field(default_factory=lambda: os.getenv("TTS_MODEL", "eleven_turbo_v2"))
    elevenlabs_api_key: str = Field(default_factory=lambda: os.getenv("ELEVENLABS_API_KEY", ""))

settings = Settings()

