export type PageNodeRole =
  | "page"
  | "section"
  | "heading"
  | "text"
  | "link"
  | "button"
  | "form"
  | "form-field"
  | "other-control";

export type FormState = "empty" | "filled" | "invalid" | "unknown";

export interface PageNode {
  id: string;                    // Widget-scoped ID, not a CSS selector
  parentId?: string;
  sectionId?: string;
  role: PageNodeRole;
  tagName: string;
  accessibleName: string;
  text: string;                  // Sanitized, visible, truncated text only
  purpose?: string;              // Derived conservatively from labels/attributes
  href?: string;                 // Same-origin safe URL only
  inputType?: string;            // Never the current value
  required?: boolean;
  disabled?: boolean;
  visible: boolean;
  ariaInvalid?: boolean;
  formState?: FormState;
}

export interface PageManifest {
  pageId: string;
  revision: number;
  contentHash: string;
  title: string;
  url: string;                   // Origin + path; strip query/hash by default
  locale?: string;
  nodes: PageNode[];
  createdAt: string;
}

export type Intent =
  | "answer"
  | "navigate_to_node"
  | "start_tour"
  | "guide_form_field"
  | "stop"
  | "unknown";

export type Gesture =
  | "none"
  | "open_palm"
  | "point_left"
  | "point_right"
  | "explain";

export interface EvidenceRef {
  nodeId: string;
  quote: string;
}

export interface PlannedStep {
  targetNodeId: string;
  spokenText: string;
  gesture: Gesture;
  stepKind: "section" | "form_field" | "control";
}

export interface TurnPlan {
  turnId: string;
  answer: string;
  intent: Intent;
  targetNodeId?: string;
  gesture: Gesture;
  steps: PlannedStep[];
  evidence: EvidenceRef[];
  confidence: number;
  pageRevision: number;
  shouldSpeak: boolean;
}

