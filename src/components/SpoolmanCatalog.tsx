import { useState } from 'react';

export interface CatalogFilament {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  color_hex?: string | null;
  color_hexes?: string[] | null;
  weight?: number;
  diameter?: number;
  extruder_temp_range?: number[] | null;
  finish?: string | null;
}

const CATALOG_URL = 'https://donkie.github.io/SpoolmanDB/filaments.json';
let catalogRequest: Promise<CatalogFilament[]> | undefined;

function loadCatalog() {
  catalogRequest ??= fetch(CATALOG_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`);
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error('Invalid catalog response');
    return records.filter((record) => record &&
      typeof record.manufacturer === 'string' &&
      typeof record.name === 'string' && typeof record.material === 'string');
  }).catch((error) => {
    catalogRequest = undefined;
    throw error;
  });
  return catalogRequest;
}

export function SpoolmanCatalog({ onSelect }: { onSelect: (entry: CatalogFilament) => void }) {
  const [catalog, setCatalog] = useState<CatalogFilament[]>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    setStatus('Loading catalog…');
    try {
      setCatalog(await loadCatalog());
      setStatus('');
    } catch {
      setStatus('Could not load SpoolmanDB. Try again when online.');
    }
  };

  const terms = query.trim().toLowerCase().split(/\s+/);
  const matches = query.trim().length < 2 ? [] : catalog?.filter((entry) => {
    const description = `${entry.manufacturer} ${entry.name} ${entry.material}`.toLowerCase();
    return terms.every((term) => description.includes(term));
  }) ?? [];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">SpoolmanDB catalog</h3>
      {!catalog ? (
        <button type="button" onClick={load} disabled={status === 'Loading catalog…'}
          className="rounded border px-3 py-1 text-sm">Load catalog</button>
      ) : (
        <>
          <input aria-label="Search SpoolmanDB" value={query} placeholder="Search brand, filament or color"
            onChange={(event) => setQuery(event.target.value)} className="w-full rounded border p-2 text-sm" />
          {query.trim().length >= 2 && matches.length === 0 && <p className="text-xs">No matching filaments.</p>}
          <ul className="max-h-52 overflow-auto">
            {matches.slice(0, 20).map((entry, index) => (
              <li key={entry.id ?? index}>
                <button type="button" onClick={() => { onSelect(entry); setQuery(''); }}
                  className="w-full border-b p-2 text-left text-sm hover:bg-gray-100">
                  {entry.manufacturer} · {entry.name} · {entry.material}
                  {entry.diameter ? ` · ${entry.diameter} mm` : ''}
                  {entry.weight ? ` · ${entry.weight} g` : ''}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {status && <p role="status" className="text-xs">{status}</p>}
    </section>
  );
}
