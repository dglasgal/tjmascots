'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildSearchIndex, runSearch, type SearchResult } from '@/lib/search';
import type { Mascot, Store } from '@/lib/types';

interface HeaderProps {
  mascots: Mascot[];
  stores: Store[];
  onSelect: (r: SearchResult) => void;
  onSubmitClick: () => void;
  totalMascots: number;
  totalUnknown: number;
}

export default function Header({
  mascots,
  stores,
  onSelect,
  onSubmitClick,
  totalMascots,
  totalUnknown,
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildSearchIndex(mascots, stores), [mascots, stores]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setOpen(false);
      return;
    }
    setResults(runSearch(index, query));
    setOpen(true);
    setActive(-1);
  }, [query, index]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = active >= 0 ? results[active] : results[0];
      if (pick) {
        onSelect(pick);
        setQuery('');
        setOpen(false);
      }
    }
  }

  return (
    <header className="relative z-[1000] flex items-center justify-between gap-5 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card">
      <div className="flex flex-shrink-0 items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)]">
          🛒
        </div>
        <div>
          <h1 className="font-display text-2xl font-black leading-none tracking-tight">TJ Mascots</h1>
          <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
            an unofficial map of every Trader Joe&apos;s store mascot
          </p>
        </div>
      </div>

      <div ref={wrapRef} className="relative flex-1 max-w-[560px] max-md:max-w-none">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 opacity-55"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          spellCheck={false}
          autoComplete="off"
          placeholder="Search a city, ZIP, mascot name, or animal…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => query && setOpen(true)}
          className="w-full rounded-full border-0 bg-[rgba(253,246,236,0.95)] px-4 py-2.5 pl-10 text-base font-semibold text-[var(--ink)] outline-none transition placeholder:font-semibold placeholder:text-[var(--ink-soft)] focus:bg-[var(--cream)] focus:ring-4 focus:ring-[rgba(253,246,236,0.35)]"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cream-dark)] text-sm font-bold text-[var(--ink-soft)]"
          >
            ×
          </button>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-[1500] max-h-[420px] overflow-y-auto rounded-2xl bg-[var(--cream)] p-1.5 shadow-pop"
            >
              {results.length === 0 ? (
                <div className="p-4 text-center text-sm font-semibold text-[var(--ink-soft)]">
                  No matches. Try a city, ZIP, or animal.
                </div>
              ) : (
                results.map((r, i) => (
                  <ResultRow
                    key={r.kind + (r.kind === 'mascot' ? r.data.id : r.data.store_number)}
                    result={r}
                    isActive={i === active}
                    onHover={() => setActive(i)}
                    onPick={() => {
                      onSelect(r);
                      setQuery('');
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5">
        <div className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold max-[900px]:hidden">
          {totalMascots} known · {totalUnknown} unknown
        </div>
        <button
          onClick={onSubmitClick}
          className="rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)]"
        >
          + Submit a mascot
        </button>
      </div>
    </header>
  );
}

function ResultRow({
  result,
  isActive,
  onHover,
  onPick,
}: {
  result: SearchResult;
  isActive: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const bg = isActive ? 'bg-[var(--cream-dark)]' : '';
  if (result.kind === 'mascot') {
    const m = result.data;
    return (
      <div
        onMouseEnter={onHover}
        onClick={onPick}
        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 transition ${bg} hover:bg-[var(--cream-dark)]`}
      >
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream-dark)] text-lg">
          {m.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-[var(--ink)]">
            {(m.name || 'Unnamed') + ' the ' + (m.animal || 'mascot')}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
            {m.store}
            {m.state ? `, ${m.state}` : ''}
            {m.zip ? ` · ${m.zip}` : ''}
          </div>
        </div>
        <div className="flex-shrink-0 rounded-full bg-[var(--cream-dark)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--tj-red)]">
          Mascot
        </div>
      </div>
    );
  }
  const s = result.data;
  return (
    <div
      onMouseEnter={onHover}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 transition ${bg} hover:bg-[var(--cream-dark)]`}
    >
      <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[var(--accent)] bg-[var(--cream-dark)] text-lg opacity-70">
        ❓
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-extrabold text-[var(--ink)]">
          TJ&apos;s {s.city}, {s.state}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
          {s.street} · {s.zip} · Store #{s.store_number}
        </div>
      </div>
      <div className="flex-shrink-0 rounded-full bg-[var(--cream-dark)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
        Store
      </div>
    </div>
  );
}
