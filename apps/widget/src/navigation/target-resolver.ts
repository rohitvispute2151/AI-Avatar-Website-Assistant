import { nodeRegistry } from "../page/node-registry";

export function resolveTargetElement(nodeId: string): HTMLElement | null {
  const el = nodeRegistry.resolve(nodeId);
  if (!el || !(el instanceof HTMLElement)) {
    return null;
  }
  if (!el.isConnected) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && !["SECTION", "MAIN", "ARTICLE"].includes(el.tagName)) {
    return null;
  }
  return el;
}

