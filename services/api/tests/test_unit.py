from app.page.schemas import (
    PageNodeIn,
    PageManifestIn,
    TurnRequest,
    EvidenceRef,
    PlannedStep,
    TurnPlanOut,
    SessionCreateIn,
)
from app.page.sanitizer import sanitize_manifest, normalize_text
from app.page.store import session_store
from app.page.ranker import select_relevant_nodes
from app.planner.verifier import verify_and_clean_plan, build_unknown_plan
from app.auth.security import (
    check_origin,
    create_session_token,
    verify_session_token,
    extract_bearer_token,
)

def test_normalize_text():
    assert normalize_text("  hello   world  ") == "hello world"
    assert normalize_text("<script>alert(1)</script>Safe Text") == "Safe Text"
    assert normalize_text("Line 1\n\n\n\nLine 2") == "Line 1\n\nLine 2"

def test_pydantic_schemas_strict():
    # Extra fields must be forbidden
    import pydantic
    try:
        TurnRequest(message="hi", page_revision=1, unexpected_field=123)
        assert False, "Should have raised ValidationError"
    except pydantic.ValidationError:
        pass

def test_session_token_and_verification():
    sid = "sess_12345"
    tenant = "widget_abc"
    expires = 9999999999 # far future
    token = create_session_token(sid, tenant, expires)
    assert verify_session_token(token, sid) is True
    assert verify_session_token(token, "wrong_sid") is False
    assert verify_session_token("invalid:token", sid) is False
    assert extract_bearer_token(f"Bearer {token}") == token

def test_manifest_store_and_revision():
    sid = "sess_unit_test"
    session_store.create_session(sid, "tenant1", "http://localhost", 3600)
    
    node = PageNodeIn(
        id="n1",
        role="section",
        tag_name="section",
        accessible_name="About Us",
        text="NovaAI provides 3D avatar assistants for websites.",
        visible=True,
    )
    manifest = PageManifestIn(
        page_id="p1",
        revision=1,
        content_hash="sha256:00000000000000000000000000000000",
        title="NovaAI",
        url="http://localhost:5173",
        nodes=[node],
    )
    
    session_store.upsert_manifest(sid, manifest)
    stored = session_store.require_revision(sid, 1)
    assert stored.revision == 1
    assert len(stored.nodes) == 1

def test_ranker_selection():
    manifest = PageManifestIn(
        page_id="p1",
        revision=1,
        content_hash="sha256:00000000000000000000000000000000",
        title="Test Page",
        url="http://localhost:5173",
        nodes=[
            PageNodeIn(
                id="n_hero",
                role="section",
                tag_name="section",
                accessible_name="Hero",
                text="Welcome to the platform.",
                visible=True,
            ),
            PageNodeIn(
                id="n_btn",
                role="button",
                tag_name="button",
                accessible_name="Sign Up",
                text="Sign Up Now",
                visible=True,
            ),
        ],
    )
    
    ranked = select_relevant_nodes("Where can I sign up?", manifest)
    assert len(ranked["candidates"]) > 0
    # n_btn should be top ranked for sign up
    assert ranked["candidates"][0]["id"] == "n_btn"

def test_verifier_grounding_and_abstention():
    manifest = PageManifestIn(
        page_id="p1",
        revision=1,
        content_hash="sha256:00000000000000000000000000000000",
        title="Test Page",
        url="http://localhost:5173",
        nodes=[
            PageNodeIn(
                id="n_about",
                role="section",
                tag_name="section",
                accessible_name="About Us",
                text="We build web assistants.",
                visible=True,
            )
        ],
    )
    
    # 1. Valid plan with exact evidence
    valid_plan = TurnPlanOut(
        turn_id="t1",
        answer="We build web assistants.",
        intent="answer",
        target_node_id="n_about",
        gesture="explain",
        steps=[],
        evidence=[EvidenceRef(node_id="n_about", quote="We build web assistants.")],
        confidence=0.95,
        page_revision=1,
    )
    verified = verify_and_clean_plan(valid_plan, manifest)
    assert verified.intent == "answer"
    assert len(verified.evidence) == 1

    # 2. Hallucinated / Unsupported claim with no matching evidence -> Must abstain
    hallucinated_plan = TurnPlanOut(
        turn_id="t2",
        answer="The CEO's phone number is +1-555-1234.",
        intent="answer",
        target_node_id=None,
        gesture="explain",
        steps=[],
        evidence=[EvidenceRef(node_id="n_about", quote="+1-555-1234")], # Not on page!
        confidence=0.9,
        page_revision=1,
    )
    verified2 = verify_and_clean_plan(hallucinated_plan, manifest)
    assert verified2.intent == "unknown"
    assert "can't find" in verified2.answer.lower()



def test_custom_error_codes():
    from app.core.errors import (
        InvalidWidgetError,
        ManifestTooLargeError,
        ProviderTimeoutError,
        ProviderRateLimitedError,
        VoiceUnavailableError,
    )
    assert InvalidWidgetError().code == "INVALID_WIDGET"
    assert ManifestTooLargeError().code == "MANIFEST_TOO_LARGE"
    assert ProviderTimeoutError().code == "PROVIDER_TIMEOUT"
    assert ProviderRateLimitedError().code == "PROVIDER_RATE_LIMITED"
    assert VoiceUnavailableError().code == "VOICE_UNAVAILABLE"
