import { TurnPlan, PlannedStep, Gesture, FormState } from "../page/manifest";
import { resolveTargetElement } from "./target-resolver";
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

  constructor(
    stage: AvatarStage,
    highlighter: TargetHighlighter,
    locale: string = "en-US",
    onSpeakStart?: () => void,
    onSpeakEnd?: () => void
  ) {
    this.stage = stage;
    this.highlighter = highlighter;
    this.locale = locale;
    this.onSpeakStart = onSpeakStart;
    this.onSpeakEnd = onSpeakEnd;
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

    // Default: answer or unknown intent
    this.stage.setGesture(plan.gesture);
    this.speak(plan.answer);
  }

  public async navigate(targetNodeId: string, gesture: Gesture, speechText: string): Promise<void> {
    const el = resolveTargetElement(targetNodeId);
    if (!el) {
      this.stage.setGesture("open_palm");
      this.speak("I couldn't locate that element on the current page.");
      return;
    }

    // 1. Smooth scroll element into view
    await scrollController.scrollToElement(el);

    // 2. Recompute bounding rect and safe avatar anchor
    const rect = el.getBoundingClientRect();
    const anchor = calculateAvatarAnchor(rect);

    // 3. Highlight target
    this.highlighter.highlight(el);

    // 4. Move avatar to anchor (plays walk animation during transition)
    await this.stage.moveToAnchor(anchor);

    // 5. Point and aim gaze toward target element procedurally
    this.stage.pointAt(rect);

    this.speak(speechText, () => {
      // Clear highlight and reset look-at after speech finishes
      setTimeout(() => {
        this.highlighter.clear();
        this.stage.stopPointing();
        this.stage.getRig()?.resetLookAt();
        this.stage.returnToDock();
      }, 2000);
    });
  }

  public async startTour(steps: PlannedStep[]): Promise<void> {
    tourController.start(
      steps,
      async (step, index, total) => {
        const el = resolveTargetElement(step.targetNodeId);
        if (el) {
          await scrollController.scrollToElement(el);
          const rect = el.getBoundingClientRect();
          const anchor = calculateAvatarAnchor(rect);
          this.highlighter.highlight(el);
          await this.stage.moveToAnchor(anchor);
          this.stage.pointAt(rect);
        } else {
          this.stage.setGesture(step.gesture || "open_palm");
        }
        this.speak(step.spokenText, () => {
          // Keep highlight until next step
        });
      },
      () => {
        this.highlighter.clear();
        this.stage.stopPointing();
        this.stage.returnToDock();
        this.stage.setState("idle");
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

    await scrollController.scrollToElement(el);
    const rect = el.getBoundingClientRect();
    const anchor = calculateAvatarAnchor(rect);

    this.highlighter.highlight(el);
    await this.stage.moveToAnchor(anchor);
    this.stage.pointAt(rect);
    this.speak(speechText, () => {
      setTimeout(() => {
        this.stage.stopPointing();
      }, 1500);
    });
  }

  public handleFormStateChange(nodeId: string, state: FormState): void {
    if (tourController.getStatus() === "running") {
      const currentStep = tourController.getCurrentStep();
      if (currentStep && currentStep.targetNodeId === nodeId && currentStep.stepKind === "form_field") {
        if (state === "filled") {
          // Field completed! Smoothly advance to the next field in the form tour
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
    tourController.stop();
    this.highlighter.clear();
    this.stage.stopPointing();
    this.stage.returnToDock();
    audioPlayer.stop();
    this.stage.setState("idle");
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

