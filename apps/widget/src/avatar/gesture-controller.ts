import { Gesture } from "../page/manifest";

export type ExtendedGesture = Gesture | "thinking" | "wave" | "hands_on_hips" | "listening";

export interface GesturePose {
  leftArm: { x: number; y: number; z: number };
  rightArm: { x: number; y: number; z: number };
  head: { x: number; y: number; z: number };
}

export class GestureController {
  private currentGesture: ExtendedGesture = "none";
  private targetGesture: ExtendedGesture = "none";
  private gestureWeight = 0; // 0 to 1 for blending
  private transitionSpeed = 4.0; // speed of cross-fading
  private gestureTimer: number | null = null;

  public setGesture(gesture: ExtendedGesture, durationMs?: number): void {
    this.targetGesture = gesture;
    
    if (this.gestureTimer !== null) {
      window.clearTimeout(this.gestureTimer);
      this.gestureTimer = null;
    }

    if (durationMs && durationMs > 0 && gesture !== "none") {
      this.gestureTimer = window.setTimeout(() => {
        this.targetGesture = "none";
        this.gestureTimer = null;
      }, durationMs);
    }
  }

  public getActiveGesture(): ExtendedGesture {
    return this.currentGesture;
  }

  public update(delta: number): void {
    if (this.currentGesture !== this.targetGesture) {
      this.gestureWeight -= delta * this.transitionSpeed;
      if (this.gestureWeight <= 0) {
        this.gestureWeight = 0;
        this.currentGesture = this.targetGesture;
      }
    } else {
      if (this.gestureWeight < 1) {
        this.gestureWeight = Math.min(1, this.gestureWeight + delta * this.transitionSpeed);
      }
    }
  }

  public getPose(time: number): GesturePose {
    const defaultPose: GesturePose = {
      leftArm: { x: 0, y: 0, z: 0.15 + Math.sin(time * 2.0) * 0.03 },
      rightArm: { x: 0, y: 0, z: -0.15 - Math.sin(time * 2.0) * 0.03 },
      head: { x: Math.sin(time * 1.5) * 0.04, y: Math.sin(time * 0.8) * 0.06, z: 0 },
    };

    if (this.currentGesture === "none" || this.gestureWeight <= 0) {
      return defaultPose;
    }

    let activePose: GesturePose;

    switch (this.currentGesture) {
      case "point_left":
        activePose = {
          leftArm: {
            x: 0,
            y: 0.35,
            z: 1.25 - Math.sin(time * 3.0) * 0.04,
          },
          rightArm: { x: 0, y: 0, z: -0.1 },
          head: { x: 0, y: 0.28, z: 0 },
        };
        break;

      case "point_right":
        activePose = {
          leftArm: { x: 0, y: 0, z: 0.1 },
          rightArm: {
            x: 0,
            y: -0.35,
            z: -1.25 + Math.sin(time * 3.0) * 0.04,
          },
          head: { x: 0, y: -0.28, z: 0 },
        };
        break;

      case "open_palm":
      case "explain":
        activePose = {
          leftArm: {
            x: -0.45 + Math.sin(time * 3.0) * 0.08,
            y: 0.15,
            z: 0.35,
          },
          rightArm: {
            x: -0.45 - Math.sin(time * 3.0 + 1.2) * 0.08,
            y: -0.15,
            z: -0.35,
          },
          head: {
            x: -0.05 + Math.sin(time * 2.5) * 0.03,
            y: Math.sin(time * 1.5) * 0.05,
            z: 0,
          },
        };
        break;

      case "thinking":
        activePose = {
          leftArm: { x: 0, y: 0, z: 0.1 },
          rightArm: { x: -1.45, y: -0.2, z: -0.4 },
          head: { x: -0.22, y: 0.28, z: 0.05 },
        };
        break;

      case "listening":
        activePose = {
          leftArm: { x: -0.18, y: 0.1, z: 0.22 + Math.sin(time * 2.0) * 0.02 },
          rightArm: { x: 0.05, y: -0.05, z: -0.15 - Math.sin(time * 2.0) * 0.02 },
          head: {
            x: 0.1 + Math.sin(time * 2.0) * 0.02,
            y: 0.12 + Math.sin(time * 1.2) * 0.03,
            z: 0.06,
          },
        };
        break;

      case "wave":
        activePose = {
          leftArm: { x: 0, y: 0, z: 0.1 },
          rightArm: {
            x: 0,
            y: 0,
            z: -1.6 + Math.sin(time * 7.0) * 0.25,
          },
          head: { x: -0.05, y: -0.1, z: 0 },
        };
        break;

      default:
        activePose = defaultPose;
        break;
    }

    // Blend between default pose and active gesture pose using gestureWeight
    const w = this.gestureWeight;
    return {
      leftArm: {
        x: defaultPose.leftArm.x * (1 - w) + activePose.leftArm.x * w,
        y: defaultPose.leftArm.y * (1 - w) + activePose.leftArm.y * w,
        z: defaultPose.leftArm.z * (1 - w) + activePose.leftArm.z * w,
      },
      rightArm: {
        x: defaultPose.rightArm.x * (1 - w) + activePose.rightArm.x * w,
        y: defaultPose.rightArm.y * (1 - w) + activePose.rightArm.y * w,
        z: defaultPose.rightArm.z * (1 - w) + activePose.rightArm.z * w,
      },
      head: {
        x: defaultPose.head.x * (1 - w) + activePose.head.x * w,
        y: defaultPose.head.y * (1 - w) + activePose.head.y * w,
        z: defaultPose.head.z * (1 - w) + activePose.head.z * w,
      },
    };
  }

  public reset(): void {
    this.currentGesture = "none";
    this.targetGesture = "none";
    this.gestureWeight = 0;
    if (this.gestureTimer !== null) {
      window.clearTimeout(this.gestureTimer);
      this.gestureTimer = null;
    }
  }
}

export const gestureController = new GestureController();

