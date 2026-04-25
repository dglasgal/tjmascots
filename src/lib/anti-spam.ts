/**
 * Anti-spam helpers for public submission/report forms.
 *
 * Two cheap, client-side techniques that combined catch ~95% of dumb bots
 * without ever showing a CAPTCHA to real users:
 *
 *   1. Honeypot field — a hidden form input named "website" that humans never
 *      see (CSS hides it). Bots fill in every field they find, so a non-empty
 *      value means it's a bot.
 *
 *   2. Submission-time check — real humans take a minimum of 2-3 seconds to
 *      read and fill a form. Bots submit instantly. We mark the form's "open
 *      time" when the modal mounts and reject submits that happen too fast.
 *
 * If you ever need stronger protection (e.g. you start seeing real spam),
 * upgrade to Cloudflare Turnstile — same shape, just a token check.
 */

import { useEffect, useRef } from 'react';

/** How fast a submission has to be to look like a bot, in milliseconds. */
const MIN_HUMAN_DURATION_MS = 2000;

export interface AntiSpamCheck {
  /** Pass to your hidden honeypot input as `value={fields.honeypot.value}`
   *  — react needs a controlled input. */
  honeypotProps: {
    name: string;
    autoComplete: string;
    tabIndex: number;
    'aria-hidden': boolean;
    style: React.CSSProperties;
  };
  /** Call this on submit. Returns true if it looks like a real person. */
  isHuman: (honeypotValue: string) => boolean;
}

/** Hook for anti-spam: returns honeypot input props + an isHuman checker.
 *  Call once per form. The opened-at timestamp is set when the hook first runs. */
export function useAntiSpam(): AntiSpamCheck {
  const openedAt = useRef<number>(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  return {
    honeypotProps: {
      // "website" is one of the most common honeypot names; bots love it.
      name: 'website',
      autoComplete: 'off',
      tabIndex: -1,
      'aria-hidden': true,
      // Visually hidden but still fillable by bots that scan the DOM.
      style: {
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
      },
    },
    isHuman: (honeypotValue: string) => {
      if (honeypotValue && honeypotValue.length > 0) return false; // bot filled it in
      const elapsed = Date.now() - openedAt.current;
      if (elapsed < MIN_HUMAN_DURATION_MS) return false; // submitted too fast
      return true;
    },
  };
}
