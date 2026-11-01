import uuid
import logging
from typing import Dict, Any
from app.core.config import settings
from app.page.schemas import TurnRequest, TurnPlanOut, EvidenceRef
from app.page.store import session_store
from app.page.ranker import select_relevant_nodes
from app.planner.prompts import FIXED_SYSTEM_PROMPT
from app.planner.verifier import verify_and_clean_plan, build_unknown_plan
from app.providers.llm.base import LLMProvider
from app.providers.llm.mock import MockLLMProvider
from app.providers.llm.gemini import GeminiLLMProvider
from app.providers.llm.openai import OpenAILLMProvider
from app.providers.llm.groq import GroqLLMProvider
from app.providers.stt.mock import MockSTTProvider
from app.providers.stt.groq import GroqSTTProvider
from app.providers.tts.mock import MockTTSProvider
from app.providers.tts.elevenlabs import ElevenLabsTTSProvider

logger = logging.getLogger(__name__)

class ConversationService:
    def __init__(self):
        self.llm_provider = self._init_llm_provider()
        self.stt_provider = self._init_stt_provider()
        self.tts_provider = self._init_tts_provider()

    def _init_llm_provider(self) -> LLMProvider:
        prov = settings.llm_provider.lower()
        if prov == "groq" and settings.groq_api_key:
            return GroqLLMProvider()
        elif prov == "gemini" and settings.gemini_api_key:
            return GeminiLLMProvider()
        elif prov == "openai" and settings.openai_api_key:
            return OpenAILLMProvider()
        elif settings.groq_api_key:
            return GroqLLMProvider()
        elif settings.gemini_api_key:
            return GeminiLLMProvider()
        return MockLLMProvider()

    def _init_stt_provider(self):
        if settings.stt_provider.lower() == "groq" and settings.groq_api_key:
            return GroqSTTProvider()
        return MockSTTProvider()

    def _init_tts_provider(self):
        if settings.tts_provider.lower() == "elevenlabs" and settings.elevenlabs_api_key:
            return ElevenLabsTTSProvider()
        return MockTTSProvider()

    async def handle_turn(self, session_id: str, request: TurnRequest) -> TurnPlanOut:
        session = session_store.get_session(session_id)
        manifest = session_store.require_revision(session_id, request.page_revision)

        # 1. Candidate ranking and selection with follow-up memory support
        recent_evidence_ids = [
            ev.node_id
            for turn in session.recent_turns[-2:]
            for ev in turn.evidence
        ]
        page_context = select_relevant_nodes(
            request.message,
            manifest,
            max_nodes=25,
            recent_node_ids=recent_evidence_ids,
        )

        # 2. Bounded conversation history format
        history = [
            {
                "user": turn.user_message,
                "assistant": turn.assistant_answer,
                "evidence_node_ids": [ev.node_id for ev in turn.evidence],
            }
            for turn in session.recent_turns
        ]

        # 3. Request structured plan from LLM
        try:
            raw_plan = await self.llm_provider.create_plan(
                system_prompt=FIXED_SYSTEM_PROMPT,
                user_message=request.message,
                page_context=page_context,
                history=history,
                response_schema=TurnPlanOut.model_json_schema(),
            )
            # Ensure turn_id and page_revision are attached
            raw_plan["turn_id"] = f"turn_{uuid.uuid4().hex[:12]}"
            raw_plan["page_revision"] = manifest.revision
            parsed_plan = TurnPlanOut.model_validate(raw_plan)
        except Exception as e:
            logger.warning(f"Planner/LLM failed: {e}. Falling back to unknown plan.")
            parsed_plan = build_unknown_plan(manifest.revision)

        # 4. Strict evidence and action plan verification
        verified_plan = verify_and_clean_plan(parsed_plan, manifest)

        # 5. Record bounded turn in session
        session_store.append_turn(
            session_id=session_id,
            user_message=request.message,
            answer=verified_plan.answer,
            evidence=verified_plan.evidence,
        )

        return verified_plan

conversation_service = ConversationService()

