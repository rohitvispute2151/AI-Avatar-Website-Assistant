export type WidgetPosition =
  | "bottom-right"
  | "bottom-left"
  | "auto";

export interface WidgetError {
  code: string;
  message: string;
  details?: unknown;
}

export type AvatarQuality = "auto" | "low" | "high";
export type CameraFraming = "bust" | "full";

export interface SiteGuideConfig {
  widgetId: string;              // Public integration identifier, never a secret
  apiBaseUrl: string;
  position?: WidgetPosition;
  locale?: string;               // e.g. "en-US"
  voiceEnabled?: boolean;
  textEnabled?: boolean;
  avatarVisible?: boolean;       // Initial avatar visibility state (default: true)
  chatOpen?: boolean;            // Initial chat window state (default: true)
  avatarAssetUrl?: string;       // Custom .glb or .vrm model
  avatarHdriUrl?: string;        // Custom 1k .hdr studio environment
  avatarAnimationsUrl?: string;  // Custom animation .glb
  voice?: string;                // Preferred voice name hint
  quality?: AvatarQuality;       // "auto" (default) | "low" | "high"
  cameraFraming?: CameraFraming; // "bust" (default) | "full"
  assetBaseUrl?: string;         // Base CDN or local asset path
  theme?: "light" | "dark" | "auto";
  zIndex?: number;
  onReady?: () => void;
  onError?: (error: WidgetError) => void;
}

export interface WidgetHandle {
  destroy(): void;
  open(): void;
  minimize(): void;
  hide(): void;
  setVoiceEnabled(enabled: boolean): void;
  openChat(): void;
  closeChat(): void;
  toggleChat(): void;
  showAvatar(): void;
  hideAvatar(): void;
  toggleAvatar(): void;
  isChatOpen(): boolean;
  isAvatarVisible(): boolean;
}

export function validateConfig(config: SiteGuideConfig): SiteGuideConfig {
  if (!config.widgetId || typeof config.widgetId !== "string") {
    throw new Error("SiteGuide: 'widgetId' is required.");
  }
  if (!config.apiBaseUrl || typeof config.apiBaseUrl !== "string") {
    throw new Error("SiteGuide: 'apiBaseUrl' is required.");
  }

  // apiBaseUrl must be https in production or http on localhost (LLD §3.1)
  const isLocalhost =
    config.apiBaseUrl.startsWith("http://localhost") ||
    config.apiBaseUrl.startsWith("http://127.0.0.1");

  if (!config.apiBaseUrl.startsWith("https://") && !isLocalhost) {
    throw new Error("SiteGuide: 'apiBaseUrl' must be HTTPS except on localhost development.");
  }

  return {
    position: "bottom-right",
    locale: "en-US",
    voiceEnabled: true,
    textEnabled: true,
    avatarVisible: config.avatarVisible !== undefined ? config.avatarVisible : true,
    chatOpen: config.chatOpen !== undefined ? config.chatOpen : false,
    quality: "auto",
    cameraFraming: "bust",
    theme: "dark",
    zIndex: 999999,
    ...config,
  };
}
