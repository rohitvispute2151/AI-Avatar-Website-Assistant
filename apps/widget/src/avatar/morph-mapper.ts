import * as THREE from "three";

/**
 * Standard Oculus Visemes (15 visemes + silence)
 */
export const OCULUS_VISEMES = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
] as const;

export type OculusViseme = typeof OCULUS_VISEMES[number];

/**
 * Common emotions supported by the facial controller
 */
export type AvatarEmotion =
  | "neutral"
  | "friendly"
  | "curious"
  | "thinking"
  | "empathetic"
  | "excited";

/**
 * ARKit-52 standard blendshape canonical names
 */
export const ARKIT_BLENDSHAPES = [
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "eyeWideLeft",
  "eyeWideRight",
  "jawForward",
  "jawLeft",
  "jawOpen",
  "jawRight",
  "mouthClose",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthFunnel",
  "mouthLeft",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthPucker",
  "mouthRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "noseSneerLeft",
  "noseSneerRight",
  "tongueOut",
] as const;

/**
 * Mapping table of alternative naming conventions to canonical morph names.
 * Supports:
 * - ARKit camelCase (mouthSmileLeft)
 * - ARKit underscore (mouthSmile_L, eyeBlink_L)
 * - VRM standard names (blink, blink_l, blink_r, aa, ih, ou, ee, oh, joy, angry, sorrow, fun)
 * - Oculus viseme names (viseme_aa, viseme_PP, etc.)
 */
const ALIAS_MAP: Record<string, string[]> = {
  // Brows
  browInnerUp: ["browInnerUp", "brow_inner_up", "brows_up"],
  browDownLeft: ["browDownLeft", "browDown_L", "brow_down_l", "browDown_left"],
  browDownRight: ["browDownRight", "browDown_R", "brow_down_r", "browDown_right"],
  browOuterUpLeft: ["browOuterUpLeft", "browOuterUp_L", "brow_outer_up_l"],
  browOuterUpRight: ["browOuterUpRight", "browOuterUp_R", "brow_outer_up_r"],

  // Blinking
  eyeBlinkLeft: ["eyeBlinkLeft", "eyeBlink_L", "eye_blink_l", "blink_l", "blinkLeft", "blink"],
  eyeBlinkRight: ["eyeBlinkRight", "eyeBlink_R", "eye_blink_r", "blink_r", "blinkRight", "blink"],

  // Eye Gaze
  eyeLookUpLeft: ["eyeLookUpLeft", "eyeLookUp_L", "eye_look_up_l", "eyesLookUp", "look_up"],
  eyeLookUpRight: ["eyeLookUpRight", "eyeLookUp_R", "eye_look_up_r", "eyesLookUp", "look_up"],
  eyeLookDownLeft: ["eyeLookDownLeft", "eyeLookDown_L", "eye_look_down_l", "eyesLookDown", "look_down"],
  eyeLookDownRight: ["eyeLookDownRight", "eyeLookDown_R", "eye_look_down_r", "eyesLookDown", "look_down"],
  eyeLookInLeft: ["eyeLookInLeft", "eyeLookIn_L", "eye_look_in_l", "look_in_l"],
  eyeLookInRight: ["eyeLookInRight", "eyeLookIn_R", "eye_look_in_r", "look_in_r"],
  eyeLookOutLeft: ["eyeLookOutLeft", "eyeLookOut_L", "eye_look_out_l", "look_out_l"],
  eyeLookOutRight: ["eyeLookOutRight", "eyeLookOut_R", "eye_look_out_r", "look_out_r"],

  // Smile / Expressions
  mouthSmileLeft: ["mouthSmileLeft", "mouthSmile_L", "mouth_smile_l", "mouthSmile", "smile_l", "joy", "fun"],
  mouthSmileRight: ["mouthSmileRight", "mouthSmile_R", "mouth_smile_r", "mouthSmile", "smile_r", "joy", "fun"],
  mouthFrownLeft: ["mouthFrownLeft", "mouthFrown_L", "mouth_frown_l", "sorrow"],
  mouthFrownRight: ["mouthFrownRight", "mouthFrown_R", "mouth_frown_r", "sorrow"],

  // Mouth & Jaw
  jawOpen: ["jawOpen", "jaw_open", "mouthOpen", "mouth_open", "open_mouth", "aa"],
  mouthFunnel: ["mouthFunnel", "mouth_funnel", "oh"],
  mouthPucker: ["mouthPucker", "mouth_pucker", "ou"],
  mouthClose: ["mouthClose", "mouth_close"],

  // Oculus Visemes directly
  viseme_sil: ["viseme_sil", "sil"],
  viseme_PP: ["viseme_PP", "viseme_pp", "PP", "mouthClose"],
  viseme_FF: ["viseme_FF", "viseme_ff", "FF"],
  viseme_TH: ["viseme_TH", "viseme_th", "TH"],
  viseme_DD: ["viseme_DD", "viseme_dd", "DD"],
  viseme_kk: ["viseme_kk", "viseme_KK", "kk"],
  viseme_CH: ["viseme_CH", "viseme_ch", "CH"],
  viseme_SS: ["viseme_SS", "viseme_ss", "SS"],
  viseme_nn: ["viseme_nn", "viseme_NN", "nn"],
  viseme_RR: ["viseme_RR", "viseme_rr", "RR"],
  viseme_aa: ["viseme_aa", "viseme_AA", "aa", "jawOpen"],
  viseme_E: ["viseme_E", "viseme_e", "ee", "E"],
  viseme_I: ["viseme_I", "viseme_i", "ih", "I"],
  viseme_O: ["viseme_O", "viseme_o", "oh", "O", "mouthFunnel"],
  viseme_U: ["viseme_U", "viseme_u", "ou", "U", "mouthPucker"],
};

export interface MorphTargetBinding {
  mesh: THREE.Mesh;
  targetIndex: number;
}

export class MorphTargetMapper {
  private targetMap = new Map<string, MorphTargetBinding[]>();
  private allDiscoveredMorphs: string[] = [];
  private meshesWithMorphs: THREE.Mesh[] = [];

  constructor(rootObject: THREE.Object3D) {
    this.discoverMorphs(rootObject);
  }

  private discoverMorphs(root: THREE.Object3D): void {
    root.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.morphTargetDictionary &&
        child.morphTargetInfluences
      ) {
        this.meshesWithMorphs.push(child);
        const dict = child.morphTargetDictionary;

        for (const [name, index] of Object.entries(dict)) {
          if (!this.allDiscoveredMorphs.includes(name)) {
            this.allDiscoveredMorphs.push(name);
          }

          // Exact match
          this.addBinding(name, child, index);
          // Case-insensitive match
          this.addBinding(name.toLowerCase(), child, index);
        }
      }
    });

    // Populate alias bindings
    for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
      for (const alias of aliases) {
        const found = this.findMatchingBindings(alias);
        if (found.length > 0) {
          for (const binding of found) {
            this.addBinding(canonical, binding.mesh, binding.targetIndex);
          }
          break; // First matching alias wins
        }
      }
    }
  }

  private addBinding(key: string, mesh: THREE.Mesh, index: number): void {
    let list = this.targetMap.get(key);
    if (!list) {
      list = [];
      this.targetMap.set(key, list);
    }
    // Prevent duplicate entries for same mesh and index
    if (!list.some((b) => b.mesh === mesh && b.targetIndex === index)) {
      list.push({ mesh, targetIndex: index });
    }
  }

  private findMatchingBindings(name: string): MorphTargetBinding[] {
    const direct = this.targetMap.get(name);
    if (direct && direct.length > 0) return direct;

    const lower = this.targetMap.get(name.toLowerCase());
    if (lower && lower.length > 0) return lower;

    // Fuzzy match: case-insensitive check against all discovered morphs
    for (const morph of this.allDiscoveredMorphs) {
      if (morph.toLowerCase() === name.toLowerCase()) {
        return this.targetMap.get(morph) || [];
      }
    }

    return [];
  }

  /**
   * Sets the weight of a morph target across all bound meshes (0.0 to 1.0)
   */
  public setValue(canonicalOrAliasName: string, weight: number): void {
    const bindings = this.targetMap.get(canonicalOrAliasName);
    if (!bindings) return;

    const clamped = Math.max(0, Math.min(1, weight));
    for (const binding of bindings) {
      if (binding.mesh.morphTargetInfluences) {
        binding.mesh.morphTargetInfluences[binding.targetIndex] = clamped;
      }
    }
  }

  /**
   * Resets all morph target influences to 0
   */
  public resetAll(): void {
    for (const mesh of this.meshesWithMorphs) {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
          mesh.morphTargetInfluences[i] = 0;
        }
      }
    }
  }

  /**
   * Checks whether a canonical morph or viseme is supported by the loaded model
   */
  public hasTarget(canonicalName: string): boolean {
    const bindings = this.targetMap.get(canonicalName);
    return !!(bindings && bindings.length > 0);
  }

  public getDiscoveredMorphNames(): string[] {
    return [...this.allDiscoveredMorphs];
  }

  /**
   * Produces a diagnostic summary of the model's morph target compatibility
   */
  public getValidationReport(): {
    totalMorphs: number;
    discovered: string[];
    supportedVisemes: string[];
    missingVisemes: string[];
    supportedARKit: string[];
    missingARKit: string[];
    isVisemeReady: boolean;
    isARKitReady: boolean;
  } {
    const supportedVisemes = OCULUS_VISEMES.filter((v) => this.hasTarget(v));
    const missingVisemes = OCULUS_VISEMES.filter((v) => !this.hasTarget(v));

    const supportedARKit = ARKIT_BLENDSHAPES.filter((b) => this.hasTarget(b));
    const missingARKit = ARKIT_BLENDSHAPES.filter((b) => !this.hasTarget(b));

    // Viseme ready if we have jawOpen/aa + key vowels or visemes
    const isVisemeReady =
      supportedVisemes.length >= 8 ||
      (this.hasTarget("jawOpen") && (this.hasTarget("mouthFunnel") || this.hasTarget("mouthPucker")));

    const isARKitReady =
      this.hasTarget("eyeBlinkLeft") &&
      this.hasTarget("mouthSmileLeft") &&
      this.hasTarget("jawOpen");

    return {
      totalMorphs: this.allDiscoveredMorphs.length,
      discovered: this.allDiscoveredMorphs,
      supportedVisemes,
      missingVisemes,
      supportedARKit,
      missingARKit,
      isVisemeReady,
      isARKitReady,
    };
  }
}

