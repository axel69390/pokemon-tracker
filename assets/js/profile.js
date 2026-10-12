// User profile: photo (picked from the device) or a Pokémon as avatar, nickname, member-since date.
// Everything stays on the device (settings). Pokémon artwork is loaded from the PokéAPI sprites repository.
import { settings } from './settings.js?v=2.4.8-202610122144';
import { asset, IS_STORE } from './edition.js?v=2.4.8-202610122144';
import { esc, icon, toast, openSheet, pickImage, today, dateFr } from './ui.js?v=2.4.8-202610122144';
import { trialStart } from './billing.js?v=2.4.8-202610122144';

const MAX_FILE = 2 * 1024 * 1024;
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export function avatarHtml(size = 44) {
  const s = settings.get();
  const inner = s.avatar ? `<img src="${esc(s.avatar)}" alt="">`
    : s.avatarMon ? `<img src="${sprite(Number(s.avatarMon))}" alt="" loading="lazy">`
    : icon('user');
  return `<span class="avatar ${s.avatar ? 'photo' : ''}" style="--av:${size}px">${inner}</span>`;
}

export function memberSince() {
  if (IS_STORE) return trialStart();
  let d = settings.get().since;
  if (!d) { d = today(); settings.set({ since: d }); }
  return d;
}

// 256 px square crop, JPEG: small enough to live in localStorage.
async function toAvatar(file) {
  if (file.size > MAX_FILE) throw new Error('Image trop lourde (2 Mo maximum)');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format accepté : JPG, PNG ou WebP');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible')); i.src = url; });
    const side = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

let names = null;
async function loadNames() {
  if (!names) names = await fetch(asset('assets/data/pokemon-names.json')).then((r) => r.json());
  return names;
}
const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function openPicker(onDone) {
  const sh = openSheet({ title: 'Choisir un Pokémon', full: true, body: `
    <label class="field"><span>Rechercher</span><input data-q type="search" placeholder="Nom ou numéro (Tortank, 25…)" autocomplete="off"></label>
    <div class="mon-grid" data-grid></div>
    <button class="btn" data-more style="margin-top:12px;width:100%" hidden>Voir plus</button>
    <p class="note">Visuels : dépôt PokéAPI. Pokémon est une marque de Nintendo / Creatures / GAME FREAK / The Pokémon Company, application non affiliée.</p>` });
  const grid = sh.body.querySelector('[data-grid]');
  const more = sh.body.querySelector('[data-more]');
  const input = sh.body.querySelector('[data-q]');
  let list = [], shown = 0;
  const cur = Number(settings.get().avatarMon) || 0;
  const draw = (reset) => {
    if (reset) { grid.innerHTML = ''; shown = 0; }
    list.slice(shown, shown + 60).forEach(([id, fr]) => {
      const b = document.createElement('button');
      b.className = id === cur ? 'on' : '';
      b.dataset.id = id;
      b.innerHTML = `<img src="${sprite(id)}" alt="" loading="lazy"><span>${esc(fr)}</span>`;
      grid.append(b);
    });
    shown = Math.min(list.length, shown + 60);
    more.hidden = shown >= list.length;
  };
  const filter = () => {
    const q = fold(input.value).trim();
    list = !q ? names : names.filter(([id, fr, en]) => String(id) === q || fold(fr).includes(q) || fold(en).includes(q));
    draw(true);
  };
  loadNames().then(() => filter()).catch(() => { grid.innerHTML = '<p class="muted">Liste indisponible hors connexion.</p>'; });
  input.oninput = filter;
  more.onclick = () => draw(false);
  grid.onclick = (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    settings.set({ avatarMon: Number(b.dataset.id), avatar: '' });
    sh.close(); onDone();
  };
}

export function profileSection() {
  const s = settings.get();
  return `<section class="section" style="margin-top:6px" data-profile>
    <div class="section-head"><h2>Mon profil</h2></div>
    <div class="panel">
      <div class="profile-head">${avatarHtml(84)}
        <div class="btns">
          <button class="btn" data-photo>${icon('camera')}Changer la photo</button>
          <button class="btn" data-mon>Choisir un Pokémon</button>
          ${s.avatar || s.avatarMon ? '<button class="btn" data-noav style="opacity:.7">Retirer</button>' : ''}
        </div>
      </div>
      <p class="note" style="margin:8px 0 0">JPG, PNG ou WebP, 2 Mo maximum.</p>
      <form data-nick style="display:flex;gap:8px;margin-top:14px">
        <label class="field" style="flex:1;margin:0"><span>Pseudo</span><input name="nick" maxlength="24" autocomplete="off" placeholder="Votre pseudo" value="${esc(s.nick || '')}"></label>
        <button class="btn primary" type="submit" style="align-self:flex-end">Enregistrer</button>
      </form>
      <p class="muted" style="margin:12px 0 0;font-size:13px">Membre depuis le ${esc(dateFr(memberSince()))}</p>
    </div>
  </section>`;
}

export function bindProfile(root, rerender) {
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-photo],[data-mon],[data-noav]');
    if (!t || !root.contains(t)) return;
    if ('noav' in t.dataset) { settings.set({ avatar: '', avatarMon: 0 }); rerender(); return; }
    if ('mon' in t.dataset) { openPicker(rerender); return; }
    const f = await pickImage();
    if (!f) return;
    try { settings.set({ avatar: await toAvatar(f), avatarMon: 0 }); toast('Photo enregistrée'); rerender(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-nick]');
    if (!f) return;
    e.preventDefault();
    settings.set({ nick: f.nick.value.trim().slice(0, 24) });
    toast('Pseudo enregistré');
  });
}
