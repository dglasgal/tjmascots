/**
 * Sound-effects helper for McQuackers' Quest.
 *
 * Generated via ElevenLabs sound-generation API; saved at
 * /public/quack/sfx/*.mp3. All effects total ~210 KB.
 *
 * Browser policies: audio playback requires a user gesture (tap/click) before
 * it can autoplay. Every sound here fires from a click handler, so we're
 * fine — except the /terms burst, which is triggered by scroll. Scroll IS
 * a user gesture on desktop and most mobile browsers, but iOS Safari is
 * strict; on iOS the burst sound may fall back silent. The visual still
 * plays.
 *
 * Mute preference persists in localStorage so a returning player keeps
 * their choice.
 */

export type SfxName =
  | 'burst'
  | 'mcq-speech'
  | 'game-start'
  | 'found-it'
  | 'wrong'
  | 'hint'
  | 'level-complete'
  | 'game-won'
  | 'ui-click';

const SFX_FILES: Record<SfxName, string> = {
  'burst': '/quack/sfx/burst.mp3',
  'mcq-speech': '/quack/sfx/mcq-speech.mp3',
  'game-start': '/quack/sfx/game-start.mp3',
  'found-it': '/quack/sfx/found-it.mp3',
  'wrong': '/quack/sfx/wrong.mp3',
  'hint': '/quack/sfx/hint.mp3',
  'level-complete': '/quack/sfx/level-complete.mp3',
  'game-won': '/quack/sfx/game-won.mp3',
  'ui-click': '/quack/sfx/ui-click.mp3',
};

const MUTE_STORAGE_KEY = 'mcq.muted';

/** In-memory cache so each effect only loads once per page. */
const audioCache: Partial<Record<SfxName, HTMLAudioElement>> = {};

function getAudio(name: SfxName): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioCache[name]) {
    const a = new Audio(SFX_FILES[name]);
    a.preload = 'auto';
    audioCache[name] = a;
  }
  return audioCache[name] ?? null;
}

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
}

export function setMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  if (muted) window.localStorage.setItem(MUTE_STORAGE_KEY, '1');
  else window.localStorage.removeItem(MUTE_STORAGE_KEY);
}

/**
 * Play a sound effect. Safe to call repeatedly — restarts the clip from 0
 * if it's already playing (so rapid taps don't get swallowed). No-ops if
 * the user has muted, or if the audio fails to play (e.g. autoplay block).
 */
export function playSfx(name: SfxName, volume = 0.6) {
  if (typeof window === 'undefined') return;
  if (isMuted()) return;
  const a = getAudio(name);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.volume = volume;
    // play() returns a promise that rejects on autoplay block; swallow it.
    void a.play().catch(() => {});
  } catch {
    // Ignore — best-effort playback.
  }
}

/** Preload all SFX files. Call once on a user interaction so they're ready
 *  to fire instantly later (avoids the first-play network blip). */
export function preloadAllSfx() {
  if (typeof window === 'undefined') return;
  (Object.keys(SFX_FILES) as SfxName[]).forEach((name) => {
    getAudio(name);
  });
}
