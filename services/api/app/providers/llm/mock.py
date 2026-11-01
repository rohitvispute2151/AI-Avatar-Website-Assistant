import re
from typing import Dict, Any, List

class MockLLMProvider:
    async def create_plan(
        self,
        *,
        system_prompt: str,
        user_message: str,
        page_context: Dict[str, Any],
        history: List[Dict[str, Any]],
        response_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        msg_lower = user_message.lower().strip()
        candidates = page_context.get("candidates", [])
        sections_outline = page_context.get("sections_outline", [])
        
        # 1. Greetings
        if msg_lower in ("hi", "hello", "hey", "greetings") or "introduce yourself" in msg_lower:
            hero_node = next((c for c in candidates if "hero" in (c.get("id") or "").lower() or c.get("role") in ("heading", "section")), None)
            quote = hero_node.get("accessible_name") or hero_node.get("text")[:40] if hero_node else "Welcome"
            return {
                "answer": f"Hello! I am your AI website guide. Welcome to {page_context.get('page_title', 'our website')}.",
                "intent": "answer",
                "target_node_id": hero_node.get("id") if hero_node else None,
                "gesture": "open_palm",
                "steps": [],
                "evidence": [{"node_id": hero_node.get("id"), "quote": quote}] if hero_node else [],
                "confidence": 0.98,
            }

        # 2. Tour request
        if any(k in msg_lower for k in ["tour", "walk through", "walk me through", "show me around", "overview"]):
            steps = []
            evidence = []
            # Find landmark or section nodes
            sections = [c for c in candidates if c.get("role") in ("section", "heading")]
            if not sections and sections_outline:
                # use outline
                for item in sections_outline[:5]:
                    steps.append({
                        "target_node_id": item["id"],
                        "spoken_text": f"Here is the {item['heading']} section.",
                        "gesture": "open_palm",
                        "step_kind": "section",
                    })
            else:
                for sec in sections[:5]:
                    sec_name = sec.get("accessible_name") or sec.get("text")[:30] or "section"
                    steps.append({
                        "target_node_id": sec["id"],
                        "spoken_text": f"Here is the {sec_name} section.",
                        "gesture": "open_palm",
                        "step_kind": "section",
                    })
                    evidence.append({
                        "node_id": sec["id"],
                        "quote": (sec.get("accessible_name") or sec.get("text")[:30])
                    })

            first_target = steps[0]["target_node_id"] if steps else None
            return {
                "answer": "Let's take a tour of the page! I'll guide you through each section.",
                "intent": "start_tour",
                "target_node_id": first_target,
                "gesture": "open_palm",
                "steps": steps,
                "evidence": evidence[:4],
                "confidence": 0.95,
            }

        # 3. Form walkthrough
        if any(k in msg_lower for k in ["form", "fill out", "help me fill", "contact form", "input"]):
            field_nodes = [c for c in candidates if c.get("role") == "form-field" or c.get("role") == "form"]
            if field_nodes:
                first_field = field_nodes[0]
                field_name = first_field.get("accessible_name") or "first field"
                quote = first_field.get("accessible_name") or first_field.get("text")[:30]
                return {
                    "answer": f"Let's fill out the form together. First, please enter your {field_name}. You type the values manually.",
                    "intent": "guide_form_field",
                    "target_node_id": first_field["id"],
                    "gesture": "point_left",
                    "steps": [],
                    "evidence": [{"node_id": first_field["id"], "quote": quote}],
                    "confidence": 0.96,
                }

        # 4. Where can I sign up? / Pricing / Buttons
        if any(k in msg_lower for k in ["sign up", "signup", "register", "get started", "join"]):
            btn_node = next(
                (c for c in candidates if c.get("role") in ("button", "link") and any(w in (c.get("accessible_name") or "").lower() for w in ["sign", "start", "get", "join"])),
                None
            )
            if not btn_node:
                # search for any button
                btn_node = next((c for c in candidates if c.get("role") == "button"), None)

            if btn_node:
                btn_text = btn_node.get("accessible_name") or btn_node.get("text")[:30]
                return {
                    "answer": f"You can get started right here. I'll take you directly to the button.",
                    "intent": "navigate_to_node",
                    "target_node_id": btn_node["id"],
                    "gesture": "point_right",
                    "steps": [],
                    "evidence": [{"node_id": btn_node["id"], "quote": btn_text}],
                    "confidence": 0.97,
                }

        # 5. Pricing question
        if any(k in msg_lower for k in ["price", "pricing", "cost", "plan", "how much"]):
            pricing_node = next(
                (c for c in candidates if "price" in (c.get("accessible_name") or "").lower() or "pricing" in (c.get("accessible_name") or "").lower() or "plan" in (c.get("text") or "").lower()),
                None
            )
            if pricing_node:
                quote = pricing_node.get("accessible_name") or pricing_node.get("text")[:40]
                return {
                    "answer": "Here are our pricing plans. Let's take a look at the available options.",
                    "intent": "navigate_to_node",
                    "target_node_id": pricing_node["id"],
                    "gesture": "explain",
                    "steps": [],
                    "evidence": [{"node_id": pricing_node["id"], "quote": quote}],
                    "confidence": 0.95,
                }

        # 6. Company description: "What does this company do?" / "about"
        if any(k in msg_lower for k in ["what does this company do", "about", "what do you do", "who are you", "what is this"]):
            about_node = next(
                (c for c in candidates if "about" in (c.get("accessible_name") or "").lower() or "company" in (c.get("text") or "").lower() or c.get("role") == "text"),
                None
            )
            if about_node:
                quote = (about_node.get("accessible_name") or about_node.get("text")[:50]).strip()
                ans_text = about_node.get("text")[:180] or about_node.get("accessible_name")
                return {
                    "answer": f"Based on our page: {ans_text}",
                    "intent": "answer",
                    "target_node_id": about_node["id"],
                    "gesture": "explain",
                    "steps": [],
                    "evidence": [{"node_id": about_node["id"], "quote": quote}],
                    "confidence": 0.94,
                }

        # 7. Unsupported questions (e.g. CEO phone number, revenue, outside knowledge)
        return {
            "answer": "I can't find that information on this page.",
            "intent": "unknown",
            "target_node_id": None,
            "gesture": "open_palm",
            "steps": [],
            "evidence": [],
            "confidence": 0.1,
        }

