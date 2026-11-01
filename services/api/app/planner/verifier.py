import re
import unicodedata
from typing import Dict, Optional, Tuple
from app.page.schemas import TurnPlanOut, PageManifestIn, PageNodeIn, EvidenceRef

def normalize_for_match(text: Optional[str]) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"\s+", " ", normalized).strip()

def build_unknown_plan(page_revision: int, message: Optional[str] = None) -> TurnPlanOut:
    return TurnPlanOut(
        turn_id="turn_fallback",
        answer=message or "I can't find that information on this page.",
        intent="unknown",
        target_node_id=None,
        gesture="open_palm",
        steps=[],
        evidence=[],
        confidence=1.0,
        page_revision=page_revision,
        should_speak=True,
    )

def verify_and_clean_plan(plan: TurnPlanOut, manifest: PageManifestIn) -> TurnPlanOut:
    node_map: Dict[str, PageNodeIn] = {node.id: node for node in manifest.nodes}
    
    # Check stop or unknown intents
    if plan.intent in ("stop", "unknown"):
        plan.target_node_id = None
        plan.steps = []
        return plan
        
    # Validate target_node_id if set
    if plan.target_node_id:
        target_node = node_map.get(plan.target_node_id)
        if not target_node or not target_node.visible:
            # Stale / invalid target
            return build_unknown_plan(manifest.revision, "I couldn't locate that element on the current page.")
            
    # Validate navigation
    if plan.intent == "navigate_to_node":
        if not plan.target_node_id:
            return build_unknown_plan(manifest.revision, "I'm not sure which section or button you're referring to.")

    # Validate tour
    if plan.intent == "start_tour":
        if not plan.steps or len(plan.steps) > 20:
            return build_unknown_plan(manifest.revision, "Unable to construct a tour for the current sections.")
        valid_steps = []
        for step in plan.steps:
            target_node = node_map.get(step.target_node_id)
            if target_node and target_node.visible:
                valid_steps.append(step)
        if not valid_steps:
            return build_unknown_plan(manifest.revision, "Unable to find sections to tour.")
        plan.steps = valid_steps[:20]
        if not plan.target_node_id and valid_steps:
            plan.target_node_id = valid_steps[0].target_node_id

    # Validate form field guidance
    if plan.intent == "guide_form_field":
        if not plan.target_node_id:
            return build_unknown_plan(manifest.revision, "I couldn't find that form field on this page.")
        target_node = node_map.get(plan.target_node_id)
        if not target_node or (target_node.role not in ("form-field", "form", "control")) or target_node.disabled:
            return build_unknown_plan(manifest.revision, "That form or field is not available or editable.")

    # Validate evidence references
    valid_evidence = []
    for ev in plan.evidence:
        node = node_map.get(ev.node_id)
        if not node:
            continue
        norm_quote = normalize_for_match(ev.quote)
        if not norm_quote:
            continue
        norm_text = normalize_for_match(node.text)
        norm_name = normalize_for_match(node.accessible_name)
        norm_purpose = normalize_for_match(node.purpose)
        norm_href = normalize_for_match(node.href)
        
        # Check substring match in either direction
        if (
            (norm_quote in norm_text)
            or (norm_quote in norm_name)
            or (norm_quote in norm_purpose)
            or (norm_quote in norm_href)
            or (norm_name and norm_name in norm_quote)
            or (norm_text and len(norm_text) > 3 and norm_text in norm_quote)
        ):
            valid_evidence.append(ev)

    # For navigation or form guidance with a valid target, ensure evidence is populated
    if plan.intent in ("navigate_to_node", "guide_form_field") and plan.target_node_id and plan.target_node_id in node_map:
        if not valid_evidence:
            tnode = node_map[plan.target_node_id]
            fallback_quote = (tnode.accessible_name or tnode.text or tnode.purpose or tnode.role or "section")[:80]
            valid_evidence.append(EvidenceRef(node_id=tnode.id, quote=fallback_quote))

    # For factual answers, require at least one valid evidence reference
    if plan.intent == "answer":
        if not valid_evidence:
            return build_unknown_plan(manifest.revision, "I can't find that information on this page.")

    plan.evidence = valid_evidence
    
    # Cap answer length
    if len(plan.answer) > 600:
        plan.answer = plan.answer[:597] + "..."
        
    return plan

