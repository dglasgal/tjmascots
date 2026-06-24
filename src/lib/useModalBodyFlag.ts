'use client';

import { useEffect } from 'react';

/**
 * While a modal is open, set `data-modal-open` on <body>.
 *
 * Why: the map's floating "Find mascots near me" button is positioned at the
 * top-center of the map on desktop, which is exactly where a centered modal's
 * header sits — so the button would overlap the modal. A CSS rule in
 * globals.css (`body[data-modal-open] .find-me-btn { display:none }`) hides the
 * button whenever this flag is set.
 *
 * This hook is shared by every modal so the behavior is consistent and a
 * teammate only has one place to look. It reference-counts, so if two modals
 * are ever open at once the flag stays until the last one closes.
 */
let openCount = 0;

export function useModalBodyFlag(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    openCount += 1;
    document.body.setAttribute('data-modal-open', '');
    return () => {
      openCount -= 1;
      if (openCount <= 0) {
        openCount = 0;
        document.body.removeAttribute('data-modal-open');
      }
    };
  }, [open]);
}
