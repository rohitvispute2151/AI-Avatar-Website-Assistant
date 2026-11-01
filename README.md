# AI Avatar Website Assistant

> **Embeddable full-body 3D AI website guide** combining WebGL/Three.js rendering, multi-modal voice/text dialogue, real-time semantic DOM observation, and deterministic spatial navigation.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/Frontend-TypeScript_5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/3D-Three.js_r170-black.svg?logo=three.js&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Bundler-Vite_6-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 1. System Architecture & Engineering Tenets

Modern web assistants are typically limited to static floating chat bubbles that dump unstructured text. **AI Avatar Assistant** transforms websites into spatial, interactive environments through an embodied human-like guide that physically navigates, points to elements, and walks visitors through complex flows.

```
flowchart TD
    subgraph Browser ["Host Web Application (Browser)"]
        DOM["Host Webpage DOM"]
        Scanner["Page Scanner & Sanitizer"]
        Watcher["Mutation & Form Watcher"]
        Widget["Shadow DOM Custom Element (&lt;site-guide&gt;)"]
        Stage["Three.js 3D Avatar Stage"]
        Executor["Action & Navigation Actuator"]
    end

    subgraph Backend ["Stateless FastAPI Service"]
        Store["HMAC Session & Manifest Store"]
        Ranker["Semantic Node Ranker"]
        Planner["Structured Action Planner"]
        Verifier["Evidence & Safety Verifier"]
    end

    subgraph Providers ["AI Providers"]
        Groq["Groq API (Primary LLM)"]
        Gemini["Gemini API (Fallback LLM)"]
        TTS["Web Speech / TTS Engine"]
    end

    DOM -->|Scan visible tree| Scanner
    Scanner -->|Privacy-filtered manifest| Store
    Watcher -->|Live DOM mutations| Store
    Widget -->|User query (voice/text)| Planner
    Store --> Ranker
    Ranker --> Planner
    Planner --> Groq
    Groq -.->|Fallback on 429/503| Gemini
    Planner --> Verifier
    Verifier -->|Verified JSON Plan| Executor
    Executor -->|Smooth scroll & cubic bezier move| Stage
    Executor -->|Highlight target & badge| DOM
    Executor -->|Phoneme/amplitude lip-sync| TTS
```

### Core Architecture Principles

1. **LLM as Planner, Browser as Actuator:** The LLM is strictly constrained to a high-level action planner emitting typed JSON schemas. It has **zero direct access to the DOM** and cannot generate executable JavaScript, CSS selectors, arbitrary URLs, or DOM mutations.
2. **Deterministic Spatial Actuation:** The client-side browser runtime parses target node IDs, measures exact live bounding client rects, calculates collision-free viewport clearance anchors, executes smooth scrolling, and drives the 3D avatar rig.
3. **Strict Page Grounding & Hallucination Defense:** Every factual claim must carry an exact normalized evidence substring from a visible node in the active page revision. If evidence is missing, the backend verifier programmatically intercepts and abstains (*"I can't find that information on this page."*).
4. **Zero-PII & Non-Intrusive Form Safety:** The assistant guides visitors field-by-field and explains required inputs, but **never collects, reads, persists, or submits form values**. Keystrokes and passwords remain strictly isolated in the visitor's browser.
5. **CSS & Style Encapsulation:** The entire UI is packaged inside an isolated Web Component (`<site-guide>`) backed by an open **Shadow DOM**, eliminating CSS bleed between host applications and the widget.

---

## 2. Embedding into Any Web Page

You can integrate the AI Avatar Assistant into any web page in less than two minutes.

### Method A: HTML Script Tag (Zero Build Tools)

Add the pre-bundled standalone distribution script before the closing `</body>` tag of any HTML document:

```html
<!-- Load AI Avatar Guide -->
<script
  src="https://cdn.yourdomain.com/widget/site-guide.js"
  data-widget-id="demo-site-widget"
  data-api-base-url="http://localhost:8000"
  data-position="bottom-right"
  defer
></script>
```

### Method B: Modern JavaScript / TypeScript (ES Modules & React)

Install the widget package into your frontend project:

```bash
npm install @ai-avatar/widget
```

Initialize the guide programmatically during your application mount cycle:

```typescript
import { SiteGuide } from "@ai-avatar/widget";

// Initialize on app mount
const guide = SiteGuide.init({
  widgetId: "demo-site-widget",
  apiBaseUrl: "http://localhost:8000",
  position: "bottom-right",        // "bottom-right" | "bottom-left"
  locale: "en-US",
  voiceEnabled: true,
  onReady: () => {
    console.log("3D Avatar Guide initialized.");
  },
  onError: (err) => {
    console.warn("Avatar guide notice:", err);
  },
});

// Programmatic controls:
// guide.open();      // Open the dialogue shell
// guide.minimize();  // Collapse to floating companion capsule
// guide.destroy();   // Clean up WebGL contexts and listeners
```

#### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `widgetId` | `string` | **Required** | Tenant / site identifier for authentication and rate-limiting. |
| `apiBaseUrl` | `string` | `"http://localhost:8000"` | Root URL of the FastAPI planning backend service. |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Initial dock anchor on the viewport. |
| `locale` | `string` | `"en-US"` | BCP-47 language tag for speech synthesis and recognition. |
| `voiceEnabled` | `boolean` | `true` | Enables Web Speech API transcription and TTS audio playback. |
| `avatarAssetUrl` | `string?` | `undefined` | Optional external `.vrm` character model URL (falls back to procedural character). |


---

## 3. Local Development & Quickstart

### Prerequisites

- **Python 3.12+**
- **Node.js LTS (v20+)** and **npm**

### Step 1: Clone and Configure Environment

```bash
# Copy sample configuration
cp .env.example .env
cp services/api/.env.example services/api/.env
```

Ensure your `services/api/.env` has valid API credentials:

```dotenv
LLM_PROVIDER=groq
LLM_MODEL=qwen/qwen3.8-27b
GROQ_API_KEY=gsk_your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=cf2b96f2-8251-4bba-ba05-461bdca468c9
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173
```

### Step 2: Start the FastAPI Backend

```powershell
# Windows PowerShell
cd services\api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt  # or: pip install fastapi "uvicorn[standard]" pydantic python-multipart httpx pytest pytest-asyncio
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Linux / macOS
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pydantic python-multipart httpx pytest pytest-asyncio
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Interactive API Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check Endpoint:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Step 3: Run the Demo Frontend

In a separate terminal window:

```bash
# From the repository root
npm install
npm --workspace=@ai-avatar/demo-web run dev
```

Navigate to **`http://localhost:5173`** in your browser.

---

## 5. Automated Verification & Testing

The repository includes comprehensive backend unit test suites covering configuration validation, HMAC session generation, node candidate ranking, evidence verification, and plan validation.

```bash
cd services/api
.venv/Scripts/python -m pytest tests/test_unit.py -v
```

To build and verify TypeScript packages:

```bash
# Build widget SDK bundle
npm --workspace=@ai-avatar/widget run build

# Build demo web application
npm --workspace=@ai-avatar/demo-web run build
```

---

## 6. Supported Acceptance Scenarios

| Scenario | User Trigger | Assistant Behavior & Actuation |
|---|---|---|
| **1. Intro & Greeting** | Widget launch / "Hello" | Welcomes the visitor with animated wave and conversational prompt suggestions. |
| **2. Grounded Q&A** | *"What does this company do?"* | Answers concisely using verified page copy from the About landmark; executes `explain` gesture. |
| **3. Spatial Navigation** | *"Where can I sign up?"* | Smoothly scrolls to the CTA/form, moves widget to safe anchor, highlights target with text badge, and points directly at the button. |
| **4. Guided Page Tour** | *"Walk me through this page"* | Orchestrates sequential tour (Hero → About → Features → Pricing → Contact) with step-by-step narration and on-screen controls (Prev, Next, Stop). |
| **5. Form Assistance** | *"Help me fill out this form"* | Steps field-by-field through Name → Email → Company → Message; detects when inputs are filled and auto-advances to the next field. |
| **6. Honest Abstention** | *"What is the weather in Tokyo?"* | Identifies absence of page grounding; gracefully responds *"I can't check the weather for you, as I only guide you through this website."* |
| **7. Dynamic DOM Sync** | DOM mutation / Promo Toggle | `MutationObserver` detects dynamic content insertion, bumps manifest revision, and references the new content in subsequent answers without manual reload. |

---

## 7. Security, Privacy & Compliance

- **Signed Session Tokens:** Requests to `/v1/sessions/{id}/turns` require HMAC-SHA256 bearer tokens bound to the active session ID, tenant, and origin.
- **Microphone Security:** Audio capture is gated behind explicit user gesture (mic button click), restricted to 30-second bounded buffers, and tracks are terminated immediately upon speech completion.
- **Content Security Policy (CSP):** The widget is self-contained. Procedural canvas textures and Three.js shader programs operate without external asset dependencies or unsafe `eval()`.
- **Reduced Motion Support:** Respects `prefers-reduced-motion: reduce` OS settings by damping camera transitions and avatar locomotion weights to 25%.

---

## 8. License

Distributed under the **MIT License**. See `LICENSE` for details.
