export class NodeRegistry {
  private elementToId = new WeakMap<Element, string>();
  private idToElement = new Map<string, Element>();
  private counter = 0;

  public getOrCreateId(el: Element, roleHint?: string): string {
    const existing = this.elementToId.get(el);
    if (existing) {
      return existing;
    }

    const guideAttr = el.getAttribute("data-guide");
    if (guideAttr) {
      this.idToElement.set(guideAttr, el);
      this.idToElement.set(`[data-guide='${guideAttr}']`, el);
      this.idToElement.set(`[data-guide="${guideAttr}"]`, el);
    }

    const attrId = el.getAttribute("data-site-guide-node-id");
    if (attrId && !this.idToElement.has(attrId)) {
      this.elementToId.set(el, attrId);
      this.idToElement.set(attrId, el);
      return attrId;
    }

    const tag = el.tagName.toLowerCase();
    const idAttr = el.id ? `_${el.id.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";
    const guideSuffix = guideAttr ? `_guide-${guideAttr}` : "";
    this.counter += 1;
    const generatedId = `node_${roleHint || tag}${idAttr}${guideSuffix}_${this.counter.toString(16)}`;

    try {
      el.setAttribute("data-site-guide-node-id", generatedId);
    } catch {
      // Ignore if host prevents setting attribute
    }

    this.elementToId.set(el, generatedId);
    this.idToElement.set(generatedId, el);
    return generatedId;
  }

  public resolve(id: string): Element | null {
    let el: Element | null | undefined = this.idToElement.get(id);
    if (!el && typeof document !== "undefined") {
      el = document.querySelector(id.startsWith("[") ? id : `[data-guide="${id}"]`) || document.getElementById(id) || null;
      if (el) {
        this.idToElement.set(id, el);
      }
    }
    if (!el || !el.isConnected) {
      this.idToElement.delete(id);
      return null;
    }
    return el;
  }

  public clear(): void {
    this.idToElement.clear();
  }
}

export const nodeRegistry = new NodeRegistry();

