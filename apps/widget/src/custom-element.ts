import { SiteGuideConfig } from "./config";
import { widgetStyles } from "./styles/widget.css";
import { ApiClient } from "./api/client";
import { MutationWatcher } from "./page/mutation-watcher";
import { FormStateWatcher } from "./page/form-state-watcher";
import { ChatController } from "./conversation/chat-controller";
import { WidgetView } from "./ui/widget-view";
import { AvatarStage } from "./avatar/avatar-stage";
import { TargetHighlighter } from "./navigation/highlighter";
import { ActionExecutor } from "./navigation/action-executor";

export class SiteGuideElement extends HTMLElement {
  private config: SiteGuideConfig | null = null;
  private apiClient: ApiClient | null = null;
  private mutationWatcher: MutationWatcher | null = null;
  private formStateWatcher: FormStateWatcher | null = null;
  private chatController: ChatController | null = null;
  private widgetView: WidgetView | null = null;
  private avatarStage: AvatarStage | null = null;
  private highlighter: TargetHighlighter | null = null;
  private actionExecutor: ActionExecutor | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  public async init(config: SiteGuideConfig): Promise<void> {
    this.config = config;
    if (!this.shadowRoot) return;

    // 1. Inject scoped styles
    const styleTag = document.createElement("style");
    styleTag.textContent = widgetStyles;
    this.shadowRoot.appendChild(styleTag);

    // 2. Initialize API Client
    this.apiClient = new ApiClient(config.apiBaseUrl);

    // 3. Initialize Mutation & Form Watchers
    this.mutationWatcher = new MutationWatcher(async (manifest) => {
      try {
        await this.apiClient?.upsertManifest(manifest);
      } catch (e) {
        console.warn("Failed to sync updated manifest:", e);
      }
    });

    this.formStateWatcher = new FormStateWatcher((nodeId, state) => {
      // Coarse state updated locally
    });

    const bootstrapSession = async () => {
      if (!this.apiClient || !this.mutationWatcher || !this.config) return;
      await this.apiClient.createSession(
        this.config.widgetId,
        window.location.origin + window.location.pathname,
        this.config.locale || "en-US"
      );
      const manifest = await this.mutationWatcher.buildInitialManifest();
      await this.apiClient.upsertManifest(manifest);
    };

    // 4. Initialize Chat Controller
    this.chatController = new ChatController(
      this.apiClient,
      this.mutationWatcher,
      (state) => {
        this.widgetView?.updateStatus(state);
        this.avatarStage?.setState(state);
      },
      (messages) => this.widgetView?.updateMessages(messages),
      bootstrapSession
    );

    // 5. Build Widget UI
    this.widgetView = new WidgetView(this.shadowRoot, this.chatController);

    // 6. Initialize 3D Avatar Stage
    const canvasWrap = this.widgetView.getCanvasContainer();
    this.avatarStage = new AvatarStage(canvasWrap, config.avatarAssetUrl);
    this.widgetView.setAvatarStage(this.avatarStage);

    // 7. Initialize Target Highlighter & Action Executor
    this.highlighter = new TargetHighlighter(this);
    this.actionExecutor = new ActionExecutor(
      this.avatarStage,
      this.highlighter,
      config.locale || "en-US",
      () => this.widgetView?.updateStatus("speaking"),
      () => this.widgetView?.updateStatus("idle")
    );
    this.chatController.setActionExecutor(this.actionExecutor);

    // 8. Start watchers
    this.mutationWatcher.start();
    this.formStateWatcher.start();

    // 9. Bootstrap Session & Initial Manifest Sync
    try {
      await bootstrapSession();

      if (config.onReady) {
        config.onReady();
      }
    } catch (err: any) {
      console.error("SiteGuide initialization error:", err);
      if (config.onError) {
        config.onError({
          code: "INIT_FAILED",
          message: err.message || "Failed to initialize site guide session.",
          details: err,
        });
      }
    }
  }

  public open(): void {
    this.widgetView?.open();
  }

  public minimize(): void {
    this.widgetView?.minimize();
  }

  public hide(): void {
    this.widgetView?.hide();
  }

  public setVoiceEnabled(enabled: boolean): void {
    if (this.config) {
      this.config.voiceEnabled = enabled;
    }
  }

  public destroy(): void {
    this.mutationWatcher?.stop();
    this.formStateWatcher?.stop();
    this.avatarStage?.dispose();
    this.highlighter?.destroy();
    this.apiClient?.deleteSession().catch(() => {});
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("site-guide")) {
  customElements.define("site-guide", SiteGuideElement);
}

