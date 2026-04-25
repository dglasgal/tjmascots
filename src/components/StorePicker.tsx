'use client';

/**
 * StorePicker
 *
 * Combobox for picking exactly ONE Trader Joe's store out of all 647 of them,
 * by city / address / zip / store number. Returns the full Store object so the
 * caller knows the store_number deterministically — no more ambiguity when a
 * city has multiple stores (Long Beach, Oakland, etc.).
 *
 * Optional "📍 Use nearest" button uses the browser's geolocation to surface
 * the 5 closest stores at the top of the list.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '@/lib/types';

interface StorePickerProps {
  stores: Store[];
  value: Store | null;
  onChange: (store: Store | null) => void;
  placeholder?: string;
}

export default function StorePicker({
  stores,
  value,
  onChange,
  placeholder = "Search city, ZIP, street, or store number…",
}: StorePickerProps) {
  const [query, setQuery] = useState(value ? formatStoreLabel(value) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [geoError, setGeoError] = useState<string>('');
  const [nearest, setNearest] = useState<Store[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter / score the store list against the query
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // If user has tapped "Use nearest" and not typed anything, show nearest first
    if (!q && nearest) return nearest;
    if (!q) return [];
    return scoreStores(stores, q).slice(0, 12);
  }, [stores, query, nearest]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active] ?? results[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function pick(store: Store) {
    onChange(store);
    setQuery(formatStoreLabel(store));
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery('');
    setNearest(null);
    inputRef.current?.focus();
  }

  function findNearest() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('err');
      setGeoError('Your browser doesn\'t support geolocation.');
      return;
    }
    setGeoStatus('loading');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ranked = stores
          .map((s) => ({ s, d: haversine(latitude, longitude, s.lat, s.lng) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 5)
          .map((r) => r.s);
        setNearest(ranked);
        setGeoStatus('ok');
        setOpen(true);
        setActive(0);
        setQuery('');
        onChange(null);
      },
      (err) => {
        setGeoStatus('err');
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. You can still search manually.'
            : 'Couldn\'t get your location. Try searching manually.',
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            // Clear the picked store if user starts typing again
            if (value && e.target.value !== formatStoreLabel(value)) {
              onChange(null);
            }
          }}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-[10px] border-2 border-[var(--cream-dark)] bg-white px-3.5 py-2.5 pr-9 text-sm outline-none focus:border-[var(--tj-red)]"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cream-dark)] text-[12px] font-bold text-[var(--ink-soft)] max-sm:h-8 max-sm:w-8"
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={findNearest}
          disabled={geoStatus === 'loading'}
          className="font-bold text-[var(--tj-red)] underline-offset-2 hover:underline disabled:opacity-60"
        >
          {geoStatus === 'loading' ? 'Locating…' : '📍 Use nearest store'}
        </button>
        {value && (
          <span className="font-bold text-[var(--ink-soft)]">
            ✓ Store #{value.store_number} selected
          </span>
        )}
      </div>
      {geoStatus === 'err' && (
        <div className="mt-1 text-[11px] text-[var(--tj-red)]">{geoError}</div>
      )}

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[2100] max-h-72 overflow-y-auto rounded-xl border border-[var(--cream-dark)] bg-[var(--cream)] p-1.5 shadow-pop">
          {nearest && results === nearest && (
            <div className="px-2 pb-1 pt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
              Nearest stores
            </div>
          )}
          {results.map((s, i) => (
            <button
              type="button"
              key={s.store_number}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                i === active ? 'bg-[var(--cream-dark)]' : ''
              } hover:bg-[var(--cream-dark)]`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-[var(--ink)]">
                  {s.city}, {s.state}{' '}
                  <span className="font-bold text-[var(--tj-red)]">#{s.store_number}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--ink-soft)]">
                  {s.street} · {s.zip}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------- helpers -------------------------- */

function formatStoreLabel(s: Store): string {
  return `${s.city}, ${s.state} #${s.store_number} — ${s.street}`;
}

function scoreStores(stores: Store[], q: string): Store[] {
  const scored: { s: Store; score: number }[] = [];
  for (const s of stores) {
    const hay = [s.city, s.state, s.zip, s.street, s.store_number]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) continue;
    let score = 1;
    if (s.zip === q) score += 100;
    if (s.store_number === q) score += 200;
    if (s.city.toLowerCase() === q) score += 80;
    else if (s.city.toLowerCase().startsWith(q)) score += 40;
    if (hay.split(/\s+/).some((tok) => tok.startsWith(q))) score += 5;
    scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((r) => r.s);
}

/** Great-circle distance in km between two lat/lng pairs. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
