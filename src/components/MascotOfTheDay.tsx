'use client';

/**
 * MascotOfTheDay — small circular sticker in the corner of the map.
 *
 * Picks a different mascot each day deterministically (everyone sees the
 * same one on a given date, no client-side randomness drift). Only mascots
 * with a real photo are eligible — a no-photo "mascot of the day" would
 * fall flat. Hides itself when a mascot card is already open so it doesn't
 * compete for attention. Click → fly the map there + open that card.
 *
 * Hawaiian-themed decoration: hibiscus flower in one corner, palm-leaf
 * frond in the other, slight tilt like a sticker, friendly tropical
 * palette layered on top of the existing TJ red/cream brand.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Mascot } from '@/lib/types';
import { photoUrl } from '@/lib/data';

interface MascotOfTheDayProps {
  mascots: Mascot[];
  /** Hide the sticker while a mascot card is open in the side panel. */
  hidden: boolean;
  onPick: (m: Mascot) => void;
}

export default function MascotOfTheDay({ mascots, hidden, onPick }: MascotOfTheDayProps) {
  const todays = useMemo(() => pickTodaysMascot(mascots), [mascots]);
  if (!todays || hidden) return null;

  const photoSrc = todays.has_photo && todays.photo ? photoUrl(todays.photo) : null;
  const animal = todays.animal || 'mascot';
  const displayName = todays.name || 'Today’s mascot';

  return (
    <motion.button
      type="button"
      onClick={() => onPick(todays)}
      title={`Today's featured mascot: ${displayName} the ${animal} at ${todays.store}. Tap to fly there.`}
      aria-label={`Mascot of the day: ${displayName} the ${animal}. Tap to view on map.`}
      initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
      animate={{ opacity: 1, scale: 1, rotate: -5 }}
      transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.5 }}
      whileHover={{ scale: 1.06, rotate: 0 }}
      whileTap={{ scale: 0.96 }}
      className="absolute bottom-5 right-5 z-[450] block h-[180px] w-[180px] max-sm:hidden"
    >
      {/* Hawaiian decoration — sits BEHIND the cream circle, big enough
          to peek out around the edges so the sticker looks pinned to a
          flower. Pointer-events disabled so they never intercept clicks. */}
      <Hibiscus className="pointer-events-none absolute -top-3 -right-4 z-0 h-[110px] w-[110px]" />
      <PalmLeaf className="pointer-events-none absolute -bottom-2 -left-5 z-0 h-[100px] w-[100px] -rotate-12" />

      {/* The cream circle that holds the text + photo, on top of the flowers */}
      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full bg-[var(--cream)] p-2 text-center shadow-pop ring-[3px] ring-[var(--tj-red)]">
        {/* Top label — "MASCOT OF THE DAY" in two stacked lines for the
            block-stamp feel, using Fraunces (our display serif, the
            closest thing to TJ's hand-lettered signage in our stack) */}
        <div className="font-display text-[14px] font-black uppercase leading-[0.92] tracking-[0.02em] text-[var(--tj-red)]">
          Mascot
          <br />
          of the Day
        </div>

        {/* Photo — the visual centerpiece. In full color, with a TJ-red
            ring border. */}
        <div className="my-1 flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--tj-red)] bg-[var(--cream-dark)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
          {photoSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoSrc}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl">{todays.emoji}</span>
          )}
        </div>

        {/* Mascot name — block red Fraunces */}
        <div className="max-w-[150px] truncate font-display text-lg font-black leading-none text-[var(--tj-red)]">
          {displayName}
        </div>
      </div>
    </motion.button>
  );
}

/* -------------------------- Daily picker -------------------------- */

/** Returns today's mascot. Same date → same mascot for every visitor.
 *  Filters to mascots with photos for visual punch. */
function pickTodaysMascot(mascots: Mascot[]): Mascot | null {
  const eligible = mascots.filter((m) => m.has_photo && m.photo);
  if (eligible.length === 0) return null;
  const seed = daysSinceEpoch();
  // Sort by id for a stable order independent of array order changes
  const sorted = [...eligible].sort((a, b) => a.id - b.id);
  return sorted[seed % sorted.length];
}

/** Number of UTC days since Unix epoch — flips at midnight UTC.
 *  Using UTC keeps the rotation consistent across visitor timezones
 *  (matters for caching too). */
function daysSinceEpoch(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/* -------------------------- Hawaiian SVGs ------------------------- */

function Hibiscus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Five overlapping petals around a yellow stamen */}
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="32"
          cy="20"
          rx="12"
          ry="16"
          fill="#E94B6B"
          stroke="#B43050"
          strokeWidth="1.5"
          transform={`rotate(${deg} 32 32)`}
          opacity="0.95"
        />
      ))}
      {/* Stamen */}
      <line x1="32" y1="32" x2="32" y2="42" stroke="#FFC93C" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3.5" fill="#FFC93C" stroke="#B45200" strokeWidth="0.8" />
      <circle cx="30" cy="42" r="1.5" fill="#FFC93C" />
      <circle cx="34" cy="42" r="1.5" fill="#FFC93C" />
      <circle cx="32" cy="44" r="1.5" fill="#FFC93C" />
    </svg>
  );
}

function PalmLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Stylized palm frond — central rib with angled fronds */}
      <g stroke="#0F7B3F" strokeWidth="1.2" strokeLinecap="round" fill="#3FAA5C">
        {/* Central stem */}
        <line x1="14" y1="50" x2="50" y2="14" stroke="#0F7B3F" strokeWidth="2.4" />
        {/* Fronds — pairs stepping along the stem */}
        {[
          [20, 44],
          [26, 38],
          [32, 32],
          [38, 26],
          [44, 20],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x - 6} cy={y + 1} rx="9" ry="3.5" transform={`rotate(${-45 + i * 4} ${x - 6} ${y + 1})`} />
            <ellipse cx={x + 1} cy={y - 6} rx="9" ry="3.5" transform={`rotate(${45 + i * 4} ${x + 1} ${y - 6})`} />
          </g>
        ))}
      </g>
    </svg>
  );
}
