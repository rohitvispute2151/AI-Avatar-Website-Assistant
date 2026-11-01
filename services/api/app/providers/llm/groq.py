import json
import logging
import httpx
from typing import Dict, Any, List
from app.core.config import settings
from app.core.errors import ProviderTimeoutError, ProviderRateLimitedError
from app.planner.prompts import build_planning_prompt

logger = logging.getLogger(__name__)

class GroqLLMProvider:
    def __init__(self, api_key: str = "", model: str = "", fallback_to_gemini: bool = True):
        self.api_key = api_key or settings.groq_api_key
        self.model = model or getattr(settings, "groq_llm_model", "qwen/qwen3.8-27b")
        self.fallback_to_gemini = fallback_to_gemini

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
                raise ValueError("GROQ_API_KEY is not set.")

            prompt = build_planning_prompt(user_message, page_context, history)
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 1024,
            }

            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 429:
                        raise ProviderRateLimitedError("Groq API rate limit exceeded.")
                    resp.raise_for_status()
                    data = resp.json()
            except httpx.TimeoutException:
                raise ProviderTimeoutError("Groq API request timed out after 20 seconds.")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    raise ProviderRateLimitedError("Groq API rate limit exceeded.")
                raise ValueError(f"Groq API HTTP {e.response.status_code}: {e.response.text[:200]}")

            try:
                raw_text = data["choices"][0]["message"]["content"]
                return json.loads(raw_text)
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                raise ValueError(f"Failed to parse Groq response: {e}")

        except Exception as groq_err:
            # Secondary fallback to Gemini when Groq fails
            if self.fallback_to_gemini and settings.gemini_api_key:
                logger.warning(
                    f"Groq call failed ({groq_err}). Automatically falling back to Gemini LLM provider..."
                )
                from app.providers.llm.gemini import GeminiLLMProvider
                gemini_provider = GeminiLLMProvider(fallback_to_groq=False)
                return await gemini_provider.create_plan(
                    system_prompt=system_prompt,
                    user_message=user_message,
                    page_context=page_context,
                    history=history,
                    response_schema=response_schema,
                )
            raise
