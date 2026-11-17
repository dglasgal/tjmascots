'use client';

/**
 * "Share your find" — the inline share section on each mascot page
 * (/mascot/[slug]). Added 2026-11-16 so spotters (and anyone else) can
 * pass a mascot's page around, which brings visitors and links.
 *
 * Reuses the link/channel builders from ShareButton.tsx so the map-card
 * popover and this section always share the same URL and text.
 */
import { buildShareTargets, ChannelTile, useShareActions, type ShareProps } from './ShareButton';

interface ShareYourFindProps extends ShareProps {
  /** Who gets the photo credit (`submitted_by`), if anyone. */
  spottedBy?: string | null;
}

export default function ShareYourFind({ spottedBy, ...props }: ShareYourFindProps) {
  const targets = buildShareTargets(props);
  const { copied, hasNativeShare, nativeShare, copy } = useShareActions(targets);
  const name = props.displayName;

  const heading = !props.hasPhoto
    ? `Help ${name} get their close-up`
    : spottedBy
      ? `📸 Spotted by ${spottedBy} · Share this find`
      : `Share ${name} with the world`;
  const blurb = !props.hasPhoto
    ? `Nobody has snapped ${name} yet. Send this to a friend who shops at this store — maybe they'll be the one to find them.`
    : spottedBy
      ? `${name} doesn't get out much (they're on shift all day). Show them off to friends, family, and fellow Trader Joe's regulars.`
      : `Know someone who shops here? Send them ${name}'s page so they know who to look for next time.`;

  return (
    <section
      aria-labelledby="share-your-find"
      className="mt-10 rounded-3xl border-2 border-dashed border-[var(--accent)] bg-[var(--cream)] px-5 py-7 text-center sm:px-8"
    >
      <div className="text-4xl" aria-hidden>
        📸
      </div>
      <h3
        id="share-your-find"
        className="mt-2 font-display text-2xl font-extrabold leading-tight text-[var(--tj-red)] sm:text-3xl"
      >
        {heading}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[var(--ink-soft)]">{blurb}</p>

      {hasNativeShare && (
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="mx-auto mt-5 flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--tj-red)] py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
        >
          📱 Share {name}
        </button>
      )}

      <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2 sm:grid-cols-4">
        <ChannelTile emoji={copied ? '✅' : '📋'} label={copied ? 'Copied!' : 'Copy link'} onClick={copy} />
        {targets.channels.map((c) => (
          <ChannelTile key={c.label} emoji={c.emoji} label={c.label} href={c.href} />
        ))}
      </div>
    </section>
  );
}
