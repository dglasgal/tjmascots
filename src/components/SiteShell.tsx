'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import MascotCard from './MascotCard';
import MascotParade from './MascotParade';
import SubmitModal, { type SubmitModalPreset } from './SubmitModal';
import type { Mascot, Store } from '@/lib/types';
import type { SearchResult } from '@/lib/search';
import { flushQueuedCorrections } from '@/lib/data';

// Leaflet relies on window, so the map component must be client-only.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--cream-dark)] text-sm font-semibold text-[var(--ink-soft)]">
      Loading map…
    </div>
  ),
});

interface SiteShellProps {
  mascots: Mascot[];
  stores: Store[];
  previousMascots?: Mascot[];
}

type Selection =
  | { kind: 'mascot'; data: Mascot }
  | { kind: 'store'; data: Store }
  | null;

export default function SiteShell({ mascots, stores, previousMascots = [] }: SiteShellProps) {
  // Index retired/historical mascots by store_number so each card can show
  // "Previous mascots at this store" without re-scanning.
  const previousByStore = useMemo(() => {
    const map = new Map<string, Mascot[]>();
    for (const m of previousMascots) {
      const key = m.store_number;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [previousMascots]);
  const [selection, setSelection] = useState<Selection>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPreset, setSubmitPreset] = useState<SubmitModalPreset | undefined>(undefined);
  const [paradeOpen, setParadeOpen] = useState(false);

  const mascotStoreNumbers = useMemo(
    () => new Set(mascots.map((m) => m.store_number).filter(Boolean)),
    [mascots],
  );
  const unknownCount = stores.filter((s) => !mascotStoreNumbers.has(s.store_number)).length;
  const mappedCount = stores.length - unknownCount;
  const percentMapped = stores.length > 0 ? (mappedCount / stores.length) * 100 : 0;

  // On first mount, retry any corrections that previously failed to submit
  // because the database was briefly unreachable. Runs silently in the
  // background; no-op if there's nothing queued.
  useEffect(() => {
    flushQueuedCorrections().catch((e) =>
      console.warn('[SiteShell] queue flush failed:', e),
    );
  }, []);

  function handleSearchSelect(r: SearchResult) {
    setFlyTo({ lat: r.data.lat, lng: r.data.lng, zoom: 13 });
    setTimeout(() => setSelection(r), 450);
  }

  function handleSubmitForStore(s: Store) {
    setSubmitPreset({
      store: `${s.city}, ${s.state}`,
      store_number: s.store_number,
    });
    setSubmitOpen(true);
  }

  function handleSubmitForMascot(m: Mascot) {
    const storeLabel =
      m.street && m.zip
        ? `${m.store}${m.state ? `, ${m.state}` : ''} (${m.street}, ${m.zip})`
        : `${m.store}${m.state ? `, ${m.state}` : ''}`;
    setSubmitPreset({
      store: storeLabel,
      store_number: m.store_number ?? undefined,
      animal: m.animal || '',
      name: m.name || '',
      notes: m.notes || '',
      headline: `Adding a photo or details for ${m.name || 'this mascot'}${
        m.animal ? ` the ${m.animal}` : ''
      } at ${m.store}. We'll review before updating the map.`,
    });
    setSubmitOpen(true);
  }

  function openSubmit() {
    setSubmitPreset(undefined);
    setSubmitOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        mascots={mascots}
        stores={stores}
        onSelect={handleSearchSelect}
        onSubmitClick={openSubmit}
        onProgressClick={() => setParadeOpen(true)}
        totalMascots={mascots.length}
        totalUnknown={unknownCount}
        percentMapped={percentMapped}
      />
      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company. &ldquo;Trader Joe&apos;s&rdquo; is a trademark of Trader Joe&apos;s Company.{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          Privacy
        </a>
      </div>

      <main className="relative flex min-h-0 flex-1">
        <div className="relative flex-1">
          <MapView
            mascots={mascots}
            stores={stores}
            onMascotClick={(m) => setSelection({ kind: 'mascot', data: m })}
            onStoreClick={(s) => setSelection({ kind: 'store', data: s })}
            flyTo={flyTo}
          />
          <Legend />
        </div>
        <MascotCard
          selection={selection}
          onClose={() => setSelection(null)}
          onSubmitForStore={(_city, _state, store) => handleSubmitForStore(store)}
          onSubmitForMascot={handleSubmitForMascot}
          stores={stores}
          previousByStore={previousByStore}
        />
      </main>

      <SubmitModal
        open={submitOpen}
        stores={stores}
        preset={submitPreset}
        onClose={() => setSubmitOpen(false)}
      />

      <MascotParade
        open={paradeOpen}
        onClose={() => setParadeOpen(false)}
        mascots={mascots}
        totalStores={stores.length}
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-5 left-5 z-[400] flex flex-col gap-1.5 rounded-xl bg-[rgba(253,246,236,0.96)] px-3.5 py-2.5 text-xs font-bold text-[var(--ink-soft)] shadow-card backdrop-blur max-sm:hidden">
      <LegendRow dotClass="border-[3px] border-[var(--tj-red)] bg-[var(--cream)]">
        Mascot known, photo
      </LegendRow>
      <LegendRow dotClass="border-[3px] border-dashed border-[var(--accent)] bg-[var(--cream)]">
        Mascot known, no photo yet
      </LegendRow>
      <LegendRow dotClass="!h-2.5 !w-2.5 border-2 border-[var(--accent)] bg-[var(--cream-dark)]">
        Store — mascot unknown
      </LegendRow>
    </div>
  );
}

function LegendRow({ dotClass, children }: { dotClass: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded-full ${dotClass}`} />
      {children}
    </div>
  );
}
