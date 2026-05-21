/**
 * Audio helper for McQuackers' Catch.
 *
 * Background music is a real audio file (HTMLAudioElement, looping). SFX —
 * catch / miss / cart-hit — are synthesized procedurally with the Web Audio
 * API so we don't have to ship sound files for them.
 *
 * Browser policy: AudioContext can only resume after a user gesture. We
 * lazily create + resume the context the first time any sound is requested.
 * In practice that happens when the user clicks the START button, which is
 * a valid gesture.
 *
 * Mute state persists across plays via localStorage under the key
 * MUTE_STORAGE_KEY.
 */

export const MUTE_STORAGE_KEY = 'mcq-catch-mute';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgAudio: HTMLAudioElement | null = null;

const BG_VOLUME = 0.35; // music sits below SFX so catches still pop
const SFX_VOLUME = 0.7;

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
}

export function setMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  applyMute();
}

function applyMute() {
  const muted = isMuted();
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  if (bgAudio) bgAudio.muted = muted;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = isMuted() ? 0 : 1;
  masterGain.connect(ctx.destination);
  return ctx;
}

/**
 * Resume the AudioContext. Must be called from a user-gesture handler (the
 * START button, mute toggle, etc.) or the browser will keep audio
 * suspended.
 */
export async function unlockAudio(): Promise<void> {
  const c = ensureContext();
  if (c && c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      // Swallow — autoplay restrictions, headphone disconnect, etc. The
      // game still plays without audio.
    }
  }
}

/**
 * Start the looping background music. Safe to call repeatedly — if the same
 * src is already playing, this just resumes it. If `src` is missing or
 * fails to load, the game continues silently (no thrown error).
 */
export function startBackgroundMusic(src: string) {
  if (typeof window === 'undefined') return;
  if (bgAudio && bgAudio.src.endsWith(src)) {
    bgAudio.play().catch(() => {});
    return;
  }
  if (bgAudio) {
    bgAudio.pause();
  }
  bgAudio = new Audio(src);
  bgAudio.loop = true;
  bgAudio.volume = BG_VOLUME;
  bgAudio.muted = isMuted();
  bgAudio.play().catch(() => {
    // Most common cause: file missing (we haven't dropped one in yet) or
    // autoplay blocked. Silent failure is fine — the game still works.
  });
}

export function stopBackgroundMusic() {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
  }
}

// ---- SFX (procedural) -------------------------------------------------------

/**
 * Bright ascending arpeggio (C-E-G) — positive "caught it!" feedback.
 * Triangle waves keep it warm/cartoony rather than harsh.
 */
export function playCatch() {
  const c = ensureContext();
  if (!c || !masterGain) return;
  const notes = [523.25, 659.25, 783.99]; // C5 → E5 → G5
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const start = c.currentTime + i * 0.06;
    osc.connect(gain);
    gain.connect(masterGain!);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(SFX_VOLUME * 0.5, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

/**
 * Whoosh — short noise burst with a descending bandpass. Reads as "swung
 * and missed" without being annoying on repeat.
 */
export function playMiss() {
  const c = ensureContext();
  if (!c || !masterGain) return;
  const len = Math.floor(c.sampleRate * 0.2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // White noise that decays to zero over the buffer length.
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2200, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.18);
  filter.Q.value = 4;
  const gain = c.createGain();
  gain.gain.value = SFX_VOLUME * 0.35;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  src.stop(c.currentTime + 0.2);
}

/**
 * Triumphant little fanfare for the intro splash. G-C-E-G with the last
 * note held — reads as "here's your assignment, get in there." Slightly
 * longer than playCatch so it lands as a screen-arrival cue rather than
 * an in-game blip.
 */
export function playSplashJingle() {
  const c = ensureContext();
  if (!c || !masterGain) return;
  const seq = [
    { freq: 392.0, time: 0.0, dur: 0.12 },   // G4
    { freq: 523.25, time: 0.1, dur: 0.12 }, // C5
    { freq: 659.25, time: 0.2, dur: 0.12 }, // E5
    { freq: 783.99, time: 0.3, dur: 0.5 },  // G5 (held)
  ];
  seq.forEach(({ freq, time, dur }) => {
    const t = c.currentTime + time;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(SFX_VOLUME * 0.45, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(masterGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

/**
 * Low bonk — McQuackers bumped into a kneeling restocker. Square wave
 * pitched down with a lowpass for that "ow" cartoon thud.
 */
export function playHit() {
  const c = ensureContext();
  if (!c || !masterGain) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.18);
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(SFX_VOLUME * 0.7, c.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.24);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(c.currentTime + 0.26);
}
