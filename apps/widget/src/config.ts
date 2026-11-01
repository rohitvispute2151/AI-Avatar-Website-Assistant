export type WidgetPosition =
  | "bottom-right"
  | "bottom-left"
  | "auto";

export interface WidgetError {
  code: string;
  message: string;
  details?: unknown;
}

export interface SiteGuideConfig {
  widgetId: string;              // Public integration identifier, never a secret
  apiBaseUrl: string;
  position?: WidgetPosition;
  locale?: string;               // e.g. "en-US"
  voiceEnabled?: boolean;
  textEnabled?: boolean;
  avatarAssetUrl?: string;
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
    theme: "dark",
    zIndex: 999999,
    ...config,
  };
}

