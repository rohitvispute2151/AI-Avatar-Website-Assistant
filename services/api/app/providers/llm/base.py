from typing import Protocol, Dict, Any, List

class LLMProvider(Protocol):
    async def create_plan(
        self,
        *,
        system_prompt: str,
        user_message: str,
        page_context: Dict[str, Any],
        history: List[Dict[str, Any]],
        response_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        ...

