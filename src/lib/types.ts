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
}
