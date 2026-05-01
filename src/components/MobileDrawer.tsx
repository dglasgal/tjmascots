'use client';

/**
 * MobileDrawer
 *
 * Mobile-only right-side drawer that holds every header feature we can't
 * fit on a small screen: mascot count link, Random, Recent, Submit,
 * Mascot of the Day, an inline Map Key, and the four utility pages
 * (Animals, FAQ, Data, Privacy). Slides in from the right edge over a
 * dimmed backdrop. Closes on backdrop tap, the X button, or Escape.
 *
 * The drawer is only ever mounted at <sm breakpoints — on tablet/desktop
 * the existing inline header pills already show all of this, so we don't
 * need the drawer there.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  totalMascots: number;
  totalUnknown: number;
  percentMapped: number;
  onProgressClick: () => void;
  onRandomClick: () => void;
  onSubmitClick: () => void;
  onMOTDClick: () => void;
}

export default function MobileDrawer({
  open,
  onClose,
  totalMascots,
  totalUnknown,
  percentMapped,
  onProgressClick,
  onRandomClick,
  onSubmitClick,
  onMOTDClick,
}: MobileDrawerProps) {
  // Esc closes the drawer
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open so the page underneath doesn't move when
  // the user scrolls the drawer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Helper: run the action, then close the drawer. Used for every
  // tappable row so the drawer never lingers awkwardly after you pick.
  function pick(action: () => void) {
    return () => {
      action();
      onClose();
    };
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[3000] sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {/* Backdrop — tap to close */}
          <div
            className="absolute inset-0 bg-[rgba(15,10,5,0.55)]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.22 }}
            className="absolute right-0 top-0 flex h-full w-[86%] max-w-[360px] flex-col overflow-y-auto bg-[var(--cream)] shadow-[ -10px_0_30px_rgba(0,0,0,0.25)]"
          >
            {/* Header strip — TJ red, with close X */}
            <div className="flex items-center justify-between bg-[var(--tj-red)] px-4 py-3 text-[var(--cream)]">
              <span className="font-display text-lg font-black tracking-tight">
                Menu
              </span>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--cream)] text-xl font-extrabold leading-none text-[var(--ink)] shadow-[0_2px_0_var(--tj-red-dark)] transition active:translate-y-px"
              >
                ×
              </button>
            </div>

            {/* 1. Mascot count → Mascot Parade */}
            <button
              onClick={pick(onProgressClick)}
              className="flex w-full items-center justify-between gap-3 border-b border-[var(--cream-dark)] px-4 py-4 text-left transition active:bg-[var(--cream-dark)]"
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  Mascot Parade
                </div>
                <div className="mt-0.5 text-sm font-extrabold text-[var(--ink)]">
                  {totalMascots} known · {totalUnknown} unknown
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-base font-extrabold text-[var(--tj-red)]">
                  {percentMapped.toFixed(1)}%
                </span>
                <span className="text-[var(--tj-red)]">↗</span>
              </div>
            </button>

            {/* 2. Random */}
            <DrawerRow
              icon="🎲"
              label="Random mascot"
              hint="Spin to a surprise pick"
              onClick={pick(onRandomClick)}
            />

            {/* 3. Recent */}
            <DrawerLinkRow
              icon="✨"
              label="Recent additions"
              hint="Newest mascots + top contributors"
              href="/recent"
              onNavigate={onClose}
            />

            {/* 4. Submit */}
            <DrawerRow
              icon="＋"
              label="Submit a mascot"
              hint="Add a sighting, photo, or correction"
              onClick={pick(onSubmitClick)}
              accent
            />

            {/* 5. Mascot of the Day */}
            <DrawerRow
              icon="🌺"
              label="Mascot of the Day"
              hint="Today's featured mascot — fly there"
              onClick={pick(onMOTDClick)}
            />

            {/* 6. Map Key — inline */}
            <div className="border-b border-[var(--cream-dark)] px-4 py-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                Map Key
              </div>
              <div className="flex flex-col gap-2 text-sm font-bold text-[var(--ink-soft)]">
                <KeyRow dotClass="border-[3px] border-[var(--tj-red)] bg-[var(--cream)]">
                  Mascot known, photo
                </KeyRow>
                <KeyRow dotClass="border-[3px] border-dashed border-[var(--accent)] bg-[var(--cream)]">
                  Mascot known, no photo yet
                </KeyRow>
                <KeyRow dotClass="!h-2.5 !w-2.5 border-2 border-[var(--accent)] bg-[var(--cream-dark)]">
                  Store — mascot unknown
                </KeyRow>
              </div>
            </div>

            {/* 7. Page links */}
            <nav className="flex flex-col">
              <DrawerLinkRow icon="🐾" label="Animals" href="/animal" onNavigate={onClose} />
              <DrawerLinkRow icon="❓" label="FAQ" href="/faq" onNavigate={onClose} />
              <DrawerLinkRow icon="📊" label="Data" href="/data" onNavigate={onClose} />
              <DrawerLinkRow icon="🔒" label="Privacy" href="/privacy" onNavigate={onClose} />
            </nav>

            {/* Footer note inside drawer */}
            <div className="mt-auto px-4 py-4 text-[11px] font-bold leading-snug text-[var(--ink-soft)]">
              Fan project. Not affiliated with Trader Joe&apos;s Company.
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Standard tappable row in the drawer (button-style). */
function DrawerRow({
  icon,
  label,
  hint,
  onClick,
  accent = false,
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[var(--cream-dark)] px-4 py-3.5 text-left transition active:bg-[var(--cream-dark)] ${
        accent ? 'bg-[rgba(204,42,30,0.06)]' : ''
      }`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cream-dark)] text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-extrabold ${accent ? 'text-[var(--tj-red)]' : 'text-[var(--ink)]'}`}>
          {label}
        </div>
        {hint && <div className="mt-0.5 text-xs text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <span className="text-[var(--ink-soft)]">›</span>
    </button>
  );
}

/** Tappable row that navigates to another route. */
function DrawerLinkRow({
  icon,
  label,
  hint,
  href,
  onNavigate,
}: {
  icon: string;
  label: string;
  hint?: string;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex w-full items-center gap-3 border-b border-[var(--cream-dark)] px-4 py-3.5 text-left transition active:bg-[var(--cream-dark)]"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cream-dark)] text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-[var(--ink)]">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <span className="text-[var(--ink-soft)]">›</span>
    </Link>
  );
}

/** A single legend row in the inline Map Key. */
function KeyRow({
  dotClass,
  children,
}: {
  dotClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-4 w-4 rounded-full ${dotClass}`} />
      {children}
    </div>
  );
}
