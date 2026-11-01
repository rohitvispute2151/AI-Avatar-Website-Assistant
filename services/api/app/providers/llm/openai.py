import json
import httpx
from typing import Dict, Any, List
from app.core.config import settings
from app.planner.prompts import build_planning_prompt

class OpenAILLMProvider:
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key or settings.openai_api_key
        self.model = model or "gpt-4o-mini"

    async def create_plan(
        self,
        *,
        system_prompt: str,
        user_message: str,
        page_context: Dict[str, Any],
        history: List[Dict[str, Any]],
        response_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not set.")

        prompt = build_planning_prompt(user_message, page_context, history)
        url = "https://api.openai.com/v1/chat/completions"
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
            "max_tokens": 800,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        try:
            raw_text = data["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse OpenAI response: {e}")

