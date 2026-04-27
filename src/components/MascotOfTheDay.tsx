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
      animate={{ opacity: 1, scale: 1, rotate: -6 }}
      transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.5 }}
      whileHover={{ scale: 1.06, rotate: 0 }}
      whileTap={{ scale: 0.96 }}
      className="absolute bottom-5 right-5 z-[450] flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-[var(--cream)] p-2 text-center shadow-pop ring-[3px] ring-[var(--tj-red)] transition max-sm:bottom-3 max-sm:right-3 max-sm:h-[100px] max-sm:w-[100px]"
    >
      {/* Hawaiian decoration — hibiscus flower top-right, palm leaf bottom-left */}
      <Hibiscus className="pointer-events-none absolute -top-2 -right-2 h-12 w-12 max-sm:h-9 max-sm:w-9" />
      <PalmLeaf className="pointer-events-none absolute -bottom-2 -left-3 h-12 w-12 -rotate-12 max-sm:h-9 max-sm:w-9" />

      {/* Top label */}
      <div className="z-[1] text-[8px] font-extrabold uppercase tracking-[0.2em] text-[var(--tj-red)] max-sm:text-[7px]">
        Mascot of the Day
      </div>

      {/* Photo or emoji */}
      <div className="z-[1] my-1 flex h-[70px] w-[70px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--cream-dark)] bg-[var(--cream-dark)] max-sm:my-0.5 max-sm:h-[48px] max-sm:w-[48px]">
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

      {/* Bottom label */}
      <div className="z-[1] max-w-full truncate font-display text-xs font-extrabold leading-none text-[var(--ink)] max-sm:text-[10px]">
        {displayName}
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
