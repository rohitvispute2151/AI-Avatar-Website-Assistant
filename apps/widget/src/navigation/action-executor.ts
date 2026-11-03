import { TurnPlan, PlannedStep, Gesture, FormState } from "../page/manifest";
import { resolveTargetElement, findSectionForPlan, getVisualContentRect } from "./target-resolver";
import { scrollController } from "./scroll-controller";
import { calculateAvatarAnchor } from "./anchor-layout";
import { TargetHighlighter } from "./highlighter";
import { AvatarStage } from "../avatar/avatar-stage";
import { audioPlayer } from "../voice/audio-player";
import { tourController } from "../conversation/tour-controller";

const ALLOWED_INTENTS = new Set([
  "answer",
  "navigate_to_node",
  "start_tour",
  "guide_form_field",
  "stop",
  "unknown",
]);

export class ActionExecutor {
  private stage: AvatarStage;
  private highlighter: TargetHighlighter;
  private locale: string;
  private onSpeakStart?: () => void;
  private onSpeakEnd?: () => void;
  private setExplainingMode?: (explaining: boolean) => void;
  private getChatRect?: () => DOMRect | null;
  private activeTrackingCleanup?: () => void;

  constructor(
    stage: AvatarStage,
    highlighter: TargetHighlighter,
    locale: string = "en-US",
    onSpeakStart?: () => void,
    onSpeakEnd?: () => void,
    setExplainingMode?: (explaining: boolean) => void,
    getChatRect?: () => DOMRect | null
  ) {
    this.stage = stage;
    this.highlighter = highlighter;
    this.locale = locale;
    this.onSpeakStart = onSpeakStart;
    this.onSpeakEnd = onSpeakEnd;
    this.setExplainingMode = setExplainingMode;
    this.getChatRect = getChatRect;
  }

  public setExplainingModeHandler(fn: (explaining: boolean) => void): void {
    this.setExplainingMode = fn;
  }

  public setChatRectGetter(fn: () => DOMRect | null): void {
    this.getChatRect = fn;
  }

  public async executePlan(plan: TurnPlan): Promise<void> {
    if (!ALLOWED_INTENTS.has(plan.intent)) {
      console.warn(`ActionExecutor: Rejected unauthorized intent '${plan.intent}'`);
      return;
    }

    if (plan.intent === "stop") {
      this.stop();
      return;
    }

    if (plan.intent === "navigate_to_node" && plan.targetNodeId) {
      await this.navigate(plan.targetNodeId, plan.gesture, plan.answer);
      return;
    }

    if (plan.intent === "start_tour" && plan.steps && plan.steps.length > 0) {
      await this.startTour(plan.steps);
      return;
    }

    if (plan.intent === "guide_form_field" && plan.targetNodeId) {
      if (plan.steps && plan.steps.length > 0) {
        await this.startTour(plan.steps);
      } else {
        await this.guideFormField(plan.targetNodeId, plan.answer);
      }
      return;
    }

    // Default intent: "answer" or general explanation
    // Check if a page section or evidence element matches what is being explained
    const targetEl = findSectionForPlan(plan);
    if (targetEl) {
      await this.explainSection(targetEl, plan.gesture, plan.answer);
      return;
    }

    // If no specific page element is referenced, speak with natural two-handed presenting gesture
    this.stage.setGesture(plan.gesture || "explain");
    this.speak(plan.answer);
  }

  /**
   * Explains a section on the page without blocking its content.
   * Docks the avatar at a clean viewport edge away from the target,
   * scales down the avatar footprint, highlights the target, points with the nearest arm,
   * and smoothly returns to dock once finished.
   */
  public async explainSection(el: HTMLElement, gesture: Gesture, speechText: string): Promise<void> {
    this.cleanupActiveTracking();

    // 1. Measure visual content rect (cards, inner containers) instead of 100% width section wrapper
    let targetRect = getVisualContentRect(el);
    const vpWidth = typeof window !== "undefined" ? window.innerWidth : 1366;
    const isWide = targetRect.width > vpWidth * 0.55;

    // 2. Smooth scroll target element into view:
    // If target is wide, align to top ("start") below sticky header so the bottom half of viewport clears
    await scrollController.scrollToElement(el, isWide ? "start" : "center");

    // 3. Re-measure visual content rect after scroll settlement
    targetRect = getVisualContentRect(el);

    // 4. Calculate collision-free avatar anchor avoiding target and chat panel
    const chatRect = this.getChatRect ? this.getChatRect() : null;
    const anchor = calculateAvatarAnchor(targetRect, 290, 550, 20, true, chatRect);

    // 5. Highlight target section subtly
    this.highlighter.highlight(el);

    // 6. Move avatar to anchor (plays walk locomotion, animates scale)
    await this.stage.moveToAnchor(anchor);

    // 7. Point and gaze toward target element procedurally
    this.stage.pointAt(targetRect);

    // 8. Setup dynamic recomputation on scroll and window resize
    const updateTracking = () => {
      if (!el.isConnected) return;
      const currentRect = getVisualContentRect(el);
      this.stage.pointAt(currentRect);
    };
    window.addEventListener("scroll", updateTracking, { passive: true });
    window.addEventListener("resize", updateTracking, { passive: true });
    this.activeTrackingCleanup = () => {
      window.removeEventListener("scroll", updateTracking);
      window.removeEventListener("resize", updateTracking);
    };

    // 9. Speak answer, then return avatar to resting dock
    this.speak(speechText, () => {
      this.cleanupActiveTracking();
      setTimeout(() => {
        this.highlighter.clear();
        this.stage.stopPointing();
        this.stage.getRig()?.resetLookAt();
        this.stage.returnToDock();
      }, 1500);
    });
  }

  public async navigate(targetNodeId: string, gesture: Gesture, speechText: string): Promise<void> {
    const el = resolveTargetElement(targetNodeId);
    if (!el) {
      this.stage.setGesture("open_palm");
      this.speak("I couldn't locate that element on the current page.");
      return;
    }

    await this.explainSection(el, gesture, speechText);
  }

  public async startTour(steps: PlannedStep[]): Promise<void> {
    if (this.setExplainingMode) {
      this.setExplainingMode(true);
    }

    tourController.start(
      steps,
      async (step, index, total) => {
        this.cleanupActiveTracking();
        const el = resolveTargetElement(step.targetNodeId);
        if (el) {
          let targetRect = getVisualContentRect(el);
          const vpWidth = typeof window !== "undefined" ? window.innerWidth : 1366;
          const isWide = targetRect.width > vpWidth * 0.55;

          await scrollController.scrollToElement(el, isWide ? "start" : "center");
          targetRect = getVisualContentRect(el);

          const chatRect = this.getChatRect ? this.getChatRect() : null;
          const anchor = calculateAvatarAnchor(targetRect, 290, 550, 20, true, chatRect);

          this.highlighter.highlight(el);
          await this.stage.moveToAnchor(anchor);
          this.stage.pointAt(targetRect);

          const updateTracking = () => {
            if (!el.isConnected) return;
            const currentRect = getVisualContentRect(el);
            this.stage.pointAt(currentRect);
          };
          window.addEventListener("scroll", updateTracking, { passive: true });
          window.addEventListener("resize", updateTracking, { passive: true });
          this.activeTrackingCleanup = () => {
            window.removeEventListener("scroll", updateTracking);
            window.removeEventListener("resize", updateTracking);
          };
        } else {
          this.stage.setGesture(step.gesture || "open_palm");
        }
        this.speak(step.spokenText, () => {
          // Keep highlight until next step
        });
      },
      () => {
        this.cleanupActiveTracking();
        this.highlighter.clear();
        this.stage.stopPointing();
        this.stage.returnToDock();
        this.stage.setState("idle");
        if (this.setExplainingMode) {
          this.setExplainingMode(false);
        }
        tourController.stop();
        this.speak("That concludes our tour of the page! Let me know if you have any questions.");
      }
    );
  }

  public async guideFormField(targetNodeId: string, speechText: string): Promise<void> {
    const el = resolveTargetElement(targetNodeId);
    if (!el) {
      this.speak(speechText);
      return;
    }

    await this.explainSection(el, "point_right", speechText);
  }

  public handleFormStateChange(nodeId: string, state: FormState): void {
    if (tourController.getStatus() === "running") {
      const currentStep = tourController.getCurrentStep();
      if (currentStep && currentStep.targetNodeId === nodeId && currentStep.stepKind === "form_field") {
        if (state === "filled") {
          setTimeout(() => {
            if (tourController.getStatus() === "running") {
              tourController.next();
            }
          }, 1000);
        } else if (state === "invalid") {
          this.stage.setGesture("explain");
        }
      }
    }
  }

  public stop(): void {
    this.cleanupActiveTracking();
    tourController.stop();
    this.highlighter.clear();
    this.stage.stopPointing();
    this.stage.returnToDock();
    if (this.setExplainingMode) {
      this.setExplainingMode(false);
    }
    audioPlayer.stop();
    this.stage.setState("idle");
  }

  private cleanupActiveTracking(): void {
    if (this.activeTrackingCleanup) {
      this.activeTrackingCleanup();
      this.activeTrackingCleanup = undefined;
    }
  }

  private speak(text: string, onEnd?: () => void): void {
    this.stage.setState("speaking");
    if (this.onSpeakStart) this.onSpeakStart();

    audioPlayer.speakText(
      text,
      this.locale,
      () => {
        // onStart
      },
      () => {
        this.stage.setState("idle");
        if (this.onSpeakEnd) this.onSpeakEnd();
        if (onEnd) onEnd();
      }
    );
  }
}
