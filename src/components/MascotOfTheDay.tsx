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
      className="absolute bottom-5 right-5 z-[450] block h-[230px] w-[230px] max-sm:hidden"
    >
      {/* Hawaiian decoration — sits BEHIND the cream circle, big enough
          to peek out around the edges so the sticker looks pinned to a
          flower. Pointer-events disabled so they never intercept clicks. */}
      <Hibiscus className="pointer-events-none absolute -top-4 -right-5 z-0 h-[130px] w-[130px]" />
      <PalmLeaf className="pointer-events-none absolute -bottom-3 -left-6 z-0 h-[120px] w-[120px] -rotate-12" />

      {/* The cream circle that holds the text + photo, on top of the flowers */}
      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full bg-[var(--cream)] px-2 py-1 text-center shadow-pop ring-[3px] ring-[var(--tj-red)]">
        {/* Top label — "MASCOT OF THE DAY" in two stacked lines for the
            block-stamp feel, using Fraunces (our display serif, the
            closest thing to TJ's hand-lettered signage in our stack) */}
        <div className="font-display text-[11px] font-black uppercase leading-[0.92] tracking-[0.02em] text-[var(--tj-red)]">
          Mascot
          <br />
          of the Day
        </div>

        {/* Photo — the visual centerpiece. Bigger circle so the mascot
            fills most of the sticker; the outer cream circle is
            unchanged but the negative space inside it is now tight. */}
        <div className="my-0.5 flex h-[150px] w-[150px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--tj-red)] bg-[var(--cream-dark)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
          {photoSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoSrc}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-4xl">{todays.emoji}</span>
          )}
        </div>

        {/* Mascot name — block red Fraunces, with the animal type as a
            smaller italic subtitle ("Ice / the Polar Bear"). */}
        <div className="max-w-[170px] truncate font-display text-base font-black leading-tight text-[var(--tj-red)]">
          {displayName}
        </div>
        <div className="-mt-0.5 max-w-[170px] truncate font-display text-[11px] font-bold italic leading-tight text-[var(--ink-soft)]">
          the {animal}
        </div>
      </div>
    </motion.button>
  );
}

/* -------------------------- Daily picker -------------------------- */

const MOTD_DATE_KEY = 'tjmascots:motd-date';
const MOTD_ID_KEY = 'tjmascots:motd-id';

/** Returns today's mascot. Sticks for the visitor's full local day even
 *  if we publish new mascots in the meantime (which would otherwise
 *  shift the deterministic `days_since_epoch % count` pick to a
 *  different entry).
 *
 *  Implementation:
 *   1. If localStorage has a pick from today's date, return that mascot.
 *   2. Otherwise, deterministically pick one (date × id-sorted index)
 *      and cache it for the rest of today.
 *
 *  Filters to mascots with real photos for visual punch.
 */
export function pickTodaysMascot(mascots: Mascot[]): Mascot | null {
  const eligible = mascots.filter((m) => m.has_photo && m.photo);
  if (eligible.length === 0) return null;

  const today = todayLocalISODate();

  // Try to honor a cached pick from earlier today.
  if (typeof window !== 'undefined') {
    try {
      const cachedDate = window.localStorage.getItem(MOTD_DATE_KEY);
      const cachedId = window.localStorage.getItem(MOTD_ID_KEY);
      if (cachedDate === today && cachedId) {
        const found = eligible.find((m) => String(m.id) === cachedId);
        if (found) return found;
      }
    } catch {
      // localStorage may be blocked (private mode, etc.); fall through
      // to the deterministic pick.
    }
  }

  // Fresh deterministic pick. Sort by id so the order is stable
  // regardless of catalog insertion order.
  const sorted = [...eligible].sort((a, b) => a.id - b.id);
  const picked = sorted[daysSinceEpoch() % sorted.length];

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MOTD_DATE_KEY, today);
      window.localStorage.setItem(MOTD_ID_KEY, String(picked.id));
    } catch {
      // ignore — picker still works without persistence
    }
  }
  return picked;
}

/** Local-time YYYY-MM-DD — the cache key. We use local time (not UTC)
 *  so a visitor seeing the sticker at 11pm and again at 1am sees
 *  different mascots only when their own day flips, matching their
 *  real-world expectation of "today." */
function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of UTC days since Unix epoch — used as the deterministic
 *  selection seed for first-of-day visitors. */
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
