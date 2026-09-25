// Pokédex Invest — entry point & router.
import { store, load } from './store.js';
import { icon, esc, download, today, closeAllSheets } from './ui.js';
import { openForm } from './sheets.js';
import * as portfolio from './views/portfolio.js';
import * as collection from './views/collection.js';
import * as scanner from './views/scanner.js';
import * as catalogue from './views/catalogue.js';
import * as settingsView from './views/settings.js';

const ROUTES = {
  '': { view: portfolio, title: 'Portefeuille', nav: 'home', live: true },
  collection: { view: collection, title: 'Collection', nav: 'collection', live: true },
  scan: { view: scanner, title: 'Scanner', nav: 'scan' },
  catalogue: { view: catalogue, title: 'Catalogue', nav: 'catalogue' },
  settings: { view: settingsView, title: 'Réglages', nav: 'settings' },
};

const NAV = [
  { id: 'catalogue', href: '#/catalogue', label: 'Catalogue', icon: 'compass' },
  { id: 'collection', href: '#/collection/cards', label: 'Collection', icon: 'cards' },
  { id: 'scan', href: '#/scan', label: 'Scanner', icon: 'scan', center: true },
  { id: 'home', href: '#/', label: 'Portefeuille', icon: 'wallet' },
  { id: 'settings', href: '#/settings', label: 'Réglages', icon: 'settings' },
];

const app = document.getElementById('app');
let current = null;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const [name = '', tab] = path.split('/');
  return { name: ROUTES[name] ? name : '', tab, query: new URLSearchParams(qs || '') };
}

function topbar(route, r) {
  let actions = '';
  if (r.name === '') {
    actions = `<a class="icon-btn" href="#/catalogue" title="Catalogue">${icon('search')}</a>
      <button class="icon-btn" data-export title="Exporter">${icon('download')}</button>`;
  } else if (r.name === 'collection') {
    actions = `<a class="icon-btn" href="#/scan" title="Scanner">${icon('scan')}</a>
      <button class="icon-btn gold" data-add="${r.tab === 'items' ? 'item' : 'card'}" title="Ajouter">${icon('plus')}</button>`;
  }
  const brand = r.name === '' ? `<div class="brand"><img src="icon.svg" alt=""><h1>${esc(route.title)}</h1></div>` : `<h1>${esc(route.title)}</h1>`;
  return `<header class="topbar">${brand}<div class="actions">${actions}</div></header>`;
}

function nav(active) {
  return `<nav class="nav"><div class="nav-inner">${NAV.map((n) => `<a href="${n.href}" class="${n.id === active ? 'on' : ''} ${n.center ? 'scan-btn' : ''}">
    ${n.center ? `<span class="disc">${icon(n.icon)}</span>` : icon(n.icon, 'lg')}<span>${n.label}</span></a>`).join('')}</div></nav>`;
}

function route() {
  const r = parse();
  const def = ROUTES[r.name];
  closeAllSheets();
  app.innerHTML = topbar(def, r) + '<main class="view"></main>' + nav(def.nav);
  current = { r, def, main: app.querySelector('main') };
  def.view.render(current.main, r);
  window.scrollTo(0, 0);
  document.title = `${def.title} · Pokédex Invest`;
}

// Re-render data-driven views when the collection changes, keeping focus in search fields.
store.on(() => {
  if (!current || !current.def.live) return;
  const active = document.activeElement;
  const focusId = active && active.id && current.main.contains(active) ? active.id : null;
  const caret = focusId ? active.selectionStart : null;
  const y = window.scrollY;
  current.def.view.render(current.main, current.r);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* not a text input */ } }
  }
  window.scrollTo(0, y);
});

app.addEventListener('click', (e) => {
  const t = e.target.closest('.topbar [data-add], .topbar [data-export]');
  if (!t) return;
  if (t.dataset.add) openForm(t.dataset.add);
  if ('export' in t.dataset) download(`pokedex-invest-${today()}.json`, JSON.stringify({ app: 'pokedex-invest', exportedAt: new Date().toISOString(), ...store.get() }, null, 2));
});

window.addEventListener('hashchange', route);
route();
load();

// Refresh when the app comes back to the foreground (another device may have edited the collection).
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !document.querySelector('.sheet')) load(); });
