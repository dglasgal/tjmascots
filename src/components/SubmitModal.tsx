'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitMascot } from '@/lib/data';

interface SubmitModalProps {
  open: boolean;
  presetStore?: string;
  onClose: () => void;
}

export default function SubmitModal({ open, presetStore, onClose }: SubmitModalProps) {
  const [store, setStore] = useState('');
  const [animal, setAnimal] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStore(presetStore || '');
      setAnimal('');
      setName('');
      setEmail('');
      setNotes('');
      setPhotoFile(undefined);
      setMessage(null);
    }
  }, [open, presetStore]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSubmit() {
    setBusy(true);
    setMessage(null);
    const result = await submitMascot({ store, animal, name, email, notes, photoFile });
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
              Submit a new mascot
            </h2>
            <p className="mb-5 mt-1 text-sm text-[var(--ink-soft)]">
              Spotted a plush at your local Trader Joe&apos;s? Tell us about it. We&apos;ll verify
              before adding to the map.
            </p>

            <Field label="Store location (city + state)">
              <input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="e.g. Berkeley, CA"
              />
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
                disabled={busy || !store || !animal}
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
