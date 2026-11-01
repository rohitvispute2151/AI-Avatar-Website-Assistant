import { SiteGuideConfig, WidgetHandle, validateConfig } from "./config";
import { SiteGuideElement } from "./custom-element";

let activeElement: SiteGuideElement | null = null;

export const SiteGuide = {
  init(rawConfig: SiteGuideConfig): WidgetHandle {
    const config = validateConfig(rawConfig);

    // If an existing widget element is present, clean it up
    if (activeElement) {
      activeElement.destroy();
      activeElement = null;
    }

    const el = document.createElement("site-guide") as SiteGuideElement;
    document.body.appendChild(el);
    activeElement = el;

    el.init(config);

    return {
      destroy: () => {
        if (activeElement === el) {
          el.destroy();
          activeElement = null;
        }
      },
      open: () => el.open(),
      minimize: () => el.minimize(),
      hide: () => el.hide(),
      setVoiceEnabled: (enabled: boolean) => el.setVoiceEnabled(enabled),
    };
  },

  destroy(): void {
    if (activeElement) {
      activeElement.destroy();
      activeElement = null;
    }
  },
};

// Global script tag initialization support (<script data-widget-id="...">)
if (typeof document !== "undefined") {
  const currentScript = document.currentScript;
  if (currentScript) {
    const widgetId = currentScript.getAttribute("data-widget-id");
    const apiBaseUrl = currentScript.getAttribute("data-api-base-url") || "http://localhost:8000";
    if (widgetId) {
      document.addEventListener("DOMContentLoaded", () => {
        SiteGuide.init({ widgetId, apiBaseUrl });
      });
    }
  }
}

