// CardVault (store edition): 14-day free trial from the first launch, then a Google Play subscription.
// Purchases go through the Digital Goods API + Payment Request inside the Android app (Trusted Web
// Activity). In a regular browser the subscription cannot be bought: the paywall points to the Android app.
import { IS_STORE } from './edition.js?v=2.4.0';
import { openSheet, toast, icon, esc, today } from './ui.js?v=2.4.0';
import { isEn } from './i18n.js?v=2.4.0';

export const TRIAL_DAYS = 14;
const PLAY = 'https://play.google.com/billing';
export const PLANS = [
  { sku: 'cardvault_monthly', fallback: isEn() ? '€2.99 / month' : '2,99 € / mois' },
  { sku: 'cardvault_yearly', fallback: isEn() ? '€24.90 / year' : '24,90 € / an', badge: isEn() ? '−30 %' : '−30 %' },
];
// Play Store listing (used from a regular browser once the app is published).
export const STORE_URL = 'https://play.google.com/store/apps/details?id=io.github.axel69390.cardvault';
// Optional server endpoint that verifies and acknowledges purchases with the Play Developer API
// (Google refunds unacknowledged purchases after 3 days). Empty until the Play account is set up.
const ACK_URL = '';

const K_FIRST = 'cv.firstRun';
const K_PREMIUM = 'cv.premium';
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function trialStart() {
  let d = ls.get(K_FIRST);
  if (!d) { d = today(); ls.set(K_FIRST, d); }
  return d;
}
export function trialDaysLeft() {
  const start = new Date(trialStart() + 'T00:00:00');
  const elapsed = Math.floor((Date.now() - start.getTime()) / 864e5);
  return Math.max(0, TRIAL_DAYS - elapsed);
}
let premium = ls.get(K_PREMIUM) === '1';
export const isPremium = () => premium;
export const hasAccess = () => !IS_STORE || premium || trialDaysLeft() > 0;

async function playService() {
  if (!('getDigitalGoodsService' in window)) return null;
  try { return await window.getDigitalGoodsService(PLAY); } catch { return null; }
}
export const canBuy = async () => !!(await playService()) && 'PaymentRequest' in window;

export async function checkPurchases() {
  if (!IS_STORE) return true;
  const svc = await playService();
  if (!svc) return premium;
  try {
    const list = await svc.listPurchases();
    premium = list.some((p) => PLANS.some((x) => x.sku === p.itemId));
    ls.set(K_PREMIUM, premium ? '1' : '0');
  } catch { /* keep cached state */ }
  return premium;
}

async function planPrices() {
  const svc = await playService();
  if (!svc) return {};
  try {
    const details = await svc.getDetails(PLANS.map((p) => p.sku));
    const out = {};
    details.forEach((d) => {
      out[d.itemId] = new Intl.NumberFormat(isEn() ? 'en-IE' : 'fr-FR', { style: 'currency', currency: d.price.currency }).format(Number(d.price.value));
    });
    return out;
  } catch { return {}; }
}

export async function buy(sku) {
  const req = new PaymentRequest([{ supportedMethods: PLAY, data: { sku } }],
    { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } });
  const resp = await req.show();
  const { purchaseToken } = resp.details || {};
  if (ACK_URL && purchaseToken) {
    try {
      await fetch(ACK_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ sku, purchaseToken }) });
    } catch { /* retried on next launch by checkPurchases */ }
  }
  await resp.complete('success');
  premium = true;
  ls.set(K_PREMIUM, '1');
  return purchaseToken;
}

/* ---------- UI ---------- */
const T = (fr, en) => (isEn() ? en : fr);

export function statusLabel() {
  if (premium) return T('CardVault Premium actif', 'CardVault Premium active');
  const d = trialDaysLeft();
  return d > 0 ? T(`Essai gratuit : ${d} jour${d > 1 ? 's' : ''} restant${d > 1 ? 's' : ''}`, `Free trial: ${d} day${d > 1 ? 's' : ''} left`)
    : T('Essai gratuit terminé', 'Free trial ended');
}

export function openPaywall({ reason = '' } = {}) {
  const sheet = openSheet({ title: 'CardVault Premium', full: true });
  const draw = async () => {
    const [prices, buyable] = await Promise.all([planPrices(), canBuy()]);
    const d = trialDaysLeft();
    sheet.render(`<div data-no-tr>
      <div class="panel hero" style="margin-top:4px">
        <div class="label">${esc(statusLabel())}</div>
        <div class="big" style="font-size:28px">${T('Gérez et valorisez toute votre collection', 'Manage and value your whole collection')}</div>
        ${reason ? `<p class="muted" style="margin:0">${esc(reason)}</p>` : ''}
      </div>
      <div class="list" style="margin-top:14px">
        ${[
          ['cards', T('Cartes et produits scellés illimités', 'Unlimited cards and sealed products')],
          ['up', T('Cotes Cardmarket mises à jour chaque jour', 'Cardmarket prices updated every day')],
          ['history', T('Courbes, moyennes du jour et sur 30 jours', 'Charts, daily and 30-day averages')],
          ['tag', T('Invest : veille, objectifs de revente et alertes de hausse', 'Invest: watchlist, resale targets and rise alerts')],
          ['layers', T('Suivi des sets carte par carte', 'Set tracking card by card')],
        ].map(([ic, txt]) => `<div class="row"><span class="up">${icon(ic)}</span><span class="main"><b style="font-weight:600;white-space:normal">${esc(txt)}</b></span></div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        ${PLANS.map((p) => `<button class="btn ${p.sku.endsWith('yearly') ? 'primary' : ''} block" data-buy="${p.sku}" ${buyable ? '' : 'disabled'}>
          ${esc(prices[p.sku] ? `${prices[p.sku]} / ${p.sku.endsWith('yearly') ? T('an', 'year') : T('mois', 'month')}` : p.fallback)}${p.badge ? ` <span class="pill up">${p.badge}</span>` : ''}</button>`).join('')}
        ${buyable ? `<button class="btn ghost block" data-restore>${T('Restaurer mes achats', 'Restore purchases')}</button>`
          : `<a class="btn block" href="${STORE_URL}" target="_blank" rel="noopener">${icon('ext')}${T('S’abonner dans l’application Android', 'Subscribe in the Android app')}</a>`}
      </div>
      <p class="note" style="text-align:center">${d > 0 ? T(`Votre essai gratuit se termine dans ${d} jour${d > 1 ? 's' : ''}. Aucun paiement avant de choisir une offre.`, `Your free trial ends in ${d} day${d > 1 ? 's' : ''}. Nothing is charged until you pick a plan.`)
        : T('Vos données restent consultables et exportables dans Réglages.', 'Your data stays viewable and exportable in Settings.')}
        ${T(' Abonnement géré par Google Play, résiliable à tout moment.', ' Subscription managed by Google Play, cancel anytime.')}</p>
    </div>`);
  };
  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-buy],[data-restore]');
    if (!t) return;
    try {
      if (t.dataset.buy) { await buy(t.dataset.buy); toast(T('Merci ! CardVault Premium est activé', 'Thank you! CardVault Premium is active')); sheet.close(); location.reload(); }
      if ('restore' in t.dataset) { const ok = await checkPurchases(); toast(ok ? T('Abonnement restauré', 'Subscription restored') : T('Aucun abonnement trouvé', 'No subscription found'), { error: !ok }); if (ok) { sheet.close(); location.reload(); } }
    } catch (err) {
      if (err && err.name !== 'AbortError') toast(T('Paiement non abouti', 'Payment not completed'), { error: true });
    }
  });
  draw();
}

// Gate for Premium actions: true when allowed, otherwise opens the paywall.
export function requireAccess(reason) {
  if (hasAccess()) return true;
  openPaywall({ reason: reason || T('Votre essai gratuit est terminé.', 'Your free trial has ended.') });
  return false;
}
