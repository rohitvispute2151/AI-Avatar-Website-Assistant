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
  assert.equal(defaultConf.chatOpen, false);

  const customConf = validateConfig({
    widgetId: "test-w",
    apiBaseUrl: "http://localhost:8000",
    avatarVisible: false,
    chatOpen: true,
  });
  assert.equal(customConf.avatarVisible, false);
  assert.equal(customConf.chatOpen, true);
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
    setAttribute: () => { },
    isConnected: true,
  } as any;

  const id1 = registry.getOrCreateId(el1, "button");
  assert.ok(id1.startsWith("node_button_cta-btn"));
  assert.equal(registry.resolve(id1), el1);
});

test("calculateAvatarAnchor: dynamically docks away from target and scales footprint", () => {
  const { calculateAvatarAnchor } = require("../src/navigation/anchor-layout");
  global.window = { innerWidth: 1280, innerHeight: 720 } as any;

  // 1. Full-width Hero section (width > 60% viewport)
  const heroRect = {
    left: 200,
    right: 1080,
    top: 140,
    bottom: 500,
    width: 880,
    height: 360,
  } as DOMRect;

  const heroAnchor = calculateAvatarAnchor(heroRect, 290, 550, 24, true);
  // Must dock on the LEFT viewport margin
  assert.equal(heroAnchor.x, 24);
  assert.equal(heroAnchor.side, "left");
  // Scaled down footprint for wide target (0.75 or 0.70 depending on clearance)
  assert.ok(heroAnchor.scale <= 0.75 && heroAnchor.scale >= 0.70);
  // Grounded at viewport bottom
  assert.ok(heroAnchor.y >= 720 - Math.round(550 * 0.75) - 24);

  // 2. Right-side pricing card
  const rightCardRect = {
    left: 800,
    right: 1100,
    top: 200,
    bottom: 600,
    width: 300,
    height: 400,
  } as DOMRect;

  const rightAnchor = calculateAvatarAnchor(rightCardRect, 290, 550, 24, true);
  // Must dock on LEFT away from target and chat
  assert.equal(rightAnchor.x, 24);
  assert.equal(rightAnchor.side, "left");

  // 3. Mobile viewport (< 768px)
  global.window = { innerWidth: 480, innerHeight: 800 } as any;
  const mobileAnchor = calculateAvatarAnchor(heroRect, 290, 550, 16, true);
  assert.equal(mobileAnchor.scale, 0.65);
});

test("findSectionForPlan: resolves semantic sections from answer intent", () => {
  const { findSectionForPlan } = require("../src/navigation/target-resolver");
  const heroEl = { id: "hero", tagName: "SECTION", isConnected: true, getBoundingClientRect: () => ({ width: 800, height: 400, top: 100, bottom: 500, left: 240, right: 1040 }) };
  global.document = {
    getElementById: (id: string) => (id === "hero" ? heroEl : null),
    querySelector: () => null,
  } as any;

  const resolved = findSectionForPlan({
    turnId: "t1",
    intent: "answer",
    answer: "NovaAI builds 3D avatar guides that turn static websites into an interactive spatial journey.",
    gesture: "explain",
    steps: [],
    evidence: [],
    confidence: 0.95,
    pageRevision: 1,
    shouldSpeak: true,
  });

  assert.equal(resolved, heroEl);
});

test("Tour Steps: Asserts zero rect intersection with target and chat panel across desktop, laptop, and mobile", () => {
  const { calculateAvatarAnchor } = require("../src/navigation/anchor-layout");

  function hasOverlap(r1: any, r2: any): boolean {
    return !(
      r1.right <= r2.left ||
      r1.left >= r2.right ||
      r1.bottom <= r2.top ||
      r1.top >= r2.bottom
    );
  }

  const viewports = [
    { name: "Desktop 1920x1080", width: 1920, height: 1080 },
    { name: "Laptop 1366x768", width: 1366, height: 768 },
  ];

  for (const vp of viewports) {
    global.window = { innerWidth: vp.width, innerHeight: vp.height } as any;

    // Compact chat panel in explaining mode (e.g. tour bar at bottom-right)
    const chatRect = {
      left: vp.width - 240,
      right: vp.width - 20,
      top: vp.height - 60,
      bottom: vp.height - 20,
      width: 220,
      height: 40,
    } as DOMRect;

    // Tour Steps:
    const heroLeft = Math.round((vp.width - 900) / 2);
    const heroTarget = {
      left: heroLeft,
      right: heroLeft + 900,
      top: 100,
      bottom: 500,
      width: 900,
      height: 400,
    } as DOMRect;

    const featLeft = Math.round((vp.width - 860) / 2);
    const featuresTarget = {
      left: featLeft,
      right: featLeft + 860,
      top: 90,
      bottom: 520,
      width: 860,
      height: 430,
    } as DOMRect;

    const priceLeft = Math.round((vp.width - 860) / 2);
    const pricingTarget = {
      left: priceLeft,
      right: priceLeft + 860,
      top: 100,
      bottom: 580,
      width: 860,
      height: 480,
    } as DOMRect;

    const contactLeft = Math.round((vp.width - 700) / 2);
    const contactTarget = {
      left: contactLeft,
      right: contactLeft + 700,
      top: 100,
      bottom: 550,
      width: 700,
      height: 450,
    } as DOMRect;

    const tourTargets = [
      { name: "Step 1: Hero", rect: heroTarget },
      { name: "Step 2: Features", rect: featuresTarget },
      { name: "Step 3: Pricing", rect: pricingTarget },
      { name: "Step 4: Contact", rect: contactTarget },
    ];

    for (const step of tourTargets) {
      const anchor = calculateAvatarAnchor(step.rect, 290, 550, 20, true, chatRect);
      const effW = Math.round(290 * anchor.scale);
      const effH = Math.round(550 * anchor.scale);
      const avatarRect = {
        left: anchor.x,
        right: anchor.x + effW,
        top: anchor.y,
        bottom: anchor.y + effH,
      };

      // 1. Assert zero overlap with target
      const overlapsTarget = hasOverlap(avatarRect, step.rect);
      assert.equal(
        overlapsTarget,
        false,
        `${vp.name} - ${step.name}: Avatar intersects target! Avatar: [${avatarRect.left}, ${avatarRect.right}], Target: [${step.rect.left}, ${step.rect.right}]`
      );

      // 2. Assert zero overlap with chat bar
      const overlapsChat = hasOverlap(avatarRect, chatRect);
      assert.equal(
        overlapsChat,
        false,
        `${vp.name} - ${step.name}: Avatar intersects chat panel! Avatar: [${avatarRect.left}, ${avatarRect.right}], Chat: [${chatRect.left}, ${chatRect.right}]`
      );

      // 3. Assert head and feet are fully inside viewport with padding
      assert.ok(avatarRect.top >= 10, `${vp.name} - ${step.name}: Head cut off at top (y=${avatarRect.top})`);
      assert.ok(avatarRect.bottom <= vp.height, `${vp.name} - ${step.name}: Feet cut off at bottom (bottom=${avatarRect.bottom}, vpHeight=${vp.height})`);
    }
  }
});

test("TourController: resets state and status to idle on stop and completion", () => {
  const { TourController } = require("../src/conversation/tour-controller");
  const controller = new TourController();

  let completed = false;
  controller.start(
    [
      { targetNodeId: "hero", spokenText: "Hero", gesture: "open_palm", stepKind: "section" },
      { targetNodeId: "features", spokenText: "Features", gesture: "open_palm", stepKind: "section" },
    ],
    () => { },
    () => {
      completed = true;
    }
  );

  assert.equal(controller.getStatus(), "running");
  assert.equal(controller.getCurrentIndex(), 0);

  // Advance to next step
  controller.next();
  assert.equal(controller.getCurrentIndex(), 1);

  // Advance past last step -> complete
  controller.next();
  assert.equal(completed, true);
  assert.equal(controller.getStatus(), "idle");
  assert.equal(controller.getCurrentIndex(), -1);
  assert.equal(controller.getTotalSteps(), 0);

  // Test stop()
  controller.start(
    [{ targetNodeId: "hero", spokenText: "Hero", gesture: "open_palm", stepKind: "section" }],
    () => { },
    () => { }
  );
  assert.equal(controller.getStatus(), "running");
  controller.stop();
  assert.equal(controller.getStatus(), "idle");
  assert.equal(controller.getCurrentIndex(), -1);
  assert.equal(controller.getTotalSteps(), 0);
});
