import * as THREE from "three";

export interface GestureArmPose {
  armQuat: THREE.Quaternion;
  foreArmQuat: THREE.Quaternion;
  handQuat: THREE.Quaternion;
}

export interface DualArmGestureState {
  weight: number; // 0.0 (idle rest) to 1.0 (fully gesturing/pointing)
  isPointing: boolean;
  pointingSide: "left" | "right" | "none";
  left: GestureArmPose;
  right: GestureArmPose;
  lookAtScreen: { x: number; y: number };
}

/**
 * Procedural Two-Handed Presenting & Target Aiming Controller.
 *
 * Enforces:
 * 1. Two-Handed presenting gestures when speaking or explaining with:
 *    - Resting state: upper arms close to torso, elbows bent at 70-100 deg,
 *      forearms raised forward at waist/chest height, hands open with palms facing viewer/up.
 *    - Cycle variety across 4 distinct gestures (open welcoming spread, speech emphasis beats,
 *      centered describing, and asymmetric cadence with one leading hand).
 *    - Speech energy coupling from real-time lip-sync/visemes.
 *    - Asymmetric timing (120-150ms delay between arms) and amplitude offsets.
 * 2. Pointing at page elements with:
 *    - Bent-elbow reach with nearest arm (never fully extended sideways).
 *    - Opposite arm performing a natural supporting waist/chest gesture (never stiff/frozen).
 *    - Fallback to two-handed presenting if target is off-screen, behind chat, or out of reach.
 *    - Strict joint limits so no limb ever hyperextends or droops.
 */
export class PointingController {
  // Target pointing state
  private targetRect: DOMRect | null = null;
  private currentWeight = 0;
  private targetWeight = 0;
  private pointingSide: "left" | "right" | "none" = "none";

  // Speaking / Explaining state
  private isSpeaking = false;
  private isExplaining = false;
  private speechEnergy = 0;

  // Smoothed screen aim coords for direct inter-target blending
  private currentAimX = 0;
  private currentAimY = 0;
  private targetAimX = 0;
  private targetAimY = 0;

  // Gesture variety state machine
  private gestureTimer = 0;
  private currentGestureType = 0; // 0: spread, 1: emphasis, 2: center, 3: alternating
  private leadArm: "left" | "right" = "left";

  // Quaternions for Left Arm chain
  private leftArmQuat = new THREE.Quaternion();
  private leftForeArmQuat = new THREE.Quaternion();
  private leftHandQuat = new THREE.Quaternion();

  // Quaternions for Right Arm chain
  private rightArmQuat = new THREE.Quaternion();
  private rightForeArmQuat = new THREE.Quaternion();
  private rightHandQuat = new THREE.Quaternion();

  private lookAtScreen = { x: 0, y: 0 };

  /**
   * Sets target element bounding rect for pointing.
   */
  public setTarget(
    targetRect: DOMRect | null,
    avatarLayerEl?: HTMLElement | null,
    chatShellEl?: HTMLElement | null
  ): { isEdgeCase: boolean; fallbackGesture?: "explain" } {
    if (!targetRect) {
      this.clearTarget();
      return { isEdgeCase: false };
    }

    this.targetRect = targetRect;

    // 1. Edge Case: Off-screen
    const isOffscreen =
      targetRect.right < 0 ||
      targetRect.left > window.innerWidth ||
      targetRect.bottom < 0 ||
      targetRect.top > window.innerHeight;

    if (isOffscreen) {
      this.pointingSide = "none";
      // Fall back to two-handed presenting
      this.targetWeight = this.isSpeaking || this.isExplaining ? 1.0 : 0.0;
      return { isEdgeCase: true, fallbackGesture: "explain" };
    }

    // 2. Edge Case: Behind chat box
    if (chatShellEl) {
      const chatRect = chatShellEl.getBoundingClientRect();
      const overlapsChat = !(
        targetRect.right < chatRect.left ||
        targetRect.left > chatRect.right ||
        targetRect.bottom < chatRect.top ||
        targetRect.top > chatRect.bottom
      );
      if (overlapsChat) {
        this.pointingSide = "none";
        this.targetWeight = this.isSpeaking || this.isExplaining ? 1.0 : 0.0;
        return { isEdgeCase: true, fallbackGesture: "explain" };
      }
    }

    // 3. Compute relative vector from avatar chest/shoulder center
    const avatarRect = avatarLayerEl
      ? avatarLayerEl.getBoundingClientRect()
      : {
          left: window.innerWidth - 320,
          top: window.innerHeight - 560,
          width: 290,
          height: 550,
        };

    const avatarCenterX = avatarRect.left + avatarRect.width * 0.5;
    const avatarShoulderY = avatarRect.top + avatarRect.height * 0.28;

    const targetCenterX = targetRect.left + targetRect.width * 0.5;
    const targetCenterY = targetRect.top + targetRect.height * 0.5;

    const dx = targetCenterX - avatarCenterX;
    const dy = targetCenterY - avatarShoulderY;
    const dist = Math.hypot(dx, dy);

    // 4. Edge Case: Very close to avatar
    if (dist < 75) {
      this.pointingSide = "none";
      this.targetWeight = this.isSpeaking || this.isExplaining ? 1.0 : 0.0;
      return { isEdgeCase: true, fallbackGesture: "explain" };
    }

    // Valid target: choose closest arm and aim
    this.targetAimX = dx;
    this.targetAimY = dy;
    this.pointingSide = dx < 0 ? "left" : "right";
    this.targetWeight = 1.0;

    // Head gaze tracking towards target
    const normX = (targetCenterX - window.innerWidth * 0.5) / (window.innerWidth * 0.5);
    const normY = (targetCenterY - window.innerHeight * 0.5) / (window.innerHeight * 0.5);
    this.lookAtScreen = {
      x: Math.max(-1, Math.min(1, normX)),
      y: Math.max(-1, Math.min(1, normY)),
    };

    return { isEdgeCase: false };
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

    // 1. Smooth blend in and out (ease speed ~3.5/s -> ~280ms transition)
    const blendSpeed = this.targetWeight > this.currentWeight ? 3.5 : 2.8;
    if (this.currentWeight < this.targetWeight) {
      this.currentWeight = Math.min(this.targetWeight, this.currentWeight + delta * blendSpeed);
    } else if (this.currentWeight > this.targetWeight) {
      this.currentWeight = Math.max(this.targetWeight, this.currentWeight - delta * blendSpeed);
    }

    // 2. Smooth aim interpolation for target pointing
    const aimBlendSpeed = 7.0;
    this.currentAimX += (this.targetAimX - this.currentAimX) * Math.min(1.0, delta * aimBlendSpeed);
    this.currentAimY += (this.targetAimY - this.currentAimY) * Math.min(1.0, delta * aimBlendSpeed);

    // 3. Gesture variety timer for two-handed presenting (switches gesture every ~3.5s)
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
        left: {
          armQuat: this.leftArmQuat,
          foreArmQuat: this.leftForeArmQuat,
          handQuat: this.leftHandQuat,
        },
        right: {
          armQuat: this.rightArmQuat,
          foreArmQuat: this.rightForeArmQuat,
          handQuat: this.rightHandHandQuatSafe(),
        },
        lookAtScreen: this.lookAtScreen,
      };
    }

    // 4. Compute Poses for BOTH Arms
    if (this.pointingSide !== "none" && this.targetRect) {
      // -------------------------------------------------------------
      // POINTING MODE: Nearest arm points, other arm supports at waist
      // -------------------------------------------------------------
      this.computePointingPose(time);
    } else {
      // -------------------------------------------------------------
      // TWO-HANDED PRESENTING MODE: Explaining / Speaking without target
      // -------------------------------------------------------------
      this.computePresentingPose(time);
    }

    return {
      weight: this.currentWeight,
      isPointing: this.pointingSide !== "none",
      pointingSide: this.pointingSide,
      left: {
        armQuat: this.leftArmQuat,
        foreArmQuat: this.leftForeArmQuat,
        handQuat: this.leftHandQuat,
      },
      right: {
        armQuat: this.rightArmQuat,
        foreArmQuat: this.rightForeArmQuat,
        handQuat: this.rightHandQuat,
      },
      lookAtScreen: this.lookAtScreen,
    };
  }

  private rightHandHandQuatSafe(): THREE.Quaternion {
    return this.rightHandQuat;
  }

  /**
   * Computes Two-Handed Explaining / Presenting Poses.
   * Both arms are bent at 70-100 deg at the elbows, forearms raised forward
   * at waist/chest height, hands open with palms facing viewer/up.
   */
  private computePresentingPose(time: number): void {
    const energy = Math.min(1.0, this.speechEnergy * 2.5); // Normalized 0..1
    const breathingDrift = Math.sin(time * 1.6) * 0.012;

    // Asymmetric timing: Left leads by ~130ms or Right leads depending on cycle
    const leadOffset = this.leadArm === "left" ? 0.28 : -0.28;
    const phaseL = time * 2.2 + leadOffset * 0.5;
    const phaseR = time * 2.2 - leadOffset * 0.5;

    // Base resting presenting pose (upper arms close to sides, elbows bent 75-90 deg)
    let lPitch = 1.02 + breathingDrift;
    let rPitch = 1.02 + breathingDrift;

    let lYaw = 0.18;
    let rYaw = -0.18;

    let lRoll = -0.22;
    let rRoll = 0.22;

    // Elbow flexion (Left: +Z, Right: -Z for Mixamo/Wolf3D armature)
    // 1.45 rad ~= 83 degrees bend forward and up
    let lFlex = 1.45;
    let rFlex = -1.45;

    let lHandPitch = 0.04;
    let rHandPitch = 0.04;
    let lHandYaw = -0.18;
    let rHandYaw = 0.18;

    // Apply gesture variety pattern
    switch (this.currentGestureType) {
      case 0: {
        // Welcoming / Explaining open palms spreading slightly outward
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
        // Speech rhythm emphasis beats (both hands moving up and down in speech cadence)
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
        // Describing / comparing: Hands drawing slightly toward center, then outward
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
        // Alternating cadence: One hand leads slightly higher while other holds support
        const altL = Math.sin(phaseL * 1.5) * (0.06 + energy * 0.08);
        const altR = Math.sin(phaseR * 1.5 + 1.2) * (0.04 + energy * 0.06);
        lPitch -= altL * 0.5;
        rPitch -= altR * 0.4;
        lFlex += altL * 0.4;
        rFlex -= altR * 0.3;
        break;
      }
    }

    // Enforce strict anatomical joint limits
    lPitch = THREE.MathUtils.clamp(lPitch, 0.85, 1.15);
    rPitch = THREE.MathUtils.clamp(rPitch, 0.85, 1.15);

    lYaw = THREE.MathUtils.clamp(lYaw, 0.06, 0.32);
    rYaw = THREE.MathUtils.clamp(rYaw, -0.32, -0.06);

    lRoll = THREE.MathUtils.clamp(lRoll, -0.32, -0.12);
    rRoll = THREE.MathUtils.clamp(rRoll, 0.12, 0.32);

    // Elbow flexion: ALWAYS bent at 70-100 deg (1.20 - 1.75 rad)
    lFlex = THREE.MathUtils.clamp(lFlex, 1.22, 1.70);
    rFlex = THREE.MathUtils.clamp(rFlex, -1.70, -1.22);

    // Build quaternions
    const lArmEuler = new THREE.Euler(lPitch, lYaw, lRoll, "XYZ");
    const lForeEuler = new THREE.Euler(0.32, 0.10, lFlex, "XYZ");
    const lHandEuler = new THREE.Euler(lHandPitch, lHandYaw, 0.12, "XYZ");

    const rArmEuler = new THREE.Euler(rPitch, rYaw, rRoll, "XYZ");
    const rForeEuler = new THREE.Euler(0.32, -0.10, rFlex, "XYZ");
    const rHandEuler = new THREE.Euler(rHandPitch, rHandYaw, -0.12, "XYZ");

    this.leftArmQuat.setFromEuler(lArmEuler);
    this.leftForeArmQuat.setFromEuler(lForeEuler);
    this.leftHandQuat.setFromEuler(lHandEuler);

    this.rightArmQuat.setFromEuler(rArmEuler);
    this.rightForeArmQuat.setFromEuler(rForeEuler);
    this.rightHandQuat.setFromEuler(rHandEuler);
  }

  /**
   * Computes Target Pointing Pose.
   * - Nearest arm executes a comfortable BENT-ELBOW reach toward target.
   * - Supporting opposite arm holds an open waist gesture (never pinned/frozen).
   */
  private computePointingPose(time: number): void {
    const isLeft = this.pointingSide === "left";
    const sign = isLeft ? 1 : -1;

    const dist = Math.hypot(this.currentAimX, this.currentAimY);
    const nx = this.currentAimX / Math.max(1, dist);
    const ny = this.currentAimY / Math.max(1, dist);

    // Elevation pitch (clamped to comfortable range: -0.35 to +0.35)
    const targetPitchNorm = THREE.MathUtils.clamp(-ny * 0.5, -0.35, 0.35);

    // Horizontal reach (clamped so hand stays in comfortable forward arc)
    const targetYawNorm = THREE.MathUtils.clamp(Math.abs(nx) * 0.4, 0.10, 0.32);

    const microSway = Math.sin(time * 2.0) * 0.012;

    // --- Active Pointing Arm (Bent-Elbow Reach) ---
    // Upper arm: kept comfortably downward-forward, pitch 0.78..0.98 rad (never horizontal!)
    const pointArmX = 0.88 - targetPitchNorm * 0.3 + microSway;
    const pointArmY = sign * (0.22 + targetYawNorm * 0.25);
    const pointArmZ = sign * (0.05 + targetYawNorm * 0.20);

    // Forearm: Bent elbow (70 to 80 deg bend, flex 1.25..1.42 rad)
    const pointFlex = sign * (1.35 - (dist > 300 ? 0.08 : 0.0) + microSway * 0.5);
    const pointForeX = 0.28;
    const pointForeY = sign * 0.10;

    // Hand: Palm angled comfortably toward viewer/target
    const pointHandX = -0.02 + microSway * 0.5;
    const pointHandY = sign * 0.12;
    const pointHandZ = sign * 0.10;

    // --- Supporting Opposite Arm (Waist/Chest resting gesture) ---
    // The opposite arm never freezes stiffly; it rests with bent elbow at the waist
    const supArmX = 1.06 + Math.sin(time * 1.8) * 0.015;
    const supArmY = -sign * 0.12;
    const supArmZ = sign * 0.22;

    const supFlex = -sign * (1.36 + Math.sin(time * 1.8 + 0.5) * 0.02);
    const supForeX = 0.34;
    const supForeY = -sign * 0.08;

    const supHandX = 0.02;
    const supHandY = -sign * 0.14;
    const supHandZ = sign * 0.08;

    if (isLeft) {
      // Left arm is pointing, Right arm is supporting
      const lArmE = new THREE.Euler(pointArmX, pointArmY, pointArmZ, "XYZ");
      const lForeE = new THREE.Euler(pointForeX, pointForeY, pointFlex, "XYZ");
      const lHandE = new THREE.Euler(pointHandX, pointHandY, pointHandZ, "XYZ");

      const rArmE = new THREE.Euler(supArmX, supArmY, supArmZ, "XYZ");
      const rForeE = new THREE.Euler(supForeX, supForeY, supFlex, "XYZ");
      const rHandE = new THREE.Euler(supHandX, supHandY, supHandZ, "XYZ");

      this.leftArmQuat.setFromEuler(lArmE);
      this.leftForeArmQuat.setFromEuler(lForeE);
      this.leftHandQuat.setFromEuler(lHandE);

      this.rightArmQuat.setFromEuler(rArmE);
      this.rightForeArmQuat.setFromEuler(rForeE);
      this.rightHandQuat.setFromEuler(rHandE);
    } else {
      // Right arm is pointing, Left arm is supporting
      const rArmE = new THREE.Euler(pointArmX, pointArmY, pointArmZ, "XYZ");
      const rForeE = new THREE.Euler(pointForeX, pointForeY, pointFlex, "XYZ");
      const rHandE = new THREE.Euler(pointHandX, pointHandY, pointHandZ, "XYZ");

      const lArmE = new THREE.Euler(supArmX, supArmY, supArmZ, "XYZ");
      const lForeE = new THREE.Euler(supForeX, supForeY, supFlex, "XYZ");
      const lHandE = new THREE.Euler(supHandX, supHandY, supHandZ, "XYZ");

      this.rightArmQuat.setFromEuler(rArmE);
      this.rightForeArmQuat.setFromEuler(rForeE);
      this.rightHandQuat.setFromEuler(rHandE);

      this.leftArmQuat.setFromEuler(lArmE);
      this.leftForeArmQuat.setFromEuler(lForeE);
      this.leftHandQuat.setFromEuler(lHandE);
    }
  }
}
