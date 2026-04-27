/**
 * MallardFull — full-body mallard illustration (head + body + bill +
 * tail + water suggestion). Used in the main header on the map page,
 * where there's room for the bigger illustration to read clearly.
 *
 * For tiny round buttons (sub-page headers, favicon) keep using
 * MallardHead — at small sizes only the head silhouette stays
 * legible.
 */

import type { SVGProps } from 'react';

interface MallardFullProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  className?: string;
}

export default function MallardFull({ className, ...props }: MallardFullProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Body — grey/brown ellipse forming the floating duck silhouette */}
      <ellipse cx="34" cy="40" rx="26" ry="11" fill="#8c7556" />
      {/* Chest — warmer brown on the front (left) */}
      <ellipse cx="18" cy="36" rx="10" ry="10" fill="#7a4a2c" />
      {/* Wing — darker patch over the back of the body */}
      <ellipse cx="42" cy="36" rx="15" ry="8" fill="#5e4830" opacity="0.85" />
      {/* Iridescent blue speculum — the signature mallard wing flash */}
      <rect x="34" y="40" width="14" height="2.6" rx="1" fill="#2c5db4" />
      <rect x="34" y="42.6" width="14" height="0.9" rx="0.4" fill="#fdf6ec" />
      {/* White collar between body and head */}
      <ellipse cx="18" cy="29" rx="7.5" ry="2.5" fill="#fdf6ec" />
      <ellipse cx="18" cy="30.2" rx="7" ry="1.2" fill="#c9a36a" opacity="0.45" />
      {/* Head — iridescent green */}
      <circle cx="17" cy="22" r="11" fill="#0f6e3d" />
      <ellipse cx="13" cy="18" rx="4.5" ry="2.5" fill="#1f8d52" opacity="0.65" />
      {/* Bill — yellow, curving forward to the right */}
      <path
        d="M 25 22 Q 40 22 40 26 Q 40 30 27 28 Z"
        fill="#f4c430"
        stroke="#8a6a0a"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d="M 27 27 Q 36 28 40 27 L 40 30 Q 32 30 27 28 Z" fill="#c89200" opacity="0.55" />
      {/* Nostril */}
      <circle cx="34" cy="24.5" r="0.7" fill="#5a4400" />
      {/* Eye */}
      <circle cx="21" cy="20" r="2" fill="#1a1a1a" />
      <circle cx="21.6" cy="19.4" r="0.6" fill="#fff" />
      {/* Tail — small upturned curl on the back-right */}
      <path d="M 56 36 Q 64 32 62 40 L 56 41 Z" fill="#1a1a1a" />
      {/* Water — subtle ripple lines under the duck */}
      <path
        d="M 4 52 Q 14 50 24 52 T 44 52 T 60 52"
        stroke="#86a9c4"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 8 56 Q 18 54 28 56 T 48 56"
        stroke="#86a9c4"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
