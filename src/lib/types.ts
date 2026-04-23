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
