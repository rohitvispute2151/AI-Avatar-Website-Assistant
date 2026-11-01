import { ChatController, ChatMessage, AssistantState } from "../conversation/chat-controller";
import { AvatarStage } from "../avatar/avatar-stage";
import { tourController } from "../conversation/tour-controller";
import { speechRecognizer } from "../voice/speech-recognition";
import { microphoneController } from "../voice/microphone-controller";

export class WidgetView {
  private shadowRoot: ShadowRoot;
  private chatController: ChatController;
  private stage: AvatarStage | null = null;
  private launcherBtn!: HTMLElement;
  private shell!: HTMLElement;
  private canvasWrap!: HTMLElement;
  private statusIndicator!: HTMLElement;
  private statusText!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputField!: HTMLInputElement;
  private micBtn!: HTMLElement;
  private sendBtn!: HTMLElement;
  private tourBar!: HTMLElement;
  private tourInfo!: HTMLElement;
  private isMinimized = false;
  private isRecording = false;

  constructor(shadowRoot: ShadowRoot, chatController: ChatController) {
    this.shadowRoot = shadowRoot;
    this.chatController = chatController;
    this.buildDom();
    this.bindEvents();
  }

  public setAvatarStage(stage: AvatarStage): void {
    this.stage = stage;
  }

  public getCanvasContainer(): HTMLElement {
    return this.canvasWrap;
  }

  private buildDom(): void {
    const root = document.createElement("div");
    root.className = "site-guide-root";

    root.innerHTML = `
      <!-- Launcher Button -->
      <button class="sg-launcher-btn sg-hidden" id="sg-launcher">
        <span>✨</span>
        <span>AI Website Guide</span>
      </button>

      <!-- Shell Window -->
      <div class="sg-shell sg-position-bottom-right" id="sg-shell">
        <!-- Header -->
        <div class="sg-header">
          <div class="sg-title-wrap">
            <div class="sg-status-indicator" id="sg-status-dot"></div>
            <span class="sg-title" id="sg-title-text">AI Guide</span>
          </div>
          <div class="sg-actions">
            <button class="sg-icon-btn sg-hidden" id="sg-btn-stop-speech" title="Stop Speaking" aria-label="Stop Speaking">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>
            <button class="sg-icon-btn" id="sg-btn-toggle-avatar" title="Collapse / Show Avatar" aria-label="Collapse / Show Avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            <button class="sg-icon-btn" id="sg-btn-minimize" title="Minimize" aria-label="Minimize">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
            </button>
            <button class="sg-icon-btn" id="sg-btn-close" title="Hide Guide" aria-label="Hide Guide">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Tour Toolbar -->
        <div class="sg-tour-bar sg-hidden" id="sg-tour-bar">
          <span id="sg-tour-info">Tour: Step 1</span>
          <div class="sg-tour-controls">
            <button class="sg-tour-btn" id="sg-tour-prev">Prev</button>
            <button class="sg-tour-btn" id="sg-tour-next">Next</button>
            <button class="sg-tour-btn" id="sg-tour-stop">Stop</button>
          </div>
        </div>

        <!-- 3D Avatar Canvas -->
        <div class="sg-avatar-canvas-wrap" id="sg-avatar-wrap" role="presentation" aria-hidden="true"></div>

        <!-- Messages Area -->
        <div class="sg-messages" id="sg-messages" aria-live="polite">
          <div class="sg-message assistant">
            Hello! I'm your interactive website guide. How can I help you explore today?
          </div>
        </div>

        <!-- Quick Prompts -->
        <div class="sg-quick-prompts">
          <button class="sg-quick-pill" data-prompt="What does this company do?">About Company</button>
          <button class="sg-quick-pill" data-prompt="Where can I sign up?">Sign Up</button>
          <button class="sg-quick-pill" data-prompt="Walk me through this page">Page Tour</button>
          <button class="sg-quick-pill" data-prompt="Help me fill out this form">Fill Form</button>
        </div>

        <!-- Input Bar -->
        <div class="sg-input-bar">
          <input type="text" class="sg-input" id="sg-input" placeholder="Ask a question or request a tour..." />
          <button class="sg-mic-btn" id="sg-btn-mic" title="Voice Input" aria-label="Voice Input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button class="sg-send-btn" id="sg-btn-send" title="Send Message" aria-label="Send Message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(root);

    this.launcherBtn = this.shadowRoot.getElementById("sg-launcher")!;
    this.shell = this.shadowRoot.getElementById("sg-shell")!;
    this.canvasWrap = this.shadowRoot.getElementById("sg-avatar-wrap")!;
    this.statusIndicator = this.shadowRoot.getElementById("sg-status-dot")!;
    this.statusText = this.shadowRoot.getElementById("sg-title-text")!;
    this.messagesContainer = this.shadowRoot.getElementById("sg-messages")!;
    this.inputField = this.shadowRoot.getElementById("sg-input") as HTMLInputElement;
    this.micBtn = this.shadowRoot.getElementById("sg-btn-mic")!;
    this.sendBtn = this.shadowRoot.getElementById("sg-btn-send")!;
    this.tourBar = this.shadowRoot.getElementById("sg-tour-bar")!;
    this.tourInfo = this.shadowRoot.getElementById("sg-tour-info")!;
  }

  private bindEvents(): void {
    // Send message on click
    this.sendBtn.addEventListener("click", () => this.handleSend());

    // Send on Enter
    this.inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSend();
      }
    });

    // Quick prompt pills
    this.shadowRoot.querySelectorAll(".sg-quick-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const prompt = pill.getAttribute("data-prompt");
        if (prompt) {
          this.chatController.sendMessage(prompt);
        }
      });
    });

    // Toggle Avatar Canvas Visibility
    this.shadowRoot.getElementById("sg-btn-toggle-avatar")?.addEventListener("click", () => {
      this.canvasWrap.classList.toggle("collapsed");
    });

    // Minimize & Close
    this.shadowRoot.getElementById("sg-btn-minimize")?.addEventListener("click", () => this.minimize());
    this.shadowRoot.getElementById("sg-btn-close")?.addEventListener("click", () => this.hide());
    this.launcherBtn.addEventListener("click", () => this.open());

    // Tour controls
    this.shadowRoot.getElementById("sg-tour-next")?.addEventListener("click", () => tourController.next());
    this.shadowRoot.getElementById("sg-tour-prev")?.addEventListener("click", () => tourController.previous());
    this.shadowRoot.getElementById("sg-tour-stop")?.addEventListener("click", () => {
      tourController.stop();
      this.tourBar.classList.add("sg-hidden");
    });

    // Stop speaking button
    this.shadowRoot.getElementById("sg-btn-stop-speech")?.addEventListener("click", () => {
      this.chatController.stop();
    });

    // Escape key handler on widget shell (LLD §12.2)
    this.shell.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (tourController.getStatus() === "running") {
          tourController.stop();
          this.tourBar.classList.add("sg-hidden");
        } else {
          this.minimize();
        }
      }
    });

    // Mic button
    this.micBtn.addEventListener("click", () => this.toggleVoice());
  }

  private async handleSend(): Promise<void> {
    const text = this.inputField.value;
    if (!text.trim()) return;
    this.inputField.value = "";
    await this.chatController.sendMessage(text);
  }

  private async toggleVoice(): Promise<void> {
    if (this.isRecording) {
      // Stop recording
      this.isRecording = false;
      this.micBtn.classList.remove("recording");
      speechRecognizer.stop();
      const blob = await microphoneController.stopRecording();
      if (blob) {
        // Can send audio to backend STT if browser recognition didn't fire
      }
    } else {
      // Start recording
      this.isRecording = true;
      this.micBtn.classList.add("recording");
      this.updateStatus("listening");

      if (speechRecognizer.isSupported()) {
        speechRecognizer.start(
          "en-US",
          (transcript) => {
            this.isRecording = false;
            this.micBtn.classList.remove("recording");
            if (transcript) {
              this.chatController.sendMessage(transcript, "voice_transcript");
            }
          },
          (err) => {
            this.isRecording = false;
            this.micBtn.classList.remove("recording");
            console.warn("Speech recognition error:", err);
            this.updateStatus("idle");
          },
          () => {
            this.isRecording = false;
            this.micBtn.classList.remove("recording");
            this.updateStatus("idle");
          }
        );
      } else {
        try {
          await microphoneController.startRecording();
        } catch (e: any) {
          this.isRecording = false;
          this.micBtn.classList.remove("recording");
          alert(e.message || "Microphone access denied.");
        }
      }
    }
  }

  public updateMessages(messages: ChatMessage[]): void {
    this.messagesContainer.innerHTML = "";
    messages.forEach((msg) => {
      const el = document.createElement("div");
      el.className = `sg-message ${msg.sender}`;
      el.textContent = msg.text;
      this.messagesContainer.appendChild(el);
    });
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  public updateStatus(state: AssistantState): void {
    if (this.stage) {
      this.stage.setState(state);
    }
    this.statusIndicator.className = "sg-status-indicator";
    if (state !== "idle") {
      this.statusIndicator.classList.add(state);
    }

    const labels: Record<AssistantState, string> = {
      idle: "AI Guide",
      listening: "Listening...",
      thinking: "Thinking...",
      speaking: "Speaking...",
      tour: "Page Tour",
      error: "Error",
    };
    this.statusText.textContent = labels[state] || "AI Guide";

    // Toggle stop speaking control
    const stopSpeechBtn = this.shadowRoot.getElementById("sg-btn-stop-speech");
    if (stopSpeechBtn) {
      if (state === "speaking") {
        stopSpeechBtn.classList.remove("sg-hidden");
      } else {
        stopSpeechBtn.classList.add("sg-hidden");
      }
    }

    // Show / hide tour toolbar
    if (tourController.getStatus() === "running") {
      this.tourBar.classList.remove("sg-hidden");
      this.tourInfo.textContent = `Tour: Step ${tourController.getCurrentIndex() + 1} of ${tourController.getTotalSteps()}`;
    } else {
      this.tourBar.classList.add("sg-hidden");
    }
  }

  public minimize(): void {
    this.isMinimized = true;
    this.shell.classList.add("sg-hidden");
    this.launcherBtn.classList.remove("sg-hidden");
    if (this.stage) this.stage.pause();
  }

  public open(): void {
    this.isMinimized = false;
    this.shell.classList.remove("sg-hidden");
    this.launcherBtn.classList.add("sg-hidden");
    if (this.stage) this.stage.resume();
  }

  public hide(): void {
    this.minimize();
  }
}

