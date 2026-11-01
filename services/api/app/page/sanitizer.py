import re
import unicodedata
from app.page.schemas import PageManifestIn

MAX_NODES_PER_PAGE = 250
MAX_TEXT_PER_NODE_CHARS = 700
MAX_TOTAL_TEXT_CHARS = 30_000

def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Normalize unicode to NFKC
    normalized = unicodedata.normalize("NFKC", text)
    # Strip full script and style tags and contents
    cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", normalized, flags=re.DOTALL | re.IGNORECASE)
    # Strip remaining HTML tags
    cleaned = re.sub(r"<[^>]*>", " ", cleaned)
    # Strip non-printable control characters (except newline and tab)
    cleaned = "".join(ch for ch in cleaned if ch == "\n" or ch == "\t" or unicodedata.category(ch)[0] != "C")
    # Normalize whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    return cleaned.strip()

def sanitize_manifest(manifest: PageManifestIn) -> PageManifestIn:
    total_text_len = 0
    sanitized_nodes = []
    
    # Slice to MAX_NODES_PER_PAGE
    raw_nodes = manifest.nodes[:MAX_NODES_PER_PAGE]
    
    for node in raw_nodes:
        cleaned_text = normalize_text(node.text)
        if len(cleaned_text) > MAX_TEXT_PER_NODE_CHARS:
            # truncate at sentence or word boundary
            cleaned_text = cleaned_text[:MAX_TEXT_PER_NODE_CHARS].rsplit(" ", 1)[0] + "..."
            
        if total_text_len + len(cleaned_text) > MAX_TOTAL_TEXT_CHARS:
            remaining = max(0, MAX_TOTAL_TEXT_CHARS - total_text_len)
            cleaned_text = cleaned_text[:remaining]
            
        total_text_len += len(cleaned_text)
        
        node.text = cleaned_text
        node.accessible_name = normalize_text(node.accessible_name)[:240]
        if node.purpose:
            node.purpose = normalize_text(node.purpose)[:240]
            
        sanitized_nodes.append(node)
        if total_text_len >= MAX_TOTAL_TEXT_CHARS:
            break

    manifest.nodes = sanitized_nodes
    manifest.title = normalize_text(manifest.title)[:240]
    return manifest
