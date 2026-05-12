'use client';

/**
 * /quack — direct entry into McQuackers' Quest.
 *
 * This route exists primarily for brag-share URLs: when a player completes
 * the game, they get a copyable link like `/quack?t=247`. Friends who open
 * it land on the intro screen with a "beat 4:07" challenge banner.
 *
 * For first-time discovery, the easter egg lives at /terms (boring legalese
 * → scroll → burst). /quack is meant to be shared, not stumbled onto.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const QuackGame = dynamic(() => import('@/components/QuackGame'), { ssr: false });

function QuackInner() {
  const params = useSearchParams();
  const tRaw = params.get('t');
  const t = tRaw ? Number(tRaw) : NaN;
  const challengeSeconds = Number.isFinite(t) && t > 0 && t < 3600 ? t : null;
  return <QuackGame challengeSeconds={challengeSeconds} />;
}

export default function QuackPage() {
  return (
    <Suspense fallback={null}>
      <QuackInner />
    </Suspense>
  );
}
