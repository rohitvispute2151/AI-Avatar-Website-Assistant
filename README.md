# AI Avatar Website Assistant

> An embeddable full-body 3D AI website guide combining Three.js/VRM rendering, voice/text conversation, live semantic DOM mapping, and grounded spatial navigation.

---

## 1. Executive Summary & Architecture

The **AI Avatar Website Assistant** provides a deterministic, privacy-first website companion. The browser observes the host page and sends a privacy-filtered, structured page manifest to the FastAPI backend. The backend uses an LLM to interpret the visitor's request against that manifest and returns a validated, typed action plan.

The browser, not the LLM, resolves target IDs to live DOM elements, scrolls, repositions the avatar stage, highlights the target, and runs the matching animation.

### Key Architecture Principles
1. **LLM as Planner, Browser as Actuator:** The LLM cannot emit JavaScript, CSS selectors, arbitrary URLs, DOM mutations, form values, clicks, or submission commands.
2. **Page-Grounded Answers:** Every factual answer carries page-node evidence; unsupported requests get an explicit fallback ("I can't find that information on this page.").
3. **No Silent Form Actions:** The avatar points to fields and explains them; it never collects input values, types into fields, or submits forms.
4. **Isolated Embedding:** Custom Element (`<site-guide>`) with Shadow DOM prevents host CSS collision.

---

## 2. Repository Layout

```text
ai-avatar-assistant/
├── apps/
│   ├── demo-web/                       # React + Vite demonstration SPA
│   │   ├── src/
│   │   │   ├── components/             # Hero, About, Features, Pricing, Contact
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── index.html
│   └── widget/                         # Framework-neutral embeddable widget
│       ├── src/
│       │   ├── bootstrap.ts            # SiteGuide.init / destroy
│       │   ├── custom-element.ts       # <site-guide> + Shadow DOM
│       │   ├── api/client.ts           # REST API client
│       │   ├── page/                   # Scanner, Manifest, MutationWatcher, FormWatcher
│       │   ├── navigation/             # ActionExecutor, AnchorLayout, Highlighter, Scroller
│       │   ├── avatar/                 # Three.js AvatarStage, VRM Loader, LipSync
│       │   └── voice/                  # SpeechSynthesis, SpeechRecognition, MicController
│       └── package.json
├── services/
│   └── api/                            # Python FastAPI modular monolith
│       ├── app/
│       │   ├── main.py
│       │   ├── api/v1/routes.py        # Sessions, Manifest, Turns, Audio
│       │   ├── auth/security.py        # Origin and HMAC signed session token guards
│       │   ├── page/                   # Schemas, Sanitizer, Store, Ranker
│       │   ├── planner/                # Prompts, Verifier
│       │   └── providers/              # LLM (Mock, Gemini, OpenAI), STT, TTS
│       ├── tests/                      # Pytest unit & integration test suite
│       └── pyproject.toml
├── docs/
│   ├── ai_avatar_hld.md                # High-Level Design document
│   └── ai_avatar_lld.md                # Low-Level Design document
├── infra/
│   └── docker-compose.yml
├── .env.example
└── README.md
```

---

## 3. Quickstart & Local Setup

### Prerequisites
- **Python 3.12+**
- **Node.js LTS (v20+)** and npm

### 3.1 Start Backend API
```bash
cd services/api

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install fastapi "uvicorn[standard]" pydantic python-multipart httpx pytest

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

### 3.2 Run Backend Unit Tests
```bash
cd services/api
.venv\Scripts\python -m pytest tests/test_unit.py
```

### 3.3 Start Demo Web App
```bash
# In another terminal:
cd apps/demo-web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. How to Embed on Any Website

### Option A: HTML Script Tag
```html
<script
  src="https://cdn.yourdomain.com/widget/site-guide.js"
  data-widget-id="prod-widget-id"
  data-api-base-url="https://api.yourdomain.com"
  defer
></script>
```

### Option B: Programmatic Initialization (ES Modules)
```javascript
import { SiteGuide } from "@ai-avatar/widget";

const guide = SiteGuide.init({
  widgetId: "my-tenant-id",
  apiBaseUrl: "https://api.yourdomain.com",
  position: "bottom-right",
  locale: "en-US",
  voiceEnabled: true,
  theme: "dark",
  onReady: () => console.log("Avatar guide is ready!"),
});

// Programmatic controls:
// guide.open();
// guide.minimize();
// guide.hide();
// guide.destroy();
```

---

## 5. Security & Privacy Posture

- **Prompt Injection Defense:** Page DOM content is treated strictly as untrusted quoted data, never as system instructions.
- **Action Allowlist:** Only `answer`, `navigate_to_node`, `start_tour`, `guide_form_field`, `stop`, and `unknown` are executable.
- **Zero Form Writes:** The assistant never inputs values into textboxes or clicks submit.
- **Privacy by Default:** Keystrokes, passwords, and form field values are never captured, logged, or sent to backend providers.
- **Evidence Verification:** Every factual answer must contain an exact normalized substring evidence quote from a currently visible node in the page manifest.

### Privacy Notice: Microphone & External AI Providers (LLD §14, §20)
- **Microphone Capture:** Audio recording is activated solely upon an explicit user action (clicking the microphone button). Recording is capped at 30 seconds and visual cues ("Listening...") are displayed in real time. Media tracks are stopped immediately upon turn completion, and raw audio is never stored in browser storage (`localStorage`, `sessionStorage`, `IndexedDB`) or logged.
- **External AI Providers:** Visitor queries and sanitized public page text are transmitted via authenticated HTTPS/TLS to the planning backend. Form values, passwords, cookies, authorization tokens, and personal form inputs are strictly excluded from transmission.

---

## 6. Acceptance Scenarios Supported

| Scenario | User Input | Assistant Action |
|---|---|---|
| **Greeting** | "Hello" / Open widget | Greets visitor using hero context, open palm gesture. |
| **Company Info** | "What does this company do?" | Concise explanation grounded in About section with valid evidence. |
| **Navigation** | "Where can I sign up?" | Smoothly scrolls to CTA, avatar relocates, points right, and highlights button. |
| **Guided Tour** | "Walk me through this page" | Sequenced tour of Hero → About → Features → Pricing → Contact. |
| **Form Help** | "Help me fill out this form" | Points to the first form field, explains purpose, observes coarse state. |
| **Grounding Test** | "What is the CEO's phone number?" | Abstains: *"I can't find that information on this page."* |
| **Live DOM Updates** | Click "Simulate Live DOM Update" | MutationObserver detects DOM changes, updates manifest revision, and answers using new copy. |

