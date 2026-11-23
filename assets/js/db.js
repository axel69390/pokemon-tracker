// Device storage for the collection, its cache and the watchlist: IndexedDB (hundreds of MB, room for the photos)
// instead of localStorage (about 5 MB per site, shared with everything else, which filled up after a few dozen
// photos). Values are stored as plain objects. Data saved by older versions in localStorage is moved here the
// first time it is read (see `take`), then removed from localStorage.
const DB_NAME = 'pokedex-invest';
const STORE = 'kv';

let dbp = null;
function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB indisponible'));
      req.onblocked = () => reject(new Error('IndexedDB bloquée'));
    }).catch((e) => { dbp = null; throw e; });
    // Ask the browser not to evict the collection under storage pressure (best effort, silently refused elsewhere).
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch { /* unsupported */ }
  }
  return dbp;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error || new Error('Écriture impossible'));
    t.onabort = () => reject(t.error || new Error('Écriture annulée'));
  }));
}

export const dbGet = (key) => tx('readonly', (s) => s.get(key));
export const dbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));

const lsRead = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const lsRemove = (key) => { try { localStorage.removeItem(key); } catch { /* private mode */ } };

// Reads `key`; when IndexedDB has nothing yet, takes the localStorage copy left by an older version, saves it in
// IndexedDB and only then removes it from localStorage. Without IndexedDB (rare private modes): localStorage only.
export async function take(key) {
  let v;
  try { v = await dbGet(key); } catch { return { value: lsRead(key), idb: false }; }
  if (v !== undefined) return { value: v, idb: true };
  const legacy = lsRead(key);
  if (legacy == null) return { value: null, idb: true };
  try { await dbSet(key, legacy); lsRemove(key); } catch { return { value: legacy, idb: false }; }
  return { value: legacy, idb: true };
}

// Writes `key`. Falls back to localStorage only when IndexedDB cannot be opened at all (so the two never hold
// diverging copies); rejects when the write fails (storage full).
export async function put(key, value) {
  let usable = true;
  try { await open(); } catch { usable = false; }
  if (usable) return dbSet(key, value);
  localStorage.setItem(key, JSON.stringify(value));
}
