export class NodeRegistry {
  private elementToId = new WeakMap<Element, string>();
  private idToElement = new Map<string, Element>();
  private counter = 0;

  public getOrCreateId(el: Element, roleHint?: string): string {
    const existing = this.elementToId.get(el);
    if (existing) {
      return existing;
    }

    const attrId = el.getAttribute("data-site-guide-node-id");
    if (attrId && !this.idToElement.has(attrId)) {
      this.elementToId.set(el, attrId);
      this.idToElement.set(attrId, el);
      return attrId;
    }

    const tag = el.tagName.toLowerCase();
    const idAttr = el.id ? `_${el.id.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";
    this.counter += 1;
    const generatedId = `node_${roleHint || tag}${idAttr}_${this.counter.toString(16)}`;

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
    const el = this.idToElement.get(id);
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

