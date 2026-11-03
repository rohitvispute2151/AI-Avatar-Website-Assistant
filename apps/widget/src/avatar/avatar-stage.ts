import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { AvatarRig, createRiggedAvatar, RigLoaderOptions } from "./rig-loader";
import { AvatarAnchor } from "../navigation/anchor-layout";
import { ExtendedGesture } from "./gesture-controller";
import { AvatarHighLevelState } from "./animation-controller";
import { AvatarEmotion } from "./morph-mapper";
import { audioPlayer } from "../voice/audio-player";
import { AvatarQuality, CameraFraming } from "../config";

export interface AvatarStageOptions {
  avatarAssetUrl?: string;
  avatarHdriUrl?: string;
  quality?: AvatarQuality;
  cameraFraming?: CameraFraming;
  assetBaseUrl?: string;
  onReady?: () => void;
  onError?: (err: any) => void;
}

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

  // Camera framing & push-in
  private cameraFraming: CameraFraming = "bust";
  private baseCameraZ = 4.1;
  private targetCameraZ = 4.1;
  private currentCameraZ = 4.1;
  private targetCameraY = 0.864;
  private currentCameraY = 0.864;
  private isSpeaking = false;
  private isReducedMotion = false;

  // Lighting & PMREM
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.AmbientLight;

  // Quality auto-tuner & performance metrics
  private quality: AvatarQuality = "auto";
  private frameCount = 0;
  private accumulatedFrameTime = 0;
  private currentFPS = 60;
  private isTuned = false;

  // Loading UI overlay
  private loadingOverlay: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private lastTargetRect: DOMRect | null = null;

  constructor(container: HTMLElement, options: AvatarStageOptions = {}) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.quality = options.quality || "auto";
    this.cameraFraming = options.cameraFraming || "bust";

    this.checkReducedMotion();

    // 1. Setup Camera — calibrated framing with safe margins ensuring hands, head, feet are fully visible
    const width = container.clientWidth || 290;
    const height = container.clientHeight || 550;
    this.targetCameraY = 0.864;
    this.baseCameraZ = this.computeIdealZ(width, height);
    this.targetCameraZ = this.baseCameraZ;
    this.currentCameraY = this.targetCameraY;
    this.currentCameraZ = this.targetCameraZ;

    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
    this.camera.position.set(0, this.currentCameraY, this.currentCameraZ);
    this.camera.lookAt(0, 0.864, 0);

    // 2. Setup Three-point Studio Lighting
    this.setupLighting();

    // 3. Setup WebGL Renderer with ACES Filmic Tone Mapping & Shadows
    this.setupRenderer(width, height);

    // 4. Create Sleek Loading Indicator Overlay
    this.createLoadingUI();

    // 5. Load CC0 Studio HDRI Environment (Poly Haven / Three.js)
    const hdriUrl = options.avatarHdriUrl || (options.assetBaseUrl ? `${options.assetBaseUrl}/assets/avatar/studio.hdr` : "/assets/avatar/studio.hdr");
    this.loadHdriEnvironment(hdriUrl);

    // 6. Load Humanoid Rig
    const modelUrl = options.avatarAssetUrl || (options.assetBaseUrl ? `${options.assetBaseUrl}/assets/avatar/avatar.glb` : "/assets/avatar/avatar.glb");
    createRiggedAvatar({
      modelUrl,
      onProgress: (percent) => {
        this.updateProgress(percent);
      },
      onReady: () => {
        this.hideLoadingUI();
        if (options.onReady) options.onReady();
      },
      onError: (err) => {
        console.warn("AvatarStage: Model load error, running fallback:", err);
        this.hideLoadingUI();
        if (options.onError) options.onError(err);
      },
    }).then((rig) => {
      this.rig = rig;
      this.scene.add(rig.root);

      // Connect speech emotion listener to facial controller
      audioPlayer.setEmotionCallback((emotion) => {
        this.rig?.facialController.setEmotion(emotion);
      });
    });

    // 7. Bind Resize and Visibility Observers
    this.bindObservers();

    // 8. Bind Pointer Gaze Tracking
    this.bindGazeTracking();

    // 9. Setup avatar mesh raycaster click listener
    this.setupAvatarClickListener();

    // 10. Start Render Loop
    this.startLoop();
  }

  private checkReducedMotion(): void {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.isReducedMotion = mq.matches;
      mq.addEventListener("change", (e) => {
        this.isReducedMotion = e.matches;
      });
    }
  }

  private setupLighting(): void {
    // Fill Light (Warm ambient)
    this.fillLight = new THREE.AmbientLight(0xfff5ea, 1.0);
    this.scene.add(this.fillLight);

    // Key Light (Warm directional with soft shadow)
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 2.0);
    this.keyLight.position.set(1.5, 3.0, 2.2);
    this.keyLight.castShadow = this.quality !== "low";
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    // Rim Light (Cool rim light behind avatar for cinematic separation)
    this.rimLight = new THREE.DirectionalLight(0xd8e8ff, 1.4);
    this.rimLight.position.set(-2.0, 2.5, -2.5);
    this.scene.add(this.rimLight);
  }

  private setupRenderer(width: number, height: number): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: this.quality !== "low",
        powerPreference: "high-performance",
      });

      this.renderer.setSize(width, height);
      const dpr = this.quality === "low" ? 1.0 : Math.min(window.devicePixelRatio || 1, 2.0);
      this.renderer.setPixelRatio(dpr);

      // ACES Filmic Tone Mapping & sRGB Color Space
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Soft PCF Shadows
      if (this.quality !== "low") {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      this.renderer.domElement.setAttribute("aria-hidden", "true");
      this.renderer.domElement.setAttribute("role", "presentation");
      this.renderer.domElement.style.transition = "opacity 0.4s ease-out";
      this.renderer.domElement.style.opacity = "0";

      this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, false);
      this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored, false);

      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn("AvatarStage: WebGL initialization failed:", e);
    }
  }

  private loadHdriEnvironment(hdriUrl: string): void {
    if (!this.renderer) return;

    try {
      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.pmremGenerator.compileEquirectangularShader();

      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(
        hdriUrl,
        (hdrTexture) => {
          if (!this.pmremGenerator) return;
          const envMap = this.pmremGenerator.fromEquirectangular(hdrTexture);
          this.scene.environment = envMap.texture;
          hdrTexture.dispose();
          envMap.dispose();
        },
        undefined,
        (err) => {
          console.warn("AvatarStage: HDRI load notice (using studio lights fallback):", err);
        }
      );
    } catch (e) {
      console.warn("AvatarStage: RGBELoader init failed:", e);
    }
  }

  private createLoadingUI(): void {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "sg-avatar-loading-overlay";
    this.loadingOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: radial-gradient(circle at center, rgba(30, 36, 50, 0.8) 0%, rgba(12, 16, 24, 0.95) 100%);
      z-index: 5;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;

    const spinner = document.createElement("div");
    spinner.style.cssText = `
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: sg-spin 0.8s linear infinite;
    `;

    const style = document.createElement("style");
    style.textContent = `@keyframes sg-spin { to { transform: rotate(360deg); } }`;
    this.loadingOverlay.appendChild(style);
    this.loadingOverlay.appendChild(spinner);

    this.progressText = document.createElement("span");
    this.progressText.style.cssText = `
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      color: rgba(255, 255, 255, 0.7);
      letter-spacing: 0.5px;
    `;
    this.progressText.textContent = "Loading 3D Avatar...";
    this.loadingOverlay.appendChild(this.progressText);

    this.container.appendChild(this.loadingOverlay);
  }

  private updateProgress(percent: number): void {
    if (this.progressText) {
      this.progressText.textContent = `Loading Avatar... ${percent}%`;
    }
  }

  private hideLoadingUI(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.opacity = "0";
      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentElement) {
          this.loadingOverlay.parentElement.removeChild(this.loadingOverlay);
          this.loadingOverlay = null;
        }
      }, 350);
    }
    if (this.renderer?.domElement) {
      this.renderer.domElement.style.opacity = "1";
    }
  }

  private computeIdealZ(width: number, height: number): number {
    const fovY = 32 * (Math.PI / 180);
    const tanHalf = Math.tan(fovY / 2);
    const aspect = Math.max(0.2, width / Math.max(1, height));
    // Safe framing margins for avatar:
    // Hands span ~1.0m (Xmax = 0.72m with safe margin), height ~1.72m (Ymax = 1.15m from center 0.88)
    const Xmax = 0.72;
    const Ymax = 1.15;
    const zForHeight = Ymax / tanHalf;
    const zForWidth = Xmax / (tanHalf * aspect);
    return Math.max(zForHeight, zForWidth);
  }

  private bindObservers(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0 && h > 0 && this.renderer) {
            this.camera.aspect = w / h;
            this.baseCameraZ = this.computeIdealZ(w, h);
            this.targetCameraZ = this.baseCameraZ;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private bindGazeTracking(): void {
    const onPointerMove = (e: MouseEvent) => {
      if (!this.container || this.isPaused) return;
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalized coordinates (-1 to 1) relative to canvas center
      const nx = (e.clientX - centerX) / (window.innerWidth / 2);
      const ny = (e.clientY - centerY) / (window.innerHeight / 2);

      this.rig?.setLookAtTarget(nx, ny);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn("AvatarStage: WebGL context lost. Pausing.");
    this.pause();
  };

  private handleContextRestored = () => {
    console.log("AvatarStage: WebGL context restored. Resuming.");
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

      const delta = Math.min(0.08, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();

      // Quality Auto-Tuner: measure frame time over initial 120 frames
      if (this.quality === "auto" && !this.isTuned) {
        this.frameCount++;
        this.accumulatedFrameTime += delta;
        if (this.frameCount >= 90) {
          const avgFrameTime = this.accumulatedFrameTime / this.frameCount;
          this.currentFPS = Math.round(1.0 / Math.max(0.001, avgFrameTime));
          this.isTuned = true;

          // If under 30 FPS, downgrade settings to maintain fluidity
          if (this.currentFPS < 30) {
            console.log(`AvatarStage: Quality auto-tuned to Performance Mode (${this.currentFPS} FPS).`);
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(1.0);
            this.keyLight.castShadow = false;
          }
        }
      }

      // Smooth subtle Camera Push-in during speaking (max 2% push, keeping hands, head, and feet fully visible)
      if (!this.isReducedMotion) {
        const pushTargetZ = this.isSpeaking ? this.baseCameraZ * 0.98 : this.baseCameraZ;
        this.currentCameraZ += (pushTargetZ - this.currentCameraZ) * Math.min(1.0, delta * 2.0);
        this.camera.position.z = this.currentCameraZ;
      }

      // Update avatar rig
      if (this.rig) {
        this.rig.update(delta, elapsed);
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  public setState(state: AvatarHighLevelState | "tour" | "error"): void {
    this.isSpeaking = state === "speaking" || state === "tour";
    if (this.rig) {
      if (state === "speaking") {
        (this.rig as any).setSpeaking?.(true);
      } else {
        (this.rig as any).setSpeaking?.(false);
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

  public pointAt(targetRect: DOMRect | null): void {
    this.lastTargetRect = targetRect;
    if (!this.rig || !this.rig.pointAt) return;
    const avatarEl = (this.container.closest(".sg-avatar-layer") as HTMLElement) || this.container.parentElement;
    const rootNode = this.container.getRootNode() as Document | ShadowRoot;
    const chatEl = rootNode?.querySelector
      ? ((rootNode.querySelector(".sg-chat-panel") || rootNode.querySelector("#sg-shell")) as HTMLElement | null)
      : null;
    this.rig.pointAt(targetRect, avatarEl, chatEl);
  }

  public stopPointing(): void {
    this.lastTargetRect = null;
    if (!this.rig || !this.rig.stopPointing) return;
    this.rig.stopPointing();
  }

  public setEmotion(emotion: AvatarEmotion): void {
    this.rig?.facialController.setEmotion(emotion);
  }

  private setupAvatarClickListener(): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      if (!this.renderer || !this.rig) return;
      const canvas = this.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObjects(this.rig.root.children, true);
        if (intersects.length > 0) {
          const rootNode = this.container.getRootNode() as ShadowRoot | Document;
          const tapHint = rootNode?.getElementById ? rootNode.getElementById("sg-avatar-tap-hint") : null;
          if (tapHint) {
            tapHint.click();
          }
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  }

  public async moveToAnchor(anchor: AvatarAnchor, durationMs: number = 650): Promise<void> {
    const avatarEl = (this.container.closest(".sg-avatar-layer") as HTMLElement) || this.container.parentElement;
    if (!avatarEl) return;

    this.isMoving = true;
    if (this.rig) {
      this.rig.animController.setLocomotion("walk");
    }

    const currentRect = avatarEl.getBoundingClientRect();
    const startX = currentRect.left;
    const startY = currentRect.top;
    const targetX = anchor.x;
    const targetY = anchor.y;

    const rawScale = parseFloat(avatarEl.style.getPropertyValue("--avatar-scale") || "1.0");
    const startScale = isNaN(rawScale) ? 1.0 : rawScale;
    const targetScale = anchor.scale ?? 0.85;

    const startTime = performance.now();

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);

        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;
        const currentScale = startScale + (targetScale - startScale) * ease;

        const stageW = avatarEl.offsetWidth || 290;
        const stageH = avatarEl.offsetHeight || 550;
        const margin = 16;
        const maxX = Math.max(margin, window.innerWidth - stageW * currentScale - margin);
        const clampedX = Math.max(margin, Math.min(currentX, maxX));

        avatarEl.style.left = `${Math.round(clampedX)}px`;
        avatarEl.style.right = "auto";
        avatarEl.style.setProperty("--avatar-scale", currentScale.toFixed(3));

        if (anchor.useBottomAnchor || anchor.side !== "top") {
          // Bottom grounding guarantees feet and shoes are 100% inside viewport
          avatarEl.style.bottom = "16px";
          avatarEl.style.top = "auto";
        } else {
          const maxY = Math.max(margin, window.innerHeight - stageH * currentScale - margin);
          const clampedY = Math.max(margin, Math.min(currentY, maxY));
          avatarEl.style.top = `${Math.round(clampedY)}px`;
          avatarEl.style.bottom = "auto";
        }

        // Dynamically recompute pointing direction as the avatar walks
        if (this.lastTargetRect) {
          this.pointAt(this.lastTargetRect);
        }

        if (progress < 1.0) {
          requestAnimationFrame(step);
        } else {
          this.isMoving = false;
          if (this.rig) {
            this.rig.animController.setLocomotion("idle");
          }
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  public async returnToDock(durationMs: number = 600): Promise<void> {
    const avatarEl = (this.container.closest(".sg-avatar-layer") as HTMLElement) || this.container.parentElement;
    if (!avatarEl) return;

    if (!avatarEl.style.left && !avatarEl.style.top) {
      return;
    }

    const currentRect = avatarEl.getBoundingClientRect();
    const startX = currentRect.left;
    const startY = currentRect.top;

    const rootNode = this.container.getRootNode() as Document | ShadowRoot;
    const chatPanel = rootNode?.querySelector
      ? ((rootNode.querySelector(".sg-chat-panel") || rootNode.querySelector("#sg-shell")) as HTMLElement | null)
      : null;
    const isChatOpen = chatPanel ? !chatPanel.classList.contains("sg-hidden") : true;

    const stageW = avatarEl.offsetWidth || 290;
    const stageH = avatarEl.offsetHeight || 550;
    const defaultRight = isChatOpen ? 414 : 20;
    const targetX = window.innerWidth - defaultRight - stageW;
    const targetY = window.innerHeight - stageH;

    const rawScale = parseFloat(avatarEl.style.getPropertyValue("--avatar-scale") || "1.0");
    const startScale = isNaN(rawScale) ? 1.0 : rawScale;
    const targetScale = 1.0;

    this.isMoving = true;
    if (this.rig) {
      this.rig.animController.setLocomotion("walk");
    }

    const startTime = performance.now();

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);

        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;
        const currentScale = startScale + (targetScale - startScale) * ease;

        avatarEl.style.left = `${Math.round(currentX)}px`;
        avatarEl.style.top = `${Math.round(currentY)}px`;
        avatarEl.style.setProperty("--avatar-scale", currentScale.toFixed(3));

        if (progress < 1.0) {
          requestAnimationFrame(step);
        } else {
          this.isMoving = false;
          if (this.rig) {
            this.rig.animController.setLocomotion("idle");
          }
          avatarEl.style.left = "";
          avatarEl.style.top = "";
          avatarEl.style.right = "";
          avatarEl.style.bottom = "";
          avatarEl.style.removeProperty("--avatar-scale");
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  public getFPS(): number {
    return this.currentFPS;
  }

  public getRig(): AvatarRig | null {
    return this.rig;
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
    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = null;
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
