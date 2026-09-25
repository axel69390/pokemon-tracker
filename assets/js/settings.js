// User preferences, persisted per device.
const KEY = 'pdx.settings';
const DEFAULTS = {
  mode: 'local',          // 'local' (this device) | 'server' (personal server)
  server: '',
  key: '',
  catalogLang: 'fr',
  cardCols: 2,
  itemCols: 3,
};

let current = { ...DEFAULTS };
try { current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* private mode */ }

const listeners = new Set();
export const settings = {
  get: () => current,
  set(patch) {
    current = { ...current, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
    listeners.forEach((fn) => fn(current));
  },
  on: (fn) => listeners.add(fn),
  isServer: () => current.mode === 'server' && !!current.server && !!current.key,
};

// One-tap setup link: …/#connect=<server>|<key>
(function readConnectLink() {
  const m = location.hash.match(/connect=([^&]+)/);
  if (!m) return;
  const [server, key] = decodeURIComponent(m[1]).split('|');
  if (server && key) settings.set({ mode: 'server', server, key });
  history.replaceState(null, '', location.pathname + location.search);
})();
