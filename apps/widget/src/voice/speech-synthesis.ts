import { AvatarEmotion } from "../avatar/morph-mapper";

export interface SpeakOptions {
  locale?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  emotion?: AvatarEmotion;
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, word?: string) => void;
}

export class BrowserSpeechSynthesizer {
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
    if ("speechSynthesis" in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  /**
   * Extracts emotion tag if present (e.g. "[emotion:friendly] Hello!")
   * Returns sanitized text and detected emotion.
   */
  public parseEmotionAndSanitizeText(text: string): { cleanText: string; emotion?: AvatarEmotion } {
    let cleanText = text;
    let emotion: AvatarEmotion | undefined;

    const match = text.match(/\[emotion:([a-zA-Z]+)\]/i);
    if (match) {
      const parsed = match[1].toLowerCase() as AvatarEmotion;
      if (["neutral", "friendly", "curious", "thinking", "empathetic", "excited"].includes(parsed)) {
        emotion = parsed;
      }
      cleanText = text.replace(/\s*\[emotion:[a-zA-Z]+\]\s*/gi, " ").trim();
    }

    return { cleanText, emotion };
  }

  public speak(
    text: string,
    locale: string = "en-US",
    onStart?: () => void,
    onEnd?: () => void,
    onBoundary?: (charIndex: number, word?: string) => void,
    rate = 1.0,
    voiceNameHint?: string
  ): { cleanText: string; emotion?: AvatarEmotion } {
    const { cleanText, emotion } = this.parseEmotionAndSanitizeText(text);

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return { cleanText, emotion };
    }

    this.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale;
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Pick best matching voice
    if (this.voices.length === 0) {
      this.loadVoices();
    }

    let matchedVoice: SpeechSynthesisVoice | undefined;
    if (voiceNameHint) {
      matchedVoice = this.voices.find((v) => v.name.toLowerCase().includes(voiceNameHint.toLowerCase()));
    }

    if (!matchedVoice) {
      matchedVoice =
        this.voices.find(
          (v) =>
            v.lang === locale &&
            (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Neural"))
        ) ||
        this.voices.find((v) => v.lang.startsWith(locale.slice(0, 2))) ||
        this.voices[0];
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    // Word boundary synchronization
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name === "word" && onBoundary) {
        onBoundary(e.charIndex);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);

    return { cleanText, emotion };
  }

  public speakAsync(text: string, options: SpeakOptions = {}): Promise<void> {
    return new Promise<void>((resolve) => {
      this.speak(
        text,
        options.locale || "en-US",
        options.onStart,
        () => {
          if (options.onEnd) options.onEnd();
          resolve();
        },
        options.onBoundary,
        options.rate || 1.0,
        options.voice
      );
    });
  }

  public cancel(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking;
  }
}

export const speechSynthesizer = new BrowserSpeechSynthesizer();
