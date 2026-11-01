from typing import Literal, Optional, List
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class PageNodeIn(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    parent_id: Optional[str] = None
    section_id: Optional[str] = None
    role: Literal[
        "page", "section", "heading", "text", "link", "button",
        "form", "form-field", "other-control"
    ]
    tag_name: str = Field(max_length=30)
    accessible_name: str = Field(max_length=500)
    text: str = Field(max_length=2000)
    purpose: Optional[str] = Field(default=None, max_length=240)
    href: Optional[str] = Field(default=None, max_length=2048)
    input_type: Optional[str] = Field(default=None, max_length=40)
    required: Optional[bool] = None
    disabled: Optional[bool] = None
    visible: bool = True
    aria_invalid: Optional[bool] = None
    form_state: Optional[Literal["empty", "filled", "invalid", "unknown"]] = None

class PageManifestIn(StrictModel):
    page_id: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=1)
    content_hash: str = Field(min_length=16, max_length=128)
    title: str = Field(max_length=240)
    url: str = Field(max_length=2048)
    locale: Optional[str] = Field(default=None, max_length=30)
    nodes: List[PageNodeIn] = Field(max_length=250)

class TurnRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    page_revision: int = Field(ge=1)
    input_mode: Literal["text", "voice_transcript"] = "text"

class EvidenceRef(StrictModel):
    node_id: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=1, max_length=400)

class PlannedStep(StrictModel):
    target_node_id: str = Field(min_length=1, max_length=80)
    spoken_text: str = Field(max_length=240)
    gesture: Literal["none", "open_palm", "point_left", "point_right", "explain"]
    step_kind: Literal["section", "form_field", "control"]

class TurnPlanOut(StrictModel):
    turn_id: str
    answer: str = Field(max_length=600)
    intent: Literal[
        "answer", "navigate_to_node", "start_tour",
        "guide_form_field", "stop", "unknown"
    ]
    target_node_id: Optional[str] = None
    gesture: Literal["none", "open_palm", "point_left", "point_right", "explain"]
    steps: List[PlannedStep] = Field(default_factory=list, max_length=20)
    evidence: List[EvidenceRef] = Field(default_factory=list, max_length=8)
    confidence: float = Field(ge=0.0, le=1.0)
    page_revision: int = Field(ge=1)
    should_speak: bool = True

class SessionCapabilities(StrictModel):
    text: bool = True
    voice: bool = True
    tts: bool = True
    guided_tour: bool = True

class SessionCreateIn(StrictModel):
    widget_id: str = Field(min_length=1, max_length=100)
    page_url: str = Field(max_length=2048)
    locale: Optional[str] = Field(default="en-US", max_length=30)

class SessionCreateOut(StrictModel):
    session_id: str
    session_token: str
    expires_in_seconds: int
    capabilities: SessionCapabilities

class PageManifestAcceptedOut(StrictModel):
    accepted: bool
    revision: int
    content_hash: str
    node_count: int

class TranscriptionOut(StrictModel):
    transcript: str
    language: str
    duration_ms: int

class SpeechRequestIn(StrictModel):
    text: str = Field(min_length=1, max_length=1000)
    locale: Optional[str] = Field(default="en-US", max_length=30)
    voice_profile: Optional[str] = Field(default="default", max_length=50)

