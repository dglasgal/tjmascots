/**
 * MallardHead — flat-style SVG of a mallard duck head, used as the
 * site's brand mark in the header round button (replacing the 🛒
 * emoji we used to ship). Inspired by McQuackers, the famous mallard
 * mascot at TJ Lakeshore Oakland (#203).
 *
 * Designed to read clearly at small sizes (down to 32px favicon) by
 * leaning on bold color blocks instead of fine detail. Background is
 * transparent so it can drop into the existing cream-circle button
 * without conflicting; for the favicon we wrap the same shape on a
 * TJ-red circle (see src/app/icon.svg).
 */

import type { SVGProps } from 'react';

interface MallardHeadProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  /** Tailwind/CSS-controlled size (className="h-7 w-7"). */
  className?: string;
}

export default function MallardHead({ className, ...props }: MallardHeadProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Mallard head — iridescent green sphere */}
      <circle cx="26" cy="28" r="17" fill="#0f6e3d" />
      {/* Subtle highlight on the head suggesting iridescence */}
      <ellipse cx="20" cy="22" rx="6" ry="3.5" fill="#1f8d52" opacity="0.7" />
      {/* White collar ring — the iconic mallard neck stripe */}
      <ellipse cx="28" cy="45" rx="14" ry="3" fill="#fdf6ec" />
      <ellipse cx="28" cy="46.5" rx="13" ry="1.6" fill="#c9a36a" opacity="0.5" />
      {/* Bill — yellow/orange, extending forward */}
      <path
        d="M 38 26 Q 58 26 58 31 Q 58 38 40 36 Z"
        fill="#f4c430"
        stroke="#8a6a0a"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Bill underline shadow */}
      <path
        d="M 40 33 Q 50 34 58 33 L 58 36 Q 48 37 40 36 Z"
        fill="#c89200"
        opacity="0.6"
      />
      {/* Nostril dot */}
      <circle cx="50" cy="30" r="0.9" fill="#5a4400" />
      {/* Eye */}
      <circle cx="33" cy="24" r="2.5" fill="#1a1a1a" />
      <circle cx="33.7" cy="23.3" r="0.8" fill="#fff" />
    </svg>
  );
}
