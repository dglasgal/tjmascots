'use client';

/**
 * /catch — McQuackers' Mascot Catch (the second easter-egg game).
 *
 * Hidden entry: 5 clicks on the © symbol in the site footer (SiteShell.tsx).
 * No nav links to this page. People share the /catch URL organically.
 *
 * Companion to /terms (McQuackers' Quest, the first easter egg).
 * Different gameplay: that one is hidden-object, this is whack-a-mole.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Game is heavy (assets + canvas) — load only on mount, never SSR.
const CatchGame = dynamic(() => import('@/components/CatchGame'), {
  ssr: false,
  loading: () => null,
});

export default function CatchPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Tiny site disclaimer in the corner so the easter egg still complies
          with the fan-site posture even when discovered raw via the URL. */}
      <div className="pointer-events-none absolute bottom-2 left-3 z-50 text-[10px] font-bold text-[var(--cream)]/60 select-none">
        Fan project. Not affiliated with Trader Joe&apos;s Company.{' '}
        <Link href="/" className="pointer-events-auto underline">map</Link>
      </div>
      {ready && <CatchGame />}
    </div>
  );
}
