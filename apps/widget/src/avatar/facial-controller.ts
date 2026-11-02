import { MorphTargetMapper, AvatarEmotion } from "./morph-mapper";

export interface GazeTarget {
  x: number; // -1 (left) to +1 (right)
  y: number; // -1 (down) to +1 (up)
}

interface EmotionMorphWeights {
  mouthSmileLeft?: number;
  mouthSmileRight?: number;
  mouthFrownLeft?: number;
  mouthFrownRight?: number;
  browInnerUp?: number;
  browOuterUpLeft?: number;
  browOuterUpRight?: number;
  browDownLeft?: number;
  browDownRight?: number;
  eyeWideLeft?: number;
  eyeWideRight?: number;
  eyeSquintLeft?: number;
  eyeSquintRight?: number;
  cheekSquintLeft?: number;
  cheekSquintRight?: number;
  cheekPuff?: number;
  noseSneerLeft?: number;
  noseSneerRight?: number;
  mouthPucker?: number;
}

const EMOTION_PRESETS: Record<AvatarEmotion, EmotionMorphWeights> = {
  neutral: {
    mouthSmileLeft: 0.05,
    mouthSmileRight: 0.05,
    browInnerUp: 0.0,
  },
  friendly: {
    mouthSmileLeft: 0.38,
    mouthSmileRight: 0.38,
    cheekSquintLeft: 0.18,
    cheekSquintRight: 0.18,
    browInnerUp: 0.12,
    browOuterUpLeft: 0.08,
    browOuterUpRight: 0.08,
  },
  curious: {
    browInnerUp: 0.4,
    browOuterUpLeft: 0.25,
    browOuterUpRight: 0.1,
    eyeWideLeft: 0.2,
    eyeWideRight: 0.2,
    mouthSmileLeft: 0.15,
    mouthSmileRight: 0.15,
  },
  thinking: {
    browDownLeft: 0.25,
    browDownRight: 0.1,
    browInnerUp: 0.2,
    eyeSquintRight: 0.25,
    eyeSquintLeft: 0.1,
    mouthPucker: 0.12,
  },
  empathetic: {
    browInnerUp: 0.3,
    mouthSmileLeft: 0.22,
    mouthSmileRight: 0.22,
    eyeSquintLeft: 0.1,
    eyeSquintRight: 0.1,
  },
  excited: {
    mouthSmileLeft: 0.65,
    mouthSmileRight: 0.65,
    cheekSquintLeft: 0.3,
    cheekSquintRight: 0.3,
    eyeWideLeft: 0.3,
    eyeWideRight: 0.3,
    browInnerUp: 0.35,
    browOuterUpLeft: 0.25,
    browOuterUpRight: 0.25,
  },
};

export class FacialController {
  private mapper: MorphTargetMapper;

  // Blinking state
  private blinkTimer = 2.5; // Next blink countdown (seconds)
  private isBlinking = false;
  private blinkProgress = 0; // 0 (open) -> 1 (closed) -> 0 (open)
  private blinkDuration = 0.18; // Seconds
  private isDoubleBlink = false;
  private doubleBlinkStage = 0;

  // Eye Gaze & Saccades
  private currentGaze: GazeTarget = { x: 0, y: 0 };
  private targetGaze: GazeTarget = { x: 0, y: 0 };
  private saccadeTimer = 2.0;
  private baseLookAtTarget: GazeTarget | null = null; // e.g. cursor or highlighted DOM element

  // Emotion Layer
  private currentEmotion: AvatarEmotion = "friendly";
  private targetEmotion: AvatarEmotion = "friendly";
  private emotionWeights: Record<string, number> = {};

  // Listening & Speaking states
  private isListening = false;
  private isSpeaking = false;
  private speechEmphasis = 0; // Brow lift during questions or emphasis

  // Micro-expression noise offset
  private noiseSeed = Math.random() * 1000;

  constructor(mapper: MorphTargetMapper) {
    this.mapper = mapper;
  }

  public setEmotion(emotion: AvatarEmotion): void {
    if (EMOTION_PRESETS[emotion]) {
      this.targetEmotion = emotion;
    }
  }

  public getEmotion(): AvatarEmotion {
    return this.currentEmotion;
  }

  public setListening(listening: boolean): void {
    this.isListening = listening;
    if (listening) {
      this.targetEmotion = "curious";
    }
  }

  public setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
  }

  public triggerSpeechEmphasis(intensity = 0.4): void {
    this.speechEmphasis = Math.min(1.0, this.speechEmphasis + intensity);
  }

  /**
   * Sets a 2D gaze anchor from mouse cursor or target element screen coordinates
   * (-1 = left/top, +1 = right/bottom)
   */
  public setLookAtScreenCoord(screenX: number, screenY: number): void {
    // Clamp to comfortable human gaze bounds (-0.6 to +0.6)
    const clampedX = Math.max(-0.6, Math.min(0.6, screenX));
    const clampedY = Math.max(-0.4, Math.min(0.4, -screenY)); // Invert Y for 3D
    this.baseLookAtTarget = { x: clampedX, y: clampedY };
  }

  public resetLookAt(): void {
    this.baseLookAtTarget = null;
  }

  public update(delta: number, time: number): void {
    // 1. Process Blinking
    this.updateBlinking(delta);

    // 2. Process Eye Gaze & Micro-Saccades
    this.updateGaze(delta, time);

    // 3. Process Emotion Blendshape Lerp
    this.updateEmotion(delta);

    // 4. Process Speech Emphasis Decay
    if (this.speechEmphasis > 0) {
      this.speechEmphasis = Math.max(0, this.speechEmphasis - delta * 2.0);
    }

    // 5. Apply Combined Facial Targets to Model
    this.applyFacialTargets(time);
  }

  private updateBlinking(delta: number): void {
    if (this.isBlinking) {
      this.blinkProgress += delta / this.blinkDuration;
      if (this.blinkProgress >= 1.0) {
        if (this.isDoubleBlink && this.doubleBlinkStage === 0) {
          // Pause briefly then trigger second blink
          this.doubleBlinkStage = 1;
          this.blinkProgress = 0;
          this.blinkDuration = 0.14;
        } else {
          this.isBlinking = false;
          this.isDoubleBlink = false;
          this.doubleBlinkStage = 0;
          this.blinkProgress = 0;
          // Schedule next blink: random 2.5 to 5.5 seconds
          this.blinkTimer = 2.2 + Math.random() * 3.3;
        }
      }
    } else {
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        this.blinkProgress = 0;
        this.blinkDuration = 0.16;
        // 20% chance of double-blink
        this.isDoubleBlink = Math.random() < 0.2;
      }
    }
  }

  private updateGaze(delta: number, time: number): void {
    this.saccadeTimer -= delta;
    if (this.saccadeTimer <= 0) {
      // Natural human micro-saccades
      const saccadeX = (Math.random() - 0.5) * 0.14;
      const saccadeY = (Math.random() - 0.5) * 0.08;

      const base = this.baseLookAtTarget || { x: 0, y: 0 };
      this.targetGaze = {
        x: base.x + saccadeX,
        y: base.y + saccadeY,
      };

      // Reset saccade timer (random 1.2 to 3.0 s)
      this.saccadeTimer = 1.2 + Math.random() * 1.8;
    }

    // Smooth damp towards target gaze (spring speed)
    const gazeSpeed = 12.0;
    this.currentGaze.x += (this.targetGaze.x - this.currentGaze.x) * Math.min(1.0, delta * gazeSpeed);
    this.currentGaze.y += (this.targetGaze.y - this.currentGaze.y) * Math.min(1.0, delta * gazeSpeed);
  }

  private updateEmotion(delta: number): void {
    if (this.currentEmotion !== this.targetEmotion) {
      this.currentEmotion = this.targetEmotion;
    }

    const targetPreset = EMOTION_PRESETS[this.targetEmotion] || EMOTION_PRESETS.friendly;
    const blendSpeed = 4.5;

    for (const [key, val] of Object.entries(targetPreset)) {
      const cur = this.emotionWeights[key] || 0;
      this.emotionWeights[key] = cur + (val - cur) * Math.min(1.0, delta * blendSpeed);
    }

    // Fade out morphs not present in active preset
    for (const key of Object.keys(this.emotionWeights)) {
      if ((targetPreset as any)[key] === undefined) {
        const cur = this.emotionWeights[key];
        this.emotionWeights[key] = cur + (0 - cur) * Math.min(1.0, delta * blendSpeed);
      }
    }
  }

  private applyFacialTargets(time: number): void {
    // 1. Blink weight: triangle wave (0 -> 1 -> 0)
    let blinkWeight = 0;
    if (this.isBlinking) {
      blinkWeight = this.blinkProgress < 0.4
        ? this.blinkProgress / 0.4
        : 1.0 - (this.blinkProgress - 0.4) / 0.6;
    }

    // Eyelid downward follow: looking down naturally drops upper eyelids slightly
    const eyeDownFollow = Math.max(0, -this.currentGaze.y) * 0.22;
    const finalLeftBlink = Math.min(1.0, blinkWeight + eyeDownFollow);
    const finalRightBlink = Math.min(1.0, blinkWeight + eyeDownFollow);

    this.mapper.setValue("eyeBlinkLeft", finalLeftBlink);
    this.mapper.setValue("eyeBlinkRight", finalRightBlink);

    // 2. Eye Gaze Direction
    const gx = this.currentGaze.x;
    const gy = this.currentGaze.y;

    if (gx > 0) {
      this.mapper.setValue("eyeLookOutLeft", 0);
      this.mapper.setValue("eyeLookInLeft", gx);
      this.mapper.setValue("eyeLookOutRight", gx);
      this.mapper.setValue("eyeLookInRight", 0);
    } else {
      this.mapper.setValue("eyeLookOutLeft", -gx);
      this.mapper.setValue("eyeLookInLeft", 0);
      this.mapper.setValue("eyeLookOutRight", 0);
      this.mapper.setValue("eyeLookInRight", -gx);
    }

    if (gy > 0) {
      this.mapper.setValue("eyeLookUpLeft", gy);
      this.mapper.setValue("eyeLookUpRight", gy);
      this.mapper.setValue("eyeLookDownLeft", 0);
      this.mapper.setValue("eyeLookDownRight", 0);
    } else {
      this.mapper.setValue("eyeLookUpLeft", 0);
      this.mapper.setValue("eyeLookUpRight", 0);
      this.mapper.setValue("eyeLookDownLeft", -gy);
      this.mapper.setValue("eyeLookDownRight", -gy);
    }

    // 3. Subtle micro-expression noise
    const t = time + this.noiseSeed;
    const microBrowL = Math.sin(t * 1.8) * 0.03;
    const microBrowR = Math.cos(t * 1.5) * 0.03;
    const microSmile = Math.sin(t * 1.2) * 0.02;

    // 4. Listening attentive expression
    const listeningWide = this.isListening ? 0.15 : 0;
    const listeningBrow = this.isListening ? 0.12 : 0;

    // 5. Apply Emotion Morphs + Micro-expressions
    for (const [key, weight] of Object.entries(this.emotionWeights)) {
      let finalWeight = weight;

      if (key === "browInnerUp") {
        finalWeight += this.speechEmphasis * 0.4 + listeningBrow;
      } else if (key === "browOuterUpLeft") {
        finalWeight += microBrowL + this.speechEmphasis * 0.25;
      } else if (key === "browOuterUpRight") {
        finalWeight += microBrowR + this.speechEmphasis * 0.25;
      } else if (key === "mouthSmileLeft" || key === "mouthSmileRight") {
        finalWeight += microSmile;
      } else if (key === "eyeWideLeft" || key === "eyeWideRight") {
        finalWeight += listeningWide;
      }

      this.mapper.setValue(key, Math.max(0, Math.min(1.0, finalWeight)));
    }
  }

  public getGaze(): GazeTarget {
    return { ...this.currentGaze };
  }
}

