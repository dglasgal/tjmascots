'use client';

/**
 * Admin moderation dashboard.
 *
 * Login: paste your Supabase service_role key (starts with sb_secret_*).
 * The key is stored in localStorage so subsequent visits skip the login.
 *
 * Auto-publish: paste your GitHub Personal Access Token in the Settings
 * panel. With it set, clicking Approve commits the photo + JSON straight
 * to the repo — no manual git, no JSON snippet to paste.
 *
 * The UI shows three tabs of pending items:
 *   • Submissions — new mascots users want to add
 *   • Corrections — reports of incorrect info on existing mascots
 *   • Messages    — contact-form messages
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
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
import {
  clearGithubPat,
  getGithubPat,
  setGithubPat,
  verifyGithubPat,
} from '@/lib/github';
import { publishApproval, type PublishResult } from '@/lib/auto-publish';
import storesData from '@/data/tj-stores.json';
import type { Store } from '@/lib/types';
import MallardHead from '@/components/MallardHead';

const stores = storesData as Store[];
const storesByNum = new Map(stores.map((s) => [s.store_number, s]));

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
  const [showSettings, setShowSettings] = useState(false);
  const [hasPat, setHasPat] = useState(false);

  // Refresh PAT status whenever settings panel closes (user may have just
  // pasted/verified one).
  useEffect(() => {
    setHasPat(Boolean(getGithubPat()));
  }, [showSettings]);

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
    setTimeout(() => setToast(null), 5500);
  }

  return (
    <div className="min-h-screen bg-[var(--cream-dark)]/40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cream)] text-xl"
          >
            <MallardHead className="h-7 w-7" />
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
            onClick={() => setShowSettings(true)}
            className="rounded-full bg-[var(--cream)] px-3 py-2 text-xs font-extrabold text-[var(--tj-red)]"
            title="Settings"
          >
            ⚙️ Settings
          </button>
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

      {/* Auto-publish status banner */}
      {!hasPat && (
        <div className="border-b-2 border-[var(--tj-red)]/20 bg-[var(--tj-red)]/10 px-6 py-2.5 text-center text-[12px] font-bold text-[var(--tj-red)]">
          Auto-publish is OFF. Approving will only generate a JSON snippet.{' '}
          <button
            onClick={() => setShowSettings(true)}
            className="underline underline-offset-2 hover:no-underline"
          >
            Add your GitHub token in Settings →
          </button>
        </div>
      )}
      {hasPat && (
        <div className="border-b-2 border-green-200 bg-green-50 px-6 py-1.5 text-center text-[11px] font-bold text-green-800">
          ✓ Auto-publish ON — Approve will commit photo + JSON to GitHub directly.
        </div>
      )}

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
                onPublished={(result) => {
                  refresh();
                  flash(
                    result.mode === 'merged'
                      ? `Photo for #${result.mascotId} merged into existing entry. Live in ~3 min.`
                      : `Mascot #${result.mascotId} added. Live in ~3 min.`,
                  );
                }}
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

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/* -------------------------- Settings panel ------------------------ */

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [pat, setPat] = useState(() => getGithubPat() ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(null);
    const trimmed = pat.trim();
    if (!trimmed) {
      clearGithubPat();
      setOk('Token cleared.');
      setBusy(false);
      return;
    }
    const result = await verifyGithubPat(trimmed);
    if (!result.ok) {
      setErr(result.error ?? 'Token verification failed.');
      setBusy(false);
      return;
    }
    setGithubPat(trimmed);
    setOk('Token saved and verified — auto-publish is now ON.');
    setBusy(false);
  }

  function remove() {
    if (!confirm('Remove the GitHub token? Approve will fall back to manual JSON-snippet mode.')) return;
    clearGithubPat();
    setPat('');
    setOk('Token removed.');
    setErr(null);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--cream)] p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold text-[var(--tj-red)]">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--cream-dark)] px-3 py-1 text-xs font-extrabold text-[var(--ink)]"
          >
            Close
          </button>
        </div>

        <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--ink)]">
          GitHub Personal Access Token
        </h3>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Paste a fine-grained PAT with{' '}
          <code className="rounded bg-[var(--cream-dark)] px-1 py-0.5">Contents: Read &amp; write</code>
          {' '}on the <code>dglasgal/tjmascots</code> repo. Stored in this
          browser only. With it set, the Approve button commits photo + JSON
          to GitHub for you. DigitalOcean redeploys automatically (~3 min).
        </p>

        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="github_pat_..."
          className="mt-3 w-full rounded-[10px] border-2 border-[var(--cream-dark)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--tj-red)]"
        />

        {err && (
          <div className="mt-3 rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-xs font-bold text-[var(--tj-red)]">
            {err}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
            {ok}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-full bg-[var(--tj-red)] px-4 py-2 text-xs font-extrabold text-[var(--cream)] disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Save & verify'}
          </button>
          {getGithubPat() && (
            <button
              onClick={remove}
              className="rounded-full border-2 border-[var(--ink-soft)] px-4 py-2 text-xs font-extrabold text-[var(--ink-soft)]"
            >
              Remove token
            </button>
          )}
        </div>

        <p className="mt-4 text-[11px] text-[var(--ink-soft)]">
          Need a token?{' '}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-2 hover:no-underline"
          >
            Create one on GitHub →
          </a>
        </p>
      </div>
    </div>
  );
}

/* -------------------------- Submission card ------------------------ */

function SubmissionCard({
  sub,
  onPublished,
  onRejected,
}: {
  sub: PendingSubmission;
  onPublished: (result: PublishResult) => void;
  onRejected: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
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
      const pat = getGithubPat();
      if (!pat) {
        throw new Error(
          'No GitHub token. Open Settings (⚙️) and paste your token first.',
        );
      }
      const res = await publishApproval({
        pat,
        sb,
        submission: sub,
        storeMatch: storeMatch
          ? {
              city: storeMatch.city,
              state: storeMatch.state,
              store_number: storeMatch.store_number,
            }
          : null,
      });
      setResult(res);
      onPublished(res);
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
          <PhotoLocationBadge sub={sub} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={approve}
              disabled={busy || Boolean(result)}
              className="rounded-full bg-[var(--tj-red)] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--cream)] disabled:opacity-50"
            >
              {busy ? '⏳ Publishing…' : '✓ Approve & Publish'}
            </button>
            <button
              onClick={reject}
              disabled={busy || Boolean(result)}
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
      {result && <PublishedBanner result={result} />}
    </div>
  );
}

/** Inline confirmation block shown after a successful publish. */
function PublishedBanner({ result }: { result: PublishResult }) {
  const shortSha = result.jsonCommitSha.slice(0, 7);
  return (
    <div className="border-t-2 border-green-200 bg-green-50 px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 font-bold text-green-800">
        ✓ Published as mascot #{result.mascotId}{' '}
        <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] uppercase tracking-wider">
          {result.mode === 'merged' ? 'merged into existing' : 'new entry'}
        </span>
        <a
          href={`https://github.com/dglasgal/tjmascots/commit/${result.jsonCommitSha}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-green-900 underline underline-offset-2 hover:no-underline"
        >
          {shortSha}
        </a>
      </div>
      <p className="mt-1 text-[12px] font-semibold text-green-900/80">
        DigitalOcean is rebuilding now. The mascot will be live on the site
        in ~3 min.
      </p>
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

/* ----------------------- Photo location badge ---------------------- */

/** Small chip rendered on each submission card showing whether the
 *  photo's EXIF GPS coordinates match the store the submitter picked.
 *  Pure visual aid for the moderator — never used to auto-approve. */
function PhotoLocationBadge({ sub }: { sub: PendingSubmission }) {
  // No photo or no GPS analysis ever happened (e.g. submission predates
  // the EXIF feature, or photo was missing) → skip the badge entirely.
  if (!sub.photo_path || !sub.photo_location_status) return null;

  let dist = sub.photo_distance_m;
  let lat = sub.photo_lat;
  let lng = sub.photo_lng;
  let status = sub.photo_location_status;

  // Defensive override: some phones/apps wrote (0, 0) into EXIF as a
  // placeholder, which makes the photo look like a "mismatch" ~7,800 mi
  // from any TJ store. Re-classify near-zero coords as no_gps so the
  // badge shows "No location data" instead of a misleading distance.
  if (
    lat != null &&
    lng != null &&
    Math.abs(lat) < 0.0005 &&
    Math.abs(lng) < 0.0005
  ) {
    status = 'no_gps';
    lat = null;
    lng = null;
    dist = null;
  }
  // Build a clickable Google Maps link to the photo's location, when known
  const mapsHref =
    lat != null && lng != null
      ? `https://maps.google.com/?q=${lat},${lng}`
      : null;

  if (status === 'match') {
    return (
      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-extrabold text-green-800">
        ✓ Photo location matches store
        {dist != null && <span className="font-bold opacity-70">({dist} m away)</span>}
      </div>
    );
  }
  if (status === 'mismatch') {
    return (
      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold text-red-800">
        ✗ Photo location is{' '}
        {dist != null ? formatDistanceMeters(dist) : 'far'} from the store
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            (open in Maps)
          </a>
        )}
      </div>
    );
  }
  // no_gps and error look the same to the moderator
  return (
    <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--cream-dark)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-soft)]">
      ⚠ No location data in this photo
    </div>
  );
}

/** Pretty-print a distance in meters: "230 m", "1.4 km", "47 mi". */
function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  if (km < 50) return `${km.toFixed(1)} km`;
  const mi = km * 0.621371;
  return `${mi.toFixed(0)} mi`;
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
