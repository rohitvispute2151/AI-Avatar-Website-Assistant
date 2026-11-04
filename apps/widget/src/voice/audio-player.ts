import { lipSyncController } from "../avatar/lipsync-controller";
import { speechSynthesizer, SpeakOptions } from "./speech-synthesis";
import { AvatarEmotion } from "../avatar/morph-mapper";

export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private isPlayingAudio = false;
  private currentObjectUrl: string | null = null;
  private onEmotionDetected?: (emotion: AvatarEmotion) => void;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.isPlaying()) {
      this.stop();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setEmotionCallback(cb: (emotion: AvatarEmotion) => void): void {
    this.onEmotionDetected = cb;
  }

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
    onEnd?: () => void,
    rate = 1.0,
    voice?: string
  ): { cleanText: string; emotion?: AvatarEmotion } {
    this.stop();
    this.isPlayingAudio = true;

    // Parse inline emotion tags and start viseme timeline
    const { cleanText, emotion } = speechSynthesizer.parseEmotionAndSanitizeText(text);
    if (emotion && this.onEmotionDetected) {
      this.onEmotionDetected(emotion);
    }

    if (this.muted) {
      if (onStart) onStart();
      const words = cleanText.split(/\s+/).length;
      const durationMs = Math.max(1200, Math.min(6000, (words / 3.2) * 1000));
      setTimeout(() => {
        this.cleanup();
        if (onEnd) onEnd();
      }, durationMs);
      return { cleanText, emotion };
    }

    // Initialize accurate viseme sequence from text
    lipSyncController.startSpeechTimeline(cleanText, 160 * rate);

    speechSynthesizer.speak(
      cleanText,
      locale,
      () => {
        if (onStart) onStart();
      },
      () => {
        this.cleanup();
        if (onEnd) onEnd();
      },
      (charIndex) => {
        lipSyncController.syncWordBoundary(charIndex);
      },
      rate,
      voice
    );

    return { cleanText, emotion };
  }

  public async speakAsync(text: string, options: SpeakOptions = {}): Promise<void> {
    return new Promise<void>((resolve) => {
      this.speakText(
        text,
        options.locale || "en-US",
        options.onStart,
        () => {
          if (options.onEnd) options.onEnd();
          resolve();
        },
        options.rate || 1.0,
        options.voice
      );
    });
  }

  public stop(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
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
