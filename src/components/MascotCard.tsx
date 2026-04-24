'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Mascot, Store } from '@/lib/types';
import { photoUrl } from '@/lib/data';

type Selection =
  | { kind: 'mascot'; data: Mascot }
  | { kind: 'store'; data: Store }
  | null;

interface MascotCardProps {
  selection: Selection;
  onClose: () => void;
  onSubmitForStore: (city: string, state: string) => void;
}

export default function MascotCard({ selection, onClose, onSubmitForStore }: MascotCardProps) {
  return (
    <AnimatePresence>
      {selection && (
        <motion.aside
          key={selection.kind === 'mascot' ? `m-${selection.data.id}` : `s-${selection.data.store_number}`}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="absolute inset-y-0 right-0 z-[500] w-[400px] overflow-y-auto border-l-[3px] border-[var(--cream-dark)] bg-[var(--cream)] shadow-[-8px_0_24px_rgba(58,46,31,0.1)] max-sm:w-full"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-2.5 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(253,246,236,0.9)] text-xl font-bold text-[var(--ink)] backdrop-blur"
          >
            ×
          </button>

          {selection.kind === 'mascot' ? (
            <MascotBody m={selection.data} />
          ) : (
            <StoreBody
              s={selection.data}
              onSubmit={() => onSubmitForStore(selection.data.city, selection.data.state)}
            />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MascotBody({ m }: { m: Mascot }) {
  const photoSrc = m.has_photo && m.photo ? photoUrl(m.photo) : null;
  return (
    <>
      {photoSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photoSrc}
          alt={m.name || m.animal}
          className="block aspect-square w-full bg-[var(--cream-dark)] object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[120px]">
          {m.emoji}
        </div>
      )}

      <div className="px-6 pb-8 pt-5">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          {m.animal}
        </div>
        <h2 className="my-1.5 font-display text-4xl font-extrabold leading-tight text-[var(--tj-red)]">
          {m.name || 'Unnamed mascot'}
        </h2>
        <div className="mb-1 text-base font-bold">
          {m.store}
          {m.state && (
            <span className="font-semibold text-[var(--ink-soft)]">, {m.state}</span>
          )}
        </div>
        {m.street && (
          <div className="mb-4 text-[13px] text-[var(--ink-soft)]">
            {m.street}
            {m.zip ? ` · ${m.zip}` : ''}
          </div>
        )}
        {m.notes && (
          <div className="border-t-2 border-dashed border-[var(--cream-dark)] py-3.5 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
            {m.notes}
          </div>
        )}
        {m.source_url && (
          <div className="mt-4 border-t-2 border-dashed border-[var(--cream-dark)] pt-3.5 text-xs text-[var(--ink-soft)]">
            Source:{' '}
            <a
              href={m.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--tj-red)] underline"
            >
              {sourceLabel(m.source_url)}
            </a>
          </div>
        )}

        <div className="mt-3 text-[11px] text-[var(--ink-soft)]">
          <a
            href={buildCorrectionMailto(m)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--cream-dark)] px-2.5 py-1 font-bold uppercase tracking-wide transition hover:border-[var(--tj-red)] hover:text-[var(--tj-red)]"
            title="Email the project owner about a correction"
          >
            ⚠︎ Report incorrect info
          </a>
        </div>
      </div>

      {!m.has_photo && (
        <div className="mx-6 mb-4 rounded-xl bg-[var(--cream-dark)] px-3.5 py-2.5 text-center text-[13px] font-semibold text-[var(--ink-soft)]">
          📷 No photo yet — help us fill this in!
        </div>
      )}
    </>
  );
}

/** Build a mailto: link with pre-filled subject & body describing the mascot.
 *  Recipient is NEXT_PUBLIC_SITE_EMAIL at build time, falling back to the
 *  project owner's email so the button always works. */
function buildCorrectionMailto(m: Mascot): string {
  const to = process.env.NEXT_PUBLIC_SITE_EMAIL || 'david@7ate9.com';
  const label = `${m.name || 'Unnamed'} the ${m.animal || 'mascot'}`;
  const subject = `TJ Mascots correction: ${label} at ${m.store || 'unknown store'}`;
  const body = [
    `I think this mascot record has an error.`,
    ``,
    `Mascot: ${label}`,
    `Store: ${m.store}${m.state ? `, ${m.state}` : ''}`,
    m.street ? `Address: ${m.street}${m.zip ? `, ${m.zip}` : ''}` : '',
    m.store_number ? `Store #: ${m.store_number}` : '',
    ``,
    `What should be corrected?`,
    `[  ] Name`,
    `[  ] Animal type`,
    `[  ] Store location`,
    `[  ] Photo is wrong`,
    `[  ] Mascot has been retired`,
    `[  ] Other:`,
    ``,
    `Correct info / details:`,
    ``,
    ``,
    `Thanks!`,
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function StoreBody({ s, onSubmit }: { s: Store; onSubmit: () => void }) {
  return (
    <>
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[120px]">
        ❓
      </div>
      <div className="px-6 pb-2 pt-5">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          Mascot unknown
        </div>
        <h2 className="my-1.5 font-display text-4xl font-extrabold leading-tight text-[var(--tj-red)]">
          TJ&apos;s {s.city}
        </h2>
        <div className="mb-1 text-base font-bold">Store #{s.store_number}</div>
        <div className="mb-4 text-[13px] text-[var(--ink-soft)]">
          {s.street} · {s.city}, {s.state} {s.zip}
        </div>
        <div className="border-t-2 border-dashed border-[var(--cream-dark)] py-3.5 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          No mascot on file for this store yet. If you&apos;ve spotted one, please share!
        </div>
      </div>
      <button
        onClick={onSubmit}
        className="mx-6 mb-6 mt-3.5 block w-[calc(100%-3rem)] rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)]"
      >
        Submit {s.city}&apos;s mascot
      </button>
    </>
  );
}

function sourceLabel(url: string): string {
  if (url.includes('reddit.com')) return 'Reddit thread';
  if (url.startsWith('User-submitted')) return url;
  if (url.includes('theaggie.org')) return 'The Aggie (Davis student paper)';
  if (url.includes('tastingtable')) return 'Tasting Table';
  if (url.includes('chowhound')) return 'Chowhound';
  if (url.includes('instagram')) return 'Instagram';
  return 'source';
}
