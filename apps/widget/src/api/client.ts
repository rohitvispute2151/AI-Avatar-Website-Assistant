import { PageManifest, TurnPlan } from "../page/manifest";

export interface SessionResponse {
  session_id: string;
  session_token: string;
  expires_in_seconds: number;
  capabilities: {
    text: boolean;
    voice: boolean;
    tts: boolean;
    guided_tour: boolean;
  };
}

export class ApiClient {
  private apiBaseUrl: string;
  private sessionId: string | null = null;
  private sessionToken: string | null = null;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  }

  public setSession(id: string, token: string): void {
    this.sessionId = id;
    this.sessionToken = token;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public async createSession(widgetId: string, pageUrl: string, locale: string = "en-US"): Promise<SessionResponse> {
    const res = await fetch(`${this.apiBaseUrl}/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        widget_id: widgetId,
        page_url: pageUrl,
        locale,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to create session (${res.status})`);
    }

    const data: SessionResponse = await res.json();
    this.sessionId = data.session_id;
    this.sessionToken = data.session_token;
    return data;
  }

  public async upsertManifest(manifest: PageManifest): Promise<void> {
    if (!this.sessionId || !this.sessionToken) {
      throw new Error("Cannot upsert manifest: no active session.");
    }

    // Convert camelCase to snake_case for Python FastAPI models
    const payload = {
      page_id: manifest.pageId,
      revision: manifest.revision,
      content_hash: manifest.contentHash,
      title: manifest.title,
      url: manifest.url,
      locale: manifest.locale,
      nodes: manifest.nodes.map((n) => ({
        id: n.id,
        parent_id: n.parentId,
        section_id: n.sectionId,
        role: n.role,
        tag_name: n.tagName,
        accessible_name: (n.accessibleName || "").slice(0, 240),
        text: (n.text || "").slice(0, 700),
        purpose: n.purpose ? n.purpose.slice(0, 240) : undefined,
        href: n.href,
        input_type: n.inputType,
        required: n.required,
        disabled: n.disabled,
        visible: n.visible,
        aria_invalid: n.ariaInvalid,
        form_state: n.formState,
      })),
    };

    const res = await fetch(`${this.apiBaseUrl}/v1/sessions/${this.sessionId}/page-manifest`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Manifest update failed (${res.status})`);
    }
  }

  public async submitTurn(
    message: string,
    pageRevision: number,
    inputMode: "text" | "voice_transcript" = "text"
  ): Promise<TurnPlan> {
    if (!this.sessionId || !this.sessionToken) {
      throw new Error("Cannot submit turn: no active session.");
    }

    const res = await fetch(`${this.apiBaseUrl}/v1/sessions/${this.sessionId}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify({
        message,
        page_revision: pageRevision,
        input_mode: inputMode,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const code = err?.error?.code;
      const error = new Error(err?.error?.message || `Turn failed (${res.status})`);
      if (code) {
        (error as any).code = code;
      }
      throw error;
    }

    const data = await res.json();
    return {
      turnId: data.turn_id,
      answer: data.answer,
      intent: data.intent,
      targetNodeId: data.target_node_id,
      gesture: data.gesture,
      steps: (data.steps || []).map((s: any) => ({
        targetNodeId: s.target_node_id,
        spokenText: s.spoken_text,
        gesture: s.gesture,
        stepKind: s.step_kind,
      })),
      evidence: (data.evidence || []).map((e: any) => ({
        nodeId: e.node_id,
        quote: e.quote,
      })),
      confidence: data.confidence,
      pageRevision: data.page_revision,
      shouldSpeak: data.should_speak ?? true,
    };
  }

  public async transcribeAudio(audioBlob: Blob, locale: string = "en"): Promise<string> {
    if (!this.sessionId || !this.sessionToken) {
      throw new Error("Cannot transcribe audio: no active session.");
    }

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("locale", locale);

    const res = await fetch(`${this.apiBaseUrl}/v1/sessions/${this.sessionId}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Audio transcription failed (${res.status})`);
    }

    const data = await res.json();
    return data.transcript;
  }

  public async deleteSession(): Promise<void> {
    if (!this.sessionId || !this.sessionToken) return;
    try {
      await fetch(`${this.apiBaseUrl}/v1/sessions/${this.sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
        },
      });
    } catch {
      // Ignore network errors on session end
    } finally {
      this.sessionId = null;
      this.sessionToken = null;
    }
  }
}

