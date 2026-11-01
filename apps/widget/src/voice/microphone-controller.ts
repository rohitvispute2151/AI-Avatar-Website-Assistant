export class MicrophoneController {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private timeoutTimer: number | null = null;

  public async startRecording(maxDurationSeconds: number = 30): Promise<void> {
    if (this.isRecording) {
      this.stopRecording();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone capture is not supported by your browser.");
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedChunks = [];

    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : undefined;

    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(250);
    this.isRecording = true;

    // Cap duration
    this.timeoutTimer = window.setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, maxDurationSeconds * 1000);
  }

  public async stopRecording(): Promise<Blob | null> {
    if (this.timeoutTimer) {
      window.clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (!this.isRecording || !this.mediaRecorder) {
      this.cleanup();
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.cleanup();
        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  public cancel(): void {
    if (this.timeoutTimer) {
      window.clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  public getRecordingState(): boolean {
    return this.isRecording;
  }
}

export const microphoneController = new MicrophoneController();

