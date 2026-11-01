import { GestureController, GesturePose, ExtendedGesture } from "./gesture-controller";
import { Gesture } from "../page/manifest";

export type LocomotionState = "idle" | "walk";
export type AvatarHighLevelState =
  | "idle"
  | "walk"
  | "thinking"
  | "listening"
  | "speaking"
  | "point_left"
  | "point_right"
  | "explain";

export interface BlendedAvatarPose {
  rootY: number;
  torsoY: number;
  headRotation: { x: number; y: number; z: number };
  leftArmRotation: { x: number; y: number; z: number };
  rightArmRotation: { x: number; y: number; z: number };
  leftLegRotation: { x: number; y: number; z: number };
  rightLegRotation: { x: number; y: number; z: number };
  mouthScaleY: number;
}

export class AnimationController {
  private locomotion: LocomotionState = "idle";
  private gestureController: GestureController;
  private walkWeight = 0;
  private isReducedMotion = false;

  constructor(gestureController: GestureController) {
    this.gestureController = gestureController;
    this.checkReducedMotion();

    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
        this.isReducedMotion = e.matches;
      });
    }
  }

  private checkReducedMotion(): void {
    if (typeof window !== "undefined" && window.matchMedia) {
      this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }

  public setLocomotion(state: LocomotionState): void {
    this.locomotion = state;
  }

  public setGesture(gesture: ExtendedGesture | "none", durationMs?: number): void {
    this.gestureController.setGesture(gesture, durationMs);
  }

  public setState(state: AvatarHighLevelState): void {
    if (state === "walk") {
      this.setLocomotion("walk");
    } else {
      this.setLocomotion("idle");
      if (
        state === "point_left" ||
        state === "point_right" ||
        state === "explain" ||
        state === "thinking" ||
        state === "listening"
      ) {
        this.setGesture(state);
      } else if (state === "speaking") {
        this.setGesture("explain");
      } else if (state === "idle") {
        this.setGesture("none");
      }
    }
  }

  public update(delta: number, time: number, mouthOpen: number): BlendedAvatarPose {
    // 1. Update walk blend weight
    const targetWalkWeight = this.locomotion === "walk" ? 1.0 : 0.0;
    const walkBlendSpeed = 6.0;
    if (this.walkWeight < targetWalkWeight) {
      this.walkWeight = Math.min(1.0, this.walkWeight + delta * walkBlendSpeed);
    } else if (this.walkWeight > targetWalkWeight) {
      this.walkWeight = Math.max(0.0, this.walkWeight - delta * walkBlendSpeed);
    }

    // 2. Update upper-body gesture controller
    this.gestureController.update(delta);
    const gesturePose: GesturePose = this.gestureController.getPose(time);

    // 3. Motion multiplier for reduced-motion accessibility preference
    const motionFactor = this.isReducedMotion ? 0.25 : 1.0;

    // 4. Locomotion / Leg calculation
    const walkFreq = 8.0;
    const legSwing = Math.sin(time * walkFreq) * 0.65 * this.walkWeight * motionFactor;
    const rootBob = Math.abs(Math.sin(time * walkFreq * 2.0)) * 0.06 * this.walkWeight * motionFactor;

    // Idle breathing
    const breath = Math.sin(time * 2.0) * 0.02 * motionFactor;

    // 5. Blending arms: if walking and NO active gesture, swing arms naturally with walk gait.
    // If an upper-body gesture IS active, the gesture pose takes precedence on the arms!
    const activeGesture = this.gestureController.getActiveGesture();
    const hasActiveGesture = activeGesture !== "none";

    let leftArmX = gesturePose.leftArm.x;
    let rightArmX = gesturePose.rightArm.x;

    if (!hasActiveGesture && this.walkWeight > 0.01) {
      // Natural walking arm counter-swing
      const walkArmSwing = -legSwing * 0.8;
      leftArmX = walkArmSwing;
      rightArmX = -walkArmSwing;
    }

    // 6. Mouth aperture calculation
    const mouthScaleY = 1.0 + Math.max(0, mouthOpen) * 6.0;

    return {
      rootY: rootBob,
      torsoY: 1.25 + breath,
      headRotation: gesturePose.head,
      leftArmRotation: {
        x: leftArmX,
        y: gesturePose.leftArm.y,
        z: gesturePose.leftArm.z,
      },
      rightArmRotation: {
        x: rightArmX,
        y: gesturePose.rightArm.y,
        z: gesturePose.rightArm.z,
      },
      leftLegRotation: {
        x: legSwing,
        y: 0,
        z: 0,
      },
      rightLegRotation: {
        x: -legSwing,
        y: 0,
        z: 0,
      },
      mouthScaleY,
    };
  }

  public reset(): void {
    this.locomotion = "idle";
    this.walkWeight = 0;
    this.gestureController.reset();
  }
}

