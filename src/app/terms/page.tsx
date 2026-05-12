'use client';

/**
 * /terms — the easter-egg entry for McQuackers' Quest.
 *
 * Loads a deliberately boring legal page. As soon as the user scrolls past
 * the first section, McQuackers crashes through the page and the hidden
 * object game takes over.
 *
 * The legalese is fan-site flavor — explicitly NOT a real legal document.
 * Anyone who actually reads it should figure that out quickly enough that
 * the burst feels like a reward, not a bait-and-switch.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MallardHead from '@/components/MallardHead';
import { playSfx, preloadAllSfx } from '@/lib/quack-sfx';

// The game is heavy with images/state — load only after the burst.
const QuackGame = dynamic(() => import('@/components/QuackGame'), {
  ssr: false,
  loading: () => null,
});

type Phase = 'reading' | 'bursting' | 'speech' | 'howto' | 'game';

const SPEECH_LINE =
  "Quack! Let's play a game! Help me find my mascot friends. Maybe you'll get a treat at the end…";

export default function TermsPage() {
  const [phase, setPhase] = useState<Phase>('reading');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Preload all SFX as soon as the page mounts so the burst sound is
  // ready to fire when scroll triggers. (Won't actually play until a user
  // gesture, but the network fetch happens early.)
  useEffect(() => {
    preloadAllSfx();
  }, []);

  // Trigger the burst when the user scrolls past the first ~18% of the
  // article. We listen on the scrollable main container, not window, so
  // it works inside the layout's height-100% shell.
  useEffect(() => {
    if (phase !== 'reading') return;
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const ratio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
      if (ratio > 0.18) {
        playSfx('burst', 0.75);
        setPhase('bursting');
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [phase]);

  // After the burst plays, McQuackers stays on screen and delivers his
  // welcome line ("Let's play a game…"). Then a brief How-to-Play card
  // flashes. Then the game loads.
  useEffect(() => {
    if (phase !== 'bursting') return;
    const t = window.setTimeout(() => {
      playSfx('mcq-speech', 0.85);
      setPhase('speech');
    }, 1500);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'speech') return;
    // Speech audio is ~6 seconds at this pitch/speed; advance after that.
    const t = window.setTimeout(() => setPhase('howto'), 6800);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'howto') return;
    // Brief 4-second how-to flash, then drop the player into the game.
    const t = window.setTimeout(() => setPhase('game'), 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'game') {
    return <QuackGame autoStart />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Plain header — matches /privacy */}
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)] transition hover:scale-105"
          >
            <MallardHead className="h-7 w-7" />
          </Link>
          <Link href="/" className="block">
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">
              TJ Mascots
            </h1>
            <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
              an unofficial map of every Trader Joe&apos;s store mascot
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

      <main
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto bg-[var(--cream)]"
      >
        <article className="mx-auto max-w-3xl px-6 py-12 text-[var(--ink)] max-sm:px-4 sm:py-16">
          <header className="mb-10 text-center">
            <h1 className="font-display text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">
              Terms and Conditions
            </h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-[var(--ink-soft)]">
              Last updated: May 2026
            </p>
          </header>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">1. Acceptance of Terms</h2>
            <p>
              By accessing or using TJ Mascots (&ldquo;the Service&rdquo;,
              &ldquo;our website&rdquo;, &ldquo;this site&rdquo;), you
              (&ldquo;the User&rdquo;, &ldquo;you&rdquo;, &ldquo;the
              Visitor&rdquo;) hereby acknowledge and consent to be bound by
              these Terms and Conditions in their entirety, including any
              modifications, amendments, supplements, addenda, or further
              elaborations thereof which may be promulgated, published, or
              otherwise made available by us, hereinafter and forevermore.
            </p>
            <p>
              The Service is provided on an &ldquo;as-is&rdquo;,
              &ldquo;as-available&rdquo;, and &ldquo;please-don&apos;t-sue-us&rdquo;
              basis. We make no warranties, express, implied, or vaguely
              implied through interpretive dance, regarding the accuracy,
              completeness, timeliness, or vibes of any mascot-related
              content displayed herein.
            </p>
          </section>

          {/* Most users will be scrolling past about now → burst fires. */}

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">2. Limitation of Liability</h2>
            <p>
              In no event shall TJ Mascots, its volunteer maintainers,
              its hosting provider, its caffeinated weekend contributors,
              the duck depicted in our logo, or any third party reasonably
              implicated by association be liable for any direct, indirect,
              incidental, consequential, exemplary, punitive, or
              comically-overwrought damages arising from your use of, or
              inability to use, the Service.
            </p>
            <p>
              This includes, but is not limited to: emotional reactions to
              discovering your local store does not yet have a known mascot;
              the existential dread of realizing how many stores there are;
              and any incidental cravings for cookie butter induced by
              prolonged browsing.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">3. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless the
              maintainers of TJ Mascots from and against any and all claims,
              demands, lawsuits, governmental actions, freedom-of-information
              requests, strongly-worded emails, mildly-worded emails,
              passive-aggressive Reddit comments, and TikTok stitches arising
              out of or related to your use of the Service, regardless of
              whether such claims have any factual basis whatsoever.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">4. Intellectual Property</h2>
            <p>
              All trademarks, service marks, logos, mascots, and similar
              proprietary indicia of origin remain the property of their
              respective owners. Trader Joe&apos;s, the Trader Joe&apos;s
              logo, and all associated branding are trademarks of Trader
              Joe&apos;s Company. This is a volunteer fan project and is
              not affiliated with, endorsed by, or otherwise officially
              sanctioned by Trader Joe&apos;s Company.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">5. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance
              with the laws of the State of California, without regard to
              its conflict of laws principles. Any disputes arising out of
              or relating to these Terms shall be resolved through
              good-faith conversation, ideally over a Joe-Joe&apos;s cookie
              and a small pour of Two-Buck Chuck.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">6. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid,
              illegal, or unenforceable for any reason, such provision shall
              be modified to the minimum extent necessary to make it valid,
              legal, and enforceable, and the remaining provisions shall
              continue in full force and effect.
            </p>
          </section>

          <section className="mb-8 space-y-4 leading-relaxed">
            <h2 className="font-display text-xl font-black">7. Contact</h2>
            <p>
              For questions about these Terms, please refer to the contact
              form on our <Link href="/about" className="underline">About page</Link>,
              or quietly stew about it on your own time.
            </p>
          </section>
        </article>
      </main>

      {/* The burst overlay — sits above everything once 'bursting' fires. */}
      {phase === 'bursting' && <BurstOverlay />}

      {/* McQuackers welcome speech — plays after the burst, before the game. */}
      {phase === 'speech' && <SpeechOverlay line={SPEECH_LINE} />}

      {/* Brief How-to-Play card that flashes before the game loads. */}
      {phase === 'howto' && <HowToFlashOverlay />}
    </div>
  );
}

/**
 * McQuackers stands center-screen and "speaks" — audio plays in parallel
 * (handled by the parent component) while a speech bubble shows the
 * subtitle text.
 */
function SpeechOverlay({ line }: { line: string }) {
  return (
    <>
      <style jsx>{`
        @keyframes mcq-bob {
          0%, 100% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, calc(-50% - 8px)); }
        }
        @keyframes bubble-pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .mcq-speech-root {
          position: absolute;
          inset: 0;
          z-index: 9999;
          background: var(--cream);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 24px;
        }
        .mcq-speech-duck {
          width: min(46vw, 320px);
          height: auto;
          animation: mcq-bob 1.6s ease-in-out infinite;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.2));
        }
        .mcq-speech-bubble {
          margin-top: 28px;
          max-width: 560px;
          padding: 18px 26px;
          border-radius: 22px;
          background: var(--cream-dark);
          border: 3px solid var(--tj-red);
          font-family: 'Fraunces', serif;
          font-weight: 800;
          font-size: clamp(18px, 2.6vw, 24px);
          color: var(--ink);
          text-align: center;
          line-height: 1.35;
          animation: bubble-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
          position: relative;
        }
        .mcq-speech-bubble::before {
          content: '';
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          border: 9px solid transparent;
          border-bottom-color: var(--tj-red);
        }
        .mcq-speech-bubble::after {
          content: '';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          border: 8px solid transparent;
          border-bottom-color: var(--cream-dark);
        }
      `}</style>
      <div className="mcq-speech-root">
        <img src="/quack/mascot-mcquackers.png" alt="McQuackers" className="mcq-speech-duck" />
        <div className="mcq-speech-bubble">{line}</div>
      </div>
    </>
  );
}

/**
 * Quick "Here's how to play" card. Auto-fades — purely a visual primer
 * before the game starts. (The full instructions live at /how-to-play
 * and are also reachable from the ❓ button in the game HUD.)
 */
function HowToFlashOverlay() {
  return (
    <>
      <style jsx>{`
        @keyframes htf-in {
          0% { transform: translate(-50%, calc(-50% + 30px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        .htf-root {
          position: absolute;
          inset: 0;
          z-index: 9999;
          background: var(--cream);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .htf-card {
          background: var(--cream-dark);
          border: 4px solid var(--tj-red);
          border-radius: 28px;
          padding: 30px 36px;
          max-width: 520px;
          width: calc(100% - 48px);
          text-align: center;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
          animation: htf-in 0.4s ease-out both;
        }
        .htf-title {
          font-family: 'Fraunces', serif;
          font-weight: 900;
          font-size: clamp(22px, 3.4vw, 30px);
          color: var(--tj-red);
          margin-bottom: 8px;
        }
        .htf-sub {
          color: var(--ink-soft);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .htf-rows {
          display: flex; flex-direction: column; gap: 10px;
          font-size: clamp(14px, 2vw, 16px);
          color: var(--ink);
          text-align: left;
        }
        .htf-row { display: flex; align-items: flex-start; gap: 10px; }
        .htf-icon { font-size: 20px; line-height: 1; flex-shrink: 0; }
      `}</style>
      <div className="htf-root">
        <div className="htf-card">
          <div className="htf-title">How to play</div>
          <div className="htf-sub">A quick primer</div>
          <div className="htf-rows">
            <div className="htf-row"><span className="htf-icon">👆</span><span><strong>Move your cursor</strong> (or drag your finger) — McQuackers follows you.</span></div>
            <div className="htf-row"><span className="htf-icon">🎯</span><span><strong>Click directly on the mascot</strong> when you spot it. On mobile, double-tap.</span></div>
            <div className="htf-row"><span className="htf-icon">⏱</span><span><strong>The faster you find them, the more points</strong> you earn.</span></div>
            <div className="htf-row"><span className="htf-icon">❓</span><span>Tap the help button in-game anytime to see this again.</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The burst-through animation. A jagged "torn page" mask grows from the
 * center while McQuackers scales up dramatically. CSS-only — no framer-motion
 * needed for this, since it's a one-shot timeline.
 */
function BurstOverlay() {
  return (
    <>
      <style jsx>{`
        @keyframes mcq-flash {
          0% { background: rgba(253,246,236,0); }
          15% { background: rgba(253,246,236,1); }
          100% { background: rgba(253,246,236,1); }
        }
        @keyframes mcq-duck-pop {
          0% { transform: translate(-50%, -50%) scale(0) rotate(-20deg); opacity: 0; }
          35% { transform: translate(-50%, -50%) scale(0.55) rotate(8deg); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(0.95) rotate(-3deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1) rotate(0deg); opacity: 1; }
        }
        @keyframes mcq-tear {
          0% { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
          100% {
            clip-path: polygon(
              0 0, 100% 0, 100% 100%, 0 100%
            );
          }
        }
        @keyframes mcq-shake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6px, 4px); }
          40% { transform: translate(7px, -3px); }
          60% { transform: translate(-4px, -5px); }
          80% { transform: translate(5px, 3px); }
        }
        .mcq-burst-root {
          position: absolute;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background: rgba(253,246,236,0);
          animation: mcq-flash 1.4s ease-out forwards, mcq-shake 0.7s ease-in-out 0.2s 1;
        }
        .mcq-duck {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(60vw, 460px);
          height: auto;
          transform: translate(-50%, -50%) scale(0);
          animation: mcq-duck-pop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
          filter: drop-shadow(0 12px 32px rgba(0,0,0,0.35));
        }
        .mcq-crack {
          position: absolute;
          inset: 0;
          clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%);
          animation: mcq-tear 1.2s ease-out 0.1s forwards;
          background: radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(253,246,236,1) 60%, rgba(232,168,124,0.3) 100%);
        }
      `}</style>
      <div className="mcq-burst-root">
        <div className="mcq-crack" />
        <img src="/quack/mascot-mcquackers.png" alt="" className="mcq-duck" />
      </div>
    </>
  );
}
