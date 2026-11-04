import { PlannedStep } from "../page/manifest";

export interface TourStop {
  id: string;
  title: string;
  target: string;                // e.g. "[data-guide='features']", "#pricing", or node ID
  narration: string;
  spokenText?: string;
  gesture?: "none" | "point" | "point_left" | "point_right" | "explain" | "wave" | "celebrating" | "greeting";
  position?: "left" | "right" | "auto";
  next?: string;
  spotlight?: boolean;
  interactionInstruction?: string;
}

export type TourEngineState =
  | "idle"
  | "initializing"
  | "navigating"
  | "approaching"
  | "presenting"
  | "speaking"
  | "awaiting_user"
  | "paused"
  | "interrupted"
  | "completed"
  | "error";

export type TourStatus = "idle" | "running" | "paused" | "stopped" | "completed";

export interface TourProgress {
  currentIndex: number;
  totalSteps: number;
  percent: number;
  currentStop: TourStop | null;
  state: TourEngineState;
  isBookmarked: boolean;
}

export const DEFAULT_PAGE_TOUR: TourStop[] = [
  {
    id: "hero-intro",
    title: "Welcome & Hero",
    target: "[data-guide='hero']",
    narration: "Welcome! I'm your interactive 3D website guide. I physically walk across pages, explain features, and point directly to key elements.",
    gesture: "wave",
    position: "left",
    spotlight: true,
  },
  {
    id: "about-overview",
    title: "About NovaAI",
    target: "[data-guide='about']",
    narration: "NovaAI provides embodied spatial guides for modern web applications, built with zero-trust privacy and browser-isolated inputs.",
    gesture: "explain",
    position: "left",
    spotlight: true,
  },
  {
    id: "features-overview",
    title: "Core Capabilities",
    target: "[data-guide='features']",
    narration: "Check out our key capabilities: real-time spatial navigation, full-body humanoid avatars, zero-trust grounding, and interactive form guidance.",
    gesture: "point_right",
    position: "left",
    spotlight: true,
  },
  {
    id: "pricing-overview",
    title: "Transparent Pricing",
    target: "[data-guide='pricing']",
    narration: "Here are our transparent pricing plans. The Professional tier includes custom avatar models and high-fidelity speech synthesis.",
    gesture: "point_right",
    position: "left",
    spotlight: true,
  },
  {
    id: "contact-form",
    title: "Get in Touch",
    target: "[data-guide='contact']",
    narration: "Ready to transform your site into an interactive spatial experience? Fill out the inquiry form or click Get Started Free!",
    gesture: "point_left",
    position: "right",
    spotlight: true,
    interactionInstruction: "Try clicking Get Started or fill in your details",
  },
];

export class TourController {
  private stops: TourStop[] = [];
  private rawSteps: PlannedStep[] = [];
  private currentIndex = -1;
  private bookmarkedIndex = -1;
  private state: TourEngineState = "idle";
  private onStepChange?: (stop: TourStop, index: number, total: number) => void;
  private onStateChange?: (state: TourEngineState, progress: TourProgress) => void;
  private onComplete?: () => void;
  private isTransitioning = false;

  public start(
    steps?: (PlannedStep | TourStop)[],
    onStepChange?: (stop: any, index: number, total: number) => void,
    onComplete?: () => void,
    onStateChange?: (state: TourEngineState, progress: TourProgress) => void
  ): void {
    const sourceSteps = steps && steps.length > 0 ? steps : DEFAULT_PAGE_TOUR;

    this.stops = sourceSteps.map((s, idx) => this.normalizeStop(s, idx));
    this.rawSteps = this.stops.map((st) => ({
      targetNodeId: st.target,
      spokenText: st.narration,
      gesture: (st.gesture === "point" ? "point_right" : st.gesture || "explain") as any,
      stepKind: "section",
    }));

    this.currentIndex = 0;
    this.bookmarkedIndex = -1;
    this.setState("initializing");

    if (onStepChange) this.onStepChange = onStepChange;
    if (onComplete) this.onComplete = onComplete;
    if (onStateChange) this.onStateChange = onStateChange;

    this.triggerCurrentStep();
  }

  public next(): void {
    if (this.state === "completed" || this.state === "idle" || this.isTransitioning) return;
    if (this.currentIndex + 1 < this.stops.length) {
      this.currentIndex += 1;
      this.triggerCurrentStep();
    } else {
      this.complete();
    }
  }

  public previous(): void {
    if (this.state === "completed" || this.state === "idle" || this.isTransitioning) return;
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
      this.triggerCurrentStep();
    }
  }

  public skip(): void {
    this.next();
  }

  public restart(): void {
    if (this.stops.length === 0) return;
    this.currentIndex = 0;
    this.bookmarkedIndex = -1;
    this.triggerCurrentStep();
  }

  public pause(): void {
    if (this.state !== "idle" && this.state !== "completed" && this.state !== "paused") {
      this.setState("paused");
    }
  }

  public resume(): void {
    if (this.state === "paused" || this.state === "interrupted") {
      this.triggerCurrentStep();
    }
  }

  public interrupt(): void {
    if (this.state !== "idle" && this.state !== "completed") {
      this.bookmarkedIndex = this.currentIndex;
      this.setState("interrupted");
    }
  }

  public resumeFromBookmark(): void {
    if (this.bookmarkedIndex >= 0 && this.bookmarkedIndex < this.stops.length) {
      this.currentIndex = this.bookmarkedIndex;
      this.bookmarkedIndex = -1;
      this.triggerCurrentStep();
    } else if (this.currentIndex >= 0 && this.currentIndex < this.stops.length) {
      this.triggerCurrentStep();
    }
  }

  public stop(): void {
    this.setState("idle");
    this.stops = [];
    this.rawSteps = [];
    this.currentIndex = -1;
    this.bookmarkedIndex = -1;
    this.isTransitioning = false;
  }

  public complete(): void {
    this.setState("completed");
    const onDone = this.onComplete;
    this.stops = [];
    this.rawSteps = [];
    this.currentIndex = -1;
    this.bookmarkedIndex = -1;
    this.isTransitioning = false;
    this.setState("idle");
    if (onDone) {
      onDone();
    }
  }

  public setState(state: TourEngineState): void {
    this.state = state;
    if (this.onStateChange) {
      this.onStateChange(state, this.getProgress());
    }
  }

  public getState(): TourEngineState {
    return this.state;
  }

  /**
   * Backward-compatible status getter matching tests and legacy API
   */
  public getStatus(): TourStatus {
    if (this.state === "idle") return "idle";
    if (this.state === "completed") return "completed";
    if (this.state === "paused" || this.state === "interrupted") return "paused";
    return "running";
  }

  public getCurrentStep(): any {
    if (this.currentIndex >= 0 && this.currentIndex < this.stops.length) {
      return this.stops[this.currentIndex];
    }
    return null;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getTotalSteps(): number {
    return this.stops.length;
  }

  public getProgress(): TourProgress {
    const total = this.stops.length;
    const current = this.getCurrentStep();
    const percent = total > 0 ? Math.round(((this.currentIndex + 1) / total) * 100) : 0;
    return {
      currentIndex: this.currentIndex,
      totalSteps: total,
      percent,
      currentStop: current,
      state: this.state,
      isBookmarked: this.bookmarkedIndex >= 0,
    };
  }

  public setCallbacks(
    onStepChange?: (stop: TourStop, index: number, total: number) => void,
    onStateChange?: (state: TourEngineState, progress: TourProgress) => void,
    onComplete?: () => void
  ): void {
    if (onStepChange) this.onStepChange = onStepChange;
    if (onStateChange) this.onStateChange = onStateChange;
    if (onComplete) this.onComplete = onComplete;
  }

  private triggerCurrentStep(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.stops.length) {
      this.complete();
      return;
    }

    const stop = this.stops[this.currentIndex];
    this.setState("navigating");

    if (this.onStepChange) {
      // Pass both TourStop and PlannedStep structure for backward compatibility
      const legacyCompatibleStep = {
        ...stop,
        targetNodeId: stop.target,
        spokenText: stop.narration,
        stepKind: "section",
      };
      this.onStepChange(legacyCompatibleStep as any, this.currentIndex, this.stops.length);
    }
  }

  private normalizeStop(s: PlannedStep | TourStop, idx: number): TourStop {
    if ("narration" in s) {
      return {
        id: s.id || `stop_${idx}`,
        title: s.title || `Stop ${idx + 1}`,
        target: s.target,
        narration: s.narration,
        spokenText: s.spokenText || s.narration,
        gesture: s.gesture || "explain",
        position: s.position || "auto",
        next: s.next,
        spotlight: s.spotlight !== false,
        interactionInstruction: s.interactionInstruction,
      };
    }
    const ps = s as PlannedStep;
    return {
      id: ps.targetNodeId || `stop_${idx}`,
      title: ps.stepKind ? `${ps.stepKind.charAt(0).toUpperCase() + ps.stepKind.slice(1)}` : `Step ${idx + 1}`,
      target: ps.targetNodeId,
      narration: ps.spokenText,
      spokenText: ps.spokenText,
      gesture: ((ps.gesture as any) === "point" ? "point_right" : ps.gesture || "explain") as any,
      position: "auto",
      spotlight: true,
    };
  }
}

export const tourController = new TourController();
