export interface Mascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  state: string;
  notes: string;
  photo: string | null;
  has_photo: boolean;
  source_url: string;
  lat: number;
  lng: number;
  street?: string;
  zip?: string;
  store_number?: string | null;
  /** Canonical city from the matched Store record. Use this (not
   *  `store`, which is free-text and may include parentheticals) when
   *  rendering "[City] TJ's"-style labels. Falls back to `store`
   *  when no Store match was found. */
  city?: string;
  /** Neighborhood from the matched Store record. Populated only when
   *  the store's city has 2+ TJs so the formatter can disambiguate
   *  (e.g., "Atlanta — Buckhead TJ's" vs "Atlanta — Midtown TJ's"). */
  neighborhood?: string;
  emoji: string;
  /** ISO date when the mascot was added to the map. Used by /recent. */
  created_at?: string;
  /** Display name to credit on the leaderboard, e.g. "Jason D." Empty for
   *  mascots from our seed scrape (no specific human contributor). */
  submitted_by?: string | null;
}

export interface Store {
  store_number: string;
  city: string;
  state: string;
  zip: string;
  street: string;
  lat: number;
  lng: number;
  phone?: string;
  url?: string;
  /** Neighborhood within the city, set only when the city has 2+ TJ
   *  stores so the Lincoln-Park-vs-Hyde-Park-vs-River-North problem
   *  is unambiguous. Single-store cities have this undefined. */
  neighborhood?: string;
}
