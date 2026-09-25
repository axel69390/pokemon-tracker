// Lightweight SVG line chart with touch/mouse scrubbing (no dependency).
import { money, dateFr, esc } from './ui.js?v=2.3.0';

const DAY = 86400e3;
const ts = (d) => new Date(d + 'T12:00:00').getTime();

export const PERIODS = [
  { id: '1m', label: '1M', days: 31 },
  { id: '3m', label: '3M', days: 92 },
  { id: '6m', label: '6M', days: 183 },
  { id: '1a', label: '1A', days: 366 },
  { id: 'max', label: 'Max', days: Infinity },
];

// Tiny inline trend line for lists.
export function sparkline(values, { w = 92, h = 30, color = '#e9b949' } = {}) {
  const v = values.filter((x) => x != null && isFinite(x));
  if (v.length < 2) return `<svg class="spark" width="${w}" height="${h}"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 4"/></svg>`;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * w, h - 3 - ((x - lo) / span) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}L${w},${h}L0,${h}Z" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
}

export function filterPeriod(points, periodId) {
  const p = PERIODS.find((x) => x.id === periodId) || PERIODS[PERIODS.length - 1];
  if (!isFinite(p.days)) return points;
  const from = Date.now() - p.days * DAY;
  const inside = points.filter((x) => ts(x.d) >= from);
  // Carry the last known values into the window so lines start at its left edge.
  const before = points.filter((x) => ts(x.d) < from);
  if (before.length) {
    const lastVal = [...before].reverse().find((x) => x.value != null);
    const edge = new Date(from).toISOString().slice(0, 10);
    inside.unshift({ d: edge, invested: before[before.length - 1].invested, value: lastVal ? lastVal.value : null });
  }
  return inside;
}

/**
 * series: [{ key, color, dashed, area }] ; points: [{ d, [key]: number|null }]
 */
export function renderChart(el, points, series, { height = 190 } = {}) {
  const usable = points.filter((p) => series.some((s) => p[s.key] != null));
  if (usable.length < 1) {
    el.innerHTML = '<div class="chart-empty">Pas encore d’historique.<br>La courbe se construit jour après jour.</div>';
    return;
  }
  const W = Math.max(280, el.clientWidth || 340);
  const H = height;
  const padT = 34, padB = 6;
  const xs = usable.map((p) => ts(p.d));
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < DAY) { x0 -= DAY * 3; x1 += DAY; }
  const vals = usable.flatMap((p) => series.map((s) => p[s.key]).filter((v) => v != null));
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.1);
  y0 -= span * 0.12; y1 += span * 0.08;
  const X = (t) => ((t - x0) / (x1 - x0)) * W;
  const Y = (v) => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);

  const paths = series.map((s) => {
    const pts = usable.filter((p) => p[s.key] != null).map((p) => [X(ts(p.d)), Y(p[s.key])]);
    if (!pts.length) return '';
    if (pts.length === 1) pts.unshift([Math.max(0, pts[0][0] - 1), pts[0][1]]);
    // Step line for invested amounts (money arrives on purchase day), smooth-ish polyline otherwise.
    const d = s.step
      ? pts.map((p, i) => (i ? `H${p[0].toFixed(1)}V${p[1].toFixed(1)}` : `M${p[0].toFixed(1)},${p[1].toFixed(1)}`)).join('')
      : pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    const area = s.area
      ? `<path d="${d}L${last[0].toFixed(1)},${H}L${pts[0][0].toFixed(1)},${H}Z" fill="url(#g-${s.key})" stroke="none"/>`
      : '';
    return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" ${s.dashed ? 'stroke-dasharray="4 5"' : ''} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${s.dot ? `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}" stroke="#0b0c10" stroke-width="2"/>` : ''}`;
  }).join('');

  const defs = series.filter((s) => s.area).map((s) => `<linearGradient id="g-${s.key}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs}</defs>${paths}
    <line class="cursor" x1="0" x2="0" y1="${padT - 6}" y2="${H}" stroke="rgba(255,255,255,.25)" stroke-width="1" visibility="hidden"/></svg>
    <div class="tip hidden"></div>`;

  const svg = el.querySelector('svg');
  const cursor = el.querySelector('.cursor');
  const tip = el.querySelector('.tip');
  const move = (clientX) => {
    const r = svg.getBoundingClientRect();
    const t = x0 + ((clientX - r.left) / r.width) * (x1 - x0);
    let best = usable[0];
    usable.forEach((p) => { if (Math.abs(ts(p.d) - t) < Math.abs(ts(best.d) - t)) best = p; });
    const cx = X(ts(best.d));
    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('visibility', 'visible');
    tip.classList.remove('hidden');
    tip.innerHTML = `<span class="faint">${esc(dateFr(best.d))}</span>` +
      series.map((s) => (best[s.key] != null ? `<b style="color:${s.tipColor || s.color}">${esc(s.label)} ${money(best[s.key])}</b>` : '')).join('');
    const px = (cx / W) * r.width;
    tip.style.left = Math.min(Math.max(px, 70), r.width - 70) + 'px';
  };
  const leave = () => { cursor.setAttribute('visibility', 'hidden'); tip.classList.add('hidden'); };
  svg.addEventListener('pointermove', (e) => move(e.clientX));
  svg.addEventListener('pointerdown', (e) => move(e.clientX));
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(leave, 1400); });
}
