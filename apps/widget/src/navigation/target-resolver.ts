import { nodeRegistry } from "../page/node-registry";
import { TurnPlan } from "../page/manifest";

export function resolveTargetElement(nodeId: string): HTMLElement | null {
  if (!nodeId) return null;

  // 1. Check nodeRegistry first
  let el: any = nodeRegistry.resolve(nodeId);

  // 2. If not found in registry, check direct ID or selector
  if (!el && typeof document !== "undefined") {
    try {
      if (nodeId.startsWith("#")) {
        el = document.querySelector(nodeId) || document.getElementById(nodeId.slice(1));
      } else {
        el = document.getElementById(nodeId) || document.querySelector(nodeId);
      }
    } catch {
      // Ignore invalid selector syntax
    }
  }

  if (!el) {
    return null;
  }
  if (typeof HTMLElement !== "undefined" && !(el instanceof HTMLElement)) {
    return null;
  }
  if (el.isConnected === false) {
    return null;
  }
  if (typeof el.getBoundingClientRect === "function") {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !["SECTION", "MAIN", "ARTICLE"].includes(el.tagName)) {
      return null;
    }
  }
  return el;
}

/**
 * Returns the actual visual content bounding box of an element (e.g., cards,
 * headings, forms within a section) rather than a full 100% width container wrapper.
 */
export function getVisualContentRect(el: HTMLElement): DOMRect {
  if (typeof window === "undefined" || !el.isConnected) {
    return el.getBoundingClientRect();
  }

  // If element is a section or wide container, locate its inner content container or child cards
  if (["SECTION", "MAIN", "ARTICLE", "DIV"].includes(el.tagName)) {
    // 1. Check for standard container
    const container = el.querySelector<HTMLElement>(".container, [class*='container'], form, #signup-form");
    if (container && container !== el) {
      const cRect = container.getBoundingClientRect();
      if (cRect.width > 30 && cRect.height > 30 && cRect.width <= window.innerWidth * 0.85) {
        return cRect;
      }
    }

    // 2. Otherwise calculate bounding envelope enclosing all visible child headings and cards
    const subCards = Array.from(
      el.querySelectorAll<HTMLElement>("h1, h2, h3, p, .glass-card, [class*='card'], form, input, button")
    );
    const visibleSub = subCards.filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    });

    if (visibleSub.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const child of visibleSub) {
        const r = child.getBoundingClientRect();
        if (r.left < minX) minX = r.left;
        if (r.top < minY) minY = r.top;
        if (r.right > maxX) maxX = r.right;
        if (r.bottom > maxY) maxY = r.bottom;
      }
      if (minX < maxX && minY < maxY) {
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
      }
    }
  }

  return el.getBoundingClientRect();
}

/**
 * Resolves the relevant DOM section or element being explained in a TurnPlan.
 * Checks targetNodeId, evidence references, and semantic keyword matching.
 */
export function findSectionForPlan(plan: TurnPlan): HTMLElement | null {
  if (typeof document === "undefined") return null;

  // 1. Explicit targetNodeId
  if (plan.targetNodeId) {
    const el = resolveTargetElement(plan.targetNodeId);
    if (el) return el;
  }

  // 2. Evidence node IDs
  if (plan.evidence && plan.evidence.length > 0) {
    for (const ev of plan.evidence) {
      if (ev.nodeId) {
        const el = resolveTargetElement(ev.nodeId);
        if (el) return el;
      }
    }
  }

  // 3. Semantic keyword matching
  const text = (plan.answer || "").toLowerCase();

  const isHtmlEl = (candidate: any): candidate is HTMLElement => {
    if (!candidate) return false;
    if (typeof HTMLElement !== "undefined") {
      return candidate instanceof HTMLElement;
    }
    return true;
  };

  if (text.includes("pricing") || text.includes("plan") || text.includes("tier") || text.includes("/month")) {
    const el = document.getElementById("pricing") || document.querySelector("section#pricing, [data-node-id*='pricing']");
    if (isHtmlEl(el)) return el as HTMLElement;
  }

  if (text.includes("feature") || text.includes("spatial") || text.includes("gesture") || text.includes("voice")) {
    const el = document.getElementById("features") || document.querySelector("section#features, [data-node-id*='feature']");
    if (isHtmlEl(el)) return el as HTMLElement;
  }

  if (text.includes("contact") || text.includes("sign up") || text.includes("get in touch") || text.includes("form") || text.includes("email")) {
    const el = document.getElementById("contact") || document.querySelector("section#contact, form");
    if (isHtmlEl(el)) return el as HTMLElement;
  }

  if (
    text.includes("about") ||
    text.includes("novaai") ||
    text.includes("company") ||
    text.includes("assistant") ||
    text.includes("static website") ||
    text.includes("turn your")
  ) {
    const el =
      document.getElementById("hero") ||
      document.getElementById("about") ||
      document.querySelector("section#hero, section:first-of-type, main > section:first-of-type");
    if (isHtmlEl(el)) return el as HTMLElement;
  }

  return null;
}
