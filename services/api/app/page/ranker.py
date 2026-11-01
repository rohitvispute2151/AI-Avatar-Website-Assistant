import re
from typing import Dict, Any, List
from app.page.schemas import PageManifestIn, PageNodeIn

def tokenize(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))

def select_relevant_nodes(
    message: str,
    manifest: PageManifestIn,
    max_nodes: int = 25,
    recent_node_ids: List[str] = None,
) -> Dict[str, Any]:
    msg_tokens = tokenize(message)
    msg_lower = message.lower()
    recent_set = set(recent_node_ids or [])
    
    # Check if tour is requested
    is_tour_query = any(k in msg_lower for k in ["tour", "walk through", "walk me through", "overview", "show me around"])
    
    # Collect sections / landmarks for outline
    section_nodes = [
        n for n in manifest.nodes
        if n.role in ("section", "heading", "page") and n.visible
    ]
    
    # Score each node
    scored_nodes: List[tuple[float, PageNodeIn]] = []
    
    for node in manifest.nodes:
        if not node.visible:
            continue
            
        score = 0.0
        node_name_lower = (node.accessible_name or "").lower()
        node_text_lower = (node.text or "").lower()
        node_purpose_lower = (node.purpose or "").lower()
        node_href_lower = (node.href or "").lower()
        
        # 1. Exact phrase match
        if node_name_lower and node_name_lower in msg_lower:
            score += 15.0
        if node_text_lower and (node_text_lower in msg_lower or msg_lower in node_text_lower):
            score += 10.0
            
        # 2. Token overlap
        name_tokens = tokenize(node_name_lower)
        text_tokens = tokenize(node_text_lower)
        purpose_tokens = tokenize(node_purpose_lower)
        
        overlap_name = len(msg_tokens.intersection(name_tokens))
        overlap_text = len(msg_tokens.intersection(text_tokens))
        overlap_purpose = len(msg_tokens.intersection(purpose_tokens))
        
        score += overlap_name * 4.0
        score += overlap_text * 1.5
        score += overlap_purpose * 2.0
        
        # 3. Role/intent heuristic boosts
        if any(k in msg_lower for k in ("sign up", "signup", "register", "get started", "join")):
            if any(k in node_name_lower or k in node_href_lower for k in ("sign", "start", "join", "contact")):
                score += 12.0
            if node.role in ("button", "link", "form"):
                score += 6.0
        if any(k in msg_lower for k in ("contact", "message", "email", "form", "reach", "fill")):
            if node.role in ("form", "form-field") or any(k in node_name_lower or k in node_href_lower for k in ("contact", "email", "message", "form", "signup", "name")):
                score += 10.0
        if "pricing" in msg_lower or "price" in msg_lower or "cost" in msg_lower or "plan" in msg_lower:
            if "pricing" in node_name_lower or "plan" in node_name_lower or "price" in node_text_lower:
                score += 8.0
        if "company" in msg_lower or "about" in msg_lower or "what does" in msg_lower:
            if "about" in node_name_lower or node.role in ("section", "heading", "text"):
                score += 5.0
                
        # Tour boost for semantic headings and sections
        if is_tour_query and node.role in ("heading", "section"):
            score += 10.0
            
        # Follow-up boost for nodes discussed in recent turns
        if node.id in recent_set:
            score += 8.0
            
        scored_nodes.append((score, node))
        
    scored_nodes.sort(key=lambda x: x[0], reverse=True)
    
    # Pick top scoring nodes
    selected = [node for _, node in scored_nodes[:max_nodes]]
    
    # Make sure at least key sections are present if tour query
    if is_tour_query:
        for s in section_nodes:
            if s not in selected and len(selected) < max_nodes:
                selected.append(s)
                
    # Build compact context dictionary
    candidates_data = [
        {
            "id": n.id,
            "role": n.role,
            "accessible_name": n.accessible_name,
            "text": n.text[:300],
            "purpose": n.purpose,
            "input_type": n.input_type,
            "required": n.required,
            "visible": n.visible,
            "form_state": n.form_state,
        }
        for n in selected
    ]
    
    sections_outline = [
        {"id": n.id, "heading": n.accessible_name or n.text[:60], "role": n.role}
        for n in section_nodes[:10]
    ]
    
    return {
        "page_title": manifest.title,
        "page_url": manifest.url,
        "page_revision": manifest.revision,
        "sections_outline": sections_outline,
        "candidates": candidates_data,
        "is_tour_query": is_tour_query,
    }

