'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Mascot, Store } from '@/lib/types';
import { photoUrl } from '@/lib/data';
import ReportModal from './ReportModal';
import PhotoLightbox from './PhotoLightbox';

type Selection =
  | { kind: 'mascot'; data: Mascot }
  | { kind: 'store'; data: Store }
  | null;

interface MascotCardProps {
  selection: Selection;
  onClose: () => void;
  onSubmitForStore: (city: string, state: string, store: Store) => void;
  /** Called when the user clicks "Submit this mascot" on a known mascot
   *  card that's missing a photo — opens the submit modal pre-filled. */
  onSubmitForMascot: (m: Mascot) => void;
  /** All TJ stores — passed through to the ReportModal's StorePicker. */
  stores: Store[];
  /** Retired/historical mascots, indexed by store_number, used to render the
   *  "Previous mascots" section at the bottom of each store or mascot card. */
  previousByStore?: Map<string, Mascot[]>;
}

export default function MascotCard({
  selection,
  onClose,
  onSubmitForStore,
  onSubmitForMascot,
  stores,
  previousByStore,
}: MascotCardProps) {
  const storeNumber =
    selection?.kind === 'mascot'
      ? selection.data.store_number || null
      : selection?.kind === 'store'
        ? selection.data.store_number
        : null;
  const previous =
    storeNumber && previousByStore ? previousByStore.get(storeNumber) ?? [] : [];

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
            className="absolute right-3 top-2.5 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(253,246,236,0.9)] text-xl font-bold text-[var(--ink)] backdrop-blur max-sm:h-11 max-sm:w-11"
          >
            ×
          </button>

          {selection.kind === 'mascot' ? (
            <MascotBody
              m={selection.data}
              stores={stores}
              onSubmit={() => onSubmitForMascot(selection.data)}
            />
          ) : (
            <StoreBody
              s={selection.data}
              onSubmit={() => onSubmitForStore(selection.data.city, selection.data.state, selection.data)}
            />
          )}

          <PreviousMascots items={previous} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** "Retired mascots" section — collapsed by default, expands on click.
 *  Hidden entirely when there are no retired entries for the store. The card's
 *  selection-key remounts this whenever you switch stores, so each store starts
 *  collapsed without needing to manage state outside this component. */
function PreviousMascots({ items }: { items: Mascot[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <section className="mt-1 border-t-4 border-[var(--cream-dark)] bg-[var(--cream-dark)]/40 px-6 py-4 max-sm:px-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--cream)] px-3.5 py-2.5 text-left shadow-[0_1px_0_var(--cream-dark)] transition hover:-translate-y-px hover:shadow-card"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🗂</span>
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-[var(--ink)]">
            Retired mascots
          </span>
          <span className="rounded-full bg-[var(--ink-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--cream)]">
            {items.length}
          </span>
        </div>
        <span
          className={`text-sm font-bold text-[var(--ink-soft)] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2.5">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-[var(--cream)] px-3 py-2.5 shadow-[0_1px_0_var(--cream-dark)]"
            >
              {m.has_photo && m.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoUrl(m.photo) || ''}
                  alt={`${m.name || 'Unnamed'} the ${m.animal || 'mascot'}`}
                  className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-dashed border-[var(--ink-soft)] object-cover opacity-80 grayscale"
                />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[var(--ink-soft)] bg-[var(--cream-dark)] text-xl opacity-80">
                  {m.emoji}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-[var(--ink)]">
                  {(m.name || 'Unnamed') + ' the ' + (m.animal || 'mascot')}
                </div>
                {m.notes && (
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-soft)]">
                    {m.notes.replace(/retired/gi, '').replace(/^[\s—,.-]+|[\s—,.-]+$/g, '')}
                  </div>
                )}
              </div>
              <span className="flex-shrink-0 rounded-full bg-[var(--ink-soft)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
                Retired
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MascotBody({ m, stores, onSubmit }: { m: Mascot; stores: Store[]; onSubmit: () => void }) {
  const photoSrc = m.has_photo && m.photo ? photoUrl(m.photo) : null;
  const [reportOpen, setReportOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const caption = `${m.name || 'Unnamed'} the ${m.animal || 'mascot'} · ${m.store}${
    m.state ? ', ' + m.state : ''
  }${m.store_number ? ' · Store #' + m.store_number : ''}`;
  return (
    <>
      {photoSrc ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          title="Click to view full photo"
          className="group relative block aspect-square w-full overflow-hidden bg-[var(--cream-dark)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc}
            alt={m.name || m.animal}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-[var(--ink)]/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)] opacity-0 transition-opacity group-hover:opacity-100">
            🔍 Click to expand
          </span>
        </button>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[120px]">
          {m.emoji}
        </div>
      )}

      <PhotoLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={photoSrc}
        alt={m.name || m.animal || 'mascot'}
        caption={caption}
      />

      <div className="px-6 pb-8 pt-5 max-sm:px-4">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          {m.animal}
        </div>
        <h2 className="my-1.5 font-display text-4xl font-extrabold leading-tight text-[var(--tj-red)] max-sm:text-3xl">
          {m.name || 'Unnamed mascot'}
        </h2>
        <div className="mb-1 flex items-baseline gap-2 text-base font-bold">
          <span>
            {m.store}
            {m.state && (
              <span className="font-semibold text-[var(--ink-soft)]">, {m.state}</span>
            )}
          </span>
          {m.store_number && (
            <span className="rounded-full bg-[var(--tj-red)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
              Store #{m.store_number}
            </span>
          )}
        </div>
        {m.street && (
          <div className="mb-4 break-words text-[13px] text-[var(--ink-soft)]">
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
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--cream-dark)] px-2.5 py-1 font-bold uppercase tracking-wide transition hover:border-[var(--tj-red)] hover:text-[var(--tj-red)]"
            title="Report a correction (goes to a private review queue)"
          >
            ⚠︎ Report incorrect info
          </button>
        </div>
      </div>

      {!m.has_photo && (
        <div className="mx-6 mb-4 max-sm:mx-4">
          <div className="rounded-xl bg-[var(--cream-dark)] px-3.5 py-2.5 text-center text-[13px] font-semibold text-[var(--ink-soft)]">
            📷 No photo yet — help us fill this in!
          </div>
          <button
            onClick={onSubmit}
            className="mt-2 block w-full rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)]"
          >
            + Submit the mascot
          </button>
        </div>
      )}

      <ReportModal open={reportOpen} mascot={m} stores={stores} onClose={() => setReportOpen(false)} />
    </>
  );
}


function StoreBody({ s, onSubmit }: { s: Store; onSubmit: () => void }) {
  return (
    <>
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[120px]">
        ❓
      </div>
      <div className="px-6 pb-2 pt-5 max-sm:px-4">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          Mascot unknown
        </div>
        <h2 className="my-1.5 font-display text-4xl font-extrabold leading-tight text-[var(--tj-red)] max-sm:text-3xl">
          TJ&apos;s {s.city}
        </h2>
        <div className="mb-1 text-base font-bold">Store #{s.store_number}</div>
        <div className="mb-4 break-words text-[13px] text-[var(--ink-soft)]">
          {s.street} · {s.city}, {s.state} {s.zip}
        </div>
        <div className="border-t-2 border-dashed border-[var(--cream-dark)] py-3.5 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          No mascot on file for this store yet. If you&apos;ve spotted one, please share!
        </div>
      </div>
      <button
        onClick={onSubmit}
        className="mx-6 mb-6 mt-3.5 block w-[calc(100%-3rem)] rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] max-sm:mx-4 max-sm:w-[calc(100%-2rem)]"
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
