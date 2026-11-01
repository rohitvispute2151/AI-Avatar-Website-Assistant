import * as THREE from "three";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AnimationController } from "./animation-controller";
import { gestureController } from "./gesture-controller";

export interface AvatarRig {
  root: THREE.Object3D;
  animController: AnimationController;
  update(delta: number, time: number, mouthOpen: number): void;
  dispose(): void;
}

/**
 * Creates dynamic canvas textures for clothing graphics and facial details
 * matching the reference character: burgundy varsity jacket with "Chicago" & "Route 66",
 * white inner tee, warm skin tone, stylish dark hair, and baggy trousers.
 */
function createJacketTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 1. Burgundy jacket background
  ctx.fillStyle = "#5c1b2b";
  ctx.fillRect(0, 0, 512, 512);

  // 2. White inner t-shirt visible down the center
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(206, 0, 100, 440);

  // Subtle crewneck collar shadow
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(216, 0, 80, 24);

  // 3. Jacket inner edges / lapels
  ctx.fillStyle = "#461320";
  ctx.fillRect(196, 0, 14, 440);
  ctx.fillRect(302, 0, 14, 440);

  // 4. "Chicago" script logo on right chest
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px 'Brush Script MT', 'Segoe Script', cursive, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.fillText("Chicago", 110, 180);
  ctx.restore();

  // 5. "ROUTE 66" badge emblem on left chest
  ctx.save();
  // Shield outline
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(370, 140);
  ctx.lineTo(430, 140);
  ctx.lineTo(440, 185);
  ctx.lineTo(400, 215);
  ctx.lineTo(360, 185);
  ctx.closePath();
  ctx.fill();

  // Inner shield
  ctx.fillStyle = "#5c1b2b";
  ctx.beginPath();
  ctx.moveTo(374, 144);
  ctx.lineTo(426, 144);
  ctx.lineTo(434, 182);
  ctx.lineTo(400, 208);
  ctx.lineTo(366, 182);
  ctx.closePath();
  ctx.fill();

  // Text inside shield
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ROUTE", 400, 165);
  ctx.font = "bold 24px 'Arial Black', sans-serif";
  ctx.fillText("66", 400, 195);
  ctx.restore();

  // 6. Jacket ribbed bottom waistband
  ctx.fillStyle = "#40111d";
  ctx.fillRect(0, 440, 512, 72);
  // Ribbed pinstripes on hem
  ctx.strokeStyle = "#5c1b2b";
  ctx.lineWidth = 4;
  for (let x = 8; x < 512; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 440);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 1. Warm tan skin tone
  ctx.fillStyle = "#cf956e";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle facial blush / contour
  const gradient = ctx.createRadialGradient(256, 256, 100, 256, 256, 260);
  gradient.addColorStop(0, "rgba(230, 155, 115, 0.4)");
  gradient.addColorStop(1, "rgba(180, 110, 75, 0.5)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Eyes
  const drawEye = (x: number, y: number) => {
    // Eye white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark iris
    ctx.fillStyle = "#221914";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#0a0705";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Eye catchlight reflection
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + 5, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyelid line
    ctx.strokeStyle = "#1b110b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 30, 19, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  };

  drawEye(180, 240);
  drawEye(332, 240);

  // 3. Eyebrows
  ctx.fillStyle = "#1e140d";
  // Left brow
  ctx.beginPath();
  ctx.moveTo(145, 205);
  ctx.lineTo(215, 200);
  ctx.lineTo(210, 212);
  ctx.lineTo(148, 214);
  ctx.closePath();
  ctx.fill();

  // Right brow
  ctx.beginPath();
  ctx.moveTo(297, 200);
  ctx.lineTo(367, 205);
  ctx.lineTo(364, 214);
  ctx.lineTo(302, 212);
  ctx.closePath();
  ctx.fill();

  // 4. Nose bridge & tip contour
  ctx.fillStyle = "rgba(165, 100, 65, 0.45)";
  ctx.beginPath();
  ctx.arc(256, 290, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 80, 50, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 288, 12, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class ProceduralAvatarRig implements AvatarRig {
  public root: THREE.Group;
  public animController: AnimationController;
  private head: THREE.Group;
  private torso: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private mouthMesh: THREE.Mesh;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private textures: THREE.Texture[] = [];

  constructor() {
    this.root = new THREE.Group();
    this.animController = new AnimationController(gestureController);

    // Textures
    const jacketTex = createJacketTexture();
    const faceTex = createFaceTexture();
    this.textures.push(jacketTex, faceTex);

    // Realistic, clean stylized materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xcf956e,
      roughness: 0.6,
      metalness: 0.05,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.55,
      metalness: 0.05,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x18181f,
      roughness: 0.75,
      metalness: 0.1,
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      map: jacketTex,
      roughness: 0.5,
      metalness: 0.15,
    });
    const jacketSolidMat = new THREE.MeshStandardMaterial({
      color: 0x5c1b2b,
      roughness: 0.5,
      metalness: 0.15,
    });
    const jacketCuffMat = new THREE.MeshStandardMaterial({
      color: 0x40111d,
      roughness: 0.6,
      metalness: 0.1,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x181f28, // Dark navy/charcoal baggy denim
      roughness: 0.85,
      metalness: 0.05,
    });
    const shoeTanMat = new THREE.MeshStandardMaterial({
      color: 0xa17650, // Wheat / Tan suede skate shoes
      roughness: 0.7,
      metalness: 0.05,
    });
    const shoeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.4,
    });
    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: 0x543924,
      roughness: 0.8,
    });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x221318 });

    this.materials.push(
      skinMat,
      faceMat,
      hairMat,
      jacketMat,
      jacketSolidMat,
      jacketCuffMat,
      pantsMat,
      shoeTanMat,
      shoeWhiteMat,
      shoeSoleMat,
      mouthMat
    );

    // ==========================================
    // 1. TORSO (Varsity Bomber Jacket + White Tee)
    // ==========================================
    this.torso = new THREE.Group();
    this.torso.position.y = 1.25;
    this.root.add(this.torso);

    // Main jacket body (box with soft chamfered contour)
    const torsoGeo = new THREE.BoxGeometry(0.56, 0.66, 0.36);
    this.geometries.push(torsoGeo);
    // Face 4 is front (+Z) -> apply jacket texture with "Chicago" & "Route 66"
    const torsoMesh = new THREE.Mesh(torsoGeo, [
      jacketSolidMat, // +X right
      jacketSolidMat, // -X left
      jacketSolidMat, // +Y top
      jacketCuffMat,  // -Y bottom waistband
      jacketMat,      // +Z front (textured with badges & white tee)
      jacketSolidMat, // -Z back
    ]);
    torsoMesh.position.y = 0.05;
    this.torso.add(torsoMesh);

    // Jacket folded collar wings (left and right)
    const collarGeo = new THREE.BoxGeometry(0.18, 0.09, 0.14);
    this.geometries.push(collarGeo);
    const leftCollar = new THREE.Mesh(collarGeo, jacketCuffMat);
    leftCollar.position.set(-0.16, 0.38, 0.16);
    leftCollar.rotation.set(-0.2, 0.1, -0.2);
    this.torso.add(leftCollar);

    const rightCollar = new THREE.Mesh(collarGeo, jacketCuffMat);
    rightCollar.position.set(0.16, 0.38, 0.16);
    rightCollar.rotation.set(-0.2, -0.1, 0.2);
    this.torso.add(rightCollar);

    // ==========================================
    // 2. HEAD & STYLISH HAIR
    // ==========================================
    this.head = new THREE.Group();
    this.head.position.set(0, 0.54, 0);
    this.torso.add(this.head);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.16, 16);
    this.geometries.push(neckGeo);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = -0.12;
    this.head.add(neckMesh);

    // Head base (warm tan skin with mapped face texture on front)
    const headGeo = new THREE.BoxGeometry(0.42, 0.44, 0.4);
    this.geometries.push(headGeo);
    const headMesh = new THREE.Mesh(headGeo, [
      skinMat, // +X
      skinMat, // -X
      skinMat, // +Y
      skinMat, // -Y
      faceMat, // +Z (Eyes, Eyebrows, Nose)
      skinMat, // -Z
    ]);
    headMesh.position.set(0, 0.1, 0);
    this.head.add(headMesh);

    // Ears
    const earGeo = new THREE.BoxGeometry(0.06, 0.12, 0.08);
    this.geometries.push(earGeo);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.23, 0.1, 0);
    this.head.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.23, 0.1, 0);
    this.head.add(rightEar);

    // Animated mouth mesh (dynamic aperture for lip-sync)
    const mouthGeo = new THREE.BoxGeometry(0.14, 0.03, 0.02);
    this.geometries.push(mouthGeo);
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.position.set(0, -0.02, 0.21);
    this.head.add(this.mouthMesh);

    // Hair Group (Textured dark curly/wavy haircut with quiff)
    const hairGroup = new THREE.Group();
    // Top main quiff volume
    const hairTopGeo = new THREE.BoxGeometry(0.46, 0.22, 0.46);
    this.geometries.push(hairTopGeo);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.32, -0.02);
    hairGroup.add(hairTop);

    // Front textured bangs / curls
    const bangsGeo = new THREE.BoxGeometry(0.44, 0.12, 0.12);
    this.geometries.push(bangsGeo);
    const bangs = new THREE.Mesh(bangsGeo, hairMat);
    bangs.position.set(0, 0.28, 0.2);
    hairGroup.add(bangs);

    // Left and right side fades
    const sideHairGeo = new THREE.BoxGeometry(0.06, 0.24, 0.44);
    this.geometries.push(sideHairGeo);
    const leftSideHair = new THREE.Mesh(sideHairGeo, hairMat);
    leftSideHair.position.set(-0.22, 0.2, -0.01);
    hairGroup.add(leftSideHair);
    const rightSideHair = new THREE.Mesh(sideHairGeo, hairMat);
    rightSideHair.position.set(0.22, 0.2, -0.01);
    hairGroup.add(rightSideHair);

    // Back of head hair
    const backHairGeo = new THREE.BoxGeometry(0.44, 0.36, 0.08);
    this.geometries.push(backHairGeo);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.15, -0.21);
    hairGroup.add(backHair);

    this.head.add(hairGroup);

    // ==========================================
    // 3. ARMS (Burgundy Bomber Sleeves + Skin Hands)
    // ==========================================
    this.leftArm = this.createArm(jacketSolidMat, jacketCuffMat, skinMat, false);
    this.leftArm.position.set(-0.35, 0.32, 0);
    this.torso.add(this.leftArm);

    this.rightArm = this.createArm(jacketSolidMat, jacketCuffMat, skinMat, true);
    this.rightArm.position.set(0.35, 0.32, 0);
    this.torso.add(this.rightArm);

    // ==========================================
    // 4. LEGS (Baggy Denim Trousers + Tan Skate Shoes)
    // ==========================================
    this.leftLeg = this.createLeg(pantsMat, shoeTanMat, shoeWhiteMat, shoeSoleMat);
    this.leftLeg.position.set(-0.16, -0.25, 0);
    this.torso.add(this.leftLeg);

    this.rightLeg = this.createLeg(pantsMat, shoeTanMat, shoeWhiteMat, shoeSoleMat);
    this.rightLeg.position.set(0.16, -0.25, 0);
    this.torso.add(this.rightLeg);
  }

  private createArm(
    sleeveMat: THREE.Material,
    cuffMat: THREE.Material,
    handMat: THREE.Material,
    isRight: boolean
  ): THREE.Group {
    const armGroup = new THREE.Group();

    // Upper arm (puffy bomber sleeve)
    const upperGeo = new THREE.CylinderGeometry(0.12, 0.11, 0.34, 16);
    this.geometries.push(upperGeo);
    const upperMesh = new THREE.Mesh(upperGeo, sleeveMat);
    upperMesh.position.y = -0.17;
    armGroup.add(upperMesh);

    // Forearm group
    const foreGroup = new THREE.Group();
    foreGroup.position.y = -0.34;

    const lowerGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.3, 16);
    this.geometries.push(lowerGeo);
    const lowerMesh = new THREE.Mesh(lowerGeo, sleeveMat);
    lowerMesh.position.y = -0.15;
    foreGroup.add(lowerMesh);

    // Ribbed wrist cuff
    const cuffGeo = new THREE.CylinderGeometry(0.095, 0.085, 0.06, 16);
    this.geometries.push(cuffGeo);
    const cuffMesh = new THREE.Mesh(cuffGeo, cuffMat);
    cuffMesh.position.y = -0.3;
    foreGroup.add(cuffMesh);

    // Hand (sculpted palm & thumb)
    const handGeo = new THREE.BoxGeometry(0.09, 0.13, 0.06);
    this.geometries.push(handGeo);
    const handMesh = new THREE.Mesh(handGeo, handMat);
    handMesh.position.y = -0.38;
    foreGroup.add(handMesh);

    const thumbGeo = new THREE.BoxGeometry(0.04, 0.07, 0.04);
    this.geometries.push(thumbGeo);
    const thumbMesh = new THREE.Mesh(thumbGeo, handMat);
    thumbMesh.position.set(isRight ? -0.05 : 0.05, -0.36, 0.02);
    foreGroup.add(thumbMesh);

    armGroup.add(foreGroup);
    return armGroup;
  }

  private createLeg(
    pantsMat: THREE.Material,
    shoeMat: THREE.Material,
    soleWhiteMat: THREE.Material,
    soleDarkMat: THREE.Material
  ): THREE.Group {
    const legGroup = new THREE.Group();

    // Baggy thigh / upper pant leg
    const upperGeo = new THREE.CylinderGeometry(0.17, 0.18, 0.44, 16);
    this.geometries.push(upperGeo);
    const upperMesh = new THREE.Mesh(upperGeo, pantsMat);
    upperMesh.position.y = -0.22;
    legGroup.add(upperMesh);

    // Lower baggy pant leg
    const lowerGroup = new THREE.Group();
    lowerGroup.position.y = -0.44;

    const lowerGeo = new THREE.CylinderGeometry(0.18, 0.19, 0.42, 16);
    this.geometries.push(lowerGeo);
    const lowerMesh = new THREE.Mesh(lowerGeo, pantsMat);
    lowerMesh.position.y = -0.21;
    lowerGroup.add(lowerMesh);

    // ==========================================
    // Tan Skate Shoe / Boot
    // ==========================================
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.42, 0.05);

    // Shoe upper (tan / wheat suede)
    const shoeUpperGeo = new THREE.BoxGeometry(0.19, 0.12, 0.28);
    this.geometries.push(shoeUpperGeo);
    const shoeUpper = new THREE.Mesh(shoeUpperGeo, shoeMat);
    shoeUpper.position.y = -0.04;
    shoeGroup.add(shoeUpper);

    // White rubber midsole stripe
    const shoeSoleWhiteGeo = new THREE.BoxGeometry(0.2, 0.03, 0.29);
    this.geometries.push(shoeSoleWhiteGeo);
    const shoeSoleWhite = new THREE.Mesh(shoeSoleWhiteGeo, soleWhiteMat);
    shoeSoleWhite.position.y = -0.1;
    shoeGroup.add(shoeSoleWhite);

    // Dark tread bottom outsole
    const shoeSoleDarkGeo = new THREE.BoxGeometry(0.2, 0.02, 0.29);
    this.geometries.push(shoeSoleDarkGeo);
    const shoeSoleDark = new THREE.Mesh(shoeSoleDarkGeo, soleDarkMat);
    shoeSoleDark.position.y = -0.12;
    shoeGroup.add(shoeSoleDark);

    lowerGroup.add(shoeGroup);
    legGroup.add(lowerGroup);
    return legGroup;
  }

  public update(delta: number, time: number, mouthOpen: number): void {
    const pose = this.animController.update(delta, time, mouthOpen);

    // Root height and torso breathing
    this.root.position.y = pose.rootY;
    this.torso.position.y = pose.torsoY;

    // Head orientation
    this.head.rotation.set(pose.headRotation.x, pose.headRotation.y, pose.headRotation.z);

    // Arms rotation
    this.leftArm.rotation.set(pose.leftArmRotation.x, pose.leftArmRotation.y, pose.leftArmRotation.z);
    this.rightArm.rotation.set(pose.rightArmRotation.x, pose.rightArmRotation.y, pose.rightArmRotation.z);

    // Baggy legs locomotion
    this.leftLeg.rotation.set(pose.leftLegRotation.x, pose.leftLegRotation.y, pose.leftLegRotation.z);
    this.rightLeg.rotation.set(pose.rightLegRotation.x, pose.rightLegRotation.y, pose.rightLegRotation.z);

    // Mouth aperture during speaking
    this.mouthMesh.scale.set(1.0, pose.mouthScaleY, 1.0);
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.animController.reset();
  }
}

export async function createAvatarRig(avatarUrl?: string): Promise<AvatarRig> {
  const animController = new AnimationController(gestureController);

  if (avatarUrl) {
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(avatarUrl);
      const vrm: VRM = gltf.userData.vrm;
      if (vrm) {
        return {
          root: vrm.scene,
          animController,
          update: (delta, time, mouthOpen) => {
            vrm.update(delta);
            const pose = animController.update(delta, time, mouthOpen);

            if (vrm.expressionManager) {
              vrm.expressionManager.setValue("aa", Math.min(1.0, (pose.mouthScaleY - 1.0) / 6.0));
              vrm.expressionManager.update();
            }

            if (vrm.humanoid) {
              const head = vrm.humanoid.getNormalizedBoneNode("head");
              if (head) {
                head.rotation.set(pose.headRotation.x, pose.headRotation.y, pose.headRotation.z);
              }
              const leftUpperArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
              if (leftUpperArm) {
                leftUpperArm.rotation.set(pose.leftArmRotation.x, pose.leftArmRotation.y, pose.leftArmRotation.z);
              }
              const rightUpperArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
              if (rightUpperArm) {
                rightUpperArm.rotation.set(pose.rightArmRotation.x, pose.rightArmRotation.y, pose.rightArmRotation.z);
              }
            }
          },
          dispose: () => {
            VRMUtils.deepDispose(vrm.scene);
            animController.reset();
          },
        };
      }
    } catch (e) {
      console.warn("Failed to load VRM asset, falling back to procedural rig:", e);
    }
  }

  return new ProceduralAvatarRig();
}

const VRMUtils = {
  deepDispose: (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  },
};
