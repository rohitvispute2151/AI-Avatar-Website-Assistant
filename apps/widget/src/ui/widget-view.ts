import { ChatController, ChatMessage, AssistantState } from "../conversation/chat-controller";
import { AvatarStage } from "../avatar/avatar-stage";
import { tourController, TourEngineState, TourProgress, TourStop } from "../conversation/tour-controller";
import { speechRecognizer } from "../voice/speech-recognition";
import { microphoneController } from "../voice/microphone-controller";
import { audioPlayer } from "../voice/audio-player";
import { ExploreModeController } from "../avatar/explore-controller";

export interface WidgetViewOptions {
  avatarVisible?: boolean;
  chatOpen?: boolean;
}

export class WidgetView {
  private shadowRoot: ShadowRoot;
  private chatController: ChatController;
  private stage: AvatarStage | null = null;
  private exploreController: ExploreModeController | null = null;

  // DOM Elements
  private launcherBtn: HTMLElement | null = null;
  private avatarLayer!: HTMLElement;
  private canvasWrap!: HTMLElement;
  private shell!: HTMLElement;
  private statusIndicator!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputField!: HTMLInputElement;
  private micBtn!: HTMLElement;
  private sendBtn!: HTMLElement;

  // Speech Bubble Elements (attached to Avatar)
  private speechBubble!: HTMLElement;
  private speechTextEl!: HTMLElement;
  private speechInstructionEl!: HTMLElement;
  private speechTypingEl!: HTMLElement;

  // Tour Minimal HUD Elements
  private tourBar!: HTMLElement;
  private tourInfo!: HTMLElement;
  private tourProgressBar!: HTMLElement;
  private tourPlayPauseBtn!: HTMLElement;
  private tourPrevBtn!: HTMLElement;
  private tourNextBtn!: HTMLElement;
  private tourExploreBtn!: HTMLElement;
  private tourMuteBtn!: HTMLElement;
  private tourStopBtn!: HTMLElement;

  // Free Roam / Explore Mode HUD
  private exploreBar!: HTMLElement;
  private exploreResumeBtn!: HTMLElement;
  private exploreExitBtn!: HTMLElement;

  // Floating Dock Elements
  private toggleAvatarBtn: HTMLElement | null = null;
  private dockBar!: HTMLElement;
  private dockGuideBtn!: HTMLElement;
  private dockMicBtn!: HTMLElement;
  private dockChatBtn!: HTMLElement;

  // Independent Visibility States (Default: Chat closed, operates with recorder only)
  private avatarVisible: boolean = true;
  private chatOpen: boolean = false;
  private isRecording: boolean = false;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private dotColors = [
    "#ec4899", // pink/magenta
    "#10b981", // bright emerald green
    "#3b82f6", // electric blue
    "#a855f7", // vivid purple
    "#06b6d4", // cyan
    "#f59e0b", // warm amber
  ];

  constructor(
    shadowRoot: ShadowRoot,
    chatController: ChatController,
    options: WidgetViewOptions = {}
  ) {
    this.shadowRoot = shadowRoot;
    this.chatController = chatController;
    if (options.avatarVisible !== undefined) this.avatarVisible = options.avatarVisible;
    if (options.chatOpen !== undefined) this.chatOpen = options.chatOpen;

    this.buildDom();
    this.bindEvents();
    this.applyVisibilityState();
  }

  public setAvatarStage(stage: AvatarStage): void {
    this.stage = stage;
    if (!this.avatarVisible) {
      this.stage.pause();
    }

    // Initialize ExploreModeController with avatar stage and layer container
    this.exploreController = new ExploreModeController(this.stage, {
      onStateChange: (active: boolean) => this.handleExploreStateChange(active),
    });
    this.exploreController.setAvatarElement(this.avatarLayer);
  }

  public getExploreController(): ExploreModeController | null {
    return this.exploreController;
  }

  public getCanvasContainer(): HTMLElement {
    return this.canvasWrap;
  }

  private buildDom(): void {
    const root = document.createElement("div");
    root.className = "site-guide-root";

    root.innerHTML = `
      <!-- Independent 3D Avatar Layer (Rendered in front of chat, z-index: 1000000) -->
      <div class="sg-avatar-layer beside-chat" id="sg-avatar-layer">
        <!-- 3D Avatar Speech Bubble Attached to Guide -->
        <div class="sg-avatar-speech-bubble sg-hidden" id="sg-speech-bubble" role="status" aria-live="polite">
          <div class="sg-bubble-header">
            <span class="sg-bubble-tag">✨ Ava Guide</span>
            <div class="sg-bubble-typing sg-hidden" id="sg-speech-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="sg-bubble-content" id="sg-speech-text"></div>
          <div class="sg-bubble-instruction sg-hidden" id="sg-speech-instruction"></div>
        </div>

        <div class="sg-avatar-canvas-wrap" id="sg-avatar-wrap" role="presentation" aria-hidden="true"></div>
      </div>

      <!-- Floating Dock (AI Guide Button + Audio Recorder + Chat Toggle) -->
      <div class="sg-dock-bar" id="sg-dock-bar">
        <!-- AI Guide Button (Visible by default; toggles avatar; when avatar hidden, mic/chat hide) -->
        <button class="sg-dock-guide-btn" id="sg-dock-guide" title="Toggle AI Guide Avatar" aria-label="Toggle AI Guide Avatar">
          <span>✨</span>
          <span>AI Guide</span>
        </button>

        <!-- Audio Recorder Button (Besides AI Guide button) -->
        <button class="sg-dock-btn" id="sg-dock-mic" title="Voice Input (Tap to speak)" aria-label="Voice Input">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        <!-- Chat Toggle Button (Besides Mic button) -->
        <button class="sg-dock-btn" id="sg-dock-chat" title="Open Chat" aria-label="Toggle Chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      <!-- Upgraded Minimal Tour HUD Toolbar (floating above dock) -->
      <div class="sg-tour-bar sg-hidden" id="sg-tour-bar">
        <div class="sg-tour-header">
          <span class="sg-tour-badge">GUIDED TOUR</span>
          <span class="sg-tour-info" id="sg-tour-info">Step 1 of 5</span>
        </div>
        <div class="sg-tour-progress-track">
          <div class="sg-tour-progress-fill" id="sg-tour-progress-fill"></div>
        </div>
        <div class="sg-tour-controls">
          <button class="sg-tour-btn" id="sg-tour-prev" title="Previous Stop (Left Arrow)">◀ Prev</button>
          <button class="sg-tour-btn sg-tour-btn-primary" id="sg-tour-play-pause" title="Pause / Resume (Space)">❚❚ Pause</button>
          <button class="sg-tour-btn" id="sg-tour-next" title="Next Stop (Right Arrow)">Next ▶</button>
          <button class="sg-tour-btn sg-tour-explore-btn" id="sg-tour-explore" title="Free Roam Explore (E)">🎮 Explore</button>
          <button class="sg-tour-btn sg-tour-mute-btn" id="sg-tour-mute" title="Toggle Mute (M)">🔊</button>
          <button class="sg-tour-btn sg-tour-close-btn" id="sg-tour-stop" title="End Tour (Esc)">✕</button>
        </div>
      </div>

      <!-- Explore Mode HUD Overlay -->
      <div class="sg-explore-bar sg-hidden" id="sg-explore-bar">
        <span class="sg-explore-pill">🎮 FREE ROAM</span>
        <span class="sg-explore-hint">WASD / Arrow Keys to walk • Space to Jump</span>
        <button class="sg-tour-btn sg-tour-btn-primary" id="sg-explore-resume" title="Resume Guided Tour">Resume Tour</button>
        <button class="sg-tour-btn sg-tour-close-btn" id="sg-explore-exit" title="Exit Explore Mode">✕ Exit</button>
      </div>

      <!-- Independent Chat Panel (Rendered on right, z-index: 1000000) -->
      <div class="sg-chat-panel sg-hidden" id="sg-shell">
        
        <!-- Top Row Suggestions -->
        <div class="sg-quick-suggestions">
          <button class="sg-pill-primary sg-quick-pill" data-prompt="Say hello 👋">Say hello 👋</button>
          <button class="sg-pill-secondary sg-quick-pill" data-prompt="What does this company do?">About Company</button>
          <button class="sg-pill-secondary sg-quick-pill" data-prompt="Walk me through this page">Page Tour</button>
          <button class="sg-pill-secondary" id="sg-btn-not-now">Not now</button>
          <div class="sg-status-indicator" id="sg-status-dot" title="Assistant Status: Ready"></div>
        </div>

        <!-- Frosted Glass Messages Card -->
        <div class="sg-messages-card" id="sg-messages" aria-live="polite">
          <div class="sg-message-item assistant">
            <div class="sg-msg-dot" style="background: #3b82f6; box-shadow: 0 0 10px #3b82f6;"></div>
            <div class="sg-bubble assistant">
              Hello! I'm your interactive website guide. How can I help you explore today?
            </div>
          </div>
        </div>

        <!-- Pill Input Bar (Image 2 Reference Layout) -->
        <div class="sg-input-pill" id="sg-input-bar">
          <!-- Left Circular Mic Button -->
          <button class="sg-mic-btn" id="sg-btn-mic" title="Voice Input (Push to Talk)" aria-label="Voice Input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <!-- Text Input Field -->
          <input 
            type="text" 
            class="sg-input" 
            id="sg-input" 
            placeholder="Ask Ava or tap the mic." 
            autocomplete="off"
          />

          <!-- Send Arrow Button -->
          <button class="sg-send-btn" id="sg-btn-send" title="Send Message" aria-label="Send Message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>

          <div class="sg-pill-divider"></div>

          <!-- Actions Group with balanced spacing -->
          <div class="sg-pill-actions">
            <!-- Avatar Visibility Toggle Button (Independent State) -->
            <button class="sg-action-icon active" id="sg-btn-toggle-avatar" title="Hide 3D Avatar" aria-label="Toggle 3D Avatar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>

            <!-- Minimize Chat Button (Closes chat, leaves avatar visible) -->
            <button class="sg-action-icon" id="sg-btn-minimize" title="Minimize Chat" aria-label="Minimize Chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            <!-- Close Chat Button -->
            <button class="sg-action-icon" id="sg-btn-close" title="Close Chat" aria-label="Close Chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    `;

    this.shadowRoot.appendChild(root);

    this.launcherBtn = this.shadowRoot.getElementById("sg-launcher");
    this.avatarLayer = this.shadowRoot.getElementById("sg-avatar-layer")!;
    this.canvasWrap = this.shadowRoot.getElementById("sg-avatar-wrap")!;
    this.shell = this.shadowRoot.getElementById("sg-shell")!;
    this.statusIndicator = this.shadowRoot.getElementById("sg-status-dot")!;
    this.messagesContainer = this.shadowRoot.getElementById("sg-messages")!;
    this.inputField = this.shadowRoot.getElementById("sg-input") as HTMLInputElement;
    this.micBtn = this.shadowRoot.getElementById("sg-btn-mic")!;
    this.sendBtn = this.shadowRoot.getElementById("sg-btn-send")!;

    // Speech Bubble bindings
    this.speechBubble = this.shadowRoot.getElementById("sg-speech-bubble")!;
    this.speechTextEl = this.shadowRoot.getElementById("sg-speech-text")!;
    this.speechInstructionEl = this.shadowRoot.getElementById("sg-speech-instruction")!;
    this.speechTypingEl = this.shadowRoot.getElementById("sg-speech-typing")!;

    // Tour Bar bindings
    this.tourBar = this.shadowRoot.getElementById("sg-tour-bar")!;
    this.tourInfo = this.shadowRoot.getElementById("sg-tour-info")!;
    this.tourProgressBar = this.shadowRoot.getElementById("sg-tour-progress-fill")!;
    this.tourPlayPauseBtn = this.shadowRoot.getElementById("sg-tour-play-pause")!;
    this.tourPrevBtn = this.shadowRoot.getElementById("sg-tour-prev")!;
    this.tourNextBtn = this.shadowRoot.getElementById("sg-tour-next")!;
    this.tourExploreBtn = this.shadowRoot.getElementById("sg-tour-explore")!;
    this.tourMuteBtn = this.shadowRoot.getElementById("sg-tour-mute")!;
    this.tourStopBtn = this.shadowRoot.getElementById("sg-tour-stop")!;

    // Explore Bar bindings
    this.exploreBar = this.shadowRoot.getElementById("sg-explore-bar")!;
    this.exploreResumeBtn = this.shadowRoot.getElementById("sg-explore-resume")!;
    this.exploreExitBtn = this.shadowRoot.getElementById("sg-explore-exit")!;

    // Dock Bar bindings
    this.toggleAvatarBtn = this.shadowRoot.getElementById("sg-btn-toggle-avatar");
    this.dockBar = this.shadowRoot.getElementById("sg-dock-bar")!;
    this.dockGuideBtn = this.shadowRoot.getElementById("sg-dock-guide")!;
    this.dockMicBtn = this.shadowRoot.getElementById("sg-dock-mic")!;
    this.dockChatBtn = this.shadowRoot.getElementById("sg-dock-chat")!;
  }

  private bindEvents(): void {
    // Dock Button Events
    this.dockGuideBtn.addEventListener("click", () => this.toggleAvatar());
    this.dockMicBtn.addEventListener("click", () => this.toggleVoice());
    this.dockChatBtn.addEventListener("click", () => this.toggleChat());

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

    // "Not now" button closes chat window (avatar stays visible)
    this.shadowRoot.getElementById("sg-btn-not-now")?.addEventListener("click", () => {
      this.closeChat();
    });

    // Toggle Avatar visibility button (Independent of chat state)
    this.toggleAvatarBtn?.addEventListener("click", () => {
      this.toggleAvatar();
    });

    // Minimize & Close buttons close the chat panel only
    this.shadowRoot.getElementById("sg-btn-minimize")?.addEventListener("click", () => this.closeChat());
    this.shadowRoot.getElementById("sg-btn-close")?.addEventListener("click", () => this.closeChat());

    // Launcher button reopens chat (if present)
    this.launcherBtn?.addEventListener("click", () => {
      this.openChat();
    });

    // Upgraded Tour HUD Controls
    this.tourNextBtn.addEventListener("click", () => tourController.next());
    this.tourPrevBtn.addEventListener("click", () => tourController.previous());
    this.tourPlayPauseBtn.addEventListener("click", () => this.handleTourPlayPause());
    this.tourExploreBtn.addEventListener("click", () => this.handleStartExplore());
    this.tourMuteBtn.addEventListener("click", () => this.handleToggleMute());
    this.tourStopBtn.addEventListener("click", () => this.handleTourStop());

    // Explore Mode HUD Controls
    this.exploreResumeBtn.addEventListener("click", () => {
      this.exploreController?.disable();
      tourController.resume();
    });
    this.exploreExitBtn.addEventListener("click", () => {
      this.exploreController?.disable();
    });

    // Global keyboard shortcuts for hands-free interactive experience
    this.keydownHandler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      const code = e.code || e.key;

      if (code === "Escape") {
        if (this.exploreController?.isRunning()) {
          this.exploreController.disable();
          return;
        }
        if (tourController.getStatus() === "running" || tourController.getState() === "paused") {
          this.handleTourStop();
          return;
        }
        if (this.chatOpen) {
          this.closeChat();
        }
        return;
      }

      // 'KeyE' toggles free roam exploration mode
      if (code === "KeyE" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.exploreController?.isRunning()) {
          this.exploreController.disable();
        } else if (this.avatarVisible) {
          if (tourController.getStatus() === "running") {
            tourController.pause();
          }
          this.exploreController?.enable();
        }
        return;
      }

      // 'KeyM' toggles speech audio mute
      if (code === "KeyM" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.handleToggleMute();
        return;
      }

      // Left/Right arrow keys navigate tour steps
      if (tourController.getStatus() === "running" || tourController.getState() === "paused") {
        if (code === "ArrowLeft") {
          e.preventDefault();
          tourController.previous();
        } else if (code === "ArrowRight") {
          e.preventDefault();
          tourController.next();
        }
      }
    };
    window.addEventListener("keydown", this.keydownHandler);

    // Wire tourController callbacks for HUD synchronization
    tourController.setCallbacks(
      (stop, idx, total) => {
        this.updateTourProgress(idx, total, stop);
      },
      (state, progress) => {
        this.handleTourStateChange(state, progress);
      },
      () => {
        this.hideTourBar();
        this.updateSpeechBubble("", false);
      }
    );

    // Mic button inside input bar
    this.micBtn.addEventListener("click", () => this.toggleVoice());
  }

  // ==========================================
  // SPEECH BUBBLE & HUD INTERACTION
  // ==========================================

  public updateSpeechBubble(text: string, isSpeaking: boolean, instruction?: string): void {
    if (!text && !instruction) {
      this.speechBubble.classList.add("sg-hidden");
      return;
    }

    this.speechBubble.classList.remove("sg-hidden");
    this.speechTextEl.textContent = text;

    if (instruction) {
      this.speechInstructionEl.textContent = instruction;
      this.speechInstructionEl.classList.remove("sg-hidden");
    } else {
      this.speechInstructionEl.classList.add("sg-hidden");
    }

    if (isSpeaking) {
      this.speechTypingEl.classList.remove("sg-hidden");
    } else {
      this.speechTypingEl.classList.add("sg-hidden");
    }
  }

  private handleTourPlayPause(): void {
    if (tourController.getState() === "paused") {
      tourController.resume();
      this.tourPlayPauseBtn.innerHTML = "❚❚ Pause";
    } else {
      tourController.pause();
      this.tourPlayPauseBtn.innerHTML = "▶ Resume";
    }
  }

  private handleStartExplore(): void {
    tourController.pause();
    this.exploreController?.enable();
  }

  private handleToggleMute(): void {
    const isMuted = audioPlayer.toggleMute();
    this.tourMuteBtn.textContent = isMuted ? "🔇" : "🔊";
    this.tourMuteBtn.title = isMuted ? "Unmute Voice (M)" : "Mute Voice (M)";
  }

  private handleTourStop(): void {
    tourController.stop();
    this.hideTourBar();
    this.updateSpeechBubble("", false);
    if (this.stage) {
      this.stage.stopPointing();
      this.stage.returnToDock();
      this.stage.setState("idle");
    }
  }

  private updateTourProgress(index: number, total: number, stop?: TourStop | null): void {
    const title = stop?.title || `Step ${index + 1}`;
    this.tourInfo.textContent = `Step ${index + 1} of ${total} • ${title}`;
    const percent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
    this.tourProgressBar.style.width = `${percent}%`;
  }

  private handleTourStateChange(state: TourEngineState, progress: TourProgress): void {
    if (state === "idle" || state === "completed") {
      this.hideTourBar();
      this.updateSpeechBubble("", false);
    } else {
      if (!this.exploreController?.isRunning()) {
        this.tourBar.classList.remove("sg-hidden");
      }
      if (state === "paused") {
        this.tourPlayPauseBtn.innerHTML = "▶ Resume";
      } else {
        this.tourPlayPauseBtn.innerHTML = "❚❚ Pause";
      }
      this.updateTourProgress(progress.currentIndex, progress.totalSteps, progress.currentStop);
    }
  }

  private handleExploreStateChange(active: boolean): void {
    if (active) {
      this.exploreBar.classList.remove("sg-hidden");
      this.tourBar.classList.add("sg-hidden");
      this.updateSpeechBubble("", false);
    } else {
      this.exploreBar.classList.add("sg-hidden");
      if (tourController.getStatus() !== "idle") {
        this.tourBar.classList.remove("sg-hidden");
      }
    }
  }

  // ==========================================
  // INDEPENDENT VISIBILITY STATE MANAGEMENT
  // ==========================================

  public isChatOpen(): boolean {
    return this.chatOpen;
  }

  public isAvatarVisible(): boolean {
    return this.avatarVisible;
  }

  public openChat(): void {
    this.chatOpen = true;
    this.applyVisibilityState();
  }

  public closeChat(): void {
    this.chatOpen = false;
    this.applyVisibilityState();
  }

  public toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    this.applyVisibilityState();
  }

  public showAvatar(): void {
    this.avatarVisible = true;
    this.applyVisibilityState();
  }

  public hideAvatar(): void {
    this.avatarVisible = false;
    this.applyVisibilityState();
  }

  public toggleAvatar(): void {
    this.avatarVisible = !this.avatarVisible;
    this.applyVisibilityState();
  }

  public setExplainingMode(explaining: boolean): void {
    if (explaining) {
      this.shell.classList.add("sg-explaining-mode");
    } else {
      this.shell.classList.remove("sg-explaining-mode");
    }
  }

  public getChatRect(): DOMRect | null {
    if (!this.chatOpen || this.shell.classList.contains("sg-hidden")) {
      return null;
    }
    return this.shell.getBoundingClientRect();
  }

  // Backward-compatible API aliases
  public open(): void {
    this.openChat();
  }

  public minimize(): void {
    this.closeChat();
  }

  public hide(): void {
    this.closeChat();
  }

  /**
   * Applies the independent visibility states to the DOM and Three.js stage.
   *
   * State Matrix:
   * 1. chatOpen = true,  avatarVisible = true  -> Both visible. Avatar beside chat (right: 414px).
   * 2. chatOpen = false, avatarVisible = true  -> Chat hidden. Avatar glides to corner (right: 20px).
   * 3. chatOpen = true,  avatarVisible = false -> Chat visible at corner. Avatar hidden (GPU paused).
   * 4. chatOpen = false, avatarVisible = false -> Both hidden (GPU paused). Launcher button shown.
   */
  private applyVisibilityState(): void {
    // 1. Avatar Layer & Canvas
    if (this.avatarVisible) {
      this.avatarLayer.classList.remove("sg-hidden");
      this.avatarLayer.classList.toggle("beside-chat", this.chatOpen);
      this.avatarLayer.classList.toggle("corner", !this.chatOpen);
      if (this.stage) this.stage.resume();
    } else {
      this.avatarLayer.classList.add("sg-hidden");
      if (this.stage) this.stage.pause();
    }

    // 2. Chat Panel
    if (this.chatOpen) {
      this.shell.classList.remove("sg-hidden");
    } else {
      this.shell.classList.add("sg-hidden");
    }

    // 3. Dock Buttons Visibility:
    // AI Guide button is always visible.
    // Mic and Chat buttons are visible ONLY when avatar is visible.
    if (this.avatarVisible) {
      this.dockMicBtn.classList.remove("sg-hidden");
      this.dockChatBtn.classList.remove("sg-hidden");
      this.dockGuideBtn.classList.remove("inactive");
      this.dockGuideBtn.title = "Hide 3D Avatar";
    } else {
      this.dockMicBtn.classList.add("sg-hidden");
      this.dockChatBtn.classList.add("sg-hidden");
      this.dockGuideBtn.classList.add("inactive");
      this.dockGuideBtn.title = "Show 3D Avatar";
    }

    // 4. Update Toggle Avatar Button icon styling in chat bar (if present)
    if (this.toggleAvatarBtn) {
      this.toggleAvatarBtn.classList.toggle("active", this.avatarVisible);
      this.toggleAvatarBtn.title = this.avatarVisible ? "Hide 3D Avatar" : "Show 3D Avatar";
    }

    // 5. Update Dock Chat Button styling
    if (this.dockChatBtn) {
      this.dockChatBtn.classList.toggle("active", this.chatOpen);
      this.dockChatBtn.title = this.chatOpen ? "Close Chat" : "Open Chat";
    }

    // 6. Floating Launcher Button (deprecated/fallback)
    if (this.launcherBtn) {
      this.launcherBtn.classList.add("sg-hidden");
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputField.value;
    if (!text.trim()) return;
    this.inputField.value = "";
    await this.chatController.sendMessage(text);
  }

  private setRecordingState(recording: boolean): void {
    this.isRecording = recording;
    this.micBtn?.classList.toggle("recording", recording);
    this.dockMicBtn?.classList.toggle("recording", recording);
  }

  private async toggleVoice(): Promise<void> {
    if (this.isRecording) {
      this.setRecordingState(false);
      speechRecognizer.stop();
      await microphoneController.stopRecording();
    } else {
      this.setRecordingState(true);
      this.updateStatus("listening");

      if (speechRecognizer.isSupported()) {
        speechRecognizer.start(
          "en-US",
          (transcript) => {
            this.setRecordingState(false);
            if (transcript) {
              this.chatController.sendMessage(transcript, "voice_transcript");
            }
          },
          (err) => {
            this.setRecordingState(false);
            console.warn("Speech recognition error:", err);
            this.updateStatus("idle");
          },
          () => {
            this.setRecordingState(false);
            this.updateStatus("idle");
          }
        );
      } else {
        try {
          await microphoneController.startRecording();
        } catch (e: any) {
          this.setRecordingState(false);
          alert(e.message || "Microphone access denied.");
        }
      }
    }
  }

  public updateMessages(messages: ChatMessage[]): void {
    this.messagesContainer.innerHTML = "";
    let assistantMsgIndex = 0;

    messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = `sg-message-item ${msg.sender}`;

      if (msg.sender === "assistant") {
        const dotColor = this.dotColors[assistantMsgIndex % this.dotColors.length];
        assistantMsgIndex++;

        const dot = document.createElement("div");
        dot.className = "sg-msg-dot";
        dot.style.background = dotColor;
        dot.style.boxShadow = `0 0 8px ${dotColor}`;

        const bubble = document.createElement("div");
        bubble.className = "sg-bubble assistant";
        bubble.textContent = msg.text;

        row.appendChild(dot);
        row.appendChild(bubble);
      } else if (msg.sender === "user") {
        const bubble = document.createElement("div");
        bubble.className = "sg-bubble user";
        bubble.textContent = msg.text;
        row.appendChild(bubble);
      } else {
        const bubble = document.createElement("div");
        bubble.className = "sg-bubble system";
        bubble.textContent = msg.text;
        row.appendChild(bubble);
      }

      this.messagesContainer.appendChild(row);
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
      idle: "AI Guide: Ready",
      listening: "AI Guide: Listening...",
      thinking: "AI Guide: Thinking...",
      speaking: "AI Guide: Speaking...",
      tour: "AI Guide: Page Tour",
      error: "AI Guide: Error",
    };
    this.statusIndicator.title = labels[state] || "AI Guide: Ready";
  }

  public hideTourBar(): void {
    if (this.tourBar) {
      this.tourBar.classList.add("sg-hidden");
    }
    if (this.tourInfo) {
      this.tourInfo.textContent = "";
    }
    if (this.tourProgressBar) {
      this.tourProgressBar.style.width = "0%";
    }
  }

  public destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    this.exploreController?.disable();
  }
}
