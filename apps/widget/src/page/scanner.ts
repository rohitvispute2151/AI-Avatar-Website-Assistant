import { PageNode, PageNodeRole } from "./manifest";
import { nodeRegistry } from "./node-registry";
import { getCoarseFormState } from "./form-state-watcher";

function computeAccessibleName(el: Element): string {
  // 1. Explicit associated <label for>
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label && label.textContent) {
      return label.textContent.trim();
    }
  }

  // 2. Wrapping <label>
  const parentLabel = el.closest("label");
  if (parentLabel && parentLabel.textContent) {
    // Avoid infinite recursion or picking up input value
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input, select, textarea").forEach((i) => i.remove());
    if (clone.textContent && clone.textContent.trim()) {
      return clone.textContent.trim();
    }
  }

  // 3. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const texts = ids
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (texts.length > 0) {
      return texts.join(" ");
    }
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
  }

  // 5. Native text content for buttons, links, headings
  if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || /^H[1-6]$/.test(el.tagName)) {
    if (el.textContent && el.textContent.trim()) {
      return el.textContent.trim();
    }
  }

  // 6. alt attribute (for images)
  const alt = el.getAttribute("alt");
  if (alt && alt.trim()) {
    return alt.trim();
  }

  // 7. title, data-guide, or placeholder as fallback
  const title = el.getAttribute("title");
  if (title && title.trim()) {
    return title.trim();
  }
  const guide = el.getAttribute("data-guide");
  if (guide && guide.trim()) {
    return guide.trim();
  }
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) {
    return placeholder.trim();
  }

  return "";
}

function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
  // LLD §4.3: check inert attribute
  if (el.hasAttribute("inert") || el.closest("[inert]")) return false;
  if (el.closest("script, style, template, noscript, site-guide")) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  const rect = el.getBoundingClientRect();
  // Elements with 0 height and 0 width are invisible unless they are section containers
  if (rect.width === 0 && rect.height === 0 && !["SECTION", "MAIN", "ARTICLE"].includes(el.tagName)) {
    return false;
  }

  return true;
}

// LLD §4.7: scan open shadow roots recursively with a depth cap
function collectCandidateElements(root: Element | Document | ShadowRoot, maxDepth = 3, currentDepth = 0): Element[] {
  const selector =
    "[data-guide], main, section, article, header, footer, nav, h1, h2, h3, h4, h5, h6, p, a, button, form, input, select, textarea, [role='button'], [role='region']";
  
  const elements = Array.from(root.querySelectorAll(selector));

  if (currentDepth < maxDepth) {
    const all = root.querySelectorAll("*");
    for (const el of all) {
      if (el.tagName.toLowerCase() === "site-guide") continue;
      if (el.shadowRoot && el.shadowRoot.mode === "open") {
        const shadowCandidates = collectCandidateElements(el.shadowRoot, maxDepth, currentDepth + 1);
        elements.push(...shadowCandidates);
      }
    }
  }

  return elements;
}

export function scanPage(): PageNode[] {
  const nodes: PageNode[] = [];
  const maxNodes = 250;
  const maxTextPerNode = 700;

  // Find all semantic elements, including those in open shadow roots
  const candidates = collectCandidateElements(document);

  for (const el of candidates) {
    if (nodes.length >= maxNodes) break;
    if (!isElementVisible(el)) continue;

    const tag = el.tagName.toLowerCase();
    let role: PageNodeRole = "text";
    let inputType: string | undefined = undefined;
    let formState: PageNode["formState"] = undefined;

    if (["section", "article", "main", "header", "footer", "nav"].includes(tag)) {
      role = "section";
    } else if (/^h[1-6]$/.test(tag)) {
      role = "heading";
    } else if (tag === "button" || el.getAttribute("role") === "button") {
      role = "button";
    } else if (tag === "a") {
      role = "link";
    } else if (tag === "form") {
      role = "form";
    } else if (["input", "select", "textarea"].includes(tag)) {
      role = "form-field";
      if (el instanceof HTMLInputElement) {
        inputType = el.type || "text";
      } else {
        inputType = tag;
      }
      formState = getCoarseFormState(el as HTMLInputElement);
    } else if (tag === "p") {
      role = "text";
    }

    const accessibleName = computeAccessibleName(el).slice(0, 240);

    // Text content: sanitize and truncate
    let text = "";
    if (role === "text" || role === "heading" || role === "section") {
      text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > maxTextPerNode) {
        text = text.slice(0, maxTextPerNode - 3) + "...";
      }
      text = text.slice(0, maxTextPerNode);
    } else if (role === "button" || role === "link") {
      text = accessibleName;
    }

    // Skip generic empty text blocks
    if (role === "text" && !text) {
      continue;
    }

    const id = nodeRegistry.getOrCreateId(el, role);

    // Safe href
    let href: string | undefined = undefined;
    if (el instanceof HTMLAnchorElement && el.href) {
      try {
        const u = new URL(el.href);
        if (u.origin === window.location.origin) {
          href = u.pathname + u.search;
        }
      } catch {
        // ignore invalid URL
      }
    }

    // Purpose hint from title or aria-description
    const purpose = (el.getAttribute("title") || el.getAttribute("aria-description") || undefined)?.slice(0, 240);

    const isRequired = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
    const isDisabled = el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
    const isInvalid = el.getAttribute("aria-invalid") === "true";

    nodes.push({
      id,
      role,
      tagName: tag,
      accessibleName,
      text,
      purpose,
      href,
      inputType,
      required: isRequired || undefined,
      disabled: isDisabled || undefined,
      visible: true,
      ariaInvalid: isInvalid || undefined,
      formState,
    });
  }

  return nodes;
}
