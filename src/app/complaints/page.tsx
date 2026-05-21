'use client';

/**
 * /complaints — the easter-egg entry for McQuackers' Mascot Catch.
 *
 * Replacement for the original 5x-© trigger (which was undiscoverable).
 *
 * UX:
 *   • Visitor lands on a deliberately straight-faced "Complaints Department"
 *     page with satirical fan-flavor text and an illustration of McQuackers
 *     manning the desk, visibly perturbed.
 *   • A small "GAME STARTS IN: 0:10" timer ticks down in the corner.
 *   • After 10 seconds the page transitions into the Mascot Catch game.
 *   • End-screen of the game has a "Back to Complaints Desk" link.
 *
 * Linked from the map attribution overlay (next to "© Mapbox © OpenStreetMap"
 * — see MapView.tsx). No other navigation surfaces.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Heavy game component — load only when we transition into the game.
const CatchGame = dynamic(() => import('@/components/CatchGame'), {
  ssr: false,
  loading: () => null,
});

const AUTO_START_SECONDS = 10;

type Phase = 'reading' | 'stamping' | 'game';

export default function ComplaintsPage() {
  const [phase, setPhase] = useState<Phase>('reading');
  const [secondsLeft, setSecondsLeft] = useState(AUTO_START_SECONDS);

  // Pre-warmed AudioContext. Browsers block AudioContext.resume() until
  // there's been a user gesture on the page, so we create one and resume it
  // on the first interaction. Without this, the 10-second auto-countdown
  // would fire the stamp THWACK while the context is still suspended and
  // nothing plays.
  //
  // Listening on the document (capture phase) catches gestures that happen
  // anywhere — including inside the scrollable <main>. A previous version
  // listened on window/scroll, which doesn't catch scroll events inside a
  // child element that has its own overflow.
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const arm = () => {
      try {
        const ctx = new AC();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        // No audio support — game still plays silently.
      }
    };
    const opts: AddEventListenerOptions = { capture: true, once: true };
    document.addEventListener('pointerdown', arm, opts);
    document.addEventListener('keydown', arm, opts);
    document.addEventListener('touchstart', arm, opts);
    return () => {
      document.removeEventListener('pointerdown', arm, opts);
      document.removeEventListener('keydown', arm, opts);
      document.removeEventListener('touchstart', arm, opts);
    };
  }, []);

  // Countdown — transitions into 'stamping' (the DENIED transition) not
  // directly into the game.
  useEffect(() => {
    if (phase !== 'reading') return;
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          setPhase('stamping');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Stamping phase: ~1.6s of animation + sound, then drop into the game.
  useEffect(() => {
    if (phase !== 'stamping') return;
    playStampAndJingle(audioCtxRef.current);
    const t = window.setTimeout(() => setPhase('game'), 1600);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'game') {
    return <CatchGame />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Plain header — matches /terms and /privacy */}
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)] transition hover:scale-105"
          >
            <span aria-hidden>📋</span>
          </Link>
          <Link href="/" className="block">
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">
              TJ Mascots
            </h1>
            <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
              Complaints Department · Window 3
            </p>
          </Link>
        </div>
        <Link
          href="/"
          aria-label="Back to the map"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">← Back to the map</span>
          <span className="hidden max-sm:inline">← Map</span>
        </Link>
      </header>

      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company.
      </div>

      <main className="relative flex-1 overflow-y-auto bg-[var(--cream)]">
        <article className="mx-auto max-w-3xl px-6 py-10 text-[var(--ink)] max-sm:px-4 sm:py-14">
          <header className="mb-8 text-center">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
              Form 27-B · Rev. 14
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">
              Complaints Department
            </h1>
            <p className="mt-2 text-base font-semibold text-[var(--ink-soft)]">
              The mascots are listening. Carefully. Through one eye.
            </p>
          </header>

          {/* The illustration — full-bleed-ish, centered */}
          <figure className="mx-auto mb-10 max-w-md text-center">
            <img
              src="/games/catch/complaints/mcquackers-desk.png"
              alt="McQuackers, perturbed, behind the Complaints Department desk."
              className="mx-auto w-full rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            />
            <figcaption className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
              McQuackers, Window Clerk · Est. 1967
            </figcaption>
          </figure>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">
              1. About this Department
            </h2>
            <p>
              The Complaints Department was established in 1967, the same year
              the first Trader Joe&apos;s opened on Arroyo Parkway. A flock of
              ducks frequented the area and one day came into the store for
              some free samples. One of the ducks promptly emptied his duck
              excrement juice on the floor and a clerk grabbed a bunch of
              papers from the complaint box to clean up the mess. The clerk
              was so impressed by the absorbency of the complaint forms he
              offered the ducks jobs at the complaints department receiving,
              filing and responding to the complaints in their natural manner.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">
              2. Accepted Forms of Grievance
            </h2>
            <p>
              We accept the following categories of complaint, in descending
              order of frequency:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>The mascot at your store has been moved again.</li>
              <li>
                The mascot at your store has <em>not</em> been moved, and you
                have an opinion about that.
              </li>
              <li>You believe your store deserves a different mascot.</li>
              <li>
                You believe your store deserves the same mascot, but in a
                different hat.
              </li>
              <li>The cookie butter situation.</li>
              <li>
                Something unrelated to mascots which you would like to vent
                about while you happen to be here.
              </li>
            </ul>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">
              3. Filing Procedure
            </h2>
            <p>
              All complaints must be submitted in triplicate, on Form 27-B
              (Rev. 14), notarized by a stuffed animal of your choice, and
              accompanied by a brief explanation of why you believe a
              volunteer-run fan website should be in a position to do anything
              about your concern.
            </p>
            <p>
              Forms may be filed at any time during the Department&apos;s
              published business hours, which are subject to change without
              notice and which, in any case, McQuackers does not observe.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">
              4. Disposition of Complaints
            </h2>
            <p>
              Complaints are reviewed in the order in which they would have
              been received, had we received them. Most resolve themselves
              within two to four business decades. A small number are
              forwarded to the Office of Things Beyond Our Control, which is
              also McQuackers, also at this desk.
            </p>
            <p>
              In the rare event that you believe your complaint warrants
              expedited handling, you may, at any point during the next ten
              seconds, prove your sincerity by helping the Department&apos;s
              sole employee chase down the mascots themselves. He cannot
              process the paperwork until he catches them. They scurry.
            </p>
          </section>

          <section className="mb-12 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">
              5. Compensation for Filing
            </h2>
            <p>
              The Department does not offer monetary compensation for filed
              complaints. We do, however, occasionally offer the deep
              psychological satisfaction of having told a duck about it. In
              advanced cases, lollipops or stickers may be available, subject
              to availability and the duck&apos;s general mood.
            </p>
            <p className="text-sm italic text-[var(--ink-soft)]">
              Thank you for your patience. Your call is important to him.
            </p>
          </section>

          <ComplaintForm />
        </article>
      </main>

      {/* Live countdown ticker — small, but visible enough that visitors get
          a beat to read before the game starts. */}
      {phase === 'reading' && <CountdownPill seconds={secondsLeft} />}

      {/* The DENIED stamp transition that hides between the satirical page
          and the actual game. Fires sound + jingle on mount. */}
      {phase === 'stamping' && <DeniedStampOverlay />}
    </div>
  );
}

/**
 * Full-screen overlay: dim the page, slam a giant COMPLAINT DENIED stamp
 * into the center, leave it there for ~1.6s, then unmount as the page
 * transitions into the game. Audio is fired by the parent
 * (`playStampAndJingle`) so it timed-syncs with the overlay's CSS animation.
 *
 * Stamp text is stacked ("COMPLAINT" small on top, "DENIED" big underneath)
 * because it looks more like an actual rubber stamp — and the long single
 * line crowded the screen.
 */
function DeniedStampOverlay() {
  return (
    <>
      <style jsx>{`
        @keyframes denied-flash {
          0% { background: rgba(0,0,0,0); }
          30% { background: rgba(0,0,0,0.55); }
          100% { background: rgba(0,0,0,0.7); }
        }
        @keyframes denied-stamp {
          /* huge + tilted + faded, then slams to slightly-bigger-than-final
             and bounces to rest. Visual "impact" is the 45% keyframe;
             playStampAndJingle is timed so the thud lands AT that moment. */
          0%   { transform: translate(-50%, -50%) scale(4) rotate(-22deg); opacity: 0; }
          35%  { transform: translate(-50%, -50%) scale(4) rotate(-22deg); opacity: 0; }
          45%  { transform: translate(-50%, -50%) scale(1.18) rotate(-12deg); opacity: 1; }
          60%  { transform: translate(-50%, -50%) scale(0.92) rotate(-12deg); opacity: 1; }
          75%  { transform: translate(-50%, -50%) scale(1.04) rotate(-12deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(-12deg); opacity: 1; }
        }
        @keyframes denied-shake {
          /* page shake on impact for "weight" — punchier than before */
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-3px, 6px); }
          50% { transform: translate(2px, 8px); }
          80% { transform: translate(-2px, 3px); }
        }
        .denied-root {
          position: absolute;
          inset: 0;
          z-index: 99999;
          pointer-events: none;
          background: rgba(0,0,0,0);
          animation: denied-flash 0.5s ease-out forwards, denied-shake 0.28s ease-out 0.5s 1;
        }
        .denied-stamp {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(4) rotate(-22deg);
          padding: 24px 54px;
          border: 10px solid #b71c1c;
          border-radius: 14px;
          background: rgba(255, 248, 240, 0.04);
          color: #b71c1c;
          font-family: 'Fraunces', serif;
          font-weight: 900;
          text-shadow: 0 4px 0 rgba(0,0,0,0.18);
          line-height: 0.92;
          text-align: center;
          box-shadow:
            inset 0 0 0 4px #b71c1c,
            0 12px 28px rgba(0,0,0,0.45);
          /* The pixelated "stamped on paper" texture: paint speckles via
             a layered radial-gradient pattern. Cheap and effective. */
          background-image:
            radial-gradient(circle at 20% 30%, rgba(183,28,28,0.18) 0 1px, transparent 1px),
            radial-gradient(circle at 70% 60%, rgba(183,28,28,0.14) 0 1px, transparent 1px),
            radial-gradient(circle at 40% 80%, rgba(183,28,28,0.10) 0 1px, transparent 1px),
            radial-gradient(circle at 85% 22%, rgba(183,28,28,0.16) 0 1px, transparent 1px);
          background-size: 7px 7px, 5px 5px, 9px 9px, 4px 4px;
          opacity: 0;
          animation: denied-stamp 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
        }
        .denied-line1 {
          display: block;
          font-size: clamp(28px, 5vw, 56px);
          letter-spacing: 0.18em;
          margin-bottom: 2px;
        }
        .denied-line2 {
          display: block;
          font-size: clamp(72px, 14vw, 160px);
          letter-spacing: 0.06em;
        }
      `}</style>
      <div className="denied-root" aria-hidden>
        <div className="denied-stamp">
          <span className="denied-line1">COMPLAINT</span>
          <span className="denied-line2">DENIED</span>
        </div>
      </div>
    </>
  );
}

/**
 * Synthesize a LOUD wooden-mallet-on-a-stack-of-paper THWACK + a spritely
 * jingle, entirely in the Web Audio API. No external audio files.
 *
 * The thwack is layered from four parts (all fire on the same sample so
 * they read as a single percussive impact, not as separate sounds):
 *   1. CRACK    — high-frequency square burst, the initial wood-on-paper attack
 *   2. BOOM     — low sine drop, the floor-rumble weight of a heavy mallet
 *   3. BODY     — mid triangle drop, the wooden density of the mallet head
 *   4. CRINKLE  — high-pass-filtered white noise burst, the paper stack rustle
 *
 * Timing is locked to the visual: DeniedStampOverlay's CSS animation lands
 * at ~0.5s after mount (45% keyframe of 0.9s + 0.1s delay), and playStampAndJingle
 * is called the moment the overlay mounts, so thudTime = now + 0.5s puts the
 * sound exactly on the visual impact.
 *
 * Master gain is at 1.0 (no attenuation) and individual layer gains push past
 * 1.0 where appropriate so the impact reads as LOUD per spec.
 */
function playStampAndJingle(prewarmedCtx: AudioContext | null) {
  if (typeof window === 'undefined') return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    // Prefer the pre-warmed context (already user-gesture-resumed). Fall
    // back to a fresh one if the user somehow got here without interacting
    // — that fresh ctx may stay suspended and play silently, but at least
    // we don't crash.
    const ctx = prewarmedCtx ?? new AC();
    // Defensive resume in case the pre-warmed ctx was suspended for any
    // reason (page backgrounded, etc.). Safe to call when already running.
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const ownsCtx = !prewarmedCtx; // only close ctx we created ourselves

    // Master bus — single gain node so every layer routes through it.
    // Kept at unity 1.0 (master pushing past 1.0 makes the browser
    // limiter clamp the layered impact and the THWACK starts sounding
    // muffled rather than louder). Individual layers below carry the
    // loudness via their own envelopes.
    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);

    // ============ THWACK (at +0.5s — synced to visual landing) ============
    const thudTime = now + 0.5;

    // 1) CRACK — sharp wood-on-paper attack. Square wave gives the harmonic
    //    bite that reads as "crisp impact." Drops fast.
    {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(1800, thudTime);
      o.frequency.exponentialRampToValueAtTime(400, thudTime + 0.025);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, thudTime);
      g.gain.exponentialRampToValueAtTime(0.9, thudTime + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, thudTime + 0.05);
      o.connect(g).connect(master);
      o.start(thudTime);
      o.stop(thudTime + 0.06);
    }

    // 2) BOOM — sub-bass body. The "weight" of the mallet hitting wood.
    //    Sine wave, big amplitude, exponential pitch drop.
    {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(85, thudTime);
      o.frequency.exponentialRampToValueAtTime(32, thudTime + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, thudTime);
      g.gain.exponentialRampToValueAtTime(1.8, thudTime + 0.006); // very loud sub
      g.gain.exponentialRampToValueAtTime(0.0001, thudTime + 0.45);
      o.connect(g).connect(master);
      o.start(thudTime);
      o.stop(thudTime + 0.5);
    }

    // 3) BODY — mid-frequency wood density. Triangle for woody softness.
    {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(230, thudTime);
      o.frequency.exponentialRampToValueAtTime(75, thudTime + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, thudTime);
      g.gain.exponentialRampToValueAtTime(1.4, thudTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, thudTime + 0.28);
      o.connect(g).connect(master);
      o.start(thudTime);
      o.stop(thudTime + 0.3);
    }

    // 4) PAPER CRINKLE — short white-noise burst, high-pass filtered for
    //    that "stack of paper compressing" sizzle. The amplitude envelope
    //    is baked into the buffer itself (decaying random samples).
    {
      const dur = 0.18;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, 1.8); // decay curve
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      // High-pass for "paper hiss" character (cut out the muddy low-mids).
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      hp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, thudTime);
      g.gain.exponentialRampToValueAtTime(0.95, thudTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, thudTime + dur);
      src.connect(hp).connect(g).connect(master);
      src.start(thudTime);
    }

    // ============ SPRITELY JINGLE (kicks in ~0.4s after the thwack) =======
    // Major arpeggio C5–E5–G5–C6, fast, cheery, resolves up. Volume kept
    // moderate so the thwack stays the dominant sound.
    const jingleStart = thudTime + 0.45;
    const noteDur = 0.12;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = jingleStart + i * noteDur;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + noteDur * 0.95);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + noteDur);
    });

    // Only close ctx if we created it ourselves. The pre-warmed one is
    // shared with future stamps in the same page session.
    if (ownsCtx) {
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1800);
    }
  } catch (e) {
    // Silently fail if the browser refuses audio playback (e.g. no user gesture).
    console.warn('[complaints] audio fail', e);
  }
}

/**
 * The satirical complaint form. Doesn't actually submit anywhere — on submit,
 * the form visually collapses into a "FILED" stamp + a thank-you message
 * making it clear McQuackers is going to put it directly in the recycle bin.
 */
function ComplaintForm() {
  const [filed, setFiled] = useState(false);

  if (filed) {
    return (
      <div className="my-10 rounded-2xl border-4 border-[var(--tj-red)] bg-[var(--cream-dark)] p-8 text-center">
        <div className="mb-2 inline-block -rotate-6 transform rounded-md border-[3px] border-[var(--tj-red)] bg-[var(--tj-red)]/10 px-6 py-2 font-display text-3xl font-black uppercase tracking-widest text-[var(--tj-red)]">
          Received
        </div>
        <p className="mt-4 text-base font-bold text-[var(--ink)]">
          Your grievance has been added to the queue.
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Estimated review time: 2&ndash;4 business decades.
        </p>
      </div>
    );
  }

  return (
    <section className="my-10">
      <h2 className="mb-1 font-display text-xl font-black">
        File Your Grievance
      </h2>
      <p className="mb-5 text-sm text-[var(--ink-soft)]">
        Please complete Form 27-B in its entirety. Incomplete forms will be
        returned, in spirit, after a delay of indeterminate length.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFiled(true);
        }}
        className="space-y-4 rounded-2xl border-2 border-[var(--ink-soft)]/30 bg-[var(--cream-dark)] p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Your name" required>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="e.g. A Concerned Shopper"
              className="w-full rounded-md border-2 border-[var(--ink-soft)]/30 bg-white px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--tj-red)] focus:outline-none"
            />
          </FormField>
          <FormField label="Email address" required>
            <input
              type="email"
              required
              maxLength={200}
              placeholder="you@example.com"
              className="w-full rounded-md border-2 border-[var(--ink-soft)]/30 bg-white px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--tj-red)] focus:outline-none"
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Store number (if known)">
            <input
              type="text"
              maxLength={20}
              placeholder="e.g. 51, 691, or just the city"
              className="w-full rounded-md border-2 border-[var(--ink-soft)]/30 bg-white px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--tj-red)] focus:outline-none"
            />
          </FormField>
          <FormField label="Severity">
            <select
              defaultValue="Polite concern"
              className="w-full rounded-md border-2 border-[var(--ink-soft)]/30 bg-white px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--tj-red)] focus:outline-none"
            >
              <option>Mild musing</option>
              <option>Polite concern</option>
              <option>Stern frown</option>
              <option>Full berserk</option>
              <option>I have written a song about it</option>
            </select>
          </FormField>
        </div>

        <FormField label="Nature of grievance" required>
          <textarea
            required
            rows={5}
            maxLength={2000}
            placeholder="Please describe the situation in your own words. Be as specific as possible. McQuackers is reading every word."
            className="w-full rounded-md border-2 border-[var(--ink-soft)]/30 bg-white px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--tj-red)] focus:outline-none"
          />
        </FormField>

        <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
          <input type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--tj-red)]" />
          <span>
            I confirm this grievance is sincerely held and that I have, to the
            best of my knowledge, no recourse left except a duck.
          </span>
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--tj-red)] px-6 py-3 text-base font-black uppercase tracking-widest text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] hover:translate-y-[1px] hover:shadow-[0_2px_0_var(--tj-red-dark)] active:translate-y-[3px] active:shadow-none"
        >
          File Grievance
        </button>
      </form>

      {/* The LARGE disclaimer David specifically asked for. Big type so
          nobody misses that this is satire and goes straight to recycling. */}
      <div className="mt-6 rounded-xl border-2 border-dashed border-[var(--tj-red)] bg-[var(--cream-dark)] p-5 text-center">
        <p className="font-display text-lg font-black leading-snug text-[var(--ink)] sm:text-xl">
          McQuackers will personally review your complaint
          <br />
          and file it into the appropriate recycle bin.
        </p>
      </div>
    </section>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-[var(--ink-soft)]">
        {label}
        {required && <span className="ml-1 text-[var(--tj-red)]">*</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Small fixed pill in the bottom-right that ticks down to game start.
 * Becomes red + pulses in the final 3 seconds for "the duck is losing it"
 * energy.
 */
function CountdownPill({ seconds }: { seconds: number }) {
  const urgent = seconds <= 3;
  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-[2000]"
      aria-live="polite"
    >
      <style jsx>{`
        @keyframes complaints-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .complaints-pill {
          background: ${urgent ? 'var(--tj-red)' : 'rgba(20,12,6,0.85)'};
          color: var(--cream);
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.06em;
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
          animation: ${urgent ? 'complaints-pulse 0.5s ease-in-out infinite' : 'none'};
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .complaints-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${urgent ? '#fff' : 'var(--tj-red)'};
          box-shadow: 0 0 6px ${urgent ? '#fff' : 'var(--tj-red)'};
        }
      `}</style>
      <div className="complaints-pill">
        <span className="complaints-dot" />
        AUTOMATIC DENIAL IN&nbsp;0:{seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
}
