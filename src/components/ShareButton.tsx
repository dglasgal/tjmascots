'use client';

/**
 * Share button + popover for the mascot card on the map.
 *
 * Surfaces a row of channel-specific share links so a visitor can pass
 * a specific store's page to friends/locals. Uses the page's per-mascot
 * SEO URL (which has its own OG card + JSON-LD), so previews look
 * polished in iMessage/Twitter/Slack/etc.
 *
 * Two text variants:
 *   • hasPhoto = true  → celebratory "Meet [Name] the [Animal] at TJ ..."
 *   • hasPhoto = false → recruiting "TJ ... is missing its mascot photo,
 *                        next time you're shopping..."
 *
 * Channels:
 *   • Native share sheet (mobile-only — falls back to Copy on desktop)
 *   • Copy link
 *   • Email
 *   • Twitter / X
 *   • Facebook
 *   • Reddit (pre-fills r/traderjoes)
 *   • Threads
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SITE_URL } from '@/lib/site-url';

interface ShareButtonProps {
  /** Slug of the per-mascot SEO page, e.g. "hoppy-vista-259". The page's
   *  OG image and JSON-LD give the link a rich preview when shared.
   *  When omitted, the share URL falls back to a homepage deep-link
   *  (`/?store=NUMBER`) — used for stores with no catalog entry. */
  mascotSlug?: string;
  /** True when the mascot already has a photo (changes share text from
   *  recruiting to celebratory). */
  hasPhoto: boolean;
  /** Mascot display name. Falls back to "the mascot" when there is no
   *  catalog entry yet. */
  displayName: string;
  /** Animal label, e.g. "Hummingbird". */
  animal: string;
  /** Store city — e.g. "Vista". */
  city: string;
  /** Store number — e.g. "259". */
  storeNumber: string | null;
}

export default function ShareButton(props: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Web Share API support is browser-dependent (mostly mobile); detect
  // at mount so we can hide the native button on browsers that don't
  // have it rather than render a button that does nothing.
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const url = props.mascotSlug
    ? `${SITE_URL}/mascot/${props.mascotSlug}`
    : `${SITE_URL}/?store=${props.storeNumber ?? ''}`;
  const text = buildShareText(props);
  const subject = buildShareSubject(props);

  async function handleNativeShare() {
    try {
      await navigator.share({ title: subject, text, url });
      setOpen(false);
    } catch {
      // User canceled or share failed silently — leave the popover open
      // so they can pick another channel.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard.writeText can fail in some browsers / iframes — fall
      // back to a hidden textarea + execCommand so the copy still works.
      const ta = document.createElement('textarea');
      ta.value = `${text} ${url}`;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* swallow */ }
      document.body.removeChild(ta);
    }
  }

  // External-channel URLs. Each channel has its own quirk for how text
  // and URL get combined in the share intent.
  const enc = encodeURIComponent;
  const channels: { label: string; emoji: string; href: string }[] = [
    {
      label: 'Email',
      emoji: '📧',
      href: `mailto:?subject=${enc(subject)}&body=${enc(`${text}\n\n${url}`)}`,
    },
    {
      label: 'X (Twitter)',
      emoji: '🐦',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    },
    {
      label: 'Facebook',
      emoji: '📘',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,
    },
    {
      label: 'Reddit',
      emoji: '💬',
      href: `https://www.reddit.com/r/traderjoes/submit?title=${enc(subject)}&url=${enc(url)}`,
    },
    {
      label: 'Threads',
      emoji: '📰',
      href: `https://www.threads.net/intent/post?text=${enc(`${text} ${url}`)}`,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-[var(--ink)] shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:-translate-y-px hover:shadow-card"
        title={
          props.hasPhoto
            ? `Share ${props.displayName} with friends`
            : `Help find this mascot — share with someone local`
        }
      >
        <span aria-hidden>📤</span>
        Share this store
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 80, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 80, scale: 0.96 }}
              transition={{ type: 'spring', damping: 24, stiffness: 240 }}
              className="w-full max-w-md rounded-t-2xl bg-[var(--cream)] p-5 shadow-pop sm:rounded-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-extrabold text-[var(--tj-red)]">
                    {props.hasPhoto ? 'Share this mascot' : 'Help find this mascot'}
                  </h3>
                  <p className="mt-0.5 text-[12px] font-semibold text-[var(--ink-soft)]">
                    {props.hasPhoto
                      ? `Spread the word about ${props.displayName} the ${props.animal}.`
                      : `Send to a local friend who might be able to snap a photo.`}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex-shrink-0 rounded-full bg-[var(--cream-dark)] px-2.5 py-1 text-sm font-extrabold text-[var(--ink)]"
                >
                  ×
                </button>
              </div>

              {/* Preview of what gets shared */}
              <div className="mb-4 rounded-xl bg-[var(--cream-dark)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink)]">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                  Preview
                </div>
                <div>{text}</div>
                <div className="mt-1 break-all font-mono text-[11px] text-[var(--ink-soft)]">{url}</div>
              </div>

              {/* Big native-share button on mobile */}
              {hasNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)]"
                >
                  📱 Share via your phone
                </button>
              )}

              {/* Copy + channels grid */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <ChannelTile
                  emoji={copied ? '✅' : '📋'}
                  label={copied ? 'Copied!' : 'Copy link'}
                  onClick={handleCopy}
                />
                {channels.map((c) => (
                  <ChannelTile
                    key={c.label}
                    emoji={c.emoji}
                    label={c.label}
                    href={c.href}
                  />
                ))}
              </div>

              <p className="mt-4 text-center text-[10px] font-semibold text-[var(--ink-soft)]">
                Share opens in a new window — your link includes a rich preview card.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChannelTile({
  emoji,
  label,
  href,
  onClick,
}: {
  emoji: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    'flex flex-col items-center gap-1 rounded-xl bg-[var(--cream-dark)] px-2 py-3 text-[11px] font-extrabold text-[var(--ink)] transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card';
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span className="text-2xl" aria-hidden>{emoji}</span>
        <span className="truncate">{label}</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ----------------------- Share text builders ----------------------- */

function buildShareText(p: ShareButtonProps): string {
  const storeLabel = p.storeNumber
    ? `Trader Joe's ${p.city} (#${p.storeNumber})`
    : `Trader Joe's ${p.city}`;
  if (p.hasPhoto) {
    return `Meet ${p.displayName} the ${p.animal} at ${storeLabel}. Find every TJ mascot at tjmascots.com 🛒`;
  }
  return `${storeLabel} is missing its mascot photo on the TJ Mascots map. Next time you're shopping, look behind the bananas and snap a pic! 📷`;
}

function buildShareSubject(p: ShareButtonProps): string {
  const storeLabel = p.storeNumber
    ? `TJ ${p.city} #${p.storeNumber}`
    : `TJ ${p.city}`;
  if (p.hasPhoto) {
    return `${p.displayName} the ${p.animal} — ${storeLabel}`;
  }
  return `Help find the mascot at ${storeLabel}`;
}
