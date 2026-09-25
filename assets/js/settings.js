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

// Setup link: …/#connect=<server>|<key>  (also accepted when pasted in the app)
export function parseConnect(text) {
  const raw = String(text || '').trim();
  const m = raw.match(/connect=([^&\s]+)/);
  const payload = m ? decodeURIComponent(m[1]) : raw;
  const [server, key] = payload.split('|').map((x) => (x || '').trim());
  return /^https?:\/\//.test(server) && key ? { server: server.replace(/\/+$/, ''), key } : null;
}

(function readConnectLink() {
  if (!/connect=/.test(location.hash + location.search)) return;
  const c = parseConnect(location.hash + location.search);
  if (c) settings.set({ mode: 'server', ...c });
  history.replaceState(null, '', location.pathname);
})();
