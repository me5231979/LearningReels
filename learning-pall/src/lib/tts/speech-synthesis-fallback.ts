/**
 * Browser SpeechSynthesis fallback for when WebGPU/Kokoro is unavailable.
 * Same interface as the Kokoro engine for seamless swapping.
 */

export class SpeechSynthesisTTS {
  private utterance: SpeechSynthesisUtterance | null = null;
  private resolveSpeak: (() => void) | null = null;

  isAvailable(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  async speak(text: string): Promise<void> {
    if (!this.isAvailable()) return;

    this.stop();

    return new Promise<void>((resolve) => {
      this.resolveSpeak = resolve;
      this.utterance = new SpeechSynthesisUtterance(text);
      this.utterance.rate = 0.95;
      this.utterance.pitch = 1.0;
      this.utterance.volume = 1.0;

      // Try to use a natural-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Samantha") ||
          v.name.includes("Google") ||
          v.name.includes("Natural") ||
          v.lang.startsWith("en")
      );
      if (preferred) this.utterance.voice = preferred;

      this.utterance.onend = () => {
        this.resolveSpeak = null;
        resolve();
      };
      this.utterance.onerror = () => {
        this.resolveSpeak = null;
        resolve();
      };

      window.speechSynthesis.speak(this.utterance);
    });
  }

  pause(): void {
    if (typeof window !== "undefined") {
      window.speechSynthesis.pause();
    }
  }

  resume(): void {
    if (typeof window !== "undefined") {
      window.speechSynthesis.resume();
    }
  }

  stop(): void {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    if (this.resolveSpeak) {
      this.resolveSpeak();
      this.resolveSpeak = null;
    }
  }

  get speaking(): boolean {
    return typeof window !== "undefined" && window.speechSynthesis.speaking;
  }
}
