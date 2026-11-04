import * as THREE from "three";

/**
 * Creates high-quality procedural animation clips targeting humanoid bones.
 * Bones matched: Hips, Spine, Spine1, Spine2, Neck, Head, LeftArm, RightArm,
 * LeftForeArm, RightForeArm, LeftHand, RightHand, LeftUpLeg, RightUpLeg, LeftLeg, RightLeg.
 */

// Helper to construct quaternion keyframe tracks from Euler angles
function createEulerTrack(
  boneName: string,
  times: number[],
  eulers: [number, number, number][]
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  for (const [x, y, z] of eulers) {
    e.set(x, y, z, "XYZ");
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }

  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function createPositionTrack(
  boneName: string,
  times: number[],
  positions: [number, number, number][]
): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const [x, y, z] of positions) {
    values.push(x, y, z);
  }
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values);
}

/**
 * Creates upright standing leg tracks matching avatar.glb skeleton bind orientation:
 * - LeftUpLeg: Euler XYZ [0.113, 0, -3.074]
 * - RightUpLeg: Euler XYZ [0.113, 0, 3.074]
 * - LeftLeg (knee): Euler XYZ [-0.075, 0, 0]
 * - RightLeg (knee): Euler XYZ [-0.075, 0, 0]
 * Ensures the legs never split or freeze in a walk stride when transitioning to gestures.
 */
function createStandingLegTracks(times: number[]): THREE.KeyframeTrack[] {
  const leftUpLegValues = times.map(() => [0.113, 0, -3.074] as [number, number, number]);
  const rightUpLegValues = times.map(() => [0.113, 0, 3.074] as [number, number, number]);
  const kneeValues = times.map(() => [-0.075, 0, 0] as [number, number, number]);

  return [
    createEulerTrack("LeftUpLeg", times, leftUpLegValues),
    createEulerTrack("RightUpLeg", times, rightUpLegValues),
    createEulerTrack("LeftLeg", times, kneeValues),
    createEulerTrack("RightLeg", times, kneeValues),
  ];
}

function createStandingHipsTrack(times: number[]): THREE.KeyframeTrack {
  const hipsValues = times.map(() => [0, 1.037, 0.04] as [number, number, number]);
  return createPositionTrack("Hips", times, hipsValues);
}

const FINGER_NAMES = ["Index", "Middle", "Ring", "Pinky"];

/**
 * Generates relaxed natural finger curl tracks so hands rest softly curved rather than rigid flat slabs.
 */
function createRelaxedFingerTracks(times: number[]): THREE.KeyframeTrack[] {
  const tracks: THREE.KeyframeTrack[] = [];
  ["Left", "Right"].forEach((side) => {
    const isLeft = side === "Left";
    const sign = isLeft ? 1 : -1;

    FINGER_NAMES.forEach((f) => {
      [1, 2, 3].forEach((joint) => {
        const bone = `${side}Hand${f}${joint}`;
        const curlX = 0.36 + joint * 0.07;
        const curlZ = sign * (f === "Index" ? -0.04 : f === "Pinky" ? 0.06 : 0.01);
        const eulers = times.map(() => [curlX, 0, curlZ] as [number, number, number]);
        tracks.push(createEulerTrack(bone, times, eulers));
      });
    });

    [1, 2].forEach((joint) => {
      const bone = `${side}HandThumb${joint}`;
      const curlX = 0.22;
      const curlZ = sign * 0.24;
      const eulers = times.map(() => [curlX, 0, curlZ] as [number, number, number]);
      tracks.push(createEulerTrack(bone, times, eulers));
    });
  });
  return tracks;
}

/**
 * Generates natural relaxed resting arm tracks (hanging close to the torso, soft elbow bend, relaxed hand)
 * to prevent non-gesturing arms from popping back into the stiff A/T-pose.
 */
function createRestingArmTracks(side: "Left" | "Right", times: number[]): THREE.KeyframeTrack[] {
  const isLeft = side === "Left";
  const sign = isLeft ? 1 : -1;
  const armValues = times.map(() => [1.088, sign * 0.097, -sign * 0.220] as [number, number, number]);
  const foreArmValues = times.map(() => [0.347, sign * 0.149, sign * 0.458] as [number, number, number]);
  const handValues = times.map(() => [0.02, -sign * 0.12, -sign * 0.04] as [number, number, number]);

  return [
    createEulerTrack(`${side}Arm`, times, armValues),
    createEulerTrack(`${side}ForeArm`, times, foreArmValues),
    createEulerTrack(`${side}Hand`, times, handValues),
  ];
}

export function createHumanoidClips(): Record<string, THREE.AnimationClip> {
  const clips: Record<string, THREE.AnimationClip> = {};

  // ==========================================
  // 1. IDLE CLIP (Natural breathing & weight shift)
  // ==========================================
  {
    const duration = 4.0;
    const times = [0, 1.0, 2.0, 3.0, 4.0];

    const tracks: THREE.KeyframeTrack[] = [
      // Hips subtle breathing rise and gentle weight shift around bind height 1.037
      createPositionTrack("Hips", times, [
        [0, 1.037, 0.04],
        [0.003, 1.039, 0.04],
        [0, 1.037, 0.04],
        [-0.003, 1.039, 0.04],
        [0, 1.037, 0.04],
      ]),
      // Spine subtle breath expansion
      createEulerTrack("Spine", times, [
        [0, 0, 0],
        [-0.02, 0, 0.01],
        [0, 0, 0],
        [-0.02, 0, -0.01],
        [0, 0, 0],
      ]),
      // Head micro-tilt
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.03, 0.02, 0.01],
        [0.01, 0, 0],
        [0.03, -0.02, -0.01],
        [0.02, 0, 0],
      ]),
      // Natural relaxed arms hanging close to torso with subtle breathing drift
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [1.096, 0.103, -0.215],
        [1.088, 0.097, -0.220],
        [1.080, 0.091, -0.225],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [1.080, -0.091, 0.225],
        [1.088, -0.097, 0.220],
        [1.096, -0.103, 0.215],
        [1.088, -0.097, 0.220],
      ]),
      // Soft elbow bend (~20 deg natural flexion)
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.355, 0.149, 0.458],
        [0.347, 0.149, 0.458],
        [0.339, 0.149, 0.458],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.339, -0.149, -0.458],
        [0.347, -0.149, -0.458],
        [0.355, -0.149, -0.458],
        [0.347, -0.149, -0.458],
      ]),
      // Relaxed wrists hanging naturally beside hips
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
      ]),
      // Soft finger curl for natural human resting hand
      ...createRelaxedFingerTracks(times),
      // Upright natural standing legs matching avatar skeleton bind orientation
      ...createStandingLegTracks(times),
    ];

    clips["idle"] = new THREE.AnimationClip("idle", duration, tracks);
  }

  // ==========================================
  // 2. WALK CLIP (Gait locomotion cycle)
  // ==========================================
  {
    const duration = 1.0;
    const times = [0, 0.25, 0.5, 0.75, 1.0];

    const tracks: THREE.KeyframeTrack[] = [
      // Hips subtle rhythmic bob during gait (1.1 cm)
      createPositionTrack("Hips", times, [
        [0, 1.037, 0.04],
        [0.004, 1.026, 0.04],
        [0, 1.037, 0.04],
        [-0.004, 1.026, 0.04],
        [0, 1.037, 0.04],
      ]),
      // Left leg swing (natural human pitch around correct bind Z: -3.074)
      createEulerTrack("LeftUpLeg", times, [
        [-0.18, -0.02, -3.077],
        [0.113, 0, -3.074],
        [0.36, 0.02, -3.077],
        [0.113, 0, -3.074],
        [-0.18, -0.02, -3.077],
      ]),
      // Left knee flexion (bends backward naturally during swing)
      createEulerTrack("LeftLeg", times, [
        [-0.08, 0, 0],
        [-0.04, 0, 0],
        [-0.42, 0, 0],
        [-0.28, 0, 0],
        [-0.08, 0, 0],
      ]),
      // Right leg swing (opposite phase around correct bind Z: +3.074)
      createEulerTrack("RightUpLeg", times, [
        [0.36, -0.02, 3.077],
        [0.113, 0, 3.074],
        [-0.18, 0.02, 3.077],
        [0.113, 0, 3.074],
        [0.36, -0.02, 3.077],
      ]),
      // Right knee flexion (opposite phase)
      createEulerTrack("RightLeg", times, [
        [-0.42, 0, 0],
        [-0.28, 0, 0],
        [-0.08, 0, 0],
        [-0.04, 0, 0],
        [-0.42, 0, 0],
      ]),
      // Arm counter-swings around natural resting posture
      createEulerTrack("LeftArm", times, [
        [1.20, 0.097, -0.220],
        [1.088, 0.097, -0.220],
        [0.96, 0.097, -0.220],
        [1.088, 0.097, -0.220],
        [1.20, 0.097, -0.220],
      ]),
      createEulerTrack("RightArm", times, [
        [0.96, -0.097, 0.220],
        [1.088, -0.097, 0.220],
        [1.20, -0.097, 0.220],
        [1.088, -0.097, 0.220],
        [0.96, -0.097, 0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.36, 0.149, 0.458],
        [0.347, 0.149, 0.458],
        [0.33, 0.149, 0.458],
        [0.347, 0.149, 0.458],
        [0.36, 0.149, 0.458],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.33, -0.149, -0.458],
        [0.347, -0.149, -0.458],
        [0.36, -0.149, -0.458],
        [0.347, -0.149, -0.458],
        [0.33, -0.149, -0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      // Spine subtle counter-twist
      createEulerTrack("Spine", times, [
        [0, 0.035, 0],
        [0, 0, 0],
        [0, -0.035, 0],
        [0, 0, 0],
        [0, 0.035, 0],
      ]),
    ];

    clips["walk"] = new THREE.AnimationClip("walk", duration, tracks);
  }

  // ==========================================
  // 3. TALK VARIANT 1 (Two-handed open welcoming presentation)
  // ==========================================
  {
    const duration = 2.4;
    const times = [0, 0.6, 1.2, 1.8, 2.4];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [1.02, 0.20, -0.25],
        [1.04, 0.22, -0.26],
        [1.02, 0.19, -0.24],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [1.02, -0.20, 0.25],
        [1.04, -0.22, 0.26],
        [1.02, -0.19, 0.24],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.32, 0.10, 1.45],
        [0.30, 0.10, 1.48],
        [0.32, 0.10, 1.44],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.32, -0.10, -1.45],
        [0.30, -0.10, -1.48],
        [0.32, -0.10, -1.44],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.04, -0.18, 0.12],
        [0.06, -0.20, 0.14],
        [0.04, -0.18, 0.12],
        [0.02, -0.12, -0.04],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.04, 0.18, -0.12],
        [0.06, 0.20, -0.14],
        [0.04, 0.18, -0.12],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0.02, 0],
        [0.04, 0.01, 0.01],
        [0.02, -0.02, -0.01],
        [0.04, 0.02, 0.01],
        [0.02, 0.02, 0],
      ]),
    ];

    clips["talk_1"] = new THREE.AnimationClip("talk_1", duration, tracks);
  }

  // ==========================================
  // 4. TALK VARIANT 2 (Two-handed speech emphasis rhythm beats)
  // ==========================================
  {
    const duration = 2.8;
    const times = [0, 0.7, 1.4, 2.1, 2.8];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [0.98, 0.15, -0.20],
        [1.02, 0.16, -0.21],
        [0.96, 0.14, -0.19],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [0.98, -0.15, 0.20],
        [1.02, -0.16, 0.21],
        [0.96, -0.14, 0.19],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.28, 0.08, 1.55],
        [0.30, 0.09, 1.50],
        [0.26, 0.07, 1.58],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.28, -0.08, -1.55],
        [0.30, -0.09, -1.50],
        [0.26, -0.07, -1.58],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.08, -0.15, 0.10],
        [0.05, -0.14, 0.09],
        [0.09, -0.16, 0.11],
        [0.02, -0.12, -0.04],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.08, 0.15, -0.10],
        [0.05, 0.14, -0.09],
        [0.09, 0.16, -0.11],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Spine", times, [
        [-0.02, 0, 0],
        [-0.05, 0, 0],
        [-0.03, 0, 0],
        [-0.06, 0, 0],
        [-0.02, 0, 0],
      ]),
    ];

    clips["talk_2"] = new THREE.AnimationClip("talk_2", duration, tracks);
  }

  // ==========================================
  // 5. POINT LEFT (Directs user to page element on left with supporting right arm)
  // ==========================================
  {
    const duration = 1.2;
    const times = [0, 0.4, 0.8, 1.2];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      // Active Left Arm (bent-elbow reach forward-left)
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [0.85, 0.24, 0.05],
        [0.82, 0.26, 0.08],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.30, 0.10, 1.35],
        [0.28, 0.10, 1.32],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [-0.02, -0.12, 0.10],
        [-0.02, -0.12, 0.10],
        [0.02, -0.12, -0.04],
      ]),
      // Supporting Right Arm (natural waist hold)
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [1.06, -0.12, 0.22],
        [1.06, -0.12, 0.22],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.34, -0.08, -1.35],
        [0.34, -0.08, -1.35],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.02, 0.14, -0.08],
        [0.02, 0.14, -0.08],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.03, 0.15, 0.02],
        [0.04, 0.18, 0.02],
        [0.02, 0, 0],
      ]),
    ];

    clips["point_left"] = new THREE.AnimationClip("point_left", duration, tracks);
  }

  // ==========================================
  // 6. POINT RIGHT (Directs user to page element on right with supporting left arm)
  // ==========================================
  {
    const duration = 1.2;
    const times = [0, 0.4, 0.8, 1.2];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      // Active Right Arm (bent-elbow reach forward-right)
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [0.85, -0.24, -0.05],
        [0.82, -0.26, -0.08],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.30, -0.10, -1.35],
        [0.28, -0.10, -1.32],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [-0.02, 0.12, -0.10],
        [-0.02, 0.12, -0.10],
        [0.02, 0.12, 0.04],
      ]),
      // Supporting Left Arm (natural waist hold)
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [1.06, 0.12, -0.22],
        [1.06, 0.12, -0.22],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.34, 0.08, 1.35],
        [0.34, 0.08, 1.35],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.02, -0.14, 0.08],
        [0.02, -0.14, 0.08],
        [0.02, -0.12, -0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.03, -0.15, -0.02],
        [0.04, -0.18, -0.02],
        [0.02, 0, 0],
      ]),
    ];

    clips["point_right"] = new THREE.AnimationClip("point_right", duration, tracks);
  }

  // ==========================================
  // 7. THINKING (Hand to chin, upward gaze)
  // ==========================================
  {
    const duration = 2.0;
    const times = [0, 0.6, 1.4, 2.0];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      ...createRestingArmTracks("Left", times),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [-0.95, -0.22, -0.35],
        [-0.98, -0.25, -0.32],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [-1.1, 0.45, 0.28],
        [-1.15, 0.48, 0.3],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.10, 0.22, 0.12],
        [0.12, 0.24, 0.14],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [-0.08, 0.12, 0.04],
        [-0.1, 0.14, 0.05],
        [0.02, 0, 0],
      ]),
    ];

    clips["thinking"] = new THREE.AnimationClip("thinking", duration, tracks);
  }

  // ==========================================
  // 8. LISTENING (Attentive posture, nodding)
  // ==========================================
  {
    const duration = 1.8;
    const times = [0, 0.45, 0.9, 1.35, 1.8];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      ...createRestingArmTracks("Left", times),
      ...createRestingArmTracks("Right", times),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.04, 0.04, 0.02],
        [0.08, 0.03, 0.02],
        [0.04, 0.04, 0.02],
        [0.07, 0.03, 0.02],
        [0.04, 0.04, 0.02],
      ]),
      createEulerTrack("Spine", times, [
        [-0.03, 0, 0],
        [-0.06, 0, 0],
        [-0.03, 0, 0],
        [-0.05, 0, 0],
        [-0.03, 0, 0],
      ]),
    ];

    clips["listening"] = new THREE.AnimationClip("listening", duration, tracks);
  }

  // ==========================================
  // 9. WAVE (Friendly welcome gesture)
  // ==========================================
  {
    const duration = 1.6;
    const times = [0, 0.3, 0.6, 0.9, 1.2, 1.6];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      ...createRestingArmTracks("Left", times),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [-0.95, -0.1, -1.05],
        [-1.0, -0.1, -1.2],
        [-0.95, -0.1, -1.05],
        [-1.0, -0.1, -1.2],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [-0.6, 0.2, 0.25],
        [-0.5, 0.2, 0.1],
        [-0.6, 0.2, 0.25],
        [-0.5, 0.2, 0.1],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.25, 0.2, -0.3],
        [0.1, 0.2, -0.1],
        [0.25, 0.2, -0.3],
        [0.1, 0.2, -0.1],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.03, -0.05, -0.01],
        [0.02, -0.04, -0.01],
        [0.03, -0.05, -0.01],
        [0.02, -0.04, -0.01],
        [0.02, 0, 0],
      ]),
    ];

    clips["wave"] = new THREE.AnimationClip("wave", duration, tracks);
  }

  // ==========================================
  // 10. CELEBRATING (Joyous two-handed cheer with positive posture)
  // ==========================================
  {
    const duration = 2.0;
    const times = [0, 0.4, 0.8, 1.2, 1.6, 2.0];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      // Left arm raised high with bent elbow
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [-0.85, 0.15, 0.95],
        [-0.95, 0.18, 1.10],
        [-0.88, 0.15, 1.00],
        [-0.95, 0.18, 1.10],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [-0.45, -0.15, -0.30],
        [-0.55, -0.18, -0.35],
        [-0.48, -0.15, -0.32],
        [-0.55, -0.18, -0.35],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.15, -0.18, 0.20],
        [0.10, -0.15, 0.15],
        [0.15, -0.18, 0.20],
        [0.10, -0.15, 0.15],
        [0.02, -0.12, -0.04],
      ]),
      // Right arm raised high with bent elbow
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [-0.85, -0.15, -0.95],
        [-0.95, -0.18, -1.10],
        [-0.88, -0.15, -1.00],
        [-0.95, -0.18, -1.10],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [-0.45, 0.15, 0.30],
        [-0.55, 0.18, 0.35],
        [-0.48, 0.15, 0.32],
        [-0.55, 0.18, 0.35],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.15, 0.18, -0.20],
        [0.10, 0.15, -0.15],
        [0.15, 0.18, -0.20],
        [0.10, 0.15, -0.15],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Spine", times, [
        [0, 0, 0],
        [-0.04, 0, 0.02],
        [-0.06, 0, -0.02],
        [-0.04, 0, 0.02],
        [-0.06, 0, -0.02],
        [0, 0, 0],
      ]),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [-0.06, 0.02, 0],
        [-0.08, -0.02, 0],
        [-0.06, 0.02, 0],
        [-0.08, -0.02, 0],
        [0.02, 0, 0],
      ]),
    ];

    clips["celebrating"] = new THREE.AnimationClip("celebrating", duration, tracks);
  }

  // ==========================================
  // 11. GREETING (Polite welcoming bow and open presentation)
  // ==========================================
  {
    const duration = 1.8;
    const times = [0, 0.45, 0.9, 1.35, 1.8];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      createEulerTrack("LeftArm", times, [
        [1.088, 0.097, -0.220],
        [1.05, 0.12, -0.22],
        [1.05, 0.12, -0.22],
        [1.06, 0.11, -0.22],
        [1.088, 0.097, -0.220],
      ]),
      createEulerTrack("LeftForeArm", times, [
        [0.347, 0.149, 0.458],
        [0.35, 0.12, 0.50],
        [0.35, 0.12, 0.50],
        [0.35, 0.12, 0.50],
        [0.347, 0.149, 0.458],
      ]),
      createEulerTrack("LeftHand", times, [
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
        [0.02, -0.12, -0.04],
      ]),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [0.85, -0.20, 0.05],
        [0.82, -0.22, 0.08],
        [0.86, -0.18, 0.06],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [0.30, -0.10, -1.35],
        [0.28, -0.10, -1.38],
        [0.32, -0.10, -1.30],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [-0.02, 0.16, -0.12],
        [-0.04, 0.18, -0.14],
        [-0.02, 0.16, -0.12],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Spine", times, [
        [0, 0, 0],
        [-0.05, 0, 0],
        [-0.07, 0, 0],
        [-0.03, 0, 0],
        [0, 0, 0],
      ]),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.08, 0, 0],
        [0.10, 0, 0],
        [0.05, 0, 0],
        [0.02, 0, 0],
      ]),
    ];

    clips["greeting"] = new THREE.AnimationClip("greeting", duration, tracks);
  }

  // ==========================================
  // 12. GOODBYE (Graceful parting farewell wave)
  // ==========================================
  {
    const duration = 1.8;
    const times = [0, 0.35, 0.7, 1.05, 1.4, 1.8];

    const tracks: THREE.KeyframeTrack[] = [
      createStandingHipsTrack(times),
      ...createStandingLegTracks(times),
      ...createRestingArmTracks("Left", times),
      createEulerTrack("RightArm", times, [
        [1.088, -0.097, 0.220],
        [-0.92, -0.12, -0.98],
        [-0.98, -0.14, -1.15],
        [-0.92, -0.12, -0.98],
        [-0.98, -0.14, -1.15],
        [1.088, -0.097, 0.220],
      ]),
      createEulerTrack("RightForeArm", times, [
        [0.347, -0.149, -0.458],
        [-0.55, 0.18, 0.22],
        [-0.48, 0.16, 0.10],
        [-0.55, 0.18, 0.22],
        [-0.48, 0.16, 0.10],
        [0.347, -0.149, -0.458],
      ]),
      createEulerTrack("RightHand", times, [
        [0.02, 0.12, 0.04],
        [0.20, 0.18, -0.25],
        [0.08, 0.15, -0.08],
        [0.20, 0.18, -0.25],
        [0.08, 0.15, -0.08],
        [0.02, 0.12, 0.04],
      ]),
      ...createRelaxedFingerTracks(times),
      createEulerTrack("Head", times, [
        [0.02, 0, 0],
        [0.04, -0.04, 0.01],
        [0.02, -0.02, 0.01],
        [0.04, -0.04, 0.01],
        [0.02, -0.02, 0.01],
        [0.02, 0, 0],
      ]),
    ];

    clips["goodbye"] = new THREE.AnimationClip("goodbye", duration, tracks);
  }

  return clips;
}
