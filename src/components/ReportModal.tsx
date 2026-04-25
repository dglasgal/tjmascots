'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitCorrection } from '@/lib/data';
import type { Mascot, Store } from '@/lib/types';
import StorePicker from './StorePicker';

interface ReportModalProps {
  open: boolean;
  mascot: Mascot | null;
  /** All TJ stores — needed for the "store is wrong" picker. */
  stores: Store[];
  onClose: () => void;
}

const ISSUE_OPTIONS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name is wrong' },
  { key: 'animal', label: 'Animal type is wrong' },
  { key: 'store', label: 'Store / location is wrong' },
  { key: 'photo', label: 'Photo is wrong or bad quality' },
  { key: 'retired', label: 'This mascot has been retired' },
  { key: 'other', label: 'Something else' },
];

export default function ReportModal({ open, mascot, stores, onClose }: ReportModalProps) {
  const [issues, setIssues] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [correctedStore, setCorrectedStore] = useState<Store | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIssues([]);
      setDetails('');
      setEmail('');
      setCorrectedStore(null);
      setMessage(null);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function toggleIssue(key: string) {
    setIssues((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit() {
    if (!mascot) return;
    setBusy(true);
    setMessage(null);
    const result = await submitCorrection({
      mascot_id: mascot.id,
      mascot_name: `${mascot.name || 'Unnamed'} the ${mascot.animal || 'mascot'}`,
      store: `${mascot.store}${mascot.state ? `, ${mascot.state}` : ''}`,
      issues,
      details: details.trim(),
      reporter_email: email.trim(),
      corrected_store_number: correctedStore?.store_number,
    });
    setBusy(false);
    if (result.ok) {
      if ('queued' in result && result.queued) {
        setMessage(
          "Saved! We couldn't reach the server right now, so your report is held on this device and will submit automatically next time the site is up.",
        );
        setTimeout(() => onClose(), 3200);
      } else {
        setMessage("Thanks! We'll review your report and update the record.");
        setTimeout(() => onClose(), 1800);
      }
    } else {
      setMessage(`Something went wrong: ${result.error}`);
    }
  }

  const canSubmit = issues.length > 0 || details.trim().length > 0;

  return (
    <AnimatePresence>
      {open && mascot && (
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
            className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-[var(--cream)] p-7 shadow-card"
          >
            <h2 className="font-display text-2xl font-extrabold text-[var(--tj-red)]">
              Report a correction
            </h2>
            <p className="mb-1 mt-1 text-sm text-[var(--ink-soft)]">
              Something off with{' '}
              <strong className="text-[var(--ink)]">
                {mascot.name || 'this mascot'} the {mascot.animal}
              </strong>
              ? Tell us what&apos;s wrong and we&apos;ll fix it.
            </p>
            <p className="mb-5 text-xs text-[var(--ink-soft)]">
              Reports go to a private queue — no email is sent.
            </p>

            <div className="mb-4">
              <span className="mb-2 block text-[13px] font-extrabold text-[var(--ink)]">
                What&apos;s wrong? (pick any that apply)
              </span>
              <div className="flex flex-col gap-1.5">
                {ISSUE_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-sm transition ${
                      issues.includes(opt.key)
                        ? 'border-[var(--tj-red)] bg-[var(--cream-dark)] font-bold text-[var(--ink)]'
                        : 'border-[var(--cream-dark)] bg-white text-[var(--ink-soft)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={issues.includes(opt.key)}
                      onChange={() => toggleIssue(opt.key)}
                      className="h-4 w-4 accent-[var(--tj-red)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {issues.includes('store') && (
              <div className="mb-3.5">
                <span className="mb-1 block text-[13px] font-extrabold text-[var(--ink)]">
                  Which store is this mascot actually at?
                </span>
                <StorePicker
                  stores={stores}
                  value={correctedStore}
                  onChange={setCorrectedStore}
                />
              </div>
            )}

            <label className="mb-3.5 block">
              <span className="mb-1 block text-[13px] font-extrabold text-[var(--ink)]">
                What should it say instead? (optional)
              </span>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. The correct name is Quincy, not Quackers."
                className="w-full rounded-[10px] border-2 border-[var(--cream-dark)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--tj-red)]"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-[13px] font-extrabold text-[var(--ink)]">
                Your email (optional, only if you&apos;re OK with a follow-up)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[10px] border-2 border-[var(--cream-dark)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--tj-red)]"
              />
            </label>

            {message && (
              <div className="mt-2 rounded-lg bg-[var(--cream-dark)] px-3.5 py-2.5 text-sm font-semibold text-[var(--ink-soft)]">
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
                disabled={busy || !canSubmit}
                className="rounded-full bg-[var(--tj-red)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
