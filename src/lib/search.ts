import type { Mascot, Store } from './types';

export type SearchResult =
  | { kind: 'mascot'; data: Mascot }
  | { kind: 'store'; data: Store };

interface IndexEntry {
  result: SearchResult;
  haystack: string;
}

export function buildSearchIndex(mascots: Mascot[], stores: Store[]): IndexEntry[] {
  const mascotStoreNumbers = new Set(
    mascots.map((m) => m.store_number).filter(Boolean) as string[],
  );
  const unknown = stores.filter((s) => !mascotStoreNumbers.has(s.store_number));

  const idx: IndexEntry[] = [];
  for (const m of mascots) {
    idx.push({
      result: { kind: 'mascot', data: m },
      haystack: [m.name, m.animal, m.store, m.state, m.zip, m.street, m.store_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    });
  }
  for (const s of unknown) {
    idx.push({
      result: { kind: 'store', data: s },
      haystack: [s.city, s.state, s.zip, s.street, s.store_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    });
  }
  return idx;
}

function scoreMatch(entry: IndexEntry, q: string): number {
  if (!entry.haystack.includes(q)) return 0;
  let score = 1;
  if (entry.result.kind === 'mascot') {
    const m = entry.result.data;
    if (m.name.toLowerCase() === q) score += 100;
    else if (m.name.toLowerCase().startsWith(q)) score += 50;
    if (m.animal.toLowerCase() === q) score += 40;
    score += 20; // mascots rank above unknown stores by default
  } else {
    const s = entry.result.data;
    if (s.city.toLowerCase() === q) score += 80;
    else if (s.city.toLowerCase().startsWith(q)) score += 40;
    if (s.zip === q) score += 100;
  }
  for (const tok of entry.haystack.split(/\s+/)) {
    if (tok.startsWith(q)) {
      score += 5;
      break;
    }
  }
  return score;
}

export function runSearch(index: IndexEntry[], query: string, limit = 10): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { score: number; result: SearchResult }[] = [];
  for (const entry of index) {
    const s = scoreMatch(entry, q);
    if (s > 0) scored.push({ score: s, result: entry.result });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((r) => r.result);
}
