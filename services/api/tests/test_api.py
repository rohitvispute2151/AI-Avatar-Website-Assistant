import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi.testclient import TestClient
from app.main import app
from app.conversation.service import conversation_service
from app.providers.llm.mock import MockLLMProvider

# Ensure mock provider is used for deterministic offline testing
conversation_service.llm_provider = MockLLMProvider()

client = TestClient(app)

def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "llm_provider" in data

def test_session_lifecycle_and_turn():
    # 1. Create session
    session_resp = client.post(
        "/v1/sessions",
        headers={"Origin": "http://localhost:5173"},
        json={
            "widget_id": "test-widget",
            "page_url": "http://localhost:5173",
            "locale": "en-US",
        },
    )
    assert session_resp.status_code == 200
    sess_data = session_resp.json()
    session_id = sess_data["session_id"]
    token = sess_data["session_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # 2. Upsert page manifest
    manifest_payload = {
        "page_id": "page_test_1",
        "revision": 1,
        "content_hash": "sha256:0123456789abcdef0123456789abcdef",
        "title": "NovaAI - Modern Spatial Avatar Assistant",
        "url": "http://localhost:5173/",
        "locale": "en-US",
        "nodes": [
            {
                "id": "node_hero",
                "role": "section",
                "tag_name": "section",
                "accessible_name": "Hero Section",
                "text": "Welcome to NovaAI, the intelligent 3D avatar assistant for your website.",
                "visible": True,
            },
            {
                "id": "node_about",
                "role": "section",
                "tag_name": "section",
                "accessible_name": "About Us",
                "text": "NovaAI builds embeddable 3D avatar guides that explain websites and guide visitors.",
                "visible": True,
            },
            {
                "id": "node_signup_btn",
                "role": "button",
                "tag_name": "button",
                "accessible_name": "Get Started",
                "text": "Get Started Free",
                "purpose": "Primary signup button",
                "visible": True,
            },
            {
                "id": "node_contact_email",
                "role": "form-field",
                "tag_name": "input",
                "accessible_name": "Work Email",
                "text": "",
                "purpose": "Email address for signup",
                "input_type": "email",
                "required": True,
                "visible": True,
                "form_state": "empty",
            },
        ],
    }
    
    man_resp = client.put(
        f"/v1/sessions/{session_id}/page-manifest",
        headers=auth_header,
        json=manifest_payload,
    )
    assert man_resp.status_code == 200
    assert man_resp.json()["accepted"] is True
    assert man_resp.json()["node_count"] == 4

    # 3. Ask question: "What does this company do?"
    turn1_resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={
            "message": "What does this company do?",
            "page_revision": 1,
            "input_mode": "text",
        },
    )
    assert turn1_resp.status_code == 200
    plan1 = turn1_resp.json()
    assert plan1["intent"] == "answer"
    assert len(plan1["evidence"]) > 0
    assert plan1["target_node_id"] == "node_about"

    # 4. Ask navigation: "Where can I sign up?"
    turn2_resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={
            "message": "Where can I sign up?",
            "page_revision": 1,
            "input_mode": "text",
        },
    )
    assert turn2_resp.status_code == 200
    plan2 = turn2_resp.json()
    assert plan2["intent"] == "navigate_to_node"
    assert plan2["target_node_id"] == "node_signup_btn"
    assert plan2["gesture"] == "point_right"

    # 5. Tour request: "Walk me through this page"
    turn3_resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={
            "message": "Walk me through this page",
            "page_revision": 1,
            "input_mode": "text",
        },
    )
    assert turn3_resp.status_code == 200
    plan3 = turn3_resp.json()
    assert plan3["intent"] == "start_tour"
    assert len(plan3["steps"]) > 0

    # 6. Form guidance: "Help me fill out this form"
    turn4_resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={
            "message": "Help me fill out this form",
            "page_revision": 1,
            "input_mode": "text",
        },
    )
    assert turn4_resp.status_code == 200
    plan4 = turn4_resp.json()
    assert plan4["intent"] == "guide_form_field"
    assert plan4["target_node_id"] == "node_contact_email"

    # 7. Grounding abstention: Ask for unknown fact (CEO phone number)
    turn5_resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={
            "message": "What is the CEO's personal cell phone number?",
            "page_revision": 1,
            "input_mode": "text",
        },
    )
    assert turn5_resp.status_code == 200
    plan5 = turn5_resp.json()
    assert plan5["intent"] == "unknown"
    assert "can't find" in plan5["answer"].lower() or "not" in plan5["answer"].lower()

    # 8. Delete session
    del_resp = client.delete(
        f"/v1/sessions/{session_id}",
        headers=auth_header,
    )
    assert del_resp.status_code == 200

def test_stale_revision_conflict():
    sess_resp = client.post(
        "/v1/sessions",
        headers={"Origin": "http://localhost:5173"},
        json={"widget_id": "test", "page_url": "http://localhost:5173"},
    )
    data = sess_resp.json()
    token = data["session_token"]
    session_id = data["session_id"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # Put manifest revision 2
    client.put(
        f"/v1/sessions/{session_id}/page-manifest",
        headers=auth_header,
        json={
            "page_id": "p1",
            "revision": 2,
            "content_hash": "sha256:11111111111111111111111111111111",
            "title": "Test",
            "url": "http://localhost:5173",
            "nodes": [],
        },
    )

    # Submit turn with stale revision 1 -> 409 PAGE_REVISION_STALE
    resp = client.post(
        f"/v1/sessions/{session_id}/turns",
        headers=auth_header,
        json={"message": "hello", "page_revision": 1},
    )
    assert resp.status_code == 409
    err = resp.json()
    assert err["error"]["code"] == "PAGE_REVISION_STALE"
