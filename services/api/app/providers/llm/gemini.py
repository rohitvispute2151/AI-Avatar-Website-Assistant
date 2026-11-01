import json
import logging
import httpx
from typing import Dict, Any, List
from app.core.config import settings
from app.core.errors import ProviderTimeoutError, ProviderRateLimitedError
from app.planner.prompts import build_planning_prompt

logger = logging.getLogger(__name__)

class GeminiLLMProvider:
    def __init__(self, api_key: str = "", model: str = "", fallback_to_groq: bool = True):
        self.api_key = api_key or settings.gemini_api_key
        raw_model = model or "gemini-3.8-flash"
        if "/" in raw_model or "gemini" not in raw_model.lower():
            raw_model = "gemini-3.8-flash"
        self.model = raw_model
        self.fallback_to_groq = fallback_to_groq

    async def create_plan(
        self,
        *,
        system_prompt: str,
        user_message: str,
        page_context: Dict[str, Any],
        history: List[Dict[str, Any]],
        response_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        try:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not set.")

            prompt = build_planning_prompt(user_message, page_context, history)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_prompt}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                    "max_output_tokens": 1024,
                }
            }

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 429:
                        raise ProviderRateLimitedError("Gemini API rate limit exceeded.")
                    resp.raise_for_status()
                    data = resp.json()
            except httpx.TimeoutException:
                raise ProviderTimeoutError("Gemini API request timed out after 30 seconds.")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    raise ProviderRateLimitedError("Gemini API rate limit exceeded.")
                raise ValueError(f"Gemini API HTTP {e.response.status_code}: {e.response.text[:200]}")
                
            try:
                candidate = data["candidates"][0]
                raw_text = candidate["content"]["parts"][0]["text"]
                plan_json = json.loads(raw_text)
                return plan_json
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                raise ValueError(f"Failed to parse Gemini response: {e}")

        except Exception as gemini_err:
            # Automatic fallback to Groq when Gemini fails
            if self.fallback_to_groq and settings.groq_api_key:
                logger.warning(
                    f"Gemini call failed ({gemini_err}). Automatically falling back to Groq LLM provider..."
                )
                from app.providers.llm.groq import GroqLLMProvider
                groq_provider = GroqLLMProvider(fallback_to_gemini=False)
                return await groq_provider.create_plan(
                    system_prompt=system_prompt,
                    user_message=user_message,
                    page_context=page_context,
                    history=history,
                    response_schema=response_schema,
                )
            raise
