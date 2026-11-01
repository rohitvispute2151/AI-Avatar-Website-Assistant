import * as THREE from "three";
import { AvatarRig, createAvatarRig } from "./vrm-loader";
import { AvatarAnchor } from "../navigation/anchor-layout";
import { GestureController, ExtendedGesture } from "./gesture-controller";
import { lipSyncController } from "./lipsync-controller";
import { AvatarHighLevelState } from "./animation-controller";

export class AvatarStage {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rig: AvatarRig | null = null;
  private clock: THREE.Clock;
  private animFrameId: number | null = null;
  private isPaused = false;
  private isMoving = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, avatarAssetUrl?: string) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();

    // Camera
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 135;
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
    this.camera.position.set(0, 1.05, 3.65);
    this.camera.lookAt(0, 1.02, 0);

    // Warm studio lights for authentic character colors
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.3);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    const softFillLight = new THREE.DirectionalLight(0xffe8d6, 0.9);
    softFillLight.position.set(-2, 2, -2);
    this.scene.add(softFillLight);

    // Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      
      // Accessibility: avatar canvas is decorative
      this.renderer.domElement.setAttribute("aria-hidden", "true");
      this.renderer.domElement.setAttribute("role", "presentation");
      
      // Context loss/restore handling
      this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, false);
      this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored, false);

      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn("WebGL initialization failed, falling back to static presentation:", e);
      return;
    }

    // Load avatar rig
    createAvatarRig(avatarAssetUrl).then((rig) => {
      this.rig = rig;
      this.scene.add(rig.root);
    });

    // Resize observer
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0 && h > 0 && this.renderer) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }

    // Start render loop
    this.startLoop();

    // Visibility listener to pause loop when tab hidden
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn("AvatarStage: WebGL context lost. Pausing rendering.");
    this.pause();
  };

  private handleContextRestored = () => {
    console.log("AvatarStage: WebGL context restored. Resuming rendering.");
    this.resume();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.pause();
    } else {
      this.resume();
    }
  };

  private startLoop(): void {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.isPaused || !this.renderer) return;

      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Get mouth opening from lip sync controller
      const mouthOpen = lipSyncController.update();

      if (this.rig) {
        this.rig.update(delta, elapsed, mouthOpen);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public setState(state: AvatarHighLevelState | "tour" | "error"): void {
    if (this.rig) {
      if (this.isMoving && state !== "walk") {
        // When moving, maintain walk locomotion while blending upper body gesture
        if (
          state === "point_left" ||
          state === "point_right" ||
          state === "explain" ||
          state === "thinking" ||
          state === "listening"
        ) {
          this.rig.animController.setGesture(state);
        }
        return;
      }
      if (state === "tour") {
        this.rig.animController.setState("speaking");
      } else if (state === "error") {
        this.rig.animController.setState("thinking");
      } else {
        this.rig.animController.setState(state);
      }
    }
  }

  public setGesture(gesture: ExtendedGesture | "none", durationMs?: number): void {
    if (this.rig) {
      this.rig.animController.setGesture(gesture, durationMs);
    }
  }

  public async moveToAnchor(anchor: AvatarAnchor, durationMs: number = 700): Promise<void> {
    const parentContainer = this.container.parentElement;
    if (!parentContainer) return;

    this.isMoving = true;
    if (this.rig) {
      this.rig.animController.setLocomotion("walk");
    }

    const startX = parentContainer.offsetLeft;
    const startY = parentContainer.offsetTop;
    const targetX = anchor.x;
    const targetY = anchor.y;

    const startTime = performance.now();

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);

        // Cubic ease in-out
        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;

        const shellW = parentContainer.offsetWidth || 320;
        const shellH = parentContainer.offsetHeight || 440;
        const margin = 16;
        const maxX = Math.max(margin, window.innerWidth - shellW - margin);
        const maxY = Math.max(margin, window.innerHeight - shellH - margin);
        const clampedX = Math.max(margin, Math.min(currentX, maxX));
        const clampedY = Math.max(margin, Math.min(currentY, maxY));

        parentContainer.style.left = `${clampedX}px`;
        parentContainer.style.top = `${clampedY}px`;
        parentContainer.style.right = "auto";
        parentContainer.style.bottom = "auto";

        if (progress < 1.0) {
          requestAnimationFrame(step);
        } else {
          this.isMoving = false;
          if (this.rig) {
            this.rig.animController.setLocomotion("idle");
            // Face towards target
            if (anchor.side === "left") {
              this.rig.animController.setGesture("point_right");
            } else if (anchor.side === "right") {
              this.rig.animController.setGesture("point_left");
            } else {
              this.rig.animController.setGesture("explain");
            }
          }
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public dispose(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.rig) {
      this.rig.dispose();
      this.rig = null;
    }
    if (this.renderer) {
      this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
      this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleContextRestored);
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }
}
