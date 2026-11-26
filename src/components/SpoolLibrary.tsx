import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ElegooSpool } from '../lib/ElegooSpool';
import {
  decodeLibraryBackup, deleteSavedSpool, encodeLibraryBackup, listSavedSpools,
  makeSavedSpool, restoreLibrary, saveSpool, type SavedSpool,
} from '../lib/spoolLibrary';

interface SpoolLibraryProps {
  spool: ElegooSpool;
  label: string;
  disabledReason?: string;
  onEditLabel: () => void;
  selectedId: string | null;
  onSelect: (profile: SavedSpool) => void;
  onSelectionChange: (id: string | null) => void;
}

const SPOOLS_PER_PAGE = 5;

const buttonClass = 'rounded border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

export function SpoolLibrary({ spool, label, disabledReason, onEditLabel, selectedId, onSelect, onSelectionChange }: SpoolLibraryProps) {
  const [profiles, setProfiles] = useState<SavedSpool[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const selected = profiles.find((entry) => entry.id === selectedId);
  const raw = spool.getRawData();
  const dirty = selected && (selected.name !== label || selected.data.length !== raw.length || selected.data.some((byte, index) => byte !== raw[index]));

  useEffect(() => {
    let mounted = true;
    listSavedSpools().then((entries) => {
      if (mounted) { setProfiles(entries); setReady(true); }
    }).catch((cause) => {
      if (mounted) setError(cause instanceof Error ? cause.message : 'Could not open My Spools.');
    });
    return () => { mounted = false; };
  }, []);

  const run = async (action: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const message = await action();
      setProfiles(await listSavedSpools());
      setStatus(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Library operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = (update: boolean) => {
    if (disabledReason) return;
    if (update && !selected) return;
    if (update && !window.confirm(`Update saved spool “${selected!.name}” with the current settings?`)) return;
    void run(async () => {
      const profile = makeSavedSpool(raw, update ? selected : undefined);
      await saveSpool(profile);
      setPage(0);
      onSelectionChange(profile.id);
      // Optional protection against automatic eviction; backups remain necessary.
      if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
      return `${update ? 'Updated' : 'Saved'} “${profile.name}”.`;
    });
  };

  const load = (profile: SavedSpool) => {
    if (dirty && !window.confirm('Discard unsaved changes to the loaded spool and load this saved spool?')) return;
    onSelect(profile);
    setError('');
    setStatus(`Loaded “${profile.name}”. Edit settings below, then use Write Tag or Mobile export.`);
  };

  const backup = () => {
    void run(async () => {
      const entries = await listSavedSpools();
      const url = URL.createObjectURL(new Blob([encodeLibraryBackup(entries)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-spools-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `Backup download requested (${entries.length} saved spools).`;
    });
  };

  const restore = (file: File) => {
    void run(async () => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
      const incoming = decodeLibraryBackup(await file.text());
      const result = await restoreLibrary(incoming);
      setPage(0);
      return `Restored ${result.added} spools; skipped ${result.skipped} unchanged entries. Existing spools were kept.`;
    });
  };

  const terms = query.trim().toLowerCase().split(/\s+/);
  const matches = profiles.filter((entry) => {
    const saved = new ElegooSpool(new Uint8Array(entry.data));
    const description = `${entry.name} ${saved.material} ${saved.subtype}`.toLowerCase();
    return terms.every((term) => description.includes(term));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pageCount = Math.ceil(matches.length / SPOOLS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const firstResult = currentPage * SPOOLS_PER_PAGE;
  const visibleSpools = matches.slice(firstResult, firstResult + SPOOLS_PER_PAGE);

  return (
    <section className="rounded-md border border-gray-200 bg-gray-50 p-3" aria-labelledby="my-spools-heading">
      <div className="flex items-center justify-between gap-2">
        <h3 id="my-spools-heading" className="flex-1 text-sm font-semibold text-gray-800">
          <button type="button" aria-expanded={open} aria-controls="my-spools-content"
            onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 py-1 text-left">
            <span>My Spools {ready && `(${profiles.length})`}</span>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </h3>
        <div className="relative" onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHelpOpen(false); }}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false); }}>
          <button type="button" aria-label="About My Spools" aria-expanded={helpOpen}
            aria-controls="my-spools-help" aria-describedby={helpOpen ? 'my-spools-help' : undefined}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHelpOpen(true); }} onClick={() => setHelpOpen(!helpOpen)}
            onKeyDown={(event) => { if (event.key === 'Escape') setHelpOpen(false); }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-white">
            ?
          </button>
          {helpOpen && <p id="my-spools-help" role="tooltip"
            className="absolute right-0 top-full z-10 mt-1 w-64 max-w-[calc(100vw-4rem)] rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg">
            Save settings here to reuse with Write Tag or Mobile export, even without the original sticker.
            Saved in this browser for this site address. Back up to move to another browser or device,
            or before clearing site data. Private browsing may not keep your library.
          </p>}
        </div>
      </div>
      <div id="my-spools-content" hidden={!open} className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!ready || busy || profiles.length === 0} onClick={backup}>Back Up Library</button>
          <button type="button" className={buttonClass} disabled={!ready || busy} onClick={() => importRef.current?.click()}>Restore Library</button>
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden" aria-label="Restore spool library backup"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) restore(file);
            }} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <p className="w-full break-words text-xs text-gray-700">Spool label: {label || 'Enter a label below.'}</p>
          <button type="button" className={buttonClass} onClick={onEditLabel}>Edit Label</button>
          <button type="button" className={buttonClass} disabled={!ready || busy || Boolean(disabledReason)} onClick={() => saveCurrent(false)}>
            {selected ? 'Save as New' : 'Save Spool'}
          </button>
          {selected && <button type="button" className={buttonClass} disabled={!ready || busy || !dirty || Boolean(disabledReason)} onClick={() => saveCurrent(true)}>Update Saved Spool</button>}
        </div>
        {disabledReason && <p className="text-xs text-gray-600">{disabledReason}</p>}
        {selected && <p className="text-xs text-gray-600">Editing “{selected.name}”{dirty ? ' — unsaved changes' : ' — saved'}. Saving does not write a tag.</p>}
        {!ready && !error && <p className="text-xs text-gray-600">Opening My Spools…</p>}
        <input type="search" aria-label="Search saved spools" placeholder="Search saved spools" value={query}
          disabled={!ready || profiles.length === 0}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          className="w-full rounded border border-gray-300 p-2 text-sm disabled:bg-gray-100 disabled:opacity-60" />
        {ready && profiles.length === 0 && <p className="text-xs text-gray-600">No saved spools yet. Writing a tag does not save it here. Choose settings below, then tap Save Spool above to keep them in this browser.</p>}
        {ready && profiles.length > 0 && (
          <>
            <ul className="divide-y divide-gray-200">
              {visibleSpools.map((profile) => {
                const saved = new ElegooSpool(new Uint8Array(profile.data));
              const displayName = profile.name;
                const { r, g, b } = saved.color;
                return (
                  <li key={profile.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="h-7 w-7 shrink-0 rounded border border-gray-300" style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }} aria-hidden="true" />
                    <div className="flex-1 min-w-[120px]">
                    <p className="break-words text-sm font-medium text-gray-800">{displayName}</p>
                      <p className="text-xs text-gray-500">{saved.material} · {saved.subtype} · RGB {r}, {g}, {b}{profile.id === selectedId ? ' · Loaded' : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonClass} disabled={busy} aria-label={`Load ${displayName}`} onClick={() => load(profile)}>Load</button>
                    <button type="button" className={buttonClass} disabled={busy || !saved.label.trim()} aria-label={`Duplicate ${displayName}`} onClick={() => void run(async () => {
                      const copy = makeSavedSpool(new Uint8Array(profile.data));
                        await saveSpool(copy);
                        setPage(0);
                      return `Duplicated “${displayName}”.`;
                      })}>Duplicate</button>
                    <button type="button" className={`${buttonClass} text-red-700`} disabled={busy} aria-label={`Delete ${displayName}`} onClick={() => {
                      if (!window.confirm(`Delete “${displayName}” from My Spools? This does not erase any NFC tag.`)) return;
                        void run(async () => {
                          await deleteSavedSpool(profile.id);
                          if (selectedId === profile.id) onSelectionChange(null);
                        return `Deleted “${displayName}”. Current editor settings were kept.`;
                        });
                      }}>Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {matches.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-600" aria-live="polite">
                  Showing {firstResult + 1}–{Math.min(firstResult + SPOOLS_PER_PAGE, matches.length)} of {matches.length}
                </p>
                {pageCount > 1 && <nav aria-label="Saved spools pages" className="flex gap-2">
                  <button type="button" className={buttonClass} disabled={busy || currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}>Previous</button>
                  <button type="button" className={buttonClass} disabled={busy || currentPage + 1 >= pageCount}
                    onClick={() => setPage(currentPage + 1)}>Next</button>
                </nav>}
              </div>
            )}
            {matches.length === 0 && <p className="text-xs text-gray-600">No saved spools match your search.</p>}
          </>
        )}
        {busy && <p role="status" className="text-xs text-gray-600">Updating library…</p>}
        {status && <p role="status" className="text-xs text-emerald-700">{status}</p>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
