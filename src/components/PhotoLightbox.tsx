'use client';

/**
 * PhotoLightbox
 *
 * Click any mascot photo to view it full-size in a modal overlay.
 * Use Esc or click the backdrop to close. Shows the full uncropped
 * image so mascots don't get cut off like they do in the small card.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoLightboxProps {
  open: boolean;
  onClose: () => void;
  src: string | null;
  alt: string;
  caption?: string;
}

export default function PhotoLightbox({
  open,
  onClose,
  src,
  alt,
  caption,
}: PhotoLightboxProps) {
  // Esc key closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && src && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[4000] flex flex-col items-center justify-center bg-[rgba(15,10,5,0.92)] p-4 sm:p-8"
          role="dialog"
          aria-label={alt}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-xl font-extrabold text-[var(--ink)] shadow-lg transition hover:-translate-y-px"
          >
            ×
          </button>

          <motion.img
            key={src}
            src={src}
            alt={alt}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          />

          {caption && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-4 max-w-[92vw] rounded-full bg-[var(--cream)] px-5 py-2 text-center text-sm font-extrabold text-[var(--ink)] shadow"
            >
              {caption}
            </div>
          )}

          <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[rgba(253,246,236,0.55)]">
            Click anywhere or press Esc to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
