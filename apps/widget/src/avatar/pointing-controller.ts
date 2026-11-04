import * as THREE from "three";

export type PointingStyle = "point" | "present";

export interface GestureArmPose {
  shoulderQuat: THREE.Quaternion;
  armQuat: THREE.Quaternion;
  foreArmQuat: THREE.Quaternion;
  handQuat: THREE.Quaternion;
  fingers: Record<string, THREE.Quaternion>;
}

export interface DualArmGestureState {
  weight: number; // 0.0 (idle rest) to 1.0 (fully gesturing/pointing)
  isPointing: boolean;
  pointingSide: "left" | "right" | "none";
  style: PointingStyle;
  left: GestureArmPose;
  right: GestureArmPose;
  lookAtScreen: { x: number; y: number };
}

export interface PointingTargetBones {
  leftArm?: THREE.Bone | null;
  rightArm?: THREE.Bone | null;
  leftShoulder?: THREE.Bone | null;
  rightShoulder?: THREE.Bone | null;
}

const FINGER_NAMES = ["Index", "Middle", "Ring", "Pinky"];

/**
 * Procedural Target-Aware Pointing & Two-Handed Presenting Controller.
 *
 * Implements:
 * 1. Target-relative nearest hand selection:
 *    - Uses live 3D unprojection or projected shoulder distance to determine which arm
 *      provides the most natural reach toward the target element without crossing the torso.
 *    - In standard presentation facing the viewer:
 *      Target to screen-right (e.g. form fields) -> LeftArm (on screen-right) points directly outward.
 *      Target to screen-left -> RightArm (on screen-left) points directly outward.
 * 2. Full anatomical arm articulation:
 *    - Clavicle / Shoulder: elevation and extension toward target direction.
 *    - Upper Arm: raised and aimed along the 3D ray directly toward the target.
 *    - Forearm: natural elbow flexion (never locked or hyperextended, never drooping near waist).
 *    - Wrist / Hand: aligned with the pointing ray toward the target.
 *    - Finger articulation:
 *      - Point style (form fields, buttons, links, controls): Index finger fully extended straight,
 *        middle/ring/pinky curled into palm, thumb resting comfortably against the side.
 *      - Present style (sections, cards, broad areas): Softly opened welcoming palm.
 * 3. Supporting opposite arm:
 *    - Opposite arm rests naturally near waist/hip with subtle breathing micro-motion (never stiff).
 * 4. Two-Handed presenting gestures when speaking without target:
 *    - Both arms active with cycle variety (spread, emphasis beats, center, alternating).
 * 5. Smooth slerping and live tracking on scroll/resize:
 *    - Automatically aims at updated coordinates without resetting or snapping.
 */
export class PointingController {
  // Target pointing state
  private targetRect: DOMRect | null = null;
  private currentWeight = 0;
  private targetWeight = 0;
  private pointingSide: "left" | "right" | "none" = "none";
  private style: PointingStyle = "point";

  // Speaking / Explaining state
  private isSpeaking = false;
  private isExplaining = false;
  private speechEnergy = 0;

  // Screen aim coords for direct inter-target blending
  private currentAimX = 0;
  private currentAimY = 0;
  private targetAimX = 0;
  private targetAimY = 0;

  // 3D aim target quaternion smoothing
  private currentAimQuat = new THREE.Quaternion();
  private targetAimQuat = new THREE.Quaternion();

  // Gesture variety state machine for general speech
  private gestureTimer = 0;
  private currentGestureType = 0;
  private leadArm: "left" | "right" = "left";

  // Quaternions for Left Arm chain
  private leftShoulderQuat = new THREE.Quaternion();
  private leftArmQuat = new THREE.Quaternion();
  private leftForeArmQuat = new THREE.Quaternion();
  private leftHandQuat = new THREE.Quaternion();
  private leftFingerQuats: Record<string, THREE.Quaternion> = {};

  // Quaternions for Right Arm chain
  private rightShoulderQuat = new THREE.Quaternion();
  private rightArmQuat = new THREE.Quaternion();
  private rightForeArmQuat = new THREE.Quaternion();
  private rightHandQuat = new THREE.Quaternion();
  private rightFingerQuats: Record<string, THREE.Quaternion> = {};

  // Base bind quaternions for RPM armature shoulders
  private baseLeftShoulderQuat = new THREE.Quaternion(0.481688, 0.492769, -0.588907, 0.422308);
  private baseRightShoulderQuat = new THREE.Quaternion(0.481688, -0.49277, 0.588906, 0.422308);

  private lookAtScreen = { x: 0, y: 0 };

  constructor() {
    this.initFingerQuats();
  }

  private initFingerQuats(): void {
    ["Left", "Right"].forEach((side) => {
      const quats = side === "Left" ? this.leftFingerQuats : this.rightFingerQuats;
      FINGER_NAMES.forEach((f) => {
        [1, 2, 3].forEach((joint) => {
          quats[`${side}Hand${f}${joint}`] = new THREE.Quaternion();
        });
      });
      [1, 2].forEach((joint) => {
        quats[`${side}HandThumb${joint}`] = new THREE.Quaternion();
      });
    });
  }

  /**
   * Sets target element bounding rect for pointing.
   */
  public setTarget(
    targetRect: DOMRect | null,
    avatarLayerEl?: HTMLElement | null,
    canvasEl?: HTMLElement | null,
    camera?: THREE.PerspectiveCamera | null,
    style: PointingStyle = "point",
    bones?: PointingTargetBones
  ): { isEdgeCase: boolean; fallbackGesture?: "explain" } {
    if (!targetRect) {
      this.clearTarget();
      return { isEdgeCase: false };
    }

    this.targetRect = targetRect;
    this.style = style;

    // 1. Edge Case: Off-screen
    const vpW = typeof window !== "undefined" ? window.innerWidth : 1366;
    const vpH = typeof window !== "undefined" ? window.innerHeight : 768;
    const isOffscreen =
      targetRect.right < 0 ||
      targetRect.left > vpW ||
      targetRect.bottom < 0 ||
      targetRect.top > vpH;

    if (isOffscreen) {
      this.pointingSide = "none";
      this.targetWeight = this.isSpeaking || this.isExplaining ? 1.0 : 0.0;
      return { isEdgeCase: true, fallbackGesture: "explain" };
    }

    // Target center in viewport screen pixels
    const targetCenterX = targetRect.left + targetRect.width * 0.5;
    const targetCenterY = targetRect.top + targetRect.height * 0.5;

    // Avatar container rect in viewport screen pixels
    const aRect = avatarLayerEl
      ? avatarLayerEl.getBoundingClientRect()
      : {
          left: vpW - 320,
          top: vpH - 560,
          width: 290,
          height: 550,
        };

    const avatarCenterX = aRect.left + aRect.width * 0.5;
    const avatarShoulderY = aRect.top + aRect.height * 0.28;

    const dx = targetCenterX - avatarCenterX;
    const dy = targetCenterY - avatarShoulderY;
    const dist = Math.hypot(dx, dy);

    // Edge Case: target center is too close to avatar chest/shoulder (< 50px)
    if (dist < 50) {
      this.pointingSide = "none";
      this.targetWeight = this.isSpeaking || this.isExplaining ? 1.0 : 0.0;
      return { isEdgeCase: true, fallbackGesture: "explain" };
    }

    // 2. Select Nearest Arm:
    // In screen coordinates:
    // When the avatar faces the camera, LeftArm is on screen-right (+X), RightArm is on screen-left (-X).
    // If target is to the right of the avatar on screen (dx >= 0), LeftArm provides the direct,
    // unobstructed reach toward the element (e.g. contact form).
    // If target is to the left of the avatar on screen (dx < 0), RightArm provides the direct reach.
    // For backwards compatibility and high-level tests:
    // getActiveSide() returns "left" if target is on screen-left (dx < 0), "right" if on screen-right (dx >= 0).
    this.pointingSide = dx < 0 ? "left" : "right";
    this.targetAimX = dx;
    this.targetAimY = dy;
    this.targetWeight = 1.0;

    // 3. 3D Aim Ray calculation when Camera and Canvas are available
    if (camera && canvasEl) {
      const cRect = canvasEl.getBoundingClientRect();
      const ndcX = ((targetCenterX - cRect.left) / Math.max(1, cRect.width)) * 2 - 1;
      const ndcY = -(((targetCenterY - cRect.top) / Math.max(1, cRect.height)) * 2 - 1);

      // Unproject camera ray
      const nearPoint = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
      const farPoint = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
      const rayDir = farPoint.sub(nearPoint).normalize();

      // Intersect with presentation depth plane Z = 0.15 in front of the character
      const t = (0.15 - camera.position.z) / (rayDir.z !== 0 ? rayDir.z : -1e-6);
      const targetWorldPos = camera.position.clone().add(rayDir.multiplyScalar(t));

      // Chosen arm bone (LeftArm if dx >= 0, RightArm if dx < 0)
      const isScreenRight = dx >= 0;
      const activeShoulder = isScreenRight ? bones?.leftShoulder : bones?.rightShoulder;
      const shoulderWorldPos = activeShoulder
        ? activeShoulder.getWorldPosition(new THREE.Vector3())
        : (isScreenRight ? new THREE.Vector3(0.062, 1.35, 0) : new THREE.Vector3(-0.062, 1.35, 0));

      const shoulderWorldQuat = activeShoulder
        ? activeShoulder.getWorldQuaternion(new THREE.Quaternion())
        : (isScreenRight ? this.baseLeftShoulderQuat : this.baseRightShoulderQuat);

      // Target direction from shoulder to 3D point
      const targetDirWorld = targetWorldPos.clone().sub(shoulderWorldPos).normalize();

      // Transform target direction into shoulder's local coordinate system
      const localTargetDir = targetDirWorld.clone().applyQuaternion(shoulderWorldQuat.clone().invert()).normalize();

      // In Ready Player Me rig, bone primary axis is local (0, 1, 0)
      this.targetAimQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localTargetDir);
    } else {
      // Fallback screen-space Euler calculation
      this.computeFallbackAimQuat(dx, dy);
    }

    // Head gaze tracking towards target
    const normX = (targetCenterX - vpW * 0.5) / (vpW * 0.5);
    const normY = (targetCenterY - vpH * 0.5) / (vpH * 0.5);
    this.lookAtScreen = {
      x: Math.max(-1, Math.min(1, normX)),
      y: Math.max(-1, Math.min(1, normY)),
    };

    return { isEdgeCase: false };
  }

  private computeFallbackAimQuat(dx: number, dy: number): void {
    const isScreenRight = dx >= 0;
    const sign = isScreenRight ? 1 : -1;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;

    // Pitch: positive raises arm from downward hang to horizontal forward reach
    // Level is ~0.35 rad, higher targets reach up (~0.1), lower reach down (~0.55)
    const pitch = THREE.MathUtils.clamp(-ny * 0.55 + 0.35, -0.15, 0.65);
    const yaw = sign * (0.35 + Math.abs(nx) * 0.35);
    const roll = -sign * 0.18;

    this.targetAimQuat.setFromEuler(new THREE.Euler(pitch, yaw, roll, "XYZ"));
  }

  /**
   * Continuously updates pointing aim during scrolling, resizing, or avatar translation.
   */
  public updateAim(
    targetRect: DOMRect,
    avatarLayerEl?: HTMLElement | null,
    canvasEl?: HTMLElement | null,
    camera?: THREE.PerspectiveCamera | null,
    style: PointingStyle = this.style,
    bones?: PointingTargetBones
  ): void {
    if (!targetRect) return;
    this.setTarget(targetRect, avatarLayerEl, canvasEl, camera, style, bones);
  }

  public clearTarget(): void {
    this.targetRect = null;
    this.pointingSide = "none";
    if (!this.isSpeaking && !this.isExplaining) {
      this.targetWeight = 0;
    }
  }

  public stopPointing(): void {
    this.clearTarget();
  }

  public setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
    if (speaking || this.isExplaining || this.targetRect) {
      this.targetWeight = 1.0;
    } else {
      this.targetWeight = 0.0;
    }
  }

  public setExplaining(explaining: boolean): void {
    this.isExplaining = explaining;
    if (explaining || this.isSpeaking || this.targetRect) {
      this.targetWeight = 1.0;
    } else {
      this.targetWeight = 0.0;
    }
  }

  public setSpeechEnergy(energy: number): void {
    this.speechEnergy = Math.max(0, Math.min(1.0, energy));
  }

  public isPointing(): boolean {
    return this.pointingSide !== "none" && (this.currentWeight > 0.01 || this.targetWeight > 0.01);
  }

  public getActiveSide(): "left" | "right" | "none" {
    return this.pointingSide;
  }

  public getActiveArm(): "LeftArm" | "RightArm" | "none" {
    if (this.pointingSide === "none") return "none";
    return this.targetAimX >= 0 ? "LeftArm" : "RightArm";
  }

  public getStyle(): PointingStyle {
    return this.style;
  }

  /**
   * Main procedural evaluation loop called per frame.
   */
  public update(delta: number, time: number, speechEnergy = 0): DualArmGestureState {
    if (speechEnergy > 0) {
      this.speechEnergy = speechEnergy;
    }

    // Determine target weight
    const shouldBeActive = this.targetRect !== null || this.isSpeaking || this.isExplaining;
    this.targetWeight = shouldBeActive ? 1.0 : 0.0;

    // 1. Smooth blend in and out (ease speed ~3.6/s -> ~270ms transition)
    const blendSpeed = this.targetWeight > this.currentWeight ? 3.6 : 2.8;
    if (this.currentWeight < this.targetWeight) {
      this.currentWeight = Math.min(this.targetWeight, this.currentWeight + delta * blendSpeed);
    } else if (this.currentWeight > this.targetWeight) {
      this.currentWeight = Math.max(this.targetWeight, this.currentWeight - delta * blendSpeed);
    }

    // 2. Smooth aim interpolation for target pointing
    const aimBlendSpeed = 8.0;
    this.currentAimX += (this.targetAimX - this.currentAimX) * Math.min(1.0, delta * aimBlendSpeed);
    this.currentAimY += (this.targetAimY - this.currentAimY) * Math.min(1.0, delta * aimBlendSpeed);
    this.currentAimQuat.slerp(this.targetAimQuat, Math.min(1.0, delta * aimBlendSpeed));

    // 3. Gesture variety timer for two-handed presenting when speaking without a target
    this.gestureTimer += delta;
    if (this.gestureTimer > 3.6) {
      this.gestureTimer = 0;
      this.currentGestureType = (this.currentGestureType + 1) % 4;
      this.leadArm = this.leadArm === "left" ? "right" : "left";
    }

    // If completely idle, return zero weight
    if (this.currentWeight <= 0.001) {
      return {
        weight: 0,
        isPointing: false,
        pointingSide: "none",
        style: this.style,
        left: {
          shoulderQuat: this.baseLeftShoulderQuat,
          armQuat: this.leftArmQuat,
          foreArmQuat: this.leftForeArmQuat,
          handQuat: this.leftHandQuat,
          fingers: this.leftFingerQuats,
        },
        right: {
          shoulderQuat: this.baseRightShoulderQuat,
          armQuat: this.rightArmQuat,
          foreArmQuat: this.rightForeArmQuat,
          handQuat: this.rightHandQuat,
          fingers: this.rightFingerQuats,
        },
        lookAtScreen: this.lookAtScreen,
      };
    }

    // 4. Compute Poses for BOTH Arms
    if (this.pointingSide !== "none" && this.targetRect) {
      this.computePointingPose(time);
    } else {
      this.computePresentingPose(time);
    }

    return {
      weight: this.currentWeight,
      isPointing: this.pointingSide !== "none",
      pointingSide: this.pointingSide,
      style: this.style,
      left: {
        shoulderQuat: this.leftShoulderQuat,
        armQuat: this.leftArmQuat,
        foreArmQuat: this.leftForeArmQuat,
        handQuat: this.leftHandQuat,
        fingers: this.leftFingerQuats,
      },
      right: {
        shoulderQuat: this.rightShoulderQuat,
        armQuat: this.rightArmQuat,
        foreArmQuat: this.rightForeArmQuat,
        handQuat: this.rightHandQuat,
        fingers: this.rightFingerQuats,
      },
      lookAtScreen: this.lookAtScreen,
    };
  }

  /**
   * Computes Target-Aware Pointing Pose:
   * - Active arm is selected based on target direction (nearest to target without crossing torso).
   * - Active arm raises, extends, and aims toward the target element with proper shoulder,
   *   elbow, wrist, and finger articulation.
   * - Supporting opposite arm rests comfortably at the waist/hip with natural breathing drift.
   */
  private computePointingPose(time: number): void {
    // When target is to the right on screen (dx >= 0), LeftArm is on screen-right facing target.
    // When target is to the left on screen (dx < 0), RightArm is on screen-left facing target.
    const isScreenRight = this.targetAimX >= 0;
    const sign = isScreenRight ? 1 : -1;
    const microSway = Math.sin(time * 2.0) * 0.01;

    // --- 1. ACTIVE POINTING ARM ---
    // Clavicle elevation: subtle reach lift (5-8 degrees)
    const activeShoulderQuat = (isScreenRight ? this.baseLeftShoulderQuat : this.baseRightShoulderQuat)
      .clone()
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sign * 0.08)));

    // Upper Arm: Aim along target direction (from 3D unprojection or fallback)
    let activeArmQuat: THREE.Quaternion;
    if (this.currentAimQuat.lengthSq() > 0.1) {
      activeArmQuat = this.currentAimQuat.clone();
      // Add subtle microSway
      activeArmQuat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(microSway, 0, 0)));
    } else {
      const pitch = THREE.MathUtils.clamp(-this.targetAimY * 0.001 + 0.35, -0.15, 0.65);
      const yaw = sign * 0.55;
      const roll = -sign * 0.18;
      activeArmQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, "XYZ"));
    }

    // Forearm: Bent elbow with comfortable extension (15° - 25° bend, flex 0.28..0.42 rad)
    const isPoint = this.style === "point";
    const flexAngle = isPoint ? 0.30 : 0.42;
    const activeForeArmQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, sign),
      flexAngle + microSway * 0.5
    );

    // Hand / Wrist: Aligned with forearm pointing toward target
    const handPitch = isPoint ? -0.05 : -0.15;
    const handYaw = sign * 0.12;
    const handRoll = sign * 0.08;
    const activeHandQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(handPitch, handYaw, handRoll, "XYZ"));

    // --- 2. SUPPORTING OPPOSITE ARM (rests comfortably at waist/hip) ---
    const supShoulderQuat = isScreenRight ? this.baseRightShoulderQuat : this.baseLeftShoulderQuat;
    const supArmEuler = new THREE.Euler(
      1.06 + Math.sin(time * 1.8) * 0.015,
      -sign * 0.12,
      sign * 0.22,
      "XYZ"
    );
    const supForeEuler = new THREE.Euler(
      0.34,
      -sign * 0.08,
      -sign * (1.36 + Math.sin(time * 1.8 + 0.5) * 0.02),
      "XYZ"
    );
    const supHandEuler = new THREE.Euler(0.02, -sign * 0.14, sign * 0.08, "XYZ");

    const supArmQuat = new THREE.Quaternion().setFromEuler(supArmEuler);
    const supForeArmQuat = new THREE.Quaternion().setFromEuler(supForeEuler);
    const supHandQuat = new THREE.Quaternion().setFromEuler(supHandEuler);

    // Assign to Left / Right chains
    if (isScreenRight) {
      // LeftArm is ACTIVE pointing arm, RightArm is SUPPORTING arm
      this.leftShoulderQuat.copy(activeShoulderQuat);
      this.leftArmQuat.copy(activeArmQuat);
      this.leftForeArmQuat.copy(activeForeArmQuat);
      this.leftHandQuat.copy(activeHandQuat);

      this.rightShoulderQuat.copy(supShoulderQuat);
      this.rightArmQuat.copy(supArmQuat);
      this.rightForeArmQuat.copy(supForeArmQuat);
      this.rightHandQuat.copy(supHandQuat);

      this.applyFingerPoses("Left", isPoint ? "point" : "present");
      this.applyFingerPoses("Right", "relaxed");
    } else {
      // RightArm is ACTIVE pointing arm, LeftArm is SUPPORTING arm
      this.rightShoulderQuat.copy(activeShoulderQuat);
      this.rightArmQuat.copy(activeArmQuat);
      this.rightForeArmQuat.copy(activeForeArmQuat);
      this.rightHandQuat.copy(activeHandQuat);

      this.leftShoulderQuat.copy(supShoulderQuat);
      this.leftArmQuat.copy(supArmQuat);
      this.leftForeArmQuat.copy(supForeArmQuat);
      this.leftHandQuat.copy(supHandQuat);

      this.applyFingerPoses("Right", isPoint ? "point" : "present");
      this.applyFingerPoses("Left", "relaxed");
    }
  }

  /**
   * Applies anatomically correct finger poses to a specific hand.
   */
  private applyFingerPoses(side: "Left" | "Right", pose: "point" | "present" | "relaxed"): void {
    const quats = side === "Left" ? this.leftFingerQuats : this.rightFingerQuats;
    const isLeft = side === "Left";
    const sign = isLeft ? 1 : -1;

    if (pose === "point") {
      // Index finger extended straight toward target
      [1, 2, 3].forEach((joint) => {
        quats[`${side}HandIndex${joint}`].setFromEuler(new THREE.Euler(0.02, 0, 0, "XYZ"));
      });

      // Middle, Ring, Pinky curled tightly into palm
      [1, 2, 3].forEach((joint) => {
        quats[`${side}HandMiddle${joint}`].setFromEuler(new THREE.Euler(joint === 1 ? 0.95 : 1.05, 0, 0, "XYZ"));
        quats[`${side}HandRing${joint}`].setFromEuler(new THREE.Euler(joint === 1 ? 1.0 : 1.10, 0, 0, "XYZ"));
        quats[`${side}HandPinky${joint}`].setFromEuler(new THREE.Euler(joint === 1 ? 1.1 : 1.15, 0, 0, "XYZ"));
      });

      // Thumb tucked comfortably against side of curled fingers
      quats[`${side}HandThumb1`].setFromEuler(new THREE.Euler(0.35, 0, sign * 0.40, "XYZ"));
      quats[`${side}HandThumb2`].setFromEuler(new THREE.Euler(0.28, 0, sign * 0.25, "XYZ"));
    } else if (pose === "present") {
      // Open welcoming palm: All fingers softly open, palm facing target/viewer
      FINGER_NAMES.forEach((f) => {
        [1, 2, 3].forEach((joint) => {
          const curlX = 0.16 + joint * 0.03;
          quats[`${side}Hand${f}${joint}`].setFromEuler(new THREE.Euler(curlX, 0, 0, "XYZ"));
        });
      });
      quats[`${side}HandThumb1`].setFromEuler(new THREE.Euler(0.22, 0, sign * 0.28, "XYZ"));
      quats[`${side}HandThumb2`].setFromEuler(new THREE.Euler(0.18, 0, sign * 0.15, "XYZ"));
    } else {
      // Relaxed resting curl
      FINGER_NAMES.forEach((f) => {
        [1, 2, 3].forEach((joint) => {
          const curlX = 0.36 + joint * 0.07;
          quats[`${side}Hand${f}${joint}`].setFromEuler(new THREE.Euler(curlX, 0, 0, "XYZ"));
        });
      });
      quats[`${side}HandThumb1`].setFromEuler(new THREE.Euler(0.22, 0, sign * 0.24, "XYZ"));
      quats[`${side}HandThumb2`].setFromEuler(new THREE.Euler(0.20, 0, sign * 0.18, "XYZ"));
    }
  }

  /**
   * Computes Two-Handed Explaining / Presenting Poses when speaking without target.
   */
  private computePresentingPose(time: number): void {
    const energy = Math.min(1.0, this.speechEnergy * 2.5);
    const breathingDrift = Math.sin(time * 1.6) * 0.012;

    const leadOffset = this.leadArm === "left" ? 0.28 : -0.28;
    const phaseL = time * 2.2 + leadOffset * 0.5;
    const phaseR = time * 2.2 - leadOffset * 0.5;

    let lPitch = 1.02 + breathingDrift;
    let rPitch = 1.02 + breathingDrift;

    let lYaw = 0.18;
    let rYaw = -0.18;

    let lRoll = -0.22;
    let rRoll = 0.22;

    let lFlex = 1.45;
    let rFlex = -1.45;

    let lHandPitch = 0.04;
    let rHandPitch = 0.04;
    let lHandYaw = -0.18;
    let rHandYaw = 0.18;

    switch (this.currentGestureType) {
      case 0: {
        // Welcoming spread
        const spreadL = (Math.sin(phaseL) * 0.5 + 0.5) * 0.10 * (1.0 + energy * 0.5);
        const spreadR = (Math.sin(phaseR) * 0.5 + 0.5) * 0.09 * (1.0 + energy * 0.5);
        lYaw += spreadL;
        rYaw -= spreadR;
        lRoll -= spreadL * 0.4;
        rRoll += spreadR * 0.4;
        lFlex += spreadL * 0.3;
        rFlex -= spreadR * 0.3;
        break;
      }
      case 1: {
        // Speech rhythm emphasis beats
        const beatL = Math.sin(phaseL * 1.8) * (0.05 + energy * 0.12);
        const beatR = Math.sin(phaseR * 1.8) * (0.045 + energy * 0.11);
        lPitch -= beatL * 0.6;
        rPitch -= beatR * 0.6;
        lFlex += beatL * 0.5;
        rFlex -= beatR * 0.5;
        lHandPitch += beatL * 0.3;
        rHandPitch += beatR * 0.3;
        break;
      }
      case 2: {
        // Center describing
        const centerL = Math.cos(phaseL * 1.2) * 0.07;
        const centerR = Math.cos(phaseR * 1.2) * 0.065;
        lYaw -= centerL;
        rYaw += centerR;
        lHandYaw += centerL * 0.5;
        rHandYaw -= centerR * 0.5;
        break;
      }
      case 3:
      default: {
        // Alternating cadence
        const altL = Math.sin(phaseL * 1.5) * (0.06 + energy * 0.08);
        const altR = Math.sin(phaseR * 1.5 + 1.2) * (0.04 + energy * 0.06);
        lPitch -= altL * 0.5;
        rPitch -= altR * 0.4;
        lFlex += altL * 0.4;
        rFlex -= altR * 0.3;
        break;
      }
    }

    lPitch = THREE.MathUtils.clamp(lPitch, 0.85, 1.15);
    rPitch = THREE.MathUtils.clamp(rPitch, 0.85, 1.15);

    lYaw = THREE.MathUtils.clamp(lYaw, 0.06, 0.32);
    rYaw = THREE.MathUtils.clamp(rYaw, -0.32, -0.06);

    lRoll = THREE.MathUtils.clamp(lRoll, -0.32, -0.12);
    rRoll = THREE.MathUtils.clamp(rRoll, 0.12, 0.32);

    lFlex = THREE.MathUtils.clamp(lFlex, 1.22, 1.70);
    rFlex = THREE.MathUtils.clamp(rFlex, -1.70, -1.22);

    this.leftShoulderQuat.copy(this.baseLeftShoulderQuat);
    this.rightShoulderQuat.copy(this.baseRightShoulderQuat);

    this.leftArmQuat.setFromEuler(new THREE.Euler(lPitch, lYaw, lRoll, "XYZ"));
    this.leftForeArmQuat.setFromEuler(new THREE.Euler(0.32, 0.10, lFlex, "XYZ"));
    this.leftHandQuat.setFromEuler(new THREE.Euler(lHandPitch, lHandYaw, 0.12, "XYZ"));

    this.rightArmQuat.setFromEuler(new THREE.Euler(rPitch, rYaw, rRoll, "XYZ"));
    this.rightForeArmQuat.setFromEuler(new THREE.Euler(0.32, -0.10, rFlex, "XYZ"));
    this.rightHandQuat.setFromEuler(new THREE.Euler(rHandPitch, rHandYaw, -0.12, "XYZ"));

    this.applyFingerPoses("Left", "present");
    this.applyFingerPoses("Right", "present");
  }
}
