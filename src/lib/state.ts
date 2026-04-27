/**
 * US state code ↔ name ↔ slug helpers for the per-state browse pages.
 *
 * Our mascot/store data uses 2-letter state codes (`"CA"`, `"NY"`, etc.).
 * The browse-by-state SEO pages need a friendly URL slug
 * (`"california"`, `"new-york"`) and a display name (`"California"`).
 */

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};

/** "CA" → "California". Returns the code unchanged if unknown. */
export function stateName(code: string): string {
  return STATE_NAMES[code.toUpperCase()] || code;
}

/** "CA" → "california". "NY" → "new-york". */
export function stateSlug(code: string): string {
  const name = stateName(code);
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** "california" → "CA". Returns null if unknown. */
export function stateCodeFromSlug(slug: string): string | null {
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (name.toLowerCase().replace(/\s+/g, '-') === slug) return code;
  }
  return null;
}

/** All state codes that appear in the given mascot list — used for
 *  enumerating which state pages to generate at build. */
export function statesWithMascots(mascots: { state: string }[]): string[] {
  return [...new Set(mascots.map((m) => m.state).filter(Boolean))].sort();
}
