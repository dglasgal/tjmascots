'use client';

/**
 * ContactForm — embedded on the privacy page.
 *
 * Lets visitors send a free-form message (takedown request, privacy
 * question, anything else) without exposing the admin's email on the
 * public site. Posts to the Supabase `messages` table; the existing
 * Resend trigger fires an email to the admin within seconds.
 *
 * Anti-spam: reuses the shared honeypot + minimum-time check.
 *
 * Reply-to email is optional — if provided and looking-like-an-email,
 * the alert email's reply-to header is set to it so the admin can
 * respond directly from their mail client.
 */

import { useState } from 'react';
import { submitContactMessage } from '@/lib/data';
import { useAntiSpam } from '@/lib/anti-spam';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactForm() {
  const { honeypotProps, isHuman } = useAntiSpam();
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'ok' }
    | { kind: 'err'; msg: string }
  >({ kind: 'idle' });

  const messageLen = message.trim().length;
  const replyToOk = !replyTo || EMAIL_RE.test(replyTo.trim());
  const canSubmit = messageLen >= 10 && replyToOk && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!isHuman(honeypot)) {
      // Silently swallow — don't tell the bot why.
      setStatus({ kind: 'ok' });
      return;
    }
    setBusy(true);
    const result = await submitContactMessage({
      message: message.trim(),
      reply_to: replyTo.trim() || undefined,
    });
    setBusy(false);
    if (result.ok) {
      setStatus({ kind: 'ok' });
      setMessage('');
      setReplyTo('');
    } else {
      setStatus({ kind: 'err', msg: result.error });
    }
  }

  if (status.kind === 'ok') {
    return (
      <div className="rounded-2xl bg-[var(--cream)] px-5 py-6 text-center">
        <div className="text-3xl">✉️ ✓</div>
        <p className="mt-3 text-base font-bold text-[var(--ink)]">
          Got it — thanks for reaching out.
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          The human admin has been notified and will respond
          {replyTo ? ' to your email' : ''} as soon as they can — usually the
          same day.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="mt-4 rounded-full border-2 border-[var(--cream-dark)] px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)] transition hover:border-[var(--tj-red)] hover:text-[var(--tj-red)]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Honeypot — hidden from humans, irresistible to bots. */}
      <input
        {...honeypotProps}
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
          Message <span className="text-[var(--tj-red)]">*</span>
        </span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          placeholder="Takedown request, privacy question, feedback…"
          className="w-full resize-y rounded-xl border-2 border-[var(--cream)] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--ink)] outline-none transition focus:border-[var(--tj-red)]"
        />
        <div className="mt-1 text-right text-[11px] font-semibold text-[var(--ink-soft)]">
          {messageLen < 10 ? `${10 - messageLen} more characters needed` : `${message.length}/5000`}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
          Your email <span className="font-normal normal-case text-[var(--ink-soft)]">(optional — only if you want a reply)</span>
        </span>
        <input
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={`w-full rounded-xl border-2 ${
            !replyToOk ? 'border-[var(--tj-red)]' : 'border-[var(--cream)]'
          } bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--tj-red)]`}
        />
        {!replyToOk && (
          <div className="mt-1 text-[11px] font-bold text-[var(--tj-red)]">
            That doesn&apos;t look like an email address.
          </div>
        )}
      </label>

      {status.kind === 'err' && (
        <div className="rounded-lg bg-[var(--tj-red)]/10 px-3 py-2 text-sm font-bold text-[var(--tj-red)]">
          Couldn&apos;t send: {status.msg}. Try again in a moment.
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_0_var(--tj-red-dark)]"
      >
        {busy ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-center text-[11px] font-semibold italic text-[var(--ink-soft)]">
        Your message goes straight to the human admin&apos;s inbox. We never
        sell or share contact details.
      </p>
    </form>
  );
}
