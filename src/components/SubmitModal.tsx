'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitMascot } from '@/lib/data';
import type { Store } from '@/lib/types';
import StorePicker from './StorePicker';
import { useAntiSpam } from '@/lib/anti-spam';

export interface SubmitModalPreset {
  store?: string;
  /** When known (e.g. user clicked "submit this mascot" on an existing card),
   *  the picker is locked to this store and the user can't change it. */
  store_number?: string;
  animal?: string;
  name?: string;
  notes?: string;
  /** Short banner text shown at the top of the modal. */
  headline?: string;
}

interface SubmitModalProps {
  open: boolean;
  /** All Trader Joe's stores — passed in so the picker can search across them. */
  stores: Store[];
  preset?: SubmitModalPreset;
  onClose: () => void;
}

export default function SubmitModal({ open, stores, preset, onClose }: SubmitModalProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [animal, setAnimal] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const antiSpam = useAntiSpam();

  // If the preset specifies a store_number, find that store so the picker is
  // pre-filled (and we lock it from changing).
  const lockedStore = useMemo(() => {
    if (!preset?.store_number) return null;
    return stores.find((s) => s.store_number === preset.store_number) ?? null;
  }, [stores, preset?.store_number]);

  useEffect(() => {
    if (open) {
      setSelectedStore(lockedStore);
      setAnimal(preset?.animal ?? '');
      setName(preset?.name ?? '');
      setEmail('');
      setNotes(preset?.notes ?? '');
      setPhotoFile(undefined);
      setMessage(null);
    }
  }, [open, preset, lockedStore]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!selectedStore) {
      setMessage('Please pick the exact Trader Joe\'s store.');
      return;
    }
    // Anti-spam: pretend success on bot detection so they don't realize they
    // were caught and tweak their attack. Real humans never see this branch.
    if (!antiSpam.isHuman(honeypot)) {
      setMessage("Thanks! We'll review and add it to the map if it checks out.");
      setTimeout(() => onClose(), 1800);
      return;
    }
    setBusy(true);
    setMessage(null);
    const storeLabel = `${selectedStore.city}, ${selectedStore.state} #${selectedStore.store_number} — ${selectedStore.street}`;
    const result = await submitMascot({
      store: storeLabel,
      store_number: selectedStore.store_number,
      animal,
      name,
      email,
      notes,
      photoFile,
    });
    setBusy(false);
    if (result.ok) {
      setMessage("Thanks! We'll review and add it to the map if it checks out.");
      setTimeout(() => onClose(), 1800);
    } else {
      setMessage(`Something went wrong: ${result.error}`);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(58,46,31,0.5)] p-5"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-2xl bg-[var(--cream)] p-7 shadow-card"
          >
            <h2 className="font-display text-2xl font-extrabold text-[var(--tj-red)]">
              {preset?.headline ? 'Add a photo / update info' : 'Submit a new mascot'}
            </h2>
            <p className="mb-5 mt-1 text-sm text-[var(--ink-soft)]">
              {preset?.headline ??
                "Spotted a store mascot at your local Trader Joe's? Tell us about it. We'll verify before adding to the map."}
            </p>

            <Field label="Which Trader Joe's?">
              {lockedStore ? (
                <div className="rounded-[10px] border-2 border-[var(--cream-dark)] bg-[var(--cream-dark)] px-3.5 py-2.5 text-sm font-bold text-[var(--ink)]">
                  {lockedStore.city}, {lockedStore.state}{' '}
                  <span className="text-[var(--tj-red)]">#{lockedStore.store_number}</span>
                  <div className="mt-0.5 text-[11px] font-semibold text-[var(--ink-soft)]">
                    {lockedStore.street} · {lockedStore.zip}
                  </div>
                </div>
              ) : (
                <StorePicker
                  stores={stores}
                  value={selectedStore}
                  onChange={setSelectedStore}
                />
              )}
            </Field>
            <Field label="Animal type">
              <input
                value={animal}
                onChange={(e) => setAnimal(e.target.value)}
                placeholder="e.g. Otter"
              />
            </Field>
            <Field label="Mascot name (if known)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ollie"
              />
            </Field>
            <Field label="Photo">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0])}
              />
            </Field>
            <Field label="Your email (optional, for credit)">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Notes (optional)">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any fun backstory?"
              />
            </Field>
            {/* Honeypot — hidden from humans, bots fill it = silently rejected. */}
            <input
              {...antiSpam.honeypotProps}
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />

            {message && (
              <div className="mt-3 rounded-lg bg-[var(--cream-dark)] px-3.5 py-2.5 text-sm font-semibold text-[var(--ink-soft)]">
                {message}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-full bg-[var(--cream-dark)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-[0_2px_0_#CFC0A6] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy || !selectedStore || !animal}
                className="rounded-full bg-[var(--tj-red)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Submit for review'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1 block text-[13px] font-extrabold text-[var(--ink)]">{label}</span>
      <div
        className="
          [&_input]:w-full [&_input]:rounded-[10px] [&_input]:border-2 [&_input]:border-[var(--cream-dark)] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-2.5 [&_input]:text-sm [&_input]:outline-none focus-within:[&_input]:border-[var(--tj-red)]
          [&_textarea]:w-full [&_textarea]:rounded-[10px] [&_textarea]:border-2 [&_textarea]:border-[var(--cream-dark)] [&_textarea]:bg-white [&_textarea]:px-3.5 [&_textarea]:py-2.5 [&_textarea]:text-sm [&_textarea]:outline-none focus-within:[&_textarea]:border-[var(--tj-red)]
        "
      >
        {children}
      </div>
    </label>
  );
}
