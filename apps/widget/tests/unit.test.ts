import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { validateConfig } from "../src/config";
import { getCoarseFormState } from "../src/page/form-state-watcher";
import { NodeRegistry } from "../src/page/node-registry";
import { GestureController } from "../src/avatar/gesture-controller";
import { AnimationController } from "../src/avatar/animation-controller";
import { TourController } from "../src/conversation/tour-controller";
import { MorphTargetMapper, OCULUS_VISEMES } from "../src/avatar/morph-mapper";
import { visemeEngine } from "../src/voice/viseme-engine";
import { speechSynthesizer } from "../src/voice/speech-synthesis";
import { createHumanoidClips } from "../src/avatar/animation-clips";
import { PointingController } from "../src/avatar/pointing-controller";

test("SiteGuideConfig: rejects missing widgetId or apiBaseUrl", () => {
  assert.throws(() => validateConfig({} as any), /widgetId/);
  assert.throws(() => validateConfig({ widgetId: "w1" } as any), /apiBaseUrl/);
});

test("SiteGuideConfig: supports independent avatarVisible and chatOpen options", () => {
  const defaultConf = validateConfig({
    widgetId: "test-w",
    apiBaseUrl: "http://localhost:8000",
  });
  assert.equal(defaultConf.avatarVisible, true);
  assert.equal(defaultConf.chatOpen, true);

  const customConf = validateConfig({
    widgetId: "test-w",
    apiBaseUrl: "http://localhost:8000",
    avatarVisible: false,
    chatOpen: false,
  });
  assert.equal(customConf.avatarVisible, false);
  assert.equal(customConf.chatOpen, false);
});

test("calculateAvatarAnchor: calculates safe placement avoiding bottom-right chat dock", () => {
  const { calculateAvatarAnchor } = require("../src/navigation/anchor-layout");
  // Simulated window dimensions in test environment
  global.window = { innerWidth: 1280, innerHeight: 720 } as any;

  // Target in top-center of page
  const targetTop = {
    left: 500,
    right: 700,
    top: 150,
    bottom: 250,
    width: 200,
    height: 100,
  } as DOMRect;

  const anchor = calculateAvatarAnchor(targetTop, 220, 520);
  assert.ok(anchor.x > 0);
  assert.ok(anchor.y >= 16);
  // Must not overlap the bottom-right chat dock (x > 870, y > 340)
  assert.ok(!(anchor.x > 870 && anchor.y > 340));
});

test("SiteGuideConfig: enforces HTTPS for non-localhost endpoints", () => {
  const localConfig = validateConfig({
    widgetId: "demo",
    apiBaseUrl: "http://localhost:8000",
  });
  assert.equal(localConfig.apiBaseUrl, "http://localhost:8000");

  assert.throws(
    () =>
      validateConfig({
        widgetId: "demo",
        apiBaseUrl: "http://api.production.com",
      }),
    /must be HTTPS except on localhost/
  );

  const httpsConfig = validateConfig({
    widgetId: "demo",
    apiBaseUrl: "https://api.production.com",
  });
  assert.equal(httpsConfig.apiBaseUrl, "https://api.production.com");
  assert.equal(httpsConfig.cameraFraming, "bust");
  assert.equal(httpsConfig.quality, "auto");
});

test("MorphTargetMapper: resolves aliases and sets morph values", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]), 3));

  const mesh = new THREE.Mesh(geometry);
  mesh.morphTargetDictionary = {
    mouthOpen: 0,
    viseme_aa: 1,
    eyeBlink_L: 2,
    mouthSmile_R: 3,
  };
  mesh.morphTargetInfluences = [0, 0, 0, 0];
  root.add(mesh);

  const mapper = new MorphTargetMapper(root);

  assert.equal(mapper.hasTarget("jawOpen"), true);
  assert.equal(mapper.hasTarget("viseme_aa"), true);
  assert.equal(mapper.hasTarget("eyeBlinkLeft"), true);
  assert.equal(mapper.hasTarget("mouthSmileRight"), true);

  // Set canonical value
  mapper.setValue("jawOpen", 0.75);
  assert.equal(mesh.morphTargetInfluences[0], 0.75);

  mapper.setValue("eyeBlinkLeft", 1.0);
  assert.equal(mesh.morphTargetInfluences[2], 1.0);

  mapper.resetAll();
  assert.equal(mesh.morphTargetInfluences[0], 0);
  assert.equal(mesh.morphTargetInfluences[2], 0);
});

test("VisemeEngine: parses text into timed viseme sequences", () => {
  const text = "Hello and welcome to our website!";
  const timeline = visemeEngine.generateVisemeTimeline(text, 150);

  assert.ok(timeline.length >= 5);
  assert.equal(timeline[0].word, "Hello");
  assert.ok(timeline[0].keyframes.length > 0);

  // Check that visemes include valid Oculus viseme names
  for (const seq of timeline) {
    for (const kf of seq.keyframes) {
      assert.ok(OCULUS_VISEMES.includes(kf.viseme));
    }
  }
});

test("SpeechSynthesis: extracts emotion tags from speech text", () => {
  const tagged = "Welcome! [emotion:friendly] How can I help you today?";
  const { cleanText, emotion } = speechSynthesizer.parseEmotionAndSanitizeText(tagged);

  assert.equal(emotion, "friendly");
  assert.equal(cleanText, "Welcome! How can I help you today?");

  const untagged = "Just a normal answer.";
  const res2 = speechSynthesizer.parseEmotionAndSanitizeText(untagged);
  assert.equal(res2.emotion, undefined);
  assert.equal(res2.cleanText, "Just a normal answer.");
});

test("HumanoidClips: generates retargetable animation clips", () => {
  const clips = createHumanoidClips();

  assert.ok(clips["idle"]);
  assert.ok(clips["walk"]);
  assert.ok(clips["talk_1"]);
  assert.ok(clips["point_left"]);
  assert.ok(clips["point_right"]);
  assert.ok(clips["thinking"]);
  assert.ok(clips["wave"]);

  // Verify idle duration and tracks
  assert.equal(clips["idle"].duration, 4.0);
  assert.ok(clips["idle"].tracks.length >= 5);

  // Verify bone track names
  const trackNames = clips["idle"].tracks.map((t) => t.name);
  assert.ok(trackNames.includes("Hips.position"));
  assert.ok(trackNames.includes("Head.quaternion"));
  assert.ok(trackNames.includes("LeftArm.quaternion"));
  assert.ok(trackNames.includes("LeftHandIndex1.quaternion"));
  assert.ok(trackNames.includes("RightHandPinky2.quaternion"));
});

test("PointingController: aims with closest arm and handles edge cases", () => {
  const pointer = new PointingController();
  global.window = { innerWidth: 1280, innerHeight: 720 } as any;

  // Mock avatar at bottom-right
  const avatarEl = {
    getBoundingClientRect: () => ({
      left: 1000,
      top: 200,
      width: 280,
      height: 520,
    }),
  } as any;

  // 1. Target on left side of avatar
  const targetLeft = {
    left: 400,
    right: 500,
    top: 250,
    bottom: 300,
    width: 100,
    height: 50,
  } as DOMRect;

  const resLeft = pointer.setTarget(targetLeft, avatarEl);
  assert.equal(resLeft.isEdgeCase, false);
  assert.equal(pointer.getActiveSide(), "left");
  assert.ok(pointer.isPointing());

  // Update simulation step
  const state = pointer.update(0.1, 1.0);
  assert.ok(state.weight > 0);
  assert.equal(state.pointingSide, "left");
  assert.ok(state.left.armQuat);
  assert.ok(state.right.armQuat);

  // 2. Speaking two-handed presenting gestures (without target)
  pointer.stopPointing();
  pointer.setSpeaking(true);
  const speakState = pointer.update(0.1, 2.0, 0.25);
  assert.ok(speakState.weight > 0);
  assert.equal(speakState.isPointing, false);
  assert.ok(speakState.left.foreArmQuat);
  assert.ok(speakState.right.foreArmQuat);

  // 3. Off-screen edge case
  const targetOffscreen = {
    left: 1400,
    right: 1500,
    top: 200,
    bottom: 300,
    width: 100,
    height: 100,
  } as DOMRect;

  const resOff = pointer.setTarget(targetOffscreen, avatarEl);
  assert.equal(resOff.isEdgeCase, true);
  assert.equal(resOff.fallbackGesture, "explain");

  // 4. Close to avatar (< 75px)
  const targetClose = {
    left: 1100,
    right: 1150,
    top: 320,
    bottom: 350,
    width: 50,
    height: 30,
  } as DOMRect;

  const resClose = pointer.setTarget(targetClose, avatarEl);
  assert.equal(resClose.isEdgeCase, true);
  assert.equal(resClose.fallbackGesture, "explain");

  // 5. Smooth stop
  pointer.stopPointing();
  pointer.setSpeaking(false);
  for (let i = 0; i < 15; i++) {
    pointer.update(0.1, 1.0);
  }
  assert.equal(pointer.isPointing(), false);
});

test("FormStateWatcher: coarse state detection never leaks input value", () => {
  const mockPassword = {
    type: "password",
    value: "supersecret123",
    disabled: false,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockPassword), "unknown");

  const mockFilled = {
    type: "text",
    value: "user@example.com",
    disabled: false,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockFilled), "filled");
});

test("NodeRegistry: generates stable unique IDs and handles registration", () => {
  const registry = new NodeRegistry();
  const el1 = {
    tagName: "BUTTON",
    id: "cta-btn",
    getAttribute: () => null,
    setAttribute: () => {},
    isConnected: true,
  } as any;

  const id1 = registry.getOrCreateId(el1, "button");
  assert.ok(id1.startsWith("node_button_cta-btn"));
  assert.equal(registry.resolve(id1), el1);
});
