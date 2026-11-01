from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, generic_error_handler
from app.api.v1.routes import router as v1_router

app = FastAPI(
    title="AI Avatar Website Assistant API",
    version="1.0.0",
    description="Modular monolith backend for embeddable AI avatar website guide.",
)

# Exception handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, generic_error_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(v1_router)

@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "env": settings.app_env,
        "llm_provider": settings.llm_provider,
        "stt_provider": settings.stt_provider,
        "tts_provider": settings.tts_provider,
    }

