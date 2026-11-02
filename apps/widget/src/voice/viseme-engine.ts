import { OculusViseme, OCULUS_VISEMES } from "../avatar/morph-mapper";

export interface VisemeKeyframe {
  viseme: OculusViseme;
  durationMs: number;
  weight: number;
}

export interface WordVisemeSequence {
  word: string;
  charIndex: number;
  totalDurationMs: number;
  keyframes: VisemeKeyframe[];
}

/**
 * Phoneme / Grapheme to Oculus 15 Viseme mapping table.
 */
const GRAPHEME_RULES: [RegExp, OculusViseme, number][] = [
  // Silence / punctuation
  [/^[.,!?;:\s]+/, "viseme_sil", 80],

  // Common digraphs & trigraphs
  [/^(th)/i, "viseme_TH", 70],
  [/^(sh|ch|tch|j|dg)/i, "viseme_CH", 80],
  [/^(ph|ff|f|v)/i, "viseme_FF", 80],
  [/^(wh|w)/i, "viseme_U", 80],
  [/^(qu)/i, "viseme_kk", 70],
  [/^(ck|k|c|g|q)/i, "viseme_kk", 65],
  [/^(ng|nk)/i, "viseme_nn", 70],
  [/^(oo|ou|ew|ue)/i, "viseme_U", 110],
  [/^(ee|ea|ey|ie)/i, "viseme_E", 110],
  [/^(ai|ay|ei|ey)/i, "viseme_E", 100],
  [/^(oa|ow|oe)/i, "viseme_O", 110],
  [/^(aw|au|al)/i, "viseme_O", 100],
  [/^(er|ir|ur|or|ar)/i, "viseme_RR", 95],

  // Consonants
  [/^[pbm]/i, "viseme_PP", 70],
  [/^[td]/i, "viseme_DD", 60],
  [/^[szc]/i, "viseme_SS", 75],
  [/^[nl]/i, "viseme_nn", 70],
  [/^[r]/i, "viseme_RR", 75],
  [/^[h]/i, "viseme_aa", 50],

  // Vowels
  [/^[a]/i, "viseme_aa", 95],
  [/^[e]/i, "viseme_E", 90],
  [/^[i]/i, "viseme_I", 85],
  [/^[o]/i, "viseme_O", 100],
  [/^[u]/i, "viseme_U", 95],
  [/^[y]/i, "viseme_I", 85],
];

export class VisemeEngine {
  /**
   * Translates an input text string into a timed sequence of visemes synchronized
   * by estimated duration and word boundary indices.
   */
  public generateVisemeTimeline(text: string, wordsPerMinute = 160): WordVisemeSequence[] {
    const sequences: WordVisemeSequence[] = [];
    // Split by words while tracking character offset
    const regex = /\S+/g;
    let match: RegExpExecArray | null;

    // Average ms per character scaled by speech rate
    const msPerChar = (60000 / (wordsPerMinute * 5));

    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      const charIndex = match.index;
      const keyframes = this.parseWordToVisemes(word);

      let wordDuration = 0;
      for (const kf of keyframes) {
        wordDuration += kf.durationMs;
      }

      // Normalize keyframes duration to match overall word length
      const targetDuration = Math.max(120, word.length * msPerChar);
      const scale = targetDuration / Math.max(1, wordDuration);
      for (const kf of keyframes) {
        kf.durationMs = Math.round(kf.durationMs * scale);
      }

      sequences.push({
        word,
        charIndex,
        totalDurationMs: targetDuration,
        keyframes,
      });
    }

    return sequences;
  }

  private parseWordToVisemes(word: string): VisemeKeyframe[] {
    const keyframes: VisemeKeyframe[] = [];
    let remaining = word.toLowerCase();

    while (remaining.length > 0) {
      let matched = false;
      for (const [pattern, viseme, baseDuration] of GRAPHEME_RULES) {
        const m = remaining.match(pattern);
        if (m) {
          const matchLen = m[0].length;
          keyframes.push({
            viseme,
            durationMs: baseDuration,
            weight: this.getVisemePeakWeight(viseme),
          });
          remaining = remaining.slice(matchLen);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Fallback for unclassified single character
        keyframes.push({
          viseme: "viseme_aa",
          durationMs: 70,
          weight: 0.6,
        });
        remaining = remaining.slice(1);
      }
    }

    // Coarticulation: insert brief silence/release between separate words
    keyframes.push({
      viseme: "viseme_sil",
      durationMs: 40,
      weight: 0,
    });

    return keyframes;
  }

  private getVisemePeakWeight(viseme: OculusViseme): number {
    switch (viseme) {
      case "viseme_sil":
        return 0;
      case "viseme_aa":
      case "viseme_O":
      case "viseme_E":
        return 0.95; // Full open vowels
      case "viseme_U":
      case "viseme_I":
        return 0.8;
      case "viseme_PP":
      case "viseme_FF":
        return 0.85; // Distinct lip seals
      case "viseme_TH":
      case "viseme_DD":
      case "viseme_SS":
      case "viseme_CH":
        return 0.7; // Consonants with subtle mouth aperture
      default:
        return 0.65;
    }
  }

  /**
   * Maps real-time audio FFT spectral bin frequencies to dominant Oculus Viseme.
   * Useful when playing audio streams / Web Audio buffers.
   */
  public classifyAudioSpectrum(
    frequencyData: ArrayLike<number>,
    sampleRate = 44100
  ): { viseme: OculusViseme; weight: number } {
    const binCount = frequencyData.length;
    const hzPerBin = (sampleRate / 2) / binCount;

    let lowEnergy = 0;   // 150 - 500 Hz (jaw / fundamental)
    let f1Energy = 0;    // 500 - 1100 Hz (open vowels 'aa', 'O')
    let f2Energy = 0;    // 1100 - 2400 Hz (front vowels 'E', 'I')
    let highEnergy = 0;  // 2400 - 6500 Hz (fricatives 'SS', 'FF', 'CH')

    for (let i = 0; i < binCount; i++) {
      const hz = i * hzPerBin;
      const amp = frequencyData[i];

      if (hz >= 150 && hz < 500) {
        lowEnergy += amp;
      } else if (hz >= 500 && hz < 1100) {
        f1Energy += amp;
      } else if (hz >= 1100 && hz < 2400) {
        f2Energy += amp;
      } else if (hz >= 2400 && hz < 6500) {
        highEnergy += amp;
      }
    }

    const total = lowEnergy + f1Energy + f2Energy + highEnergy;
    if (total < 800) {
      return { viseme: "viseme_sil", weight: 0 };
    }

    const normLow = lowEnergy / Math.max(1, total);
    const normF1 = f1Energy / Math.max(1, total);
    const normF2 = f2Energy / Math.max(1, total);
    const normHigh = highEnergy / Math.max(1, total);

    const overallVolume = Math.min(1.0, total / (binCount * 70));

    if (normHigh > 0.38) {
      return { viseme: "viseme_SS", weight: overallVolume * 0.8 };
    }
    if (normF1 > 0.4) {
      return { viseme: "viseme_aa", weight: overallVolume * 0.95 };
    }
    if (normF2 > 0.38) {
      return { viseme: "viseme_E", weight: overallVolume * 0.9 };
    }
    if (normLow > 0.42) {
      return { viseme: "viseme_O", weight: overallVolume * 0.85 };
    }

    return { viseme: "viseme_aa", weight: overallVolume * 0.7 };
  }
}

export const visemeEngine = new VisemeEngine();
