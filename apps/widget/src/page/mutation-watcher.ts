import { PageManifest, PageNode } from "./manifest";
import { scanPage } from "./scanner";

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  if (crypto && crypto.subtle) {
    const buffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simple hash
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
  }
  return `h_${Math.abs(h).toString(16).padStart(16, "0")}`;
}

export class MutationWatcher {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private currentRevision = 1;
  private currentHash = "";
  private onManifestChange: (manifest: PageManifest) => void;

  constructor(onManifestChange: (manifest: PageManifest) => void) {
    this.onManifestChange = onManifestChange;
  }

  public async buildInitialManifest(): Promise<PageManifest> {
    const nodes = scanPage();
    const hash = await this.hashNodes(nodes);
    this.currentHash = hash;
    this.currentRevision = 1;

    return {
      pageId: `page_${window.location.pathname.replace(/[^a-zA-Z0-9]/g, "_") || "root"}`,
      revision: this.currentRevision,
      contentHash: hash,
      title: document.title || "Demo Page",
      url: window.location.origin + window.location.pathname,
      locale: document.documentElement.lang || "en-US",
      nodes,
      createdAt: new Date().toISOString(),
    };
  }

  public start(): void {
    this.observer = new MutationObserver((mutations) => {
      // Check if mutations are only inside site-guide
      const hasHostMutation = mutations.some((m) => {
        const target = m.target as Node;
        if (target instanceof Element && target.closest("site-guide")) {
          return false;
        }
        return true;
      });

      if (!hasHostMutation) return;

      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(async () => {
        await this.handleMutations();
      }, 300);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
        "aria-invalid",
        "disabled",
        "hidden",
        "required",
        "href",
        "role",
        "title",
        "type",
      ],
    });

    // SPA navigation listener
    window.addEventListener("popstate", this.handleNavigation);
  }

  private handleNavigation = async () => {
    await this.handleMutations();
  };

  private async hashNodes(nodes: PageNode[]): Promise<string> {
    const payload = nodes
      .map((n) => `${n.id}:${n.role}:${n.accessibleName}:${n.text}:${n.disabled}:${n.formState}`)
      .join("|");
    return computeHash(payload);
  }

  private async handleMutations(): Promise<void> {
    const nodes = scanPage();
    const newHash = await this.hashNodes(nodes);
    if (newHash !== this.currentHash) {
      this.currentHash = newHash;
      this.currentRevision += 1;

      const manifest: PageManifest = {
        pageId: `page_${window.location.pathname.replace(/[^a-zA-Z0-9]/g, "_") || "root"}`,
        revision: this.currentRevision,
        contentHash: newHash,
        title: document.title || "Demo Page",
        url: window.location.origin + window.location.pathname,
        locale: document.documentElement.lang || "en-US",
        nodes,
        createdAt: new Date().toISOString(),
      };

      this.onManifestChange(manifest);
    }
  }

  public getRevision(): number {
    return this.currentRevision;
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    window.removeEventListener("popstate", this.handleNavigation);
  }
}

