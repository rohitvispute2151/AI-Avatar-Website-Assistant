import { FormState } from "./manifest";
import { nodeRegistry } from "./node-registry";

export function getCoarseFormState(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): FormState {
  if (el.disabled || el.type === "password") {
    return "unknown";
  }
  if (el.getAttribute("aria-invalid") === "true") {
    return "invalid";
  }
  if (el.validity && !el.validity.valid && el.value.length > 0) {
    return "invalid";
  }
  // Coarse check only - value itself is NEVER retained, logged, or sent
  if (el.value && el.value.trim().length > 0) {
    return "filled";
  }
  return "empty";
}

export class FormStateWatcher {
  private listener: (e: Event) => void;
  private onStateChange?: (nodeId: string, state: FormState) => void;

  constructor(onStateChange?: (nodeId: string, state: FormState) => void) {
    this.onStateChange = onStateChange;
    this.listener = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        const id = nodeRegistry.getOrCreateId(target, "field");
        const state = getCoarseFormState(target);
        if (this.onStateChange) {
          this.onStateChange(id, state);
        }
      }
    };
  }

  public start(): void {
    document.addEventListener("input", this.listener, true);
    document.addEventListener("change", this.listener, true);
    document.addEventListener("invalid", this.listener, true);
  }

  public stop(): void {
    document.removeEventListener("input", this.listener, true);
    document.removeEventListener("change", this.listener, true);
    document.removeEventListener("invalid", this.listener, true);
  }
}

