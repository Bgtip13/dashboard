/**
 * F.R.I.D.A.Y — lapisan suara (Web Speech API).
 *
 * Semua akses ke `window` dijaga supaya aman saat SSR. Pemanggil hanya boleh
 * memicu fungsi ini dari event handler di browser, bukan saat render server.
 */

export const VOICE_LANG = "id-ID";

/* ------------------------------- pengenalan suara ------------------------------- */

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
}

interface RecognitionResults {
  length: number;
  [index: number]: RecognitionResult;
}

export interface RecognitionEvent {
  resultIndex: number;
  results: RecognitionResults;
}

export interface RecognitionErrorEvent {
  error: string;
  message?: string;
}

/** Irisan minimal dari SpeechRecognition (belum ada di lib DOM TypeScript). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function micSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Pesan ramah untuk kode error SpeechRecognition. */
export function recognitionErrorText(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Izin mikrofon ditolak. Aktifkan mikrofon di pengaturan browser, Bos.";
    case "no-speech":
      return "Belum ada suara terdeteksi. Coba tekan mikrofon lalu bicara lagi.";
    case "audio-capture":
      return "Mikrofon tidak ditemukan. Pastikan perangkatnya terpasang.";
    case "network":
      return "Pengenalan suara butuh koneksi internet.";
    case "aborted":
      return "";
    default:
      return "Input suara sedang tidak tersedia. Coba lagi sebentar.";
  }
}

/* ----------------------------------- suara balik ----------------------------------- */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface PickedVoice {
  voice: SpeechSynthesisVoice | null;
  lang: string;
  label: string;
}

/** Nama suara wanita (FRIDAY). "female" dicek lebih dulu karena memuat kata "male". */
const FEMALE_HINTS = [
  "female", "wanita", "perempuan", "gadis", "putri", "dewi", "ayu", "damayanti",
  "siti", "nova", "indah", "sari", "maya", "citra", "rina", "google bahasa indonesia",
];
const MALE_HINTS = [
  "male", "pria", "laki", "ardi", "andika", "budi", "joko", "dimas", "reza",
  "agus", "bambang", "eko", "hadi", "tono",
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lang = (v.lang || "").toLowerCase();
  const name = (v.name || "").toLowerCase();

  // Hanya suara Indonesia/Melayu — suara Inggris membaca bahasa Indonesia dengan aneh.
  let score = 0;
  if (lang.startsWith("id")) score += 100;
  else if (lang.startsWith("ms")) score += 30;
  else return 0;

  const female = FEMALE_HINTS.some((hint) => name.includes(hint));
  const male = !female && MALE_HINTS.some((hint) => name.includes(hint));
  if (female) score += 40;
  if (male) score -= 45;
  if (/natural|neural|premium|enhanced/.test(name)) score += 10;
  if (v.localService) score += 4;
  return score;
}

/** Suara wanita Indonesia terbaik yang tersedia di perangkat. */
export function pickVoice(voices: SpeechSynthesisVoice[]): PickedVoice {
  const best = voices
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return { voice: null, lang: VOICE_LANG, label: "suara bawaan browser" };
  return { voice: best.voice, lang: best.voice.lang || VOICE_LANG, label: best.voice.name };
}

/** Suara terbaik yang tersedia saat ini. */
export function currentVoice(): PickedVoice {
  if (!ttsSupported()) return { voice: null, lang: VOICE_LANG, label: "suara bawaan browser" };
  return pickVoice(window.speechSynthesis.getVoices());
}

/** Chrome memuat daftar suara secara asinkron — ikuti perubahan berikutnya. */
export function watchVoices(onChange: (picked: PickedVoice) => void): () => void {
  if (!ttsSupported()) return () => {};
  const synth = window.speechSynthesis;
  const run = () => onChange(pickVoice(synth.getVoices()));

  synth.addEventListener("voiceschanged", run);
  return () => synth.removeEventListener("voiceschanged", run);
}

/** Bersihkan teks supaya enak diucapkan (tanpa markdown, emoji, atau bullet). */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\bF\.?\s?R\.?\s?I\.?\s?D\.?\s?A\.?\s?Y\.?\b/gi, "Friday")
    .replace(/[•·▪◦▶►→←↑↓]/g, ", ")
    .replace(/[*_`#>|]/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s*[\r\n]+\s*/g, ". ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([,.!?])(?:\s*[,.!?])+/g, "$1")
    .trim();
}

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
}

/* --------------------------------- efek audio --------------------------------- */

let audioCtx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** Satu nada pendek dengan amplop halus supaya tidak berisik. */
function blip(ctx: AudioContext, freq: number, delay: number, duration: number, volume = 0.035): void {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** Nada naik-turun singkat saat F.R.I.D.A.Y memproses perintah. */
export function playThinking(): void {
  const ctx = audioContext();
  if (!ctx) return;
  blip(ctx, 660, 0, 0.12);
  blip(ctx, 880, 0.09, 0.16);
}

/** Nada konfirmasi halus saat jawaban siap. */
export function playReady(): void {
  const ctx = audioContext();
  if (!ctx) return;
  blip(ctx, 1040, 0, 0.1);
  blip(ctx, 1560, 0.07, 0.16, 0.026);
}

/** Nada rendah saat perintah gagal diproses. */
export function playError(): void {
  const ctx = audioContext();
  if (!ctx) return;
  blip(ctx, 320, 0, 0.2, 0.042);
}

let endTimer: ReturnType<typeof setTimeout> | null = null;

/** Hentikan ucapan yang sedang berjalan. */
export function cancelSpeech(): void {
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* browser lama bisa melempar; abaikan */
  }
}

/**
 * Ucapkan teks dengan suara wanita Indonesia.
 * Mengembalikan false kalau browser tidak mendukung / teks kosong.
 */
export function speak(text: string, handlers: SpeakHandlers = {}): boolean {
  if (!ttsSupported()) return false;

  const clean = cleanForSpeech(text);
  if (!clean) return false;

  const synth = window.speechSynthesis;
  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(clean);
  const picked = pickVoice(synth.getVoices());
  if (picked.voice) utterance.voice = picked.voice;
  utterance.lang = picked.lang;
  // Sedikit lebih tinggi & cepat → karakter FRIDAY yang lincah.
  utterance.pitch = 1.18;
  utterance.rate = 1.02;
  utterance.volume = 1;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (endTimer) {
      clearTimeout(endTimer);
      endTimer = null;
    }
    handlers.onEnd?.();
  };

  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = finish;
  utterance.onerror = finish;

  // Chrome kadang tidak memicu onend; timer ini menjaga status UI tidak macet.
  const perkiraanMs = Math.min(60_000, 2_500 + clean.length * 90);
  endTimer = setTimeout(finish, perkiraanMs);

  try {
    synth.speak(utterance);
  } catch {
    finish();
    return false;
  }
  return true;
}
