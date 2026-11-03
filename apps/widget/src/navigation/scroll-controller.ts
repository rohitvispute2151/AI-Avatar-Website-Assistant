export class ScrollController {
  private isReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private getStickyHeaderHeight(): number {
    let maxHeight = 0;
    const candidates = document.querySelectorAll(
      "header, nav, [class*='header'], [class*='nav'], [class*='sticky'], [class*='fixed']"
    );
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest("site-guide")) continue;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 10 && rect.bottom > 10 && rect.width > window.innerWidth * 0.4) {
          maxHeight = Math.max(maxHeight, rect.bottom);
        }
      }
    }
    return maxHeight;
  }

  private getStickyFooterHeight(): number {
    let maxHeight = 0;
    const candidates = document.querySelectorAll(
      "footer, [class*='footer'], [class*='sticky'], [class*='fixed']"
    );
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest("site-guide")) continue;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= window.innerHeight - 10 && rect.top < window.innerHeight && rect.width > window.innerWidth * 0.4) {
          maxHeight = Math.max(maxHeight, window.innerHeight - rect.top);
        }
      }
    }
    return maxHeight;
  }

  /**
   * Smoothly scrolls the element into view.
   * If alignment is "start", positions the target in the upper part of the viewport
   * below any sticky header to clear ample room below the target for the avatar.
   */
  public async scrollToElement(
    element: HTMLElement,
    alignment: "start" | "center" = "center"
  ): Promise<void> {
    const reduced = this.isReducedMotion();
    const behavior: ScrollBehavior = reduced ? "instant" : "smooth";

    if (alignment === "start") {
      const headerOffset = this.getStickyHeaderHeight();
      const rect = element.getBoundingClientRect();
      const desiredTop = headerOffset + 24;
      const diffY = rect.top - desiredTop;

      if (Math.abs(diffY) > 8) {
        window.scrollBy({
          top: diffY,
          behavior,
        });
        await this.waitForScrollSettlement();
      }
      return;
    }

    // 1. Initial scroll to center
    element.scrollIntoView({
      behavior,
      block: "center",
      inline: "nearest",
    });

    // 2. Wait for initial scroll settlement
    await this.waitForScrollSettlement();

    // 3. Check for sticky header overlap & apply bounded scrollBy correction (LLD §8.3)
    const headerOffset = this.getStickyHeaderHeight();
    const footerOffset = this.getStickyFooterHeight();
    const rect = element.getBoundingClientRect();

    let correctionY = 0;
    const minPadding = 20;

    if (rect.top < headerOffset + minPadding) {
      correctionY = rect.top - (headerOffset + minPadding);
    } else if (rect.bottom > window.innerHeight - footerOffset - minPadding) {
      correctionY = rect.bottom - (window.innerHeight - footerOffset - minPadding);
    }

    if (Math.abs(correctionY) > 5) {
      window.scrollBy({
        top: correctionY,
        behavior,
      });
      await this.waitForScrollSettlement();
    }
  }

  private waitForScrollSettlement(): Promise<void> {
    return new Promise<void>((resolve) => {
      let lastY = window.scrollY;
      let sameCount = 0;
      const check = () => {
        if (window.scrollY === lastY) {
          sameCount++;
        } else {
          lastY = window.scrollY;
          sameCount = 0;
        }

        if (sameCount >= 3) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  }
}

export const scrollController = new ScrollController();
