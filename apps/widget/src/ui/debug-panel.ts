import { AvatarStage } from "../avatar/avatar-stage";
import { AvatarEmotion, OCULUS_VISEMES } from "../avatar/morph-mapper";
import { audioPlayer } from "../voice/audio-player";
import { lipSyncController } from "../avatar/lipsync-controller";

export class DebugPanel {
  private container: HTMLElement;
  private stage: AvatarStage;
  private panelEl: HTMLElement | null = null;
  private isVisible = false;
  private animId: number | null = null;
  private visemeBars: Record<string, HTMLElement> = {};
  private fpsDisplay!: HTMLElement;

  constructor(container: HTMLElement, stage: AvatarStage) {
    this.container = container;
    this.stage = stage;

    // Check if ?avatarDebug=1 in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("avatarDebug") === "1" || params.get("debug") === "avatar") {
        this.mount();
      }
    }
  }

  public mount(): void {
    if (this.panelEl) return;

    this.panelEl = document.createElement("div");
    this.panelEl.className = "sg-debug-panel";
    this.panelEl.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      background: rgba(15, 20, 30, 0.94);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      z-index: 10000;
      overflow-y: auto;
      backdrop-filter: blur(8px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;";
    header.innerHTML = `
      <span style="font-weight: bold; color: #60a5fa;">🛠️ 3D Avatar Debug Inspector</span>
      <button id="sg-debug-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">✕</button>
    `;
    this.panelEl.appendChild(header);

    // FPS & Metrics
    this.fpsDisplay = document.createElement("div");
    this.fpsDisplay.style.cssText = "display: flex; gap: 16px; color: #10b981; font-weight: bold;";
    this.fpsDisplay.innerHTML = `<span>FPS: --</span><span>Framing: Bust</span>`;
    this.panelEl.appendChild(this.fpsDisplay);

    // Viseme Visualizer
    const visemeSection = document.createElement("div");
    visemeSection.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px; color: #f59e0b;">👄 Real-Time Oculus Visemes:</div>`;
    const visemeGrid = document.createElement("div");
    visemeGrid.style.cssText = "display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;";

    for (const v of OCULUS_VISEMES) {
      const short = v.replace("viseme_", "");
      const row = document.createElement("div");
      row.style.cssText = "background: rgba(255,255,255,0.05); padding: 3px; border-radius: 4px;";
      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:9px;">
          <span>${short}</span><span id="vval-${short}">0%</span>
        </div>
        <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: 2px;">
          <div id="vbar-${short}" style="width: 0%; height: 100%; background: #3b82f6; transition: width 0.05s;"></div>
        </div>
      `;
      visemeGrid.appendChild(row);
      this.visemeBars[v] = row;
    }
    visemeSection.appendChild(visemeGrid);
    this.panelEl.appendChild(visemeSection);

    // Emotion Controls
    const emotionSection = document.createElement("div");
    emotionSection.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px; color: #ec4899;">🎭 Test Emotions:</div>`;
    const emotionButtons = document.createElement("div");
    emotionButtons.style.cssText = "display: flex; gap: 4px; flex-wrap: wrap;";

    const emotions: AvatarEmotion[] = ["neutral", "friendly", "curious", "thinking", "empathetic", "excited"];
    for (const em of emotions) {
      const btn = document.createElement("button");
      btn.textContent = em;
      btn.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 10px;";
      btn.onclick = () => this.stage.setEmotion(em);
      emotionButtons.appendChild(btn);
    }
    emotionSection.appendChild(emotionButtons);
    this.panelEl.appendChild(emotionSection);

    // Gesture Controls
    const gestureSection = document.createElement("div");
    gestureSection.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px; color: #8b5cf6;">🕺 Test Gestures:</div>`;
    const gestureButtons = document.createElement("div");
    gestureButtons.style.cssText = "display: flex; gap: 4px; flex-wrap: wrap;";

    const gestures = ["point_left", "point_right", "explain", "thinking", "listening", "wave", "none"];
    for (const g of gestures) {
      const btn = document.createElement("button");
      btn.textContent = g;
      btn.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 10px;";
      btn.onclick = () => this.stage.setGesture(g as any, 3000);
      gestureButtons.appendChild(btn);
    }
    gestureSection.appendChild(gestureButtons);
    this.panelEl.appendChild(gestureSection);

    // Speech Test Box
    const speechSection = document.createElement("div");
    speechSection.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px; color: #10b981;">🗣️ Test Lip-Sync Speech:</div>`;
    const speechWrap = document.createElement("div");
    speechWrap.style.cssText = "display: flex; gap: 4px;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = "Hello! [emotion:friendly] Welcome to our website. Can I show you around?";
    input.style.cssText = "flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 10px;";

    const speakBtn = document.createElement("button");
    speakBtn.textContent = "Speak";
    speakBtn.style.cssText = "background: #2563eb; border: none; color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;";
    speakBtn.onclick = () => {
      this.stage.setState("speaking");
      audioPlayer.speakText(input.value, "en-US", undefined, () => {
        this.stage.setState("idle");
      });
    };

    speechWrap.appendChild(input);
    speechWrap.appendChild(speakBtn);
    speechSection.appendChild(speechWrap);
    this.panelEl.appendChild(speechSection);

    // Discovered Blendshapes List
    const blendshapeSection = document.createElement("div");
    blendshapeSection.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px; color: #38bdf8;">🎛️ Live Blendshape Sliders:</div>`;
    const slidersWrap = document.createElement("div");
    slidersWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto;";

    const rig = this.stage.getRig();
    const morphs = rig?.morphMapper.getDiscoveredMorphNames() || ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp"];

    for (const m of morphs.slice(0, 16)) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 8px;";
      row.innerHTML = `<span style="width: 120px; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m}</span>`;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.02";
      slider.value = "0";
      slider.style.cssText = "flex: 1; height: 4px;";
      slider.oninput = () => {
        this.stage.getRig()?.morphMapper.setValue(m, parseFloat(slider.value));
      };

      row.appendChild(slider);
      slidersWrap.appendChild(row);
    }
    blendshapeSection.appendChild(slidersWrap);
    this.panelEl.appendChild(blendshapeSection);

    // Close button event
    this.panelEl.querySelector("#sg-debug-close")?.addEventListener("click", () => {
      this.unmount();
    });

    this.container.appendChild(this.panelEl);
    this.isVisible = true;
    this.startUpdater();
  }

  public unmount(): void {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.panelEl && this.panelEl.parentElement) {
      this.panelEl.parentElement.removeChild(this.panelEl);
    }
    this.panelEl = null;
    this.isVisible = false;
  }

  private startUpdater(): void {
    const update = () => {
      if (!this.isVisible) return;

      const fps = this.stage.getFPS();
      if (this.fpsDisplay) {
        this.fpsDisplay.innerHTML = `<span>FPS: ${fps}</span><span>Emotion: ${this.stage.getRig()?.facialController.getEmotion() || "idle"}</span>`;
      }

      for (const v of OCULUS_VISEMES) {
        const short = v.replace("viseme_", "");
        const weight = lipSyncController.getVisemeWeight(v);
        const percent = Math.round(weight * 100);

        const bar = this.panelEl?.querySelector(`#vbar-${short}`) as HTMLElement;
        const val = this.panelEl?.querySelector(`#vval-${short}`) as HTMLElement;
        if (bar) bar.style.width = `${percent}%`;
        if (val) val.textContent = `${percent}%`;
      }

      this.animId = requestAnimationFrame(update);
    };
    update();
  }
}

