import { PlannedStep } from "../page/manifest";

export type TourStatus = "idle" | "running" | "paused" | "stopped" | "completed";

export class TourController {
  private steps: PlannedStep[] = [];
  private currentIndex = -1;
  private status: TourStatus = "idle";
  private onStepChange?: (step: PlannedStep, index: number, total: number) => void;
  private onComplete?: () => void;

  public start(
    steps: PlannedStep[],
    onStepChange: (step: PlannedStep, index: number, total: number) => void,
    onComplete: () => void
  ): void {
    if (!steps || steps.length === 0) {
      this.status = "completed";
      onComplete();
      return;
    }

    this.steps = steps;
    this.currentIndex = 0;
    this.status = "running";
    this.onStepChange = onStepChange;
    this.onComplete = onComplete;

    this.triggerCurrentStep();
  }

  public next(): void {
    if (this.status !== "running" && this.status !== "paused") return;
    if (this.currentIndex + 1 < this.steps.length) {
      this.currentIndex += 1;
      this.status = "running";
      this.triggerCurrentStep();
    } else {
      this.complete();
    }
  }

  public previous(): void {
    if (this.status !== "running" && this.status !== "paused") return;
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
      this.status = "running";
      this.triggerCurrentStep();
    }
  }

  public pause(): void {
    if (this.status === "running") {
      this.status = "paused";
    }
  }

  public resume(): void {
    if (this.status === "paused") {
      this.status = "running";
      this.triggerCurrentStep();
    }
  }

  public stop(): void {
    this.status = "idle";
    this.steps = [];
    this.currentIndex = -1;
  }

  private complete(): void {
    this.status = "idle";
    this.steps = [];
    this.currentIndex = -1;
    if (this.onComplete) {
      this.onComplete();
    }
  }

  private triggerCurrentStep(): void {
    const step = this.steps[this.currentIndex];
    if (step && this.onStepChange) {
      this.onStepChange(step, this.currentIndex, this.steps.length);
    }
  }

  public getStatus(): TourStatus {
    return this.status;
  }

  public getCurrentStep(): PlannedStep | null {
    return this.steps[this.currentIndex] || null;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getTotalSteps(): number {
    return this.steps.length;
  }
}

export const tourController = new TourController();

