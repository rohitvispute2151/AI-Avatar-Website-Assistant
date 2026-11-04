import { AvatarStage } from "./avatar-stage";

export interface ExploreControllerOptions {
  onStateChange?: (active: boolean) => void;
  speed?: number; // pixels per second
}

export class ExploreModeController {
  private avatarEl: HTMLElement | null = null;
  private stage: AvatarStage;
  private active = false;
  private speed = 360; // px/s
  private keysPressed = new Set<string>();
  private animFrameId: number | null = null;
  private lastTime = 0;
  private currentX = 0;
  private currentY = 0;
  private isJumping = false;
  private jumpStartY = 0;
  private jumpProgress = 0;
  private options: ExploreControllerOptions;

  // Touch joystick state for mobile
  private touchOrigin: { x: number; y: number } | null = null;
  private touchVector = { x: 0, y: 0 };
  private joystickContainer: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  constructor(stage: AvatarStage, options: ExploreControllerOptions = {}) {
    this.stage = stage;
    this.options = options;
    if (options.speed) this.speed = options.speed;
  }

  public setAvatarElement(el: HTMLElement): void {
    this.avatarEl = el;
  }

  public isRunning(): boolean {
    return this.active;
  }

  public enable(): void {
    if (this.active || !this.avatarEl) return;
    this.active = true;

    // Read current avatar screen position
    const rect = this.avatarEl.getBoundingClientRect();
    this.currentX = rect.left;
    this.currentY = rect.top;

    // Apply absolute screen coordinates
    this.avatarEl.style.left = `${Math.round(this.currentX)}px`;
    this.avatarEl.style.top = `${Math.round(this.currentY)}px`;
    this.avatarEl.style.right = "auto";
    this.avatarEl.style.bottom = "auto";

    // Bind keyboard listeners
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("keydown", this.handleKeyDown, { passive: false });
      window.addEventListener("keyup", this.handleKeyUp, { passive: true });
    }

    // Bind touch joystick for mobile/touch
    this.setupMobileJoystick();

    // Start movement loop
    this.lastTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.startLoop();

    if (this.options.onStateChange) {
      this.options.onStateChange(true);
    }
  }

  public disable(): void {
    if (!this.active) return;
    this.active = false;
    this.keysPressed.clear();
    this.touchVector = { x: 0, y: 0 };

    if (this.animFrameId !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.animFrameId);
      }
      this.animFrameId = null;
    }

    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
    }
    this.teardownMobileJoystick();

    // Return avatar to idle
    const rig = this.stage.getRig();
    if (rig) {
      rig.animController.setLocomotion("idle");
      rig.setMeshRotationY?.(0);
    }

    if (this.options.onStateChange) {
      this.options.onStateChange(false);
    }
  }

  public toggle(): boolean {
    if (this.active) {
      this.disable();
    } else {
      this.enable();
    }
    return this.active;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.active) return;

    const key = e.code || e.key;
    if (
      key === "KeyW" ||
      key === "KeyS" ||
      key === "KeyA" ||
      key === "KeyD" ||
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "Space"
    ) {
      // Prevent webpage scrolling while navigating avatar
      e.preventDefault();
      this.keysPressed.add(key);

      if (key === "Space" && !this.isJumping) {
        this.triggerJump();
      }
    } else if (key === "Escape") {
      this.disable();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.code || e.key;
    this.keysPressed.delete(key);
  };

  private triggerJump(): void {
    if (this.isJumping || !this.avatarEl) return;
    this.isJumping = true;
    this.jumpStartY = this.currentY;
    this.jumpProgress = 0;
    this.stage.setGesture("celebrating", 800);
  }

  private startLoop(): void {
    const tick = (now: number) => {
      if (!this.active || !this.avatarEl) return;

      const delta = Math.min(0.08, (now - this.lastTime) / 1000);
      this.lastTime = now;

      let vx = 0;
      let vy = 0;

      // Keyboard input vector
      if (this.keysPressed.has("KeyA") || this.keysPressed.has("ArrowLeft")) vx -= 1;
      if (this.keysPressed.has("KeyD") || this.keysPressed.has("ArrowRight")) vx += 1;
      if (this.keysPressed.has("KeyW") || this.keysPressed.has("ArrowUp")) vy -= 1;
      if (this.keysPressed.has("KeyS") || this.keysPressed.has("ArrowDown")) vy += 1;

      // Touch joystick vector
      if (Math.abs(this.touchVector.x) > 0.1 || Math.abs(this.touchVector.y) > 0.1) {
        vx = this.touchVector.x;
        vy = this.touchVector.y;
      }

      const length = Math.sqrt(vx * vx + vy * vy);
      const isMoving = length > 0.05;

      const rig = this.stage.getRig();

      if (isMoving) {
        const nx = vx / (length > 1 ? length : 1);
        const ny = vy / (length > 1 ? length : 1);

        this.currentX += nx * this.speed * delta;
        this.currentY += ny * this.speed * delta;

        // Viewport bounds
        const margin = 16;
        const w = this.avatarEl.offsetWidth || 260;
        const h = this.avatarEl.offsetHeight || 500;
        const maxX = window.innerWidth - w - margin;
        const maxY = window.innerHeight - h - margin;

        this.currentX = Math.max(margin, Math.min(this.currentX, maxX));
        this.currentY = Math.max(margin, Math.min(this.currentY, maxY));

        if (rig) {
          rig.animController.setLocomotion("walk");
          // Rotate avatar to face direction of movement
          const headingAngle = Math.atan2(nx, ny * -0.5);
          rig.setMeshRotationY?.(headingAngle * 0.5);
        }
      } else {
        if (rig && !this.isJumping) {
          rig.animController.setLocomotion("idle");
          rig.setMeshRotationY?.(0);
        }
      }

      // Handle jumping hop
      let renderY = this.currentY;
      if (this.isJumping) {
        this.jumpProgress += delta * 3.5;
        if (this.jumpProgress >= Math.PI) {
          this.isJumping = false;
          this.jumpProgress = 0;
        } else {
          const hopHeight = 35 * Math.sin(this.jumpProgress);
          renderY = this.currentY - hopHeight;
        }
      }

      this.avatarEl.style.left = `${Math.round(this.currentX)}px`;
      this.avatarEl.style.top = `${Math.round(renderY)}px`;

      if (typeof requestAnimationFrame === "function") {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame === "function") {
      this.animFrameId = requestAnimationFrame(tick);
    }
  }

  private setupMobileJoystick(): void {
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    this.joystickContainer = document.createElement("div");
    this.joystickContainer.className = "sg-explore-joystick";
    this.joystickContainer.style.cssText = `
      position: fixed;
      bottom: 84px;
      left: 24px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      border: 2px solid rgba(255, 255, 255, 0.2);
      z-index: 1000010;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    `;

    this.joystickKnob = document.createElement("div");
    this.joystickKnob.style.cssText = `
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.6);
      pointer-events: none;
      transition: transform 0.05s ease-out;
    `;
    this.joystickContainer.appendChild(this.joystickKnob);

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = this.joystickContainer!.getBoundingClientRect();
      this.touchOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateTouch(touch);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.touchOrigin) return;
      const touch = e.touches[0];
      updateTouch(touch);
    };

    const onTouchEnd = () => {
      this.touchOrigin = null;
      this.touchVector = { x: 0, y: 0 };
      if (this.joystickKnob) {
        this.joystickKnob.style.transform = `translate(0px, 0px)`;
      }
    };

    const updateTouch = (touch: Touch) => {
      if (!this.touchOrigin || !this.joystickKnob) return;
      const dx = touch.clientX - this.touchOrigin.x;
      const dy = touch.clientY - this.touchOrigin.y;
      const maxRadius = 38;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxRadius);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      this.joystickKnob.style.transform = `translate(${Math.round(knobX)}px, ${Math.round(knobY)}px)`;
      this.touchVector = {
        x: knobX / maxRadius,
        y: knobY / maxRadius,
      };
    };

    this.joystickContainer.addEventListener("touchstart", onTouchStart, { passive: true });
    this.joystickContainer.addEventListener("touchmove", onTouchMove, { passive: true });
    this.joystickContainer.addEventListener("touchend", onTouchEnd, { passive: true });
    this.joystickContainer.addEventListener("touchcancel", onTouchEnd, { passive: true });

    document.body.appendChild(this.joystickContainer);
  }

  private teardownMobileJoystick(): void {
    if (this.joystickContainer && this.joystickContainer.parentElement) {
      this.joystickContainer.parentElement.removeChild(this.joystickContainer);
      this.joystickContainer = null;
      this.joystickKnob = null;
    }
  }

  public destroy(): void {
    this.disable();
  }
}
