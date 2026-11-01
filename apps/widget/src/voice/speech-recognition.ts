export class BrowserSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(
    locale: string = "en-US",
    onResult: (transcript: string) => void,
    onError: (err: any) => void,
    onEnd: () => void
  ): void {
    if (!this.recognition) {
      onError(new Error("SpeechRecognition not supported in this browser."));
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    this.recognition.lang = locale;

    this.recognition.onresult = (event: any) => {
      const result = event.results[0]?.[0]?.transcript || "";
      this.isListening = false;
      onResult(result);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      onError(event.error || "Speech recognition error");
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      onError(e);
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
    }
  }

  public getListeningState(): boolean {
    return this.isListening;
  }
}

export const speechRecognizer = new BrowserSpeechRecognizer();

