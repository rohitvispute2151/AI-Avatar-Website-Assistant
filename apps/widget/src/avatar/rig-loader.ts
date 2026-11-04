import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { MorphTargetMapper } from "./morph-mapper";
import { FacialController } from "./facial-controller";
import { lipSyncController } from "./lipsync-controller";
import { AnimationController, AvatarHighLevelState } from "./animation-controller";
import { gestureController, ExtendedGesture } from "./gesture-controller";
import { createHumanoidClips } from "./animation-clips";
import { PointingController } from "./pointing-controller";

export interface AvatarRig {
  root: THREE.Object3D;
  animController: AnimationController;
  facialController: FacialController;
  morphMapper: MorphTargetMapper;
  update(delta: number, time: number): void;
  setLookAtTarget(screenX: number, screenY: number): void;
  resetLookAt(): void;
  setMeshRotationY?(rad: number): void;
  setCamera?(camera: THREE.PerspectiveCamera | null): void;
  pointAt?(
    targetRect: DOMRect | null,
    avatarLayerEl?: HTMLElement | null,
    canvasEl?: HTMLElement | null,
    style?: "point" | "present"
  ): void;
  stopPointing?(): void;
  dispose(): void;
}

export interface RigLoaderOptions {
  modelUrl?: string;
  onProgress?: (percent: number) => void;
  onReady?: () => void;
  onError?: (err: any) => void;
}

class RealisticHumanoidRig implements AvatarRig {
  public root: THREE.Group;
  public animController: AnimationController;
  public facialController: FacialController;
  public morphMapper: MorphTargetMapper;

  private mixer: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private currentActionName = "idle";
  private bones: Record<string, THREE.Bone> = {};
  private headBone: THREE.Bone | null = null;
  private neckBone: THREE.Bone | null = null;
  private baseHeadQuat = new THREE.Quaternion();
  private baseNeckQuat = new THREE.Quaternion();

  // Pointing and limb IK references
  private pointingController = new PointingController();
  private leftShoulderBone: THREE.Bone | null = null;
  private rightShoulderBone: THREE.Bone | null = null;
  private leftArmBone: THREE.Bone | null = null;
  private rightArmBone: THREE.Bone | null = null;
  private leftForeArmBone: THREE.Bone | null = null;
  private rightForeArmBone: THREE.Bone | null = null;
  private leftHandBone: THREE.Bone | null = null;
  private rightHandBone: THREE.Bone | null = null;
  private baseLeftShoulderQuat = new THREE.Quaternion(0.481688, 0.492769, -0.588907, 0.422308);
  private baseRightShoulderQuat = new THREE.Quaternion(0.481688, -0.49277, 0.588906, 0.422308);
  private leftFingerBones: Record<string, THREE.Bone> = {};
  private rightFingerBones: Record<string, THREE.Bone> = {};
  private camera: THREE.PerspectiveCamera | null = null;

  // Procedural Look-At on top of skeletal clips
  private lookAtTargetEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private currentLookAtEuler = new THREE.Euler(0, 0, 0, "YXZ");

  // Root mesh yaw rotation for turning during locomotion or facing target
  private targetMeshRotationY = 0;
  private currentMeshRotationY = 0;

  // Talking gesture auto-cycling
  private talkClipIndex = 0;
  private talkTimer = 0;
  private isSpeaking = false;

  constructor(modelScene: THREE.Group, morphMapper: MorphTargetMapper) {
    this.root = modelScene;
    this.morphMapper = morphMapper;
    this.facialController = new FacialController(morphMapper);
    lipSyncController.setMorphMapper(morphMapper);

    this.animController = new AnimationController(gestureController);

    // 1. Locate bones
    this.root.traverse((child) => {
      if (child instanceof THREE.Bone) {
        this.bones[child.name] = child;
        const lower = child.name.toLowerCase();
        if (lower.includes("head") && !lower.includes("top")) {
          this.headBone = child;
          this.baseHeadQuat.copy(child.quaternion);
        } else if (lower.includes("neck")) {
          this.neckBone = child;
          this.baseNeckQuat.copy(child.quaternion);
        } else if (child.name === "LeftShoulder" || lower === "leftshoulder") {
          this.leftShoulderBone = child;
          this.baseLeftShoulderQuat.copy(child.quaternion);
        } else if (child.name === "RightShoulder" || lower === "rightshoulder") {
          this.rightShoulderBone = child;
          this.baseRightShoulderQuat.copy(child.quaternion);
        } else if (child.name === "LeftArm" || lower === "leftarm") {
          this.leftArmBone = child;
        } else if (child.name === "RightArm" || lower === "rightarm") {
          this.rightArmBone = child;
        } else if (child.name === "LeftForeArm" || lower === "leftforearm") {
          this.leftForeArmBone = child;
        } else if (child.name === "RightForeArm" || lower === "rightforearm") {
          this.rightForeArmBone = child;
        } else if (child.name === "LeftHand" || lower === "lefthand") {
          this.leftHandBone = child;
        } else if (child.name === "RightHand" || lower === "righthand") {
          this.rightHandBone = child;
        } else if (child.name.startsWith("LeftHand")) {
          this.leftFingerBones[child.name] = child;
        } else if (child.name.startsWith("RightHand")) {
          this.rightFingerBones[child.name] = child;
        }
      }
    });

    // 2. Setup AnimationMixer and standard humanoid clips
    this.mixer = new THREE.AnimationMixer(this.root);
    const clips = createHumanoidClips();

    for (const [name, clip] of Object.entries(clips)) {
      const action = this.mixer.clipAction(clip);
      // All clips use LoopRepeat — LoopPingPong causes sudden keyframe reversal
      // which produces the "T-pose snap" artifact mid-animation.
      action.setLoop(THREE.LoopRepeat, Infinity);
      if (name !== "idle" && name !== "walk") {
        // Gesture/talk clips clamp at end and fade back to idle via transitionToAction
        action.clampWhenFinished = false;
      }
      this.actions[name] = action;
    }

    // Start with idle action
    if (this.actions["idle"]) {
      this.actions["idle"].play();
    }
  }

  public setLookAtTarget(screenX: number, screenY: number): void {
    // Convert normalized screen coords (-1..1) to head/neck angles (radians)
    // screenX: negative = left, positive = right -> yaw head towards cursor
    // screenY: negative = top, positive = bottom -> pitch head up when pointer is high
    const yaw = Math.max(-0.35, Math.min(0.35, screenX * 0.35));
    const pitch = Math.max(-0.25, Math.min(0.25, -screenY * 0.25));
    this.lookAtTargetEuler.set(pitch, yaw, 0, "YXZ");
    this.facialController.setLookAtScreenCoord(screenX, screenY);
  }

  public resetLookAt(): void {
    this.lookAtTargetEuler.set(0, 0, 0, "YXZ");
    this.facialController.resetLookAt();
  }

  public setMeshRotationY(rad: number): void {
    this.targetMeshRotationY = rad;
  }

  private transitionToAction(name: string, fadeDuration = 0.35): void {
    if (this.currentActionName === name) return;

    const prevAction = this.actions[this.currentActionName];
    const nextAction = this.actions[name] || this.actions["idle"];

    if (nextAction) {
      nextAction.reset();
      nextAction.play();
      if (prevAction) {
        prevAction.crossFadeTo(nextAction, fadeDuration, true);
      }
      this.currentActionName = name;
    }
  }

  public update(delta: number, time: number): void {
    // 1. Step Pointing & Gesture Controller (computes smooth aim, speech energy coupling, and edge cases)
    const speechEnergy = lipSyncController.getSpeechEnergy();
    const pointingState = this.pointingController.update(delta, time, speechEnergy);
    if (pointingState.weight > 0.05 && pointingState.isPointing) {
      this.setLookAtTarget(pointingState.lookAtScreen.x, pointingState.lookAtScreen.y);
    }

    // 2. Check high-level animation & gesture states
    const activeGesture = gestureController.getActiveGesture();
    const locomotion = this.animController.getLocomotion();

    if (activeGesture === "explain" || activeGesture === "open_palm") {
      this.pointingController.setExplaining(true);
    } else {
      this.pointingController.setExplaining(false);
    }

    if (locomotion === "walk" || (locomotion as string) === "run" || (locomotion as string) === "turn") {
      this.transitionToAction("walk", 0.3);
    } else if (activeGesture === "point_left") {
      this.transitionToAction("point_left", 0.3);
    } else if (activeGesture === "point_right") {
      this.transitionToAction("point_right", 0.3);
    } else if (activeGesture === "thinking") {
      this.transitionToAction("thinking", 0.4);
    } else if (activeGesture === "listening") {
      this.transitionToAction("listening", 0.35);
    } else if (activeGesture === "wave") {
      this.transitionToAction("wave", 0.3);
    } else if (activeGesture === "greeting") {
      this.transitionToAction("greeting", 0.3);
    } else if (activeGesture === "celebrating") {
      this.transitionToAction("celebrating", 0.35);
    } else if (activeGesture === "goodbye") {
      this.transitionToAction("goodbye", 0.3);
    } else if (this.isSpeaking) {
      // Auto-cycle through natural talk variants during speech
      this.talkTimer += delta;
      if (this.talkTimer > 2.5) {
        this.talkTimer = 0;
        this.talkClipIndex = (this.talkClipIndex + 1) % 2;
      }
      this.transitionToAction(this.talkClipIndex === 0 ? "talk_1" : "talk_2", 0.4);
    } else {
      this.transitionToAction("idle", 0.4);
    }

    // 3. Step Animation Mixer
    this.mixer.update(delta);

    // 4. Blend Procedural Dual-Arm Pointing & Presenting smoothly on top of active clip
    if (pointingState.weight > 0.001) {
      const w = pointingState.weight;

      if (this.leftShoulderBone) this.leftShoulderBone.quaternion.slerp(pointingState.left.shoulderQuat, w);
      if (this.leftArmBone) this.leftArmBone.quaternion.slerp(pointingState.left.armQuat, w);
      if (this.leftForeArmBone) this.leftForeArmBone.quaternion.slerp(pointingState.left.foreArmQuat, w);
      if (this.leftHandBone) this.leftHandBone.quaternion.slerp(pointingState.left.handQuat, w);

      if (this.rightShoulderBone) this.rightShoulderBone.quaternion.slerp(pointingState.right.shoulderQuat, w);
      if (this.rightArmBone) this.rightArmBone.quaternion.slerp(pointingState.right.armQuat, w);
      if (this.rightForeArmBone) this.rightForeArmBone.quaternion.slerp(pointingState.right.foreArmQuat, w);
      if (this.rightHandBone) this.rightHandBone.quaternion.slerp(pointingState.right.handQuat, w);

      for (const [boneName, targetQuat] of Object.entries(pointingState.left.fingers)) {
        const bone = this.leftFingerBones[boneName];
        if (bone) {
          bone.quaternion.slerp(targetQuat, w);
        }
      }
      for (const [boneName, targetQuat] of Object.entries(pointingState.right.fingers)) {
        const bone = this.rightFingerBones[boneName];
        if (bone) {
          bone.quaternion.slerp(targetQuat, w);
        }
      }
    } else {
      if (this.leftShoulderBone) this.leftShoulderBone.quaternion.copy(this.baseLeftShoulderQuat);
      if (this.rightShoulderBone) this.rightShoulderBone.quaternion.copy(this.baseRightShoulderQuat);
    }

    // 5. Step Lip-Sync Controller (coarticulation + visemes)
    lipSyncController.update(delta);

    // 6. Step Facial Controller (blinking, eye saccades, emotions, micro-expressions)
    this.facialController.update(delta, time);

    // 7. Apply Procedural Head & Neck Look-At smoothly on top of clips (NO accumulation)
    const lookSpeed = 5.0;
    this.currentLookAtEuler.x +=
      (this.lookAtTargetEuler.x - this.currentLookAtEuler.x) * Math.min(1.0, delta * lookSpeed);
    this.currentLookAtEuler.y +=
      (this.lookAtTargetEuler.y - this.currentLookAtEuler.y) * Math.min(1.0, delta * lookSpeed);

    // Idle breathing micro-motion on head pitch
    const idleBreathPitch = Math.sin(time * 1.5) * 0.012;

    if (this.headBone) {
      // Head absorbs 65% of gaze rotation - always relative to baseHeadQuat
      const headOffset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (this.currentLookAtEuler.x + idleBreathPitch) * 0.65,
          this.currentLookAtEuler.y * 0.65,
          0,
          "YXZ"
        )
      );
      this.headBone.quaternion.copy(this.baseHeadQuat).multiply(headOffset);
    }
    if (this.neckBone) {
      // Neck absorbs remaining 35%
      const neckOffset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (this.currentLookAtEuler.x + idleBreathPitch) * 0.35,
          this.currentLookAtEuler.y * 0.35,
          0,
          "YXZ"
        )
      );
      this.neckBone.quaternion.copy(this.baseNeckQuat).multiply(neckOffset);
    }

    // 8. Apply Smooth Mesh Yaw Rotation (turning towards destination or facing target)
    this.currentMeshRotationY += (this.targetMeshRotationY - this.currentMeshRotationY) * Math.min(1.0, delta * 6.0);
    this.root.rotation.y = this.currentMeshRotationY;
  }

  public setCamera(camera: THREE.PerspectiveCamera | null): void {
    this.camera = camera;
  }

  public pointAt(
    targetRect: DOMRect | null,
    avatarLayerEl?: HTMLElement | null,
    canvasEl?: HTMLElement | null,
    style: "point" | "present" = "point"
  ): void {
    const res = this.pointingController.setTarget(
      targetRect,
      avatarLayerEl,
      canvasEl,
      this.camera,
      style,
      {
        leftArm: this.leftArmBone,
        rightArm: this.rightArmBone,
        leftShoulder: this.leftShoulderBone,
        rightShoulder: this.rightShoulderBone,
      }
    );
    if (res.isEdgeCase && res.fallbackGesture) {
      this.animController.setGesture("explain", 2500);
    }
  }

  public stopPointing(): void {
    this.pointingController.stopPointing();
    this.resetLookAt();
  }

  public setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
    this.facialController.setSpeaking(speaking);
    this.pointingController.setSpeaking(speaking);
    if (!speaking) {
      this.talkTimer = 0;
    }
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.morphMapper.resetAll();
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }
}

/**
 * Procedural fallback rig if network or GLB load fails
 */
class ProceduralFallbackRig implements AvatarRig {
  public root: THREE.Group;
  public animController: AnimationController;
  public facialController: FacialController;
  public morphMapper: MorphTargetMapper;
  private mouthMesh: THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();
    this.morphMapper = new MorphTargetMapper(this.root);
    this.facialController = new FacialController(this.morphMapper);
    this.animController = new AnimationController(gestureController);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.65, 16), clothesMat);
    torso.position.y = 1.2;
    this.root.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), skinMat);
    head.position.y = 1.7;
    this.root.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), hairMat);
    hair.position.set(0, 1.78, -0.04);
    this.root.add(hair);

    this.mouthMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0x221318 }));
    this.mouthMesh.position.set(0, 1.62, 0.21);
    this.root.add(this.mouthMesh);
  }

  public setLookAtTarget(): void {}
  public resetLookAt(): void {}
  public setCamera(): void {}
  public pointAt(): void {}
  public stopPointing(): void {}
  public update(delta: number, time: number): void {
    const jawOpen = lipSyncController.update(delta);
    this.mouthMesh.scale.set(1.0, 1.0 + jawOpen * 5.0, 1.0);
  }
  public dispose(): void {}
}

/**
 * Upgrades GLTF mesh materials to PBR MeshPhysicalMaterial with wet eye specular,
 * skin sheen, and soft subsurface simulation.
 */
function enhancePBRMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const mat = child.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        const name = (child.name || "").toLowerCase();

        // 1. Eyes: Cornea wet specular sheen & high clearcoat
        if (name.includes("eye") && !name.includes("brow") && !name.includes("lash")) {
          const eyeMat = new THREE.MeshPhysicalMaterial({
            map: mat.map,
            roughness: 0.06,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            reflectivity: 0.9,
          });
          child.material = eyeMat;
        }
        // 2. Teeth: Smooth pearlescent specular
        else if (name.includes("teeth")) {
          const teethMat = new THREE.MeshPhysicalMaterial({
            map: mat.map,
            color: 0xf4f4f6,
            roughness: 0.28,
            metalness: 0.0,
            clearcoat: 0.4,
          });
          child.material = teethMat;
        }
        // 3. Skin (Head, Body): Subtle peach sheen + micro-roughness
        else if (name.includes("head") || name.includes("body") || name.includes("skin") || name.includes("face")) {
          const skinMat = new THREE.MeshPhysicalMaterial({
            map: mat.map,
            normalMap: mat.normalMap,
            roughness: 0.58,
            metalness: 0.02,
            sheen: 0.35,
            sheenRoughness: 0.45,
            sheenColor: new THREE.Color(0xffdbcb),
          });
          child.material = skinMat;
        }
        // 4. Hair: Anisotropic diffuse card shading
        else if (name.includes("hair")) {
          mat.roughness = 0.75;
          mat.metalness = 0.05;
          mat.transparent = true;
          mat.alphaTest = 0.5;
        }
      }
    }
  });
}

/**
 * Loads and constructs the realistic avatar rig.
 */
export async function createRiggedAvatar(options: RigLoaderOptions = {}): Promise<AvatarRig> {
  const modelUrl = options.modelUrl || "/assets/avatar/avatar.glb";

  try {
    const loader = new GLTFLoader();

    // Configure Draco decoder
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);

    // Register VRM plugin in case user provides a .vrm file
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(modelUrl, (progress) => {
      if (options.onProgress && progress.total > 0) {
        options.onProgress(Math.round((progress.loaded / progress.total) * 100));
      }
    });

    // Check if loaded asset is a VRM
    if (gltf.userData.vrm) {
      const vrm: VRM = gltf.userData.vrm;
      const morphMapper = new MorphTargetMapper(vrm.scene);
      enhancePBRMaterials(vrm.scene);
      if (options.onReady) options.onReady();
      return new RealisticHumanoidRig(vrm.scene, morphMapper);
    }

    const scene = gltf.scene;
    // Scale and position adjustment to ensure bust camera framing
    scene.position.set(0, 0, 0);

    enhancePBRMaterials(scene);
    const morphMapper = new MorphTargetMapper(scene);

    if (options.onReady) options.onReady();
    return new RealisticHumanoidRig(scene, morphMapper);
  } catch (err) {
    console.warn("RigLoader: Failed to load 3D model asset, using procedural fallback rig:", err);
    if (options.onError) options.onError(err);
    return new ProceduralFallbackRig();
  }
}

