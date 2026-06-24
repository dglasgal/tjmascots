'use client';

/**
 * Convert Apple HEIC/HEIF photos to JPEG, in the browser, at upload time.
 *
 * Why this exists:
 *   iPhones save photos as .HEIC by default. Browsers cannot decode HEIC —
 *   not in an <img>, and not via createImageBitmap()/canvas. That broke us in
 *   two ways before this fix:
 *     1. The admin review queue showed a broken-image icon (the <img> couldn't
 *        render the HEIC signed-URL).
 *     2. On approve, resizeForPublish() (which uses createImageBitmap) threw,
 *        and we fell back to publishing the raw .heic bytes — which then can't
 *        display on the live site for any visitor either.
 *
 *   Converting to JPEG the moment the file is chosen means everything
 *   downstream (preview, EXIF GPS read, resize, publish) deals with a normal
 *   JPEG. EXIF GPS is preserved by heic2any, so the location badge still works.
 *
 * heic2any is browser-only (canvas + workers), so it's imported dynamically to
 * keep it out of any server bundle and out of the initial page load — it only
 * downloads when someone actually picks a HEIC file.
 */

/** True if the file looks like HEIC/HEIF, by MIME type or extension.
 *  (iOS sometimes hands over an empty `type`, so we check the name too.) */
export function isHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * If `file` is a HEIC/HEIF image, return a new JPEG File. Otherwise return the
 * original file unchanged. Never throws — on any conversion failure it returns
 * the original file and logs a warning, so an upload is never blocked by a
 * converter hiccup (the visitor can still send it; worst case it needs manual
 * handling, exactly as before this helper existed).
 */
export async function convertHeicToJpeg(file: File, quality = 0.85): Promise<File> {
  if (typeof window === 'undefined') return file; // never run on the server
  if (!isHeic(file)) return file;

  try {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality });
    // heic2any returns a Blob (or Blob[] for multi-image HEIC — take the first).
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    console.warn('[heic] conversion failed, using original file:', e);
    return file;
  }
}
