import test from "node:test";
import assert from "node:assert/strict";

import { validateConfig } from "../src/config.ts";
import { getCoarseFormState } from "../src/page/form-state-watcher.ts";
import { NodeRegistry } from "../src/page/node-registry.ts";
import { GestureController } from "../src/avatar/gesture-controller.ts";
import { AnimationController } from "../src/avatar/animation-controller.ts";
import { TourController } from "../src/conversation/tour-controller.ts";

test("SiteGuideConfig: rejects missing widgetId or apiBaseUrl", () => {
  assert.throws(() => validateConfig({} as any), /widgetId/);
  assert.throws(() => validateConfig({ widgetId: "w1" } as any), /apiBaseUrl/);
});

test("SiteGuideConfig: enforces HTTPS for non-localhost endpoints", () => {
  // Localhost allowed with HTTP
  const localConfig = validateConfig({
    widgetId: "demo",
    apiBaseUrl: "http://localhost:8000",
  });
  assert.equal(localConfig.apiBaseUrl, "http://localhost:8000");

  // Non-localhost must be HTTPS
  assert.throws(
    () =>
      validateConfig({
        widgetId: "demo",
        apiBaseUrl: "http://api.production.com",
      }),
    /must be HTTPS except on localhost/
  );

  // HTTPS is accepted
  const httpsConfig = validateConfig({
    widgetId: "demo",
    apiBaseUrl: "https://api.production.com",
  });
  assert.equal(httpsConfig.apiBaseUrl, "https://api.production.com");
});

test("FormStateWatcher: coarse state detection never leaks input value", () => {
  // Password field always returns unknown
  const mockPassword = {
    type: "password",
    value: "supersecret123",
    disabled: false,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockPassword), "unknown");

  // Disabled field returns unknown
  const mockDisabled = {
    type: "text",
    value: "test",
    disabled: true,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockDisabled), "unknown");

  // Filled field returns 'filled' without value leakage
  const mockFilled = {
    type: "text",
    value: "user@example.com",
    disabled: false,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockFilled), "filled");

  // Empty field returns 'empty'
  const mockEmpty = {
    type: "text",
    value: "   ",
    disabled: false,
    getAttribute: () => null,
  } as any;
  assert.equal(getCoarseFormState(mockEmpty), "empty");
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

  // Re-getting returns same ID (WeakMap stability)
  const id1Repeat = registry.getOrCreateId(el1, "button");
  assert.equal(id1, id1Repeat);

  // Resolving ID returns the element
  assert.equal(registry.resolve(id1), el1);

  // When element is disconnected, it returns null
  el1.isConnected = false;
  assert.equal(registry.resolve(id1), null);
});

test("AnimationController & GestureController: multi-layer blending", () => {
  const gestures = new GestureController();
  const anim = new AnimationController(gestures);

  // Base idle pose
  const idlePose = anim.update(0.016, 0.5, 0);
  assert.ok(idlePose.torsoY > 1.2);
  assert.equal(idlePose.mouthScaleY, 1.0);

  // Set walk locomotion and point_right gesture simultaneously
  anim.setLocomotion("walk");
  gestures.setGesture("point_right");

  // Update animation over a few frames to let blend weight accumulate
  for (let i = 0; i < 30; i++) {
    anim.update(0.03, 1.0 + i * 0.03, 0.5);
  }

  const blendedPose = anim.update(0.03, 2.0, 0.8);
  // Legs are actively swinging for locomotion
  assert.notEqual(blendedPose.leftLegRotation.x, 0);
  // Mouth is open from lip-sync
  assert.ok(blendedPose.mouthScaleY > 2.0);
  // Pointing gesture is active on right arm
  assert.ok(blendedPose.rightArmRotation.z < -0.5);
});

test("TourController: step navigation, bounds and completion", () => {
  const tour = new TourController();

  const steps = [
    { targetNodeId: "n1", spokenText: "Step 1", gesture: "open_palm" as const, stepKind: "section" as const },
    { targetNodeId: "n2", spokenText: "Step 2", gesture: "point_right" as const, stepKind: "section" as const },
  ];

  let currentStepIndex = -1;
  let completed = false;

  tour.start(
    steps,
    (_step, idx) => {
      currentStepIndex = idx;
    },
    () => {
      completed = true;
    }
  );

  assert.equal(tour.getStatus(), "running");
  assert.equal(currentStepIndex, 0);

  tour.next();
  assert.equal(currentStepIndex, 1);

  tour.next(); // At end -> complete
  assert.equal(tour.getStatus(), "completed");
  assert.equal(completed, true);
});

