export class TargetHighlighter {
  private overlayElement: HTMLElement | null = null;
  private badgeElement: HTMLElement | null = null;
  private instructionElement: HTMLElement | null = null;
  private svgBeam: SVGSVGElement | null = null;
  private beamPath: SVGPathElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private avatarOrigin: { x: number; y: number } | null = null;
  private updateHandler: () => void;

  constructor(container: HTMLElement) {
    // 1. Target Spotlight Overlay
    this.overlayElement = document.createElement("div");
    this.overlayElement.className = "site-guide-target-highlight";
    this.overlayElement.style.cssText = `
      position: fixed;
      pointer-events: none;
      display: none;
      z-index: 999990;
      border: 2px solid #6366f1;
      border-radius: 12px;
      box-shadow: 0 0 25px rgba(99, 102, 241, 0.45), 0 0 0 9999px rgba(8, 12, 24, 0.45), inset 0 0 16px rgba(99, 102, 241, 0.25);
      transition: top 0.25s ease-out, left 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out, opacity 0.3s ease;
      opacity: 0;
    `;

    // 2. Accessible Focus Badge
    this.badgeElement = document.createElement("div");
    this.badgeElement.className = "site-guide-target-badge";
    this.badgeElement.textContent = "🎯 Spotlight";
    this.badgeElement.style.cssText = `
      position: absolute;
      top: -24px;
      left: 4px;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      letter-spacing: 0.04em;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    this.overlayElement.appendChild(this.badgeElement);

    // 3. Optional Interaction Instruction Chip
    this.instructionElement = document.createElement("div");
    this.instructionElement.className = "site-guide-instruction-badge";
    this.instructionElement.style.cssText = `
      position: absolute;
      bottom: -28px;
      left: 4px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 6px;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      white-space: nowrap;
    `;
    this.overlayElement.appendChild(this.instructionElement);

    // 4. SVG Connector Beam
    if (typeof document !== "undefined") {
      this.svgBeam = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.svgBeam.setAttribute("class", "site-guide-connector-beam");
      this.svgBeam.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 999988;
        display: none;
      `;

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      grad.setAttribute("id", "sg-beam-grad");
      grad.setAttribute("gradientUnits", "userSpaceOnUse");
      grad.innerHTML = `
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#818cf8" stop-opacity="0.2" />
      `;
      defs.appendChild(grad);
      this.svgBeam.appendChild(defs);

      this.beamPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      this.beamPath.setAttribute("stroke", "url(#sg-beam-grad)");
      this.beamPath.setAttribute("stroke-width", "2.5");
      this.beamPath.setAttribute("stroke-dasharray", "6 4");
      this.beamPath.setAttribute("fill", "none");
      this.beamPath.setAttribute("opacity", "0.75");
      this.svgBeam.appendChild(this.beamPath);

      container.appendChild(this.svgBeam);
    }

    container.appendChild(this.overlayElement);

    this.updateHandler = () => {
      if (this.currentTarget) {
        this.updatePosition();
      }
    };

    window.addEventListener("scroll", this.updateHandler, { passive: true });
    window.addEventListener("resize", this.updateHandler, { passive: true });
  }

  public highlight(element: HTMLElement, instruction?: string, avatarOrigin?: { x: number; y: number }): void {
    this.currentTarget = element;
    if (avatarOrigin) {
      this.avatarOrigin = avatarOrigin;
    }
    this.updatePosition();

    if (this.instructionElement) {
      if (instruction) {
        this.instructionElement.textContent = `💡 ${instruction}`;
        this.instructionElement.style.display = "block";
      } else {
        this.instructionElement.style.display = "none";
      }
    }

    if (this.overlayElement) {
      this.overlayElement.style.display = "block";
      requestAnimationFrame(() => {
        if (this.overlayElement) this.overlayElement.style.opacity = "1";
      });
    }

    if (this.svgBeam) {
      this.svgBeam.style.display = "block";
    }
  }

  public setAvatarOrigin(origin: { x: number; y: number } | null): void {
    this.avatarOrigin = origin;
    if (this.currentTarget) {
      this.updatePosition();
    }
  }

  public clear(): void {
    this.currentTarget = null;
    this.avatarOrigin = null;

    if (this.overlayElement) {
      this.overlayElement.style.opacity = "0";
      setTimeout(() => {
        if (!this.currentTarget && this.overlayElement) {
          this.overlayElement.style.display = "none";
        }
      }, 250);
    }

    if (this.svgBeam) {
      this.svgBeam.style.display = "none";
    }
  }

  private updatePosition(): void {
    if (!this.currentTarget || !this.overlayElement) return;
    const rect = this.currentTarget.getBoundingClientRect();
    const pad = 8;

    this.overlayElement.style.top = `${Math.round(rect.top - pad)}px`;
    this.overlayElement.style.left = `${Math.round(rect.left - pad)}px`;
    this.overlayElement.style.width = `${Math.round(rect.width + pad * 2)}px`;
    this.overlayElement.style.height = `${Math.round(rect.height + pad * 2)}px`;

    // Update connector beam
    if (this.beamPath && this.avatarOrigin) {
      const ax = this.avatarOrigin.x;
      const ay = this.avatarOrigin.y;
      const tx = rect.left + rect.width / 2;
      const ty = rect.top + rect.height / 2;

      // Draw smooth quadratic curved beam from avatar to target
      const cx = (ax + tx) / 2;
      const cy = Math.min(ay, ty) - 40;
      this.beamPath.setAttribute("d", `M ${ax} ${ay} Q ${cx} ${cy} ${tx} ${ty}`);
    } else if (this.beamPath) {
      this.beamPath.removeAttribute("d");
    }
  }

  public destroy(): void {
    window.removeEventListener("scroll", this.updateHandler);
    window.removeEventListener("resize", this.updateHandler);
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    if (this.svgBeam && this.svgBeam.parentElement) {
      this.svgBeam.parentElement.removeChild(this.svgBeam);
    }
    this.currentTarget = null;
    this.badgeElement = null;
    this.instructionElement = null;
  }
}
