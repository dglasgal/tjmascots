/**
 * EXIF GPS extraction + store-distance matching for submitted photos.
 *
 * Used by SubmitModal to give the moderator a "did this photo come from
 * the store the submitter picked?" confidence signal in the admin queue.
 *
 * Limitations to remember (so we never auto-approve based on this alone):
 *   - Most photos sent through chat apps (iMessage, WhatsApp, IG) have
 *     EXIF stripped for privacy. ~30-40% of submissions will have GPS;
 *     the rest report status='no_gps'.
 *   - Photos taken just outside the store (parking lot, sidewalk) still
 *     count as a match — we use a 250m radius.
 *   - EXIF can be spoofed but it's rare for casual users.
 */

import exifr from 'exifr';

export type PhotoLocationStatus = 'match' | 'mismatch' | 'no_gps' | 'error';

export interface PhotoLocationResult {
  status: PhotoLocationStatus;
  /** GPS latitude from the photo's EXIF, if present. */
  lat: number | null;
  /** GPS longitude from the photo's EXIF, if present. */
  lng: number | null;
  /** Distance from photo location to the chosen store, in meters.
   *  Null when no GPS or no store reference. */
  distance_m: number | null;
}

/** Threshold for "this photo was taken at the store" — generous enough to
 *  cover the parking lot, just outside the door, etc. */
const MATCH_RADIUS_METERS = 250;

/**
 * Read the file's EXIF GPS coords (no other EXIF fields are extracted)
 * and compare them to the store's known coordinates. Returns a status the
 * admin dashboard can render as a badge.
 *
 * Never throws — if exifr fails for any reason (corrupt file, weird
 * format, library error), we return status='error' and the caller can
 * fall back to manual review.
 */
export async function extractPhotoLocation(
  file: File,
  storeLat: number,
  storeLng: number,
): Promise<PhotoLocationResult> {
  let gps: { latitude?: number; longitude?: number } | undefined;
  try {
    // Pull JUST the GPS block from EXIF — don't load the whole metadata.
    gps = await exifr.gps(file);
  } catch {
    return { status: 'error', lat: null, lng: null, distance_m: null };
  }

  if (
    !gps ||
    typeof gps.latitude !== 'number' ||
    typeof gps.longitude !== 'number'
  ) {
    return { status: 'no_gps', lat: null, lng: null, distance_m: null };
  }

  const distance = haversineMeters(gps.latitude, gps.longitude, storeLat, storeLng);
  const status: PhotoLocationStatus =
    distance <= MATCH_RADIUS_METERS ? 'match' : 'mismatch';

  return {
    status,
    lat: gps.latitude,
    lng: gps.longitude,
    distance_m: Math.round(distance),
  };
}

/** Great-circle distance between two lat/lng pairs, in meters. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
