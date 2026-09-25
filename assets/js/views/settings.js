import { settings, parseConnect } from '../settings.js';
import { server } from '../api.js';
import { store, replaceAll, qtyOf, unitValue, costOf, worthOf } from '../store.js';
import { esc, icon, toast, download, confirmSheet, today, LANGS, GRADERS } from '../ui.js';

export const VERSION = '2.1.6';

export function render(main) {
  const s = settings.get();
  const st = store.status();
  const d = store.get();
  main.innerHTML = `
    <section class="section" style="margin-top:6px">
      <div class="section-head"><h2>Stockage des données</h2>
        <span style="display:flex;align-items:center;gap:8px;font-size:12px" class="muted">
          <span class="status-dot ${s.mode === 'server' ? (st.online ? 'ok' : 'ko') : ''}"></span>
          ${s.mode === 'server' ? (st.online ? 'Connecté' : 'Hors ligne') : 'Sur cet appareil'}</span></div>
      <div class="seg" style="margin-bottom:12px">
        <button data-mode="local" class="${s.mode !== 'server' ? 'on' : ''}">${icon('phone', 'sm')}Appareil</button>
        <button data-mode="server" class="${s.mode === 'server' ? 'on' : ''}">${icon('server', 'sm')}Serveur</button>
      </div>
      <form class="panel form" data-link style="margin-bottom:12px">
        <label class="field"><span>Lien de connexion</span><input name="link" autocomplete="off" placeholder="Collez ici le lien de connexion reçu"></label>
        <button class="btn primary" type="submit">${icon('link')}Connecter</button>
      </form>
      ${s.mode === 'server' ? `<form class="panel form" data-server>
        <label class="field"><span>Adresse du serveur</span><input name="server" type="url" inputmode="url" placeholder="https://mondomaine.fr/pokemon" value="${esc(s.server)}"></label>
        <label class="field"><span>Clé d’accès</span><input name="key" type="password" autocomplete="off" placeholder="Clé fournie par votre serveur" value="${esc(s.key)}"></label>
        <button class="btn primary" type="submit">${icon('check')}Enregistrer et tester</button>
        <p class="note" style="margin:0">Le serveur synchronise la collection entre vos appareils, conserve l’historique quotidien de la valeur et active le scanner.</p>
      </form>` : `<div class="panel muted" style="font-size:13px">Les données sont enregistrées dans ce navigateur uniquement. Exportez-les régulièrement ou connectez un serveur personnel pour les synchroniser.</div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2>Mes données</h2></div>
      <div class="list">
        <button class="row" data-export="json"><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('download')}</span></span><span class="main"><b>Sauvegarde complète</b><small>Fichier JSON (cartes, items, ventes, sets, historique)</small></span>${icon('chev', 'sm faint')}</button>
        <button class="row" data-export="csv"><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('download')}</span></span><span class="main"><b>Export tableur</b><small>Fichier CSV compatible Excel</small></span>${icon('chev', 'sm faint')}</button>
        <button class="row" data-import><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('upload')}</span></span><span class="main"><b>Restaurer une sauvegarde</b><small>Remplace la collection actuelle</small></span>${icon('chev', 'sm faint')}</button>
      </div>
      <p class="note">${d.cards.length} cartes · ${d.items.length} items · ${d.sales.length} ventes · ${d.history.length} jours d’historique</p>
    </section>

    <section class="section">
      <div class="section-head"><h2>À propos</h2></div>
      <div class="panel" style="display:flex;gap:14px;align-items:center">
        <img src="icon.svg" alt="" width="48" height="48" style="border-radius:14px">
        <div><b>Pokédex Invest</b> <span class="pill gold">v${VERSION}</span><br>
        <small class="muted">Cotes : Cardmarket &amp; TCGplayer via TCGdex. Pokémon est une marque de Nintendo / Creatures / GAME FREAK — application non affiliée.</small></div>
      </div>
    </section>`;

  main.onclick = async (e) => {
    const t = e.target.closest('[data-mode],[data-export],[data-import]');
    if (!t) return;
    if (t.dataset.mode) {
      if (t.dataset.mode === s.mode) return;
      settings.set({ mode: t.dataset.mode });
      render(main);
    }
    if (t.dataset.export === 'json') {
      download(`pokedex-invest-${today()}.json`, JSON.stringify({ app: 'pokedex-invest', version: VERSION, exportedAt: new Date().toISOString(), ...store.get() }, null, 2));
    }
    if (t.dataset.export === 'csv') download(`pokedex-invest-${today()}.csv`, toCsv(), 'text/csv;charset=utf-8');
    if ('import' in t.dataset) importBackup();
  };
  main.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if ('link' in f.dataset) {
      const c = parseConnect(f.link.value);
      if (!c) { toast('Lien de connexion invalide', { error: true }); return; }
      settings.set({ mode: 'server', ...c });
    } else settings.set({ mode: 'server', server: f.server.value.trim().replace(/\/+$/, ''), key: f.key.value.trim() });
    try { await server.ping(); toast('Serveur connecté'); }
    catch (err) { toast(err.status === 401 ? 'Clé d’accès refusée' : err.message, { error: true }); }
    render(main);
  };
}

function toCsv() {
  const { cards, items } = store.get();
  const head = ['Type', 'Nom', 'Extension', 'Numéro', 'Catégorie', 'Langue', 'Gradation', 'Quantité', 'Achat unitaire', 'Frais gradation', 'Coût total', 'Valeur unitaire', 'Valeur totale', 'Plus-value', 'Date achat', 'Remarque'];
  const row = (kind, a) => [kind, a.name, a.set, a.num || '', a.category || '', LANGS[a.lang]?.label || a.lang,
    a.grader && a.grader !== 'raw' ? `${GRADERS[a.grader] || a.grader} ${a.grade || ''}` : '', qtyOf(a), a.buyPrice || 0, a.gradingCost || 0,
    costOf(a).toFixed(2), unitValue(a).toFixed(2), worthOf(a).toFixed(2), (worthOf(a) - costOf(a)).toFixed(2), a.buyDate || '', a.note || ''];
  const cell = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return /[;"\n]/.test(s) ? `"${s}"` : s; };
  const lines = [head, ...cards.map((a) => row('Carte', a)), ...items.map((a) => row('Item', a))].map((r) => r.map(cell).join(';'));
  return '﻿' + lines.join('\r\n');
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.cards) || !Array.isArray(data.items)) throw new Error('Ce fichier n’est pas une sauvegarde Pokédex Invest');
      if (!(await confirmSheet(`Remplacer la collection actuelle par cette sauvegarde (${data.cards.length} cartes, ${data.items.length} items) ?`, { ok: 'Restaurer', danger: true }))) return;
      replaceAll({ cards: data.cards, items: data.items, sales: data.sales || [], sets: data.sets || [], history: data.history || [] });
      toast('Sauvegarde restaurée');
    } catch (e) { toast(e.message, { error: true }); }
  };
  input.click();
}
