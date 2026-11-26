import { ElegooSpool, MAX_LABEL_BYTES } from './ElegooSpool';

export interface SavedSpool {
  id: string;
  name: string;
  data: number[];
  createdAt: string;
  updatedAt: string;
}

const BACKUP_FORMAT = 'elegoo-spool-library';
const STORE = 'spools';

export function newProfileId(): string {
  // getRandomValues also works on the existing local HTTP/IP workflow.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function makeSavedSpool(data: Uint8Array, previous?: SavedSpool): SavedSpool {
  const name = new ElegooSpool(data).label;
  if (!name.trim()) throw new Error('Enter a spool label before saving.');
  const now = new Date().toISOString();
  const profile = {
    id: previous?.id ?? newProfileId(),
    name,
    data: Array.from(data),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  validateProfile(profile);
  return profile;
}

function validateProfile(value: unknown): asserts value is SavedSpool {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved spool.');
  const entry = value as SavedSpool;
  if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 128 ||
      typeof entry.name !== 'string' || !entry.name.trim() || new TextEncoder().encode(entry.name).length > MAX_LABEL_BYTES ||
      !Array.isArray(entry.data) || entry.data.length < 180 || entry.data.length > 540 || entry.data.length % 4 !== 0 ||
      !entry.data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) || entry.data[0x40] !== 0x36 ||
      typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt)) ||
      typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))) {
    throw new Error('Invalid spool profile. Check the name and spool data.');
  }
  if (new ElegooSpool(new Uint8Array(entry.data)).label !== entry.name) {
    throw new Error('The saved name must match the spool label.');
  }
}

export function encodeLibraryBackup(spools: SavedSpool[]): string {
  spools.forEach(validateProfile);
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, spools }, null, 2);
}

export function decodeLibraryBackup(text: string): SavedSpool[] {
  if (text.length > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not a valid JSON backup.'); }
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== 1 ||
      !Array.isArray(backup.spools) || backup.spools.length > 10000) {
    throw new Error('Choose a version 1 My Spools library backup.');
  }
  backup.spools.forEach(validateProfile);
  const ids = new Set<string>();
  for (const profile of backup.spools as SavedSpool[]) {
    if (ids.has(profile.id)) throw new Error('Backup contains duplicate spool IDs.');
    ids.add(profile.id);
  }
  return backup.spools;
}

// A changed entry from another browser becomes a separate copy; never overwrite.
export function mergeLibrary(existing: SavedSpool[], incoming: SavedSpool[]) {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  const added: SavedSpool[] = [];
  let skipped = 0;
  for (const profile of incoming) {
    const current = byId.get(profile.id);
    if (current && current.name === profile.name &&
        current.data.length === profile.data.length && current.data.every((byte, index) => byte === profile.data[index])) {
      skipped++;
      continue;
    }
    const copy = current ? { ...profile, id: newProfileId() } : profile;
    byId.set(copy.id, copy);
    added.push(copy);
  }
  return { added, skipped };
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Browser storage is unavailable. You can still edit and export tags.'));
      return;
    }
    const request = indexedDB.open('elegoo-rfid-spool-library', 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(new Error('Could not open My Spools. Check this browser’s site storage settings.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other editor tabs and reload to open My Spools.'));
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    let result: T;
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE, mode); } catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(new Error('Library change could not be saved. Check available browser storage and try again.')); };
    try { action(tx.objectStore(STORE), (value) => { result = value; }); }
    catch (error) { tx.abort(); db.close(); reject(error); }
  });
}

export function listSavedSpools(): Promise<SavedSpool[]> {
  return transaction('readonly', (store, result) => {
    store.getAll().onsuccess = (event) => result((event.target as IDBRequest<SavedSpool[]>).result);
  });
}

export function saveSpool(profile: SavedSpool): Promise<void> {
  validateProfile(profile);
  return transaction('readwrite', (store, result) => { store.put(profile); result(undefined); });
}

export function deleteSavedSpool(id: string): Promise<void> {
  return transaction('readwrite', (store, result) => { store.delete(id); result(undefined); });
}

export function restoreLibrary(profiles: SavedSpool[]): Promise<{ added: number; skipped: number }> {
  profiles.forEach(validateProfile);
  return transaction('readwrite', (store, result) => {
    store.getAll().onsuccess = (event) => {
      const merged = mergeLibrary((event.target as IDBRequest<SavedSpool[]>).result, profiles);
      merged.added.forEach((entry) => store.add(entry));
      result({ added: merged.added.length, skipped: merged.skipped });
    };
  });
}
