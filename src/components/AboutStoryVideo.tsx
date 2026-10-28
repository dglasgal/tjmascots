'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The About page's animated story: Brian walks into a TJ's, discovers the
 * menagerie, gets a high-five for spotting McQuackers, the crew rounds up
 * the wandering mascots at closing, and Brian finds them all on the map.
 *
 * A 25-second silent loop generated with Higgsfield (Seedance 2.5) from
 * five approved story frames (Oct 2026). Files: /public/videos/about-story.mp4
 * and its poster /public/videos/about-story-poster.jpg.
 *
 * Autoplays muted (browsers only allow muted autoplay). Visitors who've
 * asked their device for reduced motion get the still poster instead, and
 * everyone gets a pause/play button (accessibility: moving content longer
 * than 5 seconds needs a way to stop it).
 */
export default function AboutStoryVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      v.pause();
      setPlaying(false);
    } else {
      v.play().catch(() => setPlaying(false));
    }
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[420px] overflow-hidden rounded-3xl bg-[var(--cream-dark)] shadow-card ring-1 ring-black/5">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        src="/videos/about-story.mp4"
        poster="/videos/about-story-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Animated story: Brian walks into a Trader Joe's and spots McQuackers the duck above the registers, a moose calf behind the sunflowers and a crab in the produce cooler. A crew member high-fives him for finding McQuackers, then after closing rounds up the wandering mascots. That night Brian smiles at a map dotted with mascots while McQuackers waves through his window."
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause the animation' : 'Play the animation'}
        className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(253,246,236,0.9)] text-base font-black text-[var(--tj-red)] shadow-card backdrop-blur transition hover:scale-105"
      >
        {playing ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
