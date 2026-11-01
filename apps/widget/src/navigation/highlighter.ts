export class TargetHighlighter {
  private overlayElement: HTMLElement | null = null;
  private badgeElement: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private updateHandler: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement("div");
    this.overlayElement.className = "site-guide-target-highlight";
    this.overlayElement.style.position = "fixed";
    this.overlayElement.style.pointerEvents = "none";
    this.overlayElement.style.display = "none";
    this.overlayElement.style.zIndex = "999990";
    this.overlayElement.style.border = "2px solid #6366f1";
    this.overlayElement.style.borderRadius = "8px";
    this.overlayElement.style.boxShadow =
      "0 0 20px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(99, 102, 241, 0.2)";
    this.overlayElement.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

    // Accessible text badge so highlighting does not rely solely on color (LLD §12.3)
    this.badgeElement = document.createElement("div");
    this.badgeElement.className = "site-guide-target-badge";
    this.badgeElement.textContent = "Target";
    this.badgeElement.style.position = "absolute";
    this.badgeElement.style.top = "-20px";
    this.badgeElement.style.left = "4px";
    this.badgeElement.style.background = "#6366f1";
    this.badgeElement.style.color = "#ffffff";
    this.badgeElement.style.fontSize = "10px";
    this.badgeElement.style.fontWeight = "600";
    this.badgeElement.style.padding = "1px 6px";
    this.badgeElement.style.borderRadius = "4px";
    this.badgeElement.style.textTransform = "uppercase";
    this.badgeElement.style.letterSpacing = "0.05em";
    this.overlayElement.appendChild(this.badgeElement);

    container.appendChild(this.overlayElement);

    this.updateHandler = () => {
      if (this.currentTarget) {
        this.updatePosition();
      }
    };

    window.addEventListener("scroll", this.updateHandler, { passive: true });
    window.addEventListener("resize", this.updateHandler, { passive: true });
  }

  public highlight(element: HTMLElement): void {
    this.currentTarget = element;
    this.updatePosition();
    if (this.overlayElement) {
      this.overlayElement.style.display = "block";
      this.overlayElement.style.opacity = "1";
    }
  }

  public clear(): void {
    this.currentTarget = null;
    if (this.overlayElement) {
      this.overlayElement.style.opacity = "0";
      setTimeout(() => {
        if (!this.currentTarget && this.overlayElement) {
          this.overlayElement.style.display = "none";
        }
      }, 300);
    }
  }

  private updatePosition(): void {
    if (!this.currentTarget || !this.overlayElement) return;
    const rect = this.currentTarget.getBoundingClientRect();
    const pad = 6;
    this.overlayElement.style.top = `${rect.top - pad}px`;
    this.overlayElement.style.left = `${rect.left - pad}px`;
    this.overlayElement.style.width = `${rect.width + pad * 2}px`;
    this.overlayElement.style.height = `${rect.height + pad * 2}px`;
  }

  public destroy(): void {
    window.removeEventListener("scroll", this.updateHandler);
    window.removeEventListener("resize", this.updateHandler);
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.currentTarget = null;
    this.badgeElement = null;
  }
}
