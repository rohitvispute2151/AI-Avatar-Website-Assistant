import { MorphTargetMapper, OculusViseme, OCULUS_VISEMES } from "./morph-mapper";
import { visemeEngine, WordVisemeSequence, VisemeKeyframe } from "../voice/viseme-engine";

export interface LipSyncEvents {
  onViseme?: (viseme: OculusViseme, weight: number) => void;
  onWordBoundary?: (word: string, charIndex: number) => void;
}

export class LipSyncController {
  private mapper: MorphTargetMapper | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<any> | null = null;

  // Real-time timeline driven lip sync
  private timeline: WordVisemeSequence[] = [];
  private currentWordIndex = 0;
  private currentKeyframeIndex = 0;
  private keyframeTimeElapsed = 0;
  private isTimelineActive = false;

  // Active viseme weights & coarticulation
  private currentVisemeWeights: Record<string, number> = {};
  private targetVisemeWeights: Record<string, number> = {};

  // Procedural fallback
  private isProcedural = false;
  private proceduralPhase = 0;

  // Event callbacks
  private events: LipSyncEvents = {};

  constructor() {
    for (const v of OCULUS_VISEMES) {
      this.currentVisemeWeights[v] = 0;
      this.targetVisemeWeights[v] = 0;
    }
    this.currentVisemeWeights["jawOpen"] = 0;
    this.targetVisemeWeights["jawOpen"] = 0;
  }

  public setMorphMapper(mapper: MorphTargetMapper): void {
    this.mapper = mapper;
  }

  public setEvents(events: LipSyncEvents): void {
    this.events = events;
  }

  /**
   * Prepares and starts viseme timeline driving for browser SpeechSynthesis.
   */
  public startSpeechTimeline(text: string, wordsPerMinute = 160): void {
    this.stop();
    this.timeline = visemeEngine.generateVisemeTimeline(text, wordsPerMinute);
    this.currentWordIndex = 0;
    this.currentKeyframeIndex = 0;
    this.keyframeTimeElapsed = 0;
    this.isTimelineActive = true;
  }

  /**
   * Re-synchronizes speech timeline when SpeechSynthesis fires a 'boundary' event.
   */
  public syncWordBoundary(charIndex: number): void {
    if (!this.isTimelineActive || this.timeline.length === 0) return;

    for (let i = 0; i < this.timeline.length; i++) {
      if (this.timeline[i].charIndex >= charIndex - 2 && this.timeline[i].charIndex <= charIndex + 2) {
        this.currentWordIndex = i;
        this.currentKeyframeIndex = 0;
        this.keyframeTimeElapsed = 0;
        if (this.events.onWordBoundary) {
          this.events.onWordBoundary(this.timeline[i].word, charIndex);
        }
        break;
      }
    }
  }

  public attachAudioStream(stream: MediaStream): void {
    try {
      this.stop();
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      this.startProcedural();
    }
  }

  public attachMediaElement(audioEl: HTMLAudioElement): void {
    try {
      this.stop();
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaElementSource(audioEl);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      this.startProcedural();
    }
  }

  public startProcedural(): void {
    this.stop();
    this.isProcedural = true;
    this.proceduralPhase = 0;
  }

  public stop(): void {
    this.isTimelineActive = false;
    this.isProcedural = false;
    this.timeline = [];
    this.currentWordIndex = 0;
    this.currentKeyframeIndex = 0;

    if (this.analyser) {
      this.analyser = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    // Zero out all target visemes
    for (const v of OCULUS_VISEMES) {
      this.targetVisemeWeights[v] = 0;
    }
    this.targetVisemeWeights["jawOpen"] = 0;
  }

  /**
   * Core frame update loop called in AvatarStage render loop.
   * Updates coarticulation smoothing and applies morph targets.
   * Returns current overall mouth open aperture (0 to 1).
   */
  public update(delta: number): number {
    const deltaMs = delta * 1000;

    // Reset target weights
    for (const v of OCULUS_VISEMES) {
      this.targetVisemeWeights[v] = 0;
    }
    this.targetVisemeWeights["jawOpen"] = 0;

    // Mode A: Timeline from SpeechSynthesis boundary events
    if (this.isTimelineActive && this.timeline.length > 0) {
      if (this.currentWordIndex < this.timeline.length) {
        const wordSeq = this.timeline[this.currentWordIndex];
        const keyframe = wordSeq.keyframes[this.currentKeyframeIndex];

        if (keyframe) {
          this.targetVisemeWeights[keyframe.viseme] = keyframe.weight;
          this.targetVisemeWeights["jawOpen"] = this.getJawOpeningForViseme(keyframe.viseme, keyframe.weight);

          this.keyframeTimeElapsed += deltaMs;
          if (this.keyframeTimeElapsed >= keyframe.durationMs) {
            this.keyframeTimeElapsed = 0;
            this.currentKeyframeIndex++;
            if (this.currentKeyframeIndex >= wordSeq.keyframes.length) {
              this.currentKeyframeIndex = 0;
              this.currentWordIndex++;
            }
          }
        }
      } else {
        this.isTimelineActive = false;
      }
    }
    // Mode B: Audio Analyser FFT classification
    else if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      const classified = visemeEngine.classifyAudioSpectrum(this.dataArray);
      if (classified.weight > 0.05) {
        this.targetVisemeWeights[classified.viseme] = classified.weight;
        this.targetVisemeWeights["jawOpen"] = this.getJawOpeningForViseme(classified.viseme, classified.weight);
      }
    }
    // Mode C: Procedural harmonic fallback
    else if (this.isProcedural) {
      this.proceduralPhase += delta * 14.0;
      const wave = Math.max(0, Math.sin(this.proceduralPhase) * 0.7 + Math.sin(this.proceduralPhase * 2.3) * 0.3);
      this.targetVisemeWeights["viseme_aa"] = wave * 0.45;
      this.targetVisemeWeights["jawOpen"] = wave * 0.30;
    }

    // Coarticulation Smoothing:
    // Attack speed: fast (~50 ms) to snap to consonant/vowel onsets
    // Release speed: smooth (~100 ms) for natural coarticulation decay
    const attackRate = Math.min(1.0, delta * 20.0);  // ~50 ms
    const releaseRate = Math.min(1.0, delta * 10.0); // ~100 ms

    let dominantViseme: OculusViseme = "viseme_sil";
    let dominantWeight = 0;

    for (const v of OCULUS_VISEMES) {
      const cur = this.currentVisemeWeights[v] || 0;
      const target = this.targetVisemeWeights[v] || 0;
      const rate = target > cur ? attackRate : releaseRate;
      const blended = cur + (target - cur) * rate;
      this.currentVisemeWeights[v] = blended;

      if (blended > dominantWeight) {
        dominantWeight = blended;
        dominantViseme = v;
      }

      if (this.mapper) {
        this.mapper.setValue(v, blended);
      }
    }

    // Jaw opening coarticulation with anatomical limit for natural conversational speech
    const curJaw = this.currentVisemeWeights["jawOpen"] || 0;
    const targetJaw = Math.min(0.38, this.targetVisemeWeights["jawOpen"] || 0);
    const jawRate = targetJaw > curJaw ? attackRate : releaseRate;
    const blendedJaw = Math.min(0.38, curJaw + (targetJaw - curJaw) * jawRate);
    this.currentVisemeWeights["jawOpen"] = blendedJaw;

    if (this.mapper) {
      this.mapper.setValue("jawOpen", blendedJaw);
    }

    if (this.events.onViseme && dominantWeight > 0.1) {
      this.events.onViseme(dominantViseme, dominantWeight);
    }

    return blendedJaw;
  }

  private getJawOpeningForViseme(viseme: OculusViseme, weight: number): number {
    switch (viseme) {
      case "viseme_aa":
        return Math.min(0.38, weight * 0.42);
      case "viseme_O":
        return Math.min(0.32, weight * 0.38);
      case "viseme_E":
        return Math.min(0.28, weight * 0.32);
      case "viseme_I":
        return Math.min(0.22, weight * 0.26);
      case "viseme_U":
        return Math.min(0.20, weight * 0.24);
      case "viseme_PP":
        return 0.02; // Tight lips
      case "viseme_FF":
        return 0.06;
      case "viseme_TH":
      case "viseme_DD":
      case "viseme_SS":
        return 0.08; // Teeth together
      default:
        return Math.min(0.22, weight * 0.26);
    }
  }

  public getVisemeWeight(viseme: OculusViseme): number {
    return this.currentVisemeWeights[viseme] || 0;
  }

  public getSpeechEnergy(): number {
    return this.currentVisemeWeights["jawOpen"] || 0;
  }
}

export const lipSyncController = new LipSyncController();
