'use client';

/**
 * Admin moderation dashboard.
 *
 * Login: paste your Supabase service_role key (starts with sb_secret_*).
 * The key is stored in localStorage so subsequent visits skip the login.
 *
 * The UI shows two tabs of pending items:
 *   • Submissions — new mascots users want to add
 *   • Corrections — reports of incorrect info on existing mascots
 *
 * For each submission, you can Approve (moves photo to public bucket,
 * generates JSON to paste into mascots.json) or Reject (deletes photo).
 *
 * For each correction, you can mark Resolved (you applied the fix) or
 * Dismissed (not actually a bug).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  approveSubmission,
  clearAdminKey,
  getAdminClient,
  getAdminKey,
  listPendingCorrections,
  listPendingMessages,
  listPendingSubmissions,
  rejectSubmission,
  setAdminKey,
  setCorrectionStatus,
  setMessageStatus,
  signedSubmissionUrl,
  verifyAdminKey,
  type PendingCorrection,
  type PendingMessage,
  type PendingSubmission,
} from '@/lib/admin';
import storesData from '@/data/tj-stores.json';
import mascotsRaw from '@/data/mascots.json';
import type { Store } from '@/lib/types';

const stores = storesData as Store[];
const storesByNum = new Map(stores.map((s) => [s.store_number, s]));
const allMascots = (mascotsRaw as { mascots: { id: number }[] }).mascots;
const NEXT_MASCOT_ID = Math.max(...allMascots.map((m) => m.id)) + 1;

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthed(Boolean(getAdminKey()));
    setLoading(false);
  }, []);

  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;
  return <Dashboard onSignOut={() => { clearAdminKey(); setAuthed(false); }} />;
}

/* ------------------------------ Login ------------------------------ */

function Login({ onAuthed }: { onAuthed: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const result = await verifyAdminKey(key.trim());
    setBusy(false);
    if (result.ok) {
      setAdminKey(key.trim());
      onAuthed();
    } else {
      setErr(result.error ?? 'Invalid key.');
    }
  }

  return (
    <FullScreen>
      <div className="max-w-md rounded-2xl bg-[var(--cream)] p-7 shadow-card">
        <h1 className="font-display text-3xl font-extrabold text-[var(--tj-red)]">Admin</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Paste your Supabase <strong>service_role</strong> key (starts with
          {' '}<code className="rounded bg-[var(--cream-dark)] px-1.5 py-0.5 text-[12px]">sb_secret_</code>).
          Stored in this browser only — never sent to GitHub or our servers.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="sb_secret_..."
          className="mt-4 w-full rounded-[10px] border-2 border-[var(--cream-dark)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--tj-red)]"
        />
        {err && (
          <div className="mt-3 rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-sm font-bold text-[var(--tj-red)]">
            {err}
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !key.trim()}
          className="mt-4 w-full rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Sign in'}
        </button>
        <Link
          href="/"
          className="mt-4 block text-center text-xs font-bold text-[var(--ink-soft)] underline-offset-2 hover:underline"
        >
          ← Back to map
        </Link>
      </div>
    </FullScreen>
  );
}

/* --------------------------- Dashboard ----------------------------- */

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<'submissions' | 'corrections' | 'messages'>('submissions');
  const [subs, setSubs] = useState<PendingSubmission[]>([]);
  const [corrs, setCorrs] = useState<PendingCorrection[]>([]);
  const [msgs, setMsgs] = useState<PendingMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nextId, setNextId] = useState(NEXT_MASCOT_ID);

  // Auto-logout after 30 minutes of inactivity. Listens for mouse/keyboard
  // events; resets the timer on each. If the timer fires, clears the admin
  // key and kicks back to the login screen.
  useEffect(() => {
    const IDLE_MS = 30 * 60 * 1000; // 30 min
    let lastActivity = Date.now();
    function bump() { lastActivity = Date.now(); }
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, bump, { passive: true }));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > IDLE_MS) {
        onSignOut();
      }
    }, 60_000); // check once per minute
    return () => {
      events.forEach((e) => document.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [onSignOut]);

  async function refresh() {
    setBusy(true);
    setErr(null);
    const sb = getAdminClient();
    if (!sb) { setBusy(false); setErr('No admin key.'); return; }
    try {
      const [s, c, m] = await Promise.all([
        listPendingSubmissions(sb),
        listPendingCorrections(sb),
        // The messages table is new — if the migration hasn't been run yet,
        // this call would 404. Catch and fall back to an empty list so the
        // dashboard still renders the existing tabs.
        listPendingMessages(sb).catch((e) => {
          console.warn('[admin] listPendingMessages failed (run migration?):', e);
          return [] as PendingMessage[];
        }),
      ]);
      setSubs(s);
      setCorrs(c);
      setMsgs(m);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }

  return (
    <div className="min-h-screen bg-[var(--cream-dark)]/40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cream)] text-xl"
          >
            🛒
          </Link>
          <div>
            <h1 className="font-display text-xl font-extrabold leading-none">Admin</h1>
            <div className="mt-0.5 text-[11px] font-bold opacity-80">
              {subs.length} submissions · {corrs.length} corrections · {msgs.length} messages pending
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={busy}
            className="rounded-full bg-[var(--cream)] px-4 py-2 text-xs font-extrabold text-[var(--tj-red)] disabled:opacity-50"
          >
            {busy ? 'Loading…' : '🔄 Refresh'}
          </button>
          <button
            onClick={onSignOut}
            className="rounded-full border-2 border-[var(--cream)] px-4 py-2 text-xs font-extrabold text-[var(--cream)]"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 border-b-2 border-[var(--cream-dark)] bg-[var(--cream)] px-6 py-2">
        <TabButton active={tab === 'submissions'} onClick={() => setTab('submissions')}>
          Submissions ({subs.length})
        </TabButton>
        <TabButton active={tab === 'corrections'} onClick={() => setTab('corrections')}>
          Corrections ({corrs.length})
        </TabButton>
        <TabButton active={tab === 'messages'} onClick={() => setTab('messages')}>
          Messages ({msgs.length})
        </TabButton>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {err && (
          <div className="mb-4 rounded-xl bg-[var(--tj-red)]/10 px-4 py-3 text-sm font-bold text-[var(--tj-red)]">
            {err}
          </div>
        )}

        {tab === 'submissions' && (
          <div className="space-y-4">
            {subs.length === 0 && !busy && (
              <Empty text="No pending submissions. 🎉" />
            )}
            {subs.map((s) => (
              <SubmissionCard
                key={s.id}
                sub={s}
                nextMascotId={nextId}
                onApproved={() => { setNextId((n) => n + 1); refresh(); flash('Approved. Copy the snippet into mascots.json.'); }}
                onRejected={() => { refresh(); flash('Rejected.'); }}
              />
            ))}
          </div>
        )}

        {tab === 'corrections' && (
          <div className="space-y-4">
            {corrs.length === 0 && !busy && (
              <Empty text="No pending corrections. 🎉" />
            )}
            {corrs.map((c) => (
              <CorrectionCard
                key={c.id}
                correction={c}
                onResolved={() => { refresh(); flash('Marked resolved.'); }}
                onDismissed={() => { refresh(); flash('Dismissed.'); }}
              />
            ))}
          </div>
        )}

        {tab === 'messages' && (
          <div className="space-y-4">
            {msgs.length === 0 && !busy && (
              <Empty text="No pending messages. 🎉" />
            )}
            {msgs.map((m) => (
              <MessageCard
                key={m.id}
                msg={m}
                onResolved={() => { refresh(); flash('Marked resolved.'); }}
                onDismissed={() => { refresh(); flash('Dismissed.'); }}
              />
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--cream)] shadow-pop">
          {toast}
        </div>
      )}
    </div>
  );
}

/* -------------------------- Submission card ------------------------ */

function SubmissionCard({
  sub,
  nextMascotId,
  onApproved,
  onRejected,
}: {
  sub: PendingSubmission;
  nextMascotId: number;
  onApproved: () => void;
  onRejected: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const storeMatch = sub.store_number ? storesByNum.get(sub.store_number) : undefined;

  useEffect(() => {
    if (!sub.photo_path) return;
    const sb = getAdminClient();
    if (!sb) return;
    signedSubmissionUrl(sb, sub.photo_path).then(setPhotoUrl);
  }, [sub.photo_path]);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      const sb = getAdminClient();
      if (!sb) throw new Error('Lost admin key.');
      const { jsonSnippet } = await approveSubmission(sb, sub, nextMascotId, storeMatch);
      setSnippet(JSON.stringify(jsonSnippet, null, 2));
      onApproved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function reject() {
    if (!confirm('Reject this submission? The uploaded photo will be deleted.')) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = getAdminClient();
      if (!sb) throw new Error('Lost admin key.');
      await rejectSubmission(sb, sub, 'rejected via admin UI');
      onRejected();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--cream)] shadow-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        {photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt=""
            className="h-44 w-full flex-shrink-0 rounded-xl bg-[var(--cream-dark)] object-contain sm:w-44"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
            {sub.animal} · {timeAgo(sub.created_at)}
          </div>
          <h3 className="font-display text-2xl font-extrabold leading-tight text-[var(--tj-red)]">
            {sub.name || <span className="opacity-60 italic">Unnamed</span>}
          </h3>
          <div className="mt-1 text-sm font-bold">
            {storeMatch ? (
              <>
                {storeMatch.city}, {storeMatch.state}{' '}
                <span className="rounded-full bg-[var(--tj-red)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
                  Store #{storeMatch.store_number}
                </span>
                <div className="text-[12px] font-semibold text-[var(--ink-soft)]">
                  {storeMatch.street} · {storeMatch.zip}
                </div>
              </>
            ) : (
              <span className="text-[var(--tj-red)]">⚠ Free-text store: {sub.store}</span>
            )}
          </div>
          {sub.notes && (
            <div className="mt-2 text-sm text-[var(--ink-soft)]">&ldquo;{sub.notes}&rdquo;</div>
          )}
          {sub.email && (
            <div className="mt-2 text-[12px] font-semibold text-[var(--ink-soft)]">
              Submitted by: {sub.email}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={approve}
              disabled={busy}
              className="rounded-full bg-[var(--tj-red)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--cream)] disabled:opacity-50"
            >
              ✓ Approve as #{nextMascotId}
            </button>
            <button
              onClick={reject}
              disabled={busy}
              className="rounded-full border-2 border-[var(--ink-soft)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)] disabled:opacity-50"
            >
              ✗ Reject
            </button>
          </div>
          {err && (
            <div className="mt-3 rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-xs font-bold text-[var(--tj-red)]">
              {err}
            </div>
          )}
        </div>
      </div>
      {snippet && (
        <div className="border-t-2 border-[var(--cream-dark)] bg-[var(--cream-dark)]/50 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <strong className="font-display text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
              Paste this into <code>mascots.json</code> &rarr; mascots[]
            </strong>
            <button
              onClick={() => navigator.clipboard.writeText(snippet)}
              className="rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)]"
            >
              📋 Copy
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[var(--ink)] p-3 text-[11px] leading-snug text-[var(--cream)]">
            {snippet}
          </pre>
          <p className="mt-2 text-[11px] font-semibold text-[var(--ink-soft)]">
            Photo has been moved to the public mascot-photos bucket. Add this
            object to <code>mascots.json</code>, push to GitHub, and DigitalOcean
            will redeploy.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Correction card ------------------------ */

function CorrectionCard({
  correction,
  onResolved,
  onDismissed,
}: {
  correction: PendingCorrection;
  onResolved: () => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const correctedStore = correction.corrected_store_number
    ? storesByNum.get(correction.corrected_store_number)
    : null;

  async function setStatus(status: 'resolved' | 'dismissed', notes?: string) {
    setBusy(true);
    setErr(null);
    try {
      const sb = getAdminClient();
      if (!sb) throw new Error('Lost admin key.');
      await setCorrectionStatus(sb, correction, status, notes);
      if (status === 'resolved') onResolved();
      else onDismissed();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl bg-[var(--cream)] p-5 shadow-card">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
        Correction · {timeAgo(correction.created_at)}
      </div>
      <h3 className="font-display text-xl font-extrabold leading-tight text-[var(--tj-red)]">
        {correction.mascot_name || `Mascot #${correction.mascot_id}`}
      </h3>
      <div className="text-sm text-[var(--ink-soft)]">{correction.store}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {correction.issues.map((i) => (
          <span
            key={i}
            className="rounded-full bg-[var(--tj-red)]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tj-red)]"
          >
            {i}
          </span>
        ))}
      </div>
      {correction.details && (
        <div className="mt-3 rounded-lg bg-[var(--cream-dark)] px-3.5 py-2.5 text-sm">
          &ldquo;{correction.details}&rdquo;
        </div>
      )}
      {correctedStore && (
        <div className="mt-3 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-3.5 py-2.5 text-sm">
          <strong>Suggested store:</strong> {correctedStore.city}, {correctedStore.state} #{correctedStore.store_number} ({correctedStore.street})
        </div>
      )}
      {correction.reporter_email && (
        <div className="mt-2 text-[12px] font-semibold text-[var(--ink-soft)]">
          Reported by: {correction.reporter_email}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setStatus('resolved', 'fixed via admin UI')}
          disabled={busy}
          className="rounded-full bg-[var(--tj-red)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--cream)] disabled:opacity-50"
        >
          ✓ Mark resolved
        </button>
        <button
          onClick={() => setStatus('dismissed', 'dismissed via admin UI')}
          disabled={busy}
          className="rounded-full border-2 border-[var(--ink-soft)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)] disabled:opacity-50"
        >
          ✗ Dismiss
        </button>
      </div>
      {err && (
        <div className="mt-3 rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-xs font-bold text-[var(--tj-red)]">
          {err}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Message card -------------------------- */

function MessageCard({
  msg,
  onResolved,
  onDismissed,
}: {
  msg: PendingMessage;
  onResolved: () => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setStatus(status: 'resolved' | 'dismissed', notes?: string) {
    setBusy(true);
    setErr(null);
    try {
      const sb = getAdminClient();
      if (!sb) throw new Error('Lost admin key.');
      await setMessageStatus(sb, msg, status, notes);
      if (status === 'resolved') onResolved();
      else onDismissed();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl bg-[var(--cream)] p-5 shadow-card">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
        Contact message · {timeAgo(msg.created_at)}
      </div>
      <h3 className="mt-1 font-display text-base font-extrabold leading-tight text-[var(--tj-red)]">
        {msg.reply_to ? (
          <a
            href={`mailto:${msg.reply_to}?subject=Re%3A%20your%20TJ%20Mascots%20message`}
            className="underline decoration-[var(--tj-red)]/30 underline-offset-4 hover:decoration-[var(--tj-red)]"
          >
            {msg.reply_to}
          </a>
        ) : (
          <span className="italic text-[var(--ink-soft)]">Anonymous (no reply-to)</span>
        )}
      </h3>
      <blockquote className="mt-3 whitespace-pre-wrap rounded-lg border-l-4 border-[var(--tj-red)] bg-[var(--cream-dark)] px-3.5 py-2.5 font-serif text-[15px] leading-relaxed text-[var(--ink)]">
        {msg.message}
      </blockquote>
      <div className="mt-3 flex flex-wrap gap-2">
        {msg.reply_to && (
          <a
            href={`mailto:${msg.reply_to}?subject=Re%3A%20your%20TJ%20Mascots%20message`}
            className="rounded-full bg-[var(--tj-red)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--cream)]"
          >
            ✉️ Reply
          </a>
        )}
        <button
          onClick={() => setStatus('resolved', 'handled via admin UI')}
          disabled={busy}
          className="rounded-full border-2 border-[var(--tj-red)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--tj-red)] disabled:opacity-50"
        >
          ✓ Mark resolved
        </button>
        <button
          onClick={() => setStatus('dismissed', 'dismissed via admin UI')}
          disabled={busy}
          className="rounded-full border-2 border-[var(--ink-soft)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)] disabled:opacity-50"
        >
          ✗ Dismiss
        </button>
      </div>
      {err && (
        <div className="mt-3 rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-xs font-bold text-[var(--tj-red)]">
          {err}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Small helpers --------------------------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-extrabold transition ${
        active
          ? 'bg-[var(--tj-red)] text-[var(--cream)]'
          : 'text-[var(--ink-soft)] hover:bg-[var(--cream-dark)]'
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[var(--cream)] py-16 text-center text-[var(--ink-soft)]">
      <p className="font-display text-lg font-bold">{text}</p>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream-dark)] p-5">
      {children}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
