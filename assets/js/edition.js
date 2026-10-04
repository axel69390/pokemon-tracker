// Two editions share this code: "pdx" (Axel's Pokédex Invest, personal server) and "cardvault"
// (the store edition: data on the device, 14-day trial then subscription). The page sets
// window.APP_EDITION before loading the app.
export const EDITION = (typeof window !== 'undefined' && window.APP_EDITION) || 'pdx';
export const IS_STORE = EDITION === 'cardvault';
export const APP_NAME = IS_STORE ? 'CardVault' : 'Pokédex Invest';
// Repository root (…/pokemon-tracker/), whatever folder the page is served from.
export const ROOT = new URL('../../', import.meta.url).href.replace(/\?.*$/, '');
export const ICON = IS_STORE ? ROOT + 'cardvault/icon.svg' : ROOT + 'icon.svg';
export const asset = (path) => ROOT + path;
// URL of the eBay listings proxy (tools/ebay-proxy/worker.js, deployed on Cloudflare). Empty = the eBay section is hidden.
export const EBAY_API = 'https://ebay-proxy.axel-ger.workers.dev/';
