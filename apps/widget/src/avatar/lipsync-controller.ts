export class LipSyncController {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private isAnalyzing = false;
  private mouthOpen = 0;
  private proceduralInterval: number | null = null;

  public startProcedural(): void {
    this.stop();
    this.isAnalyzing = true;
    let phase = 0;
    this.proceduralInterval = window.setInterval(() => {
      phase += 0.3;
      // Oscillate mouth open naturally between 0.1 and 0.8
      this.mouthOpen = 0.35 + 0.35 * Math.sin(phase) + 0.15 * Math.sin(phase * 2.3);
    }, 50);
  }

  public attachAudioStream(stream: MediaStream): void {
    try {
      this.stop();
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isAnalyzing = true;
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
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isAnalyzing = true;
    } catch {
      // Fallback to procedural if audio node binding restricted by CORS
      this.startProcedural();
    }
  }

  public update(): number {
    if (!this.isAnalyzing) {
      this.mouthOpen = 0;
      return 0;
    }

    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      // Map amplitude to mouth opening value (0 to 1)
      const target = Math.min(1.0, (avg / 128) * 1.5);
      // Smooth attack/release
      this.mouthOpen += (target - this.mouthOpen) * 0.3;
    }

    return this.mouthOpen;
  }

  public stop(): void {
    this.isAnalyzing = false;
    this.mouthOpen = 0;
    if (this.proceduralInterval) {
      window.clearInterval(this.proceduralInterval);
      this.proceduralInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}

export const lipSyncController = new LipSyncController();
