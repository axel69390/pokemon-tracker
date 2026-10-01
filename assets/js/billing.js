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
  let plan = 'cardvault_yearly';
  const draw = async () => {
    const [prices, buyable] = await Promise.all([planPrices(), canBuy()]);
    const d = trialDaysLeft();
    const label = (p) => (prices[p.sku] ? `${prices[p.sku]} / ${p.sku.endsWith('yearly') ? T('an', 'year') : T('mois', 'month')}` : p.fallback);
    const perMonth = isEn() ? '≈ €2.08 / month' : 'soit environ 2,08 € / mois';
    sheet.render(`<div data-no-tr class="paywall">
      <div class="pw-hero">
        <div class="pw-ic">${icon('star', 'lg')}</div>
        <h2>${T('Passez à CardVault Premium', 'Go CardVault Premium')}</h2>
        <p>${esc(reason) || T('Valorisez toute votre collection avec des prix fiables.', 'Value your whole collection with reliable prices.')}</p>
        <span class="pill gold">${esc(statusLabel())}</span>
      </div>
      <ul class="pw-benefits">
        ${[
          T('Cartes et produits scellés illimités', 'Unlimited cards and sealed products'),
          T('Cote du marché : ventes réelles, Cardmarket et TCGplayer', 'Market price: real sales, Cardmarket and TCGplayer'),
          T('Courbes d’évolution et tendance sur 30 jours', 'Price charts and 30-day trend'),
          T('Invest : monte, baisse, stable, et le bon moment pour vendre', 'Invest: rising, falling, stable, and the right time to sell'),
          T('Suivi des sets carte par carte', 'Set tracking card by card'),
        ].map((txt) => `<li><span class="up">${icon('check', 'sm')}</span><span>${esc(txt)}</span></li>`).join('')}
      </ul>
      <div class="pw-plans">
        ${PLANS.map((p) => { const yr = p.sku.endsWith('yearly'); return `<button class="pw-plan ${plan === p.sku ? 'on' : ''}" data-plan="${p.sku}">
          ${yr ? `<span class="pw-best">${T('Meilleure offre', 'Best value')}</span>` : ''}
          <span class="pw-t">${yr ? T('Annuel', 'Yearly') : T('Mensuel', 'Monthly')}</span>
          <b class="num">${esc(label(p))}</b>
          <small>${yr ? perMonth : T('Sans engagement', 'No commitment')}</small></button>`; }).join('')}
      </div>
      ${buyable ? `<button class="btn primary block pw-cta" data-buy="${plan}">${d > 0 ? T(`Essayer gratuitement · ${d} jour${d > 1 ? 's' : ''}`, `Try free · ${d} day${d > 1 ? 's' : ''}`) : T('S’abonner', 'Subscribe')}</button>
        <button class="btn ghost block" data-restore>${T('Restaurer mes achats', 'Restore purchases')}</button>`
        : `<a class="btn primary block pw-cta" href="${STORE_URL}" target="_blank" rel="noopener">${icon('ext')}${T('S’abonner dans l’application Android', 'Subscribe in the Android app')}</a>`}
      <p class="note" style="text-align:center">${d > 0 ? T('Aucun paiement avant la fin de l’essai.', 'Nothing is charged before the trial ends.') : T('Vos données restent consultables et exportables dans Réglages.', 'Your data stays viewable and exportable in Settings.')}
        ${T(' Abonnement géré par Google Play, résiliable à tout moment.', ' Subscription managed by Google Play, cancel anytime.')}</p>
      <p class="pw-legal"><a href="privacy.html" target="_blank" rel="noopener">${T('Confidentialité', 'Privacy')}</a> · <a href="https://play.google.com/intl/fr_fr/about/play-terms/" target="_blank" rel="noopener">${T('Conditions', 'Terms')}</a></p>
    </div>`);
  };
  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-buy],[data-restore],[data-plan]');
    if (!t) return;
    if (t.dataset.plan) { plan = t.dataset.plan; draw(); return; }
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
