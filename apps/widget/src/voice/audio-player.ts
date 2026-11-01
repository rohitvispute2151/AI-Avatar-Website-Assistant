import { lipSyncController } from "../avatar/lipsync-controller";
import { speechSynthesizer } from "./speech-synthesis";

export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private isPlayingAudio = false;
  private currentObjectUrl: string | null = null;

  public async playAudioBytes(
    audioBytes: ArrayBuffer,
    mimeType: string = "audio/mpeg",
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): Promise<void> {
    this.stop();

    try {
      const blob = new Blob([audioBytes], { type: mimeType });
      this.currentObjectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.currentObjectUrl);
      this.audioElement = audio;

      audio.onplay = () => {
        this.isPlayingAudio = true;
        lipSyncController.attachMediaElement(audio);
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.cleanup();
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        this.cleanup();
        if (onError) onError(e);
      };

      await audio.play();
    } catch (e) {
      this.cleanup();
      if (onError) onError(e);
    }
  }

  public speakText(
    text: string,
    locale: string = "en-US",
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    this.stop();
    this.isPlayingAudio = true;

    // Start procedural lip sync for speech synthesis
    lipSyncController.startProcedural();

    speechSynthesizer.speak(
      text,
      locale,
      () => {
        if (onStart) onStart();
      },
      () => {
        this.cleanup();
        if (onEnd) onEnd();
      }
    );
  }

  public stop(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // ignore
      }
      this.audioElement = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    speechSynthesizer.cancel();
    lipSyncController.stop();
    this.isPlayingAudio = false;
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio || speechSynthesizer.getSpeakingState();
  }

  private cleanup(): void {
    this.isPlayingAudio = false;
    lipSyncController.stop();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.audioElement = null;
  }
}

export const audioPlayer = new AudioPlayer();

