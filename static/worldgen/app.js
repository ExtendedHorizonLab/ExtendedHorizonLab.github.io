'use strict';
/* WorldGen dashboard: the page. It asks the server (dashboard/server.py) for the state of things
   once a second and draws it; nothing here changes the system. Text from the system (names,
   lines, log lines) is always set as text, never as markup. */

// ---------------------------------------------------------------- small helpers
const $ = (selector, root = document) => root.querySelector(selector);
const NS = 'http://www.w3.org/2000/svg';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, kids);
  return el;
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}
function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === '') continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}
function fill(el, ...kids) { el.replaceChildren(); append(el, kids); return el; }

const nf = new Intl.NumberFormat('en-US');
const fmt = {
  int: n => n == null ? '—' : nf.format(Math.round(n)),
  num: (n, digits = 1) => n == null ? '—' : Number(n).toFixed(digits).replace(/\.0+$/, ''),
  compact(n) {
    if (n == null) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return nf.format(Math.round(n));
  },
  clock(seconds) {
    if (seconds == null) return '—';
    const t = Math.max(0, Math.round(seconds)), m = Math.floor(t / 60) % 60, hrs = Math.floor(t / 3600);
    return (hrs ? hrs + ':' + String(m).padStart(2, '0') : m) + ':' + String(t % 60).padStart(2, '0');
  },
  span(seconds) {
    if (seconds == null) return '—';
    if (seconds < 90) return Math.round(seconds) + ' s';
    if (seconds < 5400) return Math.round(seconds / 60) + ' min';
    if (seconds < 129600) return fmt.num(seconds / 3600) + ' h';
    return Math.round(seconds / 86400) + ' d';
  },
  money(d) {
    if (d == null || d === '') return '—';
    const n = Number(d);
    return Number.isFinite(n) ? '$' + (n < 0.1 ? n.toFixed(3) : n.toFixed(2)) : String(d);
  },
  pct(share) { return share == null ? '—' : Math.round(share * 100) + '%'; },
  gb(mb) { return mb == null ? '—' : (mb / 1024).toFixed(1) + ' GB'; },
  bytes(n) { return n == null ? '—' : n >= 2 ** 30 ? (n / 2 ** 30).toFixed(1) + ' GB' : n >= 2 ** 20 ? (n / 2 ** 20).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; },
  wall(ts) { return new Date(ts * 1000).toLocaleTimeString('en-GB'); },
  date(ts) { return ts ? new Date(ts * 1000).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; },
};
const words = id => String(id || '').replace(/(_v\d+)?(_\d+)?$/, '').replace(/_/g, ' ').trim() || String(id || '');
const cap = text => text ? text[0].toUpperCase() + text.slice(1) : text;

// Status marks: a shape and a word, never colour alone.
const MARKS = {
  good: 'M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1z',     // a disc
  warning: 'M6 1l5.2 9.5H.8z',                    // a triangle
  serious: 'M6 .8L11.2 6 6 11.2.8 6z',            // a diamond
  critical: 'M1.5 1.5h9v9h-9z',                   // a square
};
function mark(level) {
  const svg = s('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' });
  svg.append(level === 'idle'
    ? s('circle', { cx: 6, cy: 6, r: 4, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 })
    : s('path', { d: MARKS[level] || MARKS.good, fill: 'currentColor' }));
  return svg;
}
function status(level, label) { return h('span', { class: 'status ' + level }, mark(level), label); }

const ICONS = {
  say: 'M2 2.5h10V9H6.5l-3 2.5V9H2z',                                                   // a speech bubble
  thought: 'M4.5 9.5a3 3 0 1 1 .6-5.9 3.2 3.2 0 0 1 6 1.1 2.4 2.4 0 0 1-.6 4.8z',       // a cloud
  action: 'M3.5 2.5L11 7l-7.5 4.5z',                                                    // an arrowhead
  world: 'M7 1.5l5 2.8v5.4l-5 2.8-5-2.8V4.3z',                                          // a block
};
function icon(kind) {
  const svg = s('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true' });
  if (kind === 'problem' || kind === 'fault') {
    svg.append(s('path', { d: 'M7 1.5l6 10.8H1z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
      s('path', { d: 'M7 5.5v3.2M7 10.3v.3', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  } else if (kind === 'world') {
    svg.append(s('path', { d: ICONS.world, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }));
  } else {
    svg.append(s('path', { d: ICONS[kind] || ICONS.action, fill: 'currentColor' }));
  }
  return svg;
}

const tip = {
  el: $('#tooltip'),
  show(event, ...content) {
    fill(this.el, ...content);
    this.el.hidden = false;
    const pad = 14, box = this.el.getBoundingClientRect();
    let x = event.clientX + pad, y = event.clientY + pad;
    if (x + box.width > innerWidth - 8) x = event.clientX - box.width - pad;
    if (y + box.height > innerHeight - 8) y = event.clientY - box.height - pad;
    this.el.style.left = Math.max(4, x) + 'px';
    this.el.style.top = Math.max(4, y) + 'px';
  },
  hide() { this.el.hidden = true; },
};

async function api(path) {
  // (A replay on a website, with no server: replay.js answers. See dashboard/export_replay.py.)
  if (window.REPLAY) return window.REPLAY.api(path);
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(path + ': ' + response.status);
  return response.json();
}

// ---------------------------------------------------------------- state
const S = {
  tab: 'live', state: null, ok: false, failures: 0,
  events: [], seq: 0, series: {},
  selected: null, feedKind: 'all', feedWho: '', range: 600,
  scene: null, sceneData: null, framedFor: null,
  chartTables: new Set(), lastCharts: 0,
};

// ---------------------------------------------------------------- charts
/* A line chart: one or two series of the same unit on one axis, hairline grid, a crosshair that
   finds the nearest time, and the values in a tooltip. opts: {series: [{name, color, points:
   [[x, y]]}], x0, x1, unit, yMax, ticks: [[x, label]], gap, tipTime: x => text, height}. */
function lineChart(host, opts) {
  const width = Math.max(240, host.clientWidth || 320), height = opts.height || 150;
  const m = { l: 36, r: 46, t: 8, b: 20 };
  const pw = width - m.l - m.r, ph = height - m.t - m.b;
  const all = opts.series.flatMap(se => se.points.filter(p => p[0] >= opts.x0 && p[0] <= opts.x1));
  let top = opts.yMax || niceMax(Math.max(1e-9, ...all.map(p => p[1])));
  const X = x => m.l + (x - opts.x0) / Math.max(1e-9, opts.x1 - opts.x0) * pw;
  const Y = y => m.t + ph - Math.min(1, Math.max(0, y / top)) * ph;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': opts.label || '' });
  for (const f of [0, 0.5, 1]) {
    svg.append(s('line', { class: f ? 'grid' : 'base', x1: m.l, x2: m.l + pw, y1: Y(top * f), y2: Y(top * f) }));
    if (all.length || opts.yMax) svg.append(s('text', { x: m.l - 6, y: Y(top * f) + 3.5, 'text-anchor': 'end', text: tickText(top * f) }));
  }
  for (const [x, label] of opts.ticks || []) {
    svg.append(s('text', { x: X(x), y: height - 4, 'text-anchor': x >= opts.x1 ? 'end' : x <= opts.x0 ? 'start' : 'middle', text: label }));
  }
  if (!all.length) {
    svg.append(s('text', { class: 'nodata', x: m.l + pw / 2, y: m.t + ph / 2 + 4, 'text-anchor': 'middle', text: opts.empty || 'no data yet' }));
    host.replaceChildren(svg);
    return;
  }
  const gap = opts.gap || Infinity;
  opts.series.forEach((se, index) => {
    const pts = se.points.filter(p => p[0] >= opts.x0 && p[0] <= opts.x1);
    if (!pts.length) return;
    let d = '', area = '', runStart = null, last = null;
    const closeArea = () => { if (runStart != null && last) area += `L${X(last[0]).toFixed(1)},${Y(0)}L${X(runStart).toFixed(1)},${Y(0)}Z`; };
    for (const p of pts) {
      const fresh = !last || p[0] - last[0] > gap;
      if (fresh) { closeArea(); runStart = p[0]; }
      const point = `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;
      d += (fresh ? 'M' : 'L') + point;
      area += (fresh ? 'M' : 'L') + point;
      last = p;
    }
    closeArea();
    if (opts.series.length === 1) svg.append(s('path', { d: area, fill: se.color, opacity: 0.10 }));
    svg.append(s('path', { class: 'line', d, stroke: se.color }));
    if (opts.endLabels !== false && (opts.x1 - last[0]) <= (opts.live ? 10 : Infinity)) {
      svg.append(s('circle', { class: 'dot', cx: X(last[0]), cy: Y(last[1]), r: 4, fill: se.color }));
      if (opts.series.length === 1 || index === 0 || Math.abs(Y(last[1]) - Y(lastOf(opts.series[0].points, opts)[1])) > 12) {
        svg.append(s('text', { x: X(last[0]) + 8, y: Y(last[1]) + 3.5, style: 'fill: var(--ink-2); font-weight: 600', text: tickText(last[1]) }));
      }
    }
  });
  const cross = s('line', { class: 'cross', y1: m.t, y2: m.t + ph, visibility: 'hidden' });
  const dots = opts.series.map(se => s('circle', { class: 'dot', r: 4, fill: se.color, visibility: 'hidden' }));
  const hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });
  svg.append(cross, ...dots, hit);
  const move = event => {
    const box = svg.getBoundingClientRect();
    const x = opts.x0 + ((event.clientX - box.left) * (width / box.width) - m.l) / pw * (opts.x1 - opts.x0);
    const near = opts.series.map(se => nearest(se.points, x));
    const anchor = near.filter(Boolean).sort((a, b) => Math.abs(a[0] - x) - Math.abs(b[0] - x))[0];
    if (!anchor) return;
    cross.setAttribute('x1', X(anchor[0])); cross.setAttribute('x2', X(anchor[0])); cross.setAttribute('visibility', 'visible');
    const rows = [h('div', { class: 't', text: opts.tipTime ? opts.tipTime(anchor[0]) : '' })];
    near.forEach((p, i) => {
      const shown = p && Math.abs(p[0] - anchor[0]) <= (opts.gap || 5);
      dots[i].setAttribute('visibility', shown ? 'visible' : 'hidden');
      if (!shown) return;
      dots[i].setAttribute('cx', X(p[0])); dots[i].setAttribute('cy', Y(p[1]));
      rows.push(h('div', { class: 'row' }, h('span', {}, h('i', { style: { background: opts.series[i].color } }), opts.series[i].name),
        h('b', { text: fmt.num(p[1], p[1] < 10 ? 2 : 1) + ' ' + (opts.unit || '') })));
    });
    tip.show(event, ...rows);
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); tip.hide(); });
  host.replaceChildren(svg);
}
function lastOf(points, opts) { const pts = points.filter(p => p[0] >= opts.x0 && p[0] <= opts.x1); return pts[pts.length - 1] || [0, 0]; }
function nearest(points, x) {
  if (!points.length) return null;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] < x) lo = mid; else hi = mid; }
  return Math.abs(points[lo][0] - x) <= Math.abs(points[hi][0] - x) ? points[lo] : points[hi];
}
function niceMax(value) {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 4, 5, 10]) if (value <= step * power) return step * power;
  return 10 * power;
}
function tickText(v) { return v >= 10000 ? fmt.compact(v) : v >= 100 ? String(Math.round(v)) : fmt.num(v, v < 10 && v % 1 ? 1 : 0); }

/* The points of a chart as a table (the same numbers, without the picture). */
function pointsTable(series, xLabel, xText, unit, limit = 14) {
  const xs = [...new Set(series.flatMap(se => se.points.map(p => p[0])))].sort((a, b) => a - b).slice(-limit).reverse();
  const at = series.map(se => new Map(se.points.map(p => [p[0], p[1]])));
  return h('div', { class: 'table-wrap small-table' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', { text: xLabel }), series.map(se => h('th', { class: 'r', text: se.name + (unit ? ', ' + unit : '') })))),
    h('tbody', {}, xs.map(x => h('tr', {}, h('td', { text: xText(x) }), at.map(map => h('td', { class: 'r', text: map.has(x) ? fmt.num(map.get(x), 2) : '' })))))));
}

function sparkline(points, color = 'var(--series-1)') {
  const width = 84, height = 30;
  const svg = s('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
  if (points.length < 2) return svg;
  const x0 = points[0][0], x1 = points[points.length - 1][0], top = Math.max(1e-9, ...points.map(p => p[1]));
  const d = points.map((p, i) => (i ? 'L' : 'M') + ((p[0] - x0) / Math.max(1e-9, x1 - x0) * (width - 4) + 2).toFixed(1) + ',' + (height - 3 - p[1] / top * (height - 6)).toFixed(1)).join('');
  svg.append(s('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.9 }));
  return svg;
}

/* Ranked bars: one hue, largest first, the value at the tip. */
function barList(rows, unit = '') {
  const top = Math.max(1, ...rows.map(r => r[1]));
  const el = h('div', { class: 'bars' });
  for (const [label, value, note] of rows) {
    const track = h('div', { class: 'track' }, h('i', { style: { width: (value / top * 100).toFixed(1) + '%' } }));
    track.addEventListener('pointermove', event => tip.show(event, h('b', { text: fmt.int(value) + (unit ? ' ' + unit : '') }), ' ' + label, note ? h('div', { class: 't', text: note }) : null));
    track.addEventListener('pointerleave', () => tip.hide());
    el.append(h('div', { text: label }), track, h('div', { class: 'v', text: fmt.int(value) }));
  }
  return el;
}

// ---------------------------------------------------------------- the map
/* The scene from above, as Unity shows it from the top (its +X to the right, its +Z up). WorldGen's
   x is Unity's mirrored, so a WorldGen point (x, z) is drawn at (-x, -z). */
class SceneMap {
  constructor(host, onPick) {
    this.host = host; this.onPick = onPick;
    this.view = { cx: 0, cy: 0, w: 120 };
    this.people = new Map();
    this.extent = 200;
    this.svg = s('svg', {});
    this.gStatic = s('g', {}); this.gRooms = s('g', {}); this.gPeople = s('g', {});
    this.svg.append(this.gStatic, this.gRooms, this.gPeople);
    this.empty = h('div', { class: 'empty', style: { position: 'absolute', inset: 0 } });
    this.legend = h('div', { class: 'map-legend' },
      h('span', {}, h('i', { style: { background: 'var(--map-building)' } }), 'buildings'),
      h('span', {}, h('i', { style: { background: 'var(--map-room)', outline: '1.5px solid var(--accent)' } }), 'rooms to walk into'),
      h('span', {}, h('i', { style: { background: 'var(--accent)', borderRadius: '50%' } }), 'characters'),
      h('span', { class: 'muted', text: 'drag to move · Ctrl + scroll to zoom' }));
    this.roomLabels = [];
    host.append(this.svg, this.legend, this.empty);
    new ResizeObserver(() => this.apply()).observe(host);
    // Ctrl + wheel (and a pinch on a touchpad) zooms; the wheel alone scrolls the page as anywhere else.
    host.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      this.zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, event);
    }, { passive: false });
    let drag = null;
    host.addEventListener('pointerdown', event => {
      if (event.target.closest('.who')) return;
      drag = { x: event.clientX, y: event.clientY, cx: this.view.cx, cy: this.view.cy, moved: false };
      host.setPointerCapture(event.pointerId);
    });
    host.addEventListener('pointermove', event => {
      if (!drag) return;
      const k = this.view.w / host.clientWidth;
      if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 3) { drag.moved = true; host.classList.add('dragging'); tip.hide(); }
      this.view.cx = drag.cx - (event.clientX - drag.x) * k;
      this.view.cy = drag.cy - (event.clientY - drag.y) * k;
      this.apply();
    });
    const end = () => { drag = null; host.classList.remove('dragging'); };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    this.svg.addEventListener('pointermove', event => {
      const shape = event.target.closest('[data-tip]');
      if (shape && !drag) tip.show(event, h('b', { text: shape.dataset.tip }), shape.dataset.sub ? h('div', { class: 't', text: shape.dataset.sub }) : null);
      else if (!event.target.closest('.who')) tip.hide();
    });
    this.svg.addEventListener('pointerleave', () => tip.hide());
  }

  message(title, text) {
    this.empty.hidden = !title;
    if (title) fill(this.empty, h('div', {}, h('b', { text: title }), text));
  }

  zoom(factor, event) {
    const box = this.host.getBoundingClientRect();
    const k = this.view.w / box.width;
    const fx = event ? event.clientX - box.left - box.width / 2 : 0, fy = event ? event.clientY - box.top - box.height / 2 : 0;
    const wx = this.view.cx + fx * k, wy = this.view.cy + fy * k;
    this.view.w = Math.min(Math.max(this.view.w * factor, 6), this.extent * 3);
    const k2 = this.view.w / box.width;
    this.view.cx = wx - fx * k2; this.view.cy = wy - fy * k2;
    this.apply();
  }

  apply() {
    const pw = this.host.clientWidth || 600, ph = this.host.clientHeight || 400;
    const vh = this.view.w * ph / pw;
    this.svg.setAttribute('viewBox', `${this.view.cx - this.view.w / 2} ${this.view.cy - vh / 2} ${this.view.w} ${vh}`);
    const k = this.view.w / pw;
    this.k = k;
    for (const mk of this.svg.querySelectorAll('.mk')) mk.setAttribute('transform', `scale(${k})`);
    for (const label of this.gRooms.querySelectorAll('g.lab')) label.setAttribute('transform', `translate(${label.dataset.x},${label.dataset.y}) scale(${k})`);
    this.layoutLabels();
  }

  /* Names beside their dots where they do not cover one another, a room's name or someone's line:
     the first free place of a few round the dot (all in screen pixels). */
  layoutLabels() {
    const k = this.k || 1, taken = [];
    const hits = box => taken.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
    for (const r of this.roomLabels) taken.push({ x0: r.x / k - r.w / 2, x1: r.x / k + r.w / 2, y0: r.y / k + 3, y1: r.y / k + 17 });
    const people = [...this.people.values()].filter(p => p.at);
    for (const p of people) {
      const x = p.at[0] / k, y = p.at[1] / k;
      taken.push({ x0: x - 8, x1: x + 8, y0: y - 8, y1: y + 8 });
      if (p.said.textContent) { const w = p.said.textContent.length * 5.6; taken.push({ x0: x - w / 2, x1: x + w / 2, y0: y + 11, y1: y + 25 }); }
    }
    const places = [[0, -15, 'middle'], [12, 4, 'start'], [-12, 4, 'end'], [0, -29, 'middle'], [12, -10, 'start'], [-12, -10, 'end'], [12, 18, 'start'], [-12, 18, 'end'], [0, -43, 'middle']];
    for (const p of people.sort((a, b) => a.at[1] - b.at[1])) {
      const x = p.at[0] / k, y = p.at[1] / k, w = p.name.textContent.length * 6.6 + 4;
      let best = null;
      for (const [dx, dy, anchor] of places) {
        const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x + dx : x + dx - w;
        const box = { x0, x1: x0 + w, y0: y + dy - 10, y1: y + dy + 3 };
        if (!best) best = { dx, dy, anchor, box };
        if (!hits(box)) { best = { dx, dy, anchor, box }; break; }
      }
      taken.push(best.box);
      p.name.setAttribute('x', best.anchor === 'middle' ? 0 : best.dx);
      p.name.setAttribute('y', best.dy);
      p.name.setAttribute('text-anchor', best.anchor);
    }
  }

  frame(box) {
    if (!box) return;
    const pw = this.host.clientWidth || 600, ph = this.host.clientHeight || 400;
    const bw = Math.max(box.x1 - box.x0, 1), bh = Math.max(box.y1 - box.y0, 1);
    this.view.cx = (box.x0 + box.x1) / 2; this.view.cy = (box.y0 + box.y1) / 2;
    this.view.w = Math.max(bw, bh * pw / ph, 24) * 1.18;
    this.apply();
  }
  frameSite() { const e = this.extent / 2; this.frame({ x0: -e, x1: e, y0: -e, y1: e }); }
  framePeople() {
    const pts = [...this.people.values()].map(p => p.at).filter(Boolean);
    if (!pts.length) return this.frameSite();
    this.frame({ x0: Math.min(...pts.map(p => p[0])) - 6, x1: Math.max(...pts.map(p => p[0])) + 6,
                 y0: Math.min(...pts.map(p => p[1])) - 6, y1: Math.max(...pts.map(p => p[1])) + 6 });
  }

  setScene(data) {
    this.gStatic.replaceChildren(); this.gRooms.replaceChildren();
    this.roomLabels = [];
    if (!data || data.error) return;
    this.extent = data.extent || 200;
    const e = this.extent / 2;
    // The ground itself (terrain, lanes, paving, fields, water), drawn once by the server from the scene's meshes.
    const g = data.ground;
    if (g && g.url) this.gStatic.append(s('image', { class: 'ground', href: g.url, x: g.x, y: g.y, width: g.width, height: g.height, preserveAspectRatio: 'none' }));
    this.gStatic.append(s('rect', { class: 'extent', x: -e, y: -e, width: this.extent, height: this.extent }));
    for (const w of data.water || []) {
      const c = w.center || w.position, r = w.radius || (w.size ? Math.max(...w.size) / 2 : 0);
      if (c && r) this.gStatic.append(s('circle', { class: 'water', cx: -c[0], cy: -c[c.length - 1], r, 'data-tip': 'water' }));
    }
    for (const sh of data.shapes) {
      const group = sh.f === 'surface' ? 'surface' : sh.f === 'building' ? 'building' : sh.f === 'structure' ? 'structure' : sh.f === 'plant' ? 'plant' : 'prop';
      const attrs = { class: 'shape f-' + group, transform: `translate(${-sh.x},${-sh.z}) rotate(${-sh.r})`, 'data-tip': words(sh.k),
                      'data-sub': `${sh.room ? 'walk-in: ' + sh.room + ' · ' : ''}${sh.f} · ${sh.w} × ${sh.d} m, ${sh.h} m high` };
      this.gStatic.append(group === 'plant'
        ? s('ellipse', { ...attrs, rx: sh.w / 2, ry: sh.d / 2 })
        : s('rect', { ...attrs, x: -sh.w / 2, y: -sh.d / 2, width: sh.w, height: sh.d, rx: group === 'building' ? 0.3 : 0.1 }));
    }
    for (const room of data.rooms || []) {
      // The room inside its building: turned as the building is, set off from its middle.
      const g = s('g', { transform: `translate(${-room.x},${-room.z}) rotate(${-room.r})` });
      const ox = -(room.offset[0] || 0), oy = -(room.offset[1] || 0);
      g.append(s('rect', { class: 'room', x: ox - room.w / 2, y: oy - room.d / 2, width: room.w, height: room.d, 'data-tip': words(room.label),
                           'data-sub': `a room to walk into, ${room.w} × ${room.d} m` }));
      for (const door of room.doors || []) {
        const half = (door.width || 1.2) / 2, o = door.offset || 0;
        let x1, y1, x2, y2;   // room plan (x east, z north) -> drawn (-x, -z)
        if (door.wall === 'north') { x1 = -o - half; x2 = -o + half; y1 = y2 = -room.d / 2; }
        else if (door.wall === 'south') { x1 = -o - half; x2 = -o + half; y1 = y2 = room.d / 2; }
        else if (door.wall === 'east') { y1 = -o - half; y2 = -o + half; x1 = x2 = -room.w / 2; }
        else { y1 = -o - half; y2 = -o + half; x1 = x2 = room.w / 2; }
        g.append(s('line', { class: 'door', x1: ox + x1, y1: oy + y1, x2: ox + x2, y2: oy + y2 }));
      }
      this.gRooms.append(g);
      // Its name under the room as it is drawn: below the lowest of its corners.
      const a = -room.r * Math.PI / 180, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const cx = ox + sx * room.w / 2, cy = oy + sy * room.d / 2;
        return [-room.x + cx * Math.cos(a) - cy * Math.sin(a), -room.z + cx * Math.sin(a) + cy * Math.cos(a)];
      });
      const lx = corners.reduce((sum, c) => sum + c[0], 0) / 4, ly = Math.max(...corners.map(c => c[1]));
      const text = words(room.label);
      this.gRooms.append(s('g', { class: 'lab', 'data-x': lx, 'data-y': ly }, s('text', { class: 'place-label', y: 14, 'text-anchor': 'middle', text })));
      this.roomLabels.push({ x: lx, y: ly, w: text.length * 6 + 6 });
    }
    this.apply();
  }

  setPeople(characters, selected) {
    const seen = new Set();
    for (const c of characters) {
      if (!c.position) continue;
      seen.add(c.id);
      let p = this.people.get(c.id);
      if (!p) {
        const g = s('g', { class: 'who' });
        const mk = s('g', { class: 'mk', transform: `scale(${this.k || 1})` });
        const heading = s('path', { class: 'heading', d: 'M0,-12L4.5,-6.5L-4.5,-6.5Z' });
        const name = s('text', { y: -15, 'text-anchor': 'middle' });
        const said = s('text', { class: 'said', y: 21, 'text-anchor': 'middle' });
        mk.append(s('circle', { class: 'pulse', r: 6 }), heading, s('circle', { class: 'dot', r: 6 }), name, said);
        g.append(mk);
        g.addEventListener('click', () => this.onPick(c.id));
        g.addEventListener('pointermove', event => { const now = this.people.get(c.id).data; tip.show(event, ...personTip(now)); });
        g.addEventListener('pointerleave', () => tip.hide());
        this.gPeople.append(g);
        p = { g, heading, name, said };
        this.people.set(c.id, p);
      }
      p.data = c;
      p.at = [-c.position[0], -c.position[2]];
      p.g.style.transform = `translate(${p.at[0]}px, ${p.at[1]}px)`;
      p.heading.setAttribute('transform', `rotate(${c.yaw || 0})`);
      p.heading.setAttribute('visibility', c.yaw == null ? 'hidden' : 'visible');
      p.name.textContent = c.name;
      const line = c.speech ? '“' + c.speech + '”' : '';
      p.said.textContent = line.length > 46 ? line.slice(0, 44) + '…”' : line;
      p.g.setAttribute('class', 'who' + (c.id === selected ? ' sel' : '') + ((c.mind && (c.mind.thinking || c.mind.musing)) ? ' thinking' : '')
        + (c.in_unity && c.streaming === false ? ' off' : '') + (c.faults && c.faults.length ? ' fault' : ''));
    }
    for (const [id, p] of this.people) if (!seen.has(id)) { p.g.remove(); this.people.delete(id); }
    this.layoutLabels();
  }
}

function personTip(c) {
  return [h('b', { text: c.name }), c.role ? ' · ' + c.role : '',
    h('div', {}, doing(c)), h('div', { class: 't', text: whereabouts(c) + (c.holding ? ' · holding ' + words(c.holding) : '') }),
    c.faults && c.faults.length ? h('div', { class: 't', text: 'posture: ' + c.faults.map(f => f.label).join(' · ') }) : null];
}
/* (A scene that is one room has no buildings to be in or out of: everyone is in the room.) */
function whereabouts(c) {
  return c.place ? 'in ' + words(c.place) : (S.sceneData && S.sceneData.single_room) ? 'in the room' : 'outdoors';
}
function doing(c) {
  const params = (c.mind && c.mind.current_params) || {};
  const target = params.target_id ? ' ' + thing(params.target_id) : '';
  return words(c.action) + (c.action !== 'idle' ? target : '') + (c.seated ? ' (seated)' : '');
}
/* An id as a person's name or as what the thing is; and a sentence with its ids put that way
   ("give bread_loaf_v2_114 to Morgan" -> "give bread loaf to Morgan"). */
function thing(id) {
  const who = S.state && (S.state.characters || []).find(c => c.id === id);
  return who ? who.name : words(id);
}
function plain(text) {
  return String(text || '').replace(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*_\d+\b/g, id => thing(id));
}

// ---------------------------------------------------------------- live: services and tiles
function renderLive(newEvents) {
  const d = S.state;
  if (!d) return;
  const u = d.unity, b = d.brain;
  $('#subtitle').textContent = [u ? u.scene : (d.last.scene ? 'last played: ' + d.last.scene : 'nothing playing'), u && u.cast, b && b.config.model].filter(Boolean).join(' · ');
  renderBanner(d);
  renderServices(d);
  renderTiles(d);
  renderMap(d);
  renderFeed(newEvents);
  renderPeople(d);
  if (Date.now() - S.lastCharts > 1900) { S.lastCharts = Date.now(); renderCharts(); }
  if (S.selected) renderDrawer();
}

function renderBanner(d) {
  const banner = $('#banner'), sys = d.system || {};
  const notes = [];
  if (sys.miner) notes.push(`A GPU miner is running (${sys.miner}): ARDY generates motion many times slower while it does. Pause it before recording.`);
  if (sys.psutil === false) notes.push('The Python package psutil is missing: processes and ports are not shown (pip install psutil).');
  banner.hidden = !notes.length;
  if (notes.length) fill(banner, status('warning', ''), h('div', {}, notes.map(n => h('div', { text: n }))));
}

function service(name, state, main, lines) {
  return h('div', { class: 'card svc' },
    h('div', { class: 'svc-head' }, h('span', { class: 'svc-name', text: name }), status(state[0], state[1])),
    h('div', { class: 'svc-main', text: main, title: main }),
    h('div', { class: 'svc-sub' }, lines.filter(Boolean).map(line => line instanceof Node ? line : h('div', { text: line, title: line }))));
}

function renderServices(d) {
  const sv = d.services || {}, u = d.unity, b = d.brain, ed = d.editor || {}, sys = d.system || {};
  const chars = d.characters || [], cards = [];
  const un = sv.unity || {};
  let st, main;
  if (un.running === false) { st = ['critical', 'Not running']; main = 'The editor is closed'; }
  else if (u) { st = ['good', u.replaying ? 'Drawing videos' : (u.recorders || u.taping) ? 'Playing, recording' : 'Playing']; main = u.scene || 'a scene'; }
  else if (ed.compiling) { st = ['warning', 'Compiling']; main = ed.scene || 'editor'; }
  else if (ed.playing) { st = ['warning', 'Playing, no reports']; main = 'WorldGenTelemetry is not reporting'; }
  else { st = ['idle', un.running ? 'Open, not playing' : 'Unknown']; main = d.last.scene ? 'last played: ' + d.last.scene : (un.project || 'editor').split(/[\\/]/).pop(); }
  cards.push(service('Unity', st, main, [
    u ? [u.cast, [u.time_of_day, u.weather].filter(Boolean).map(words).join(', ')].filter(Boolean).join(' · ') : un.project,
    ['Unity ' + (ed.version || (u && u.unity_version) || '?'), un.ram_mb ? fmt.gb(un.ram_mb) + ' memory' : null, un.started ? 'open ' + fmt.span(d.now - un.started) : null].filter(Boolean).join(' · '),
    un.bridge ? 'MCP bridge on 8090' + (ed.ok === false ? ': ' + ed.error : '') : 'MCP bridge not listening',
  ]));

  const ar = sv.ardy || {}, al = d.ardy_log || {}, alFresh = al.at && d.now - al.at < 25;
  const inUnity = chars.filter(c => c.in_unity), streaming = inUnity.filter(c => c.streaming).length;
  if (!ar.listening) st = [u ? 'critical' : 'idle', 'Not running'];
  else if (u && u.ardy_connected) st = [streaming === inUnity.length ? 'good' : 'warning', `Streaming ${streaming}/${inUnity.length}`];
  else st = ['idle', 'Listening'];
  cards.push(service('ARDY', st, alFresh ? `${al.ms_per_step} ms per step` : ar.listening ? 'port 8770' : 'unity_stream_server.py', [
    ar.listening ? (ar.via === 'wslrelay.exe' ? 'runs in WSL' : ar.via) + (ar.started ? ' · up ' + fmt.span(d.now - ar.started) : '') : 'start it with Tools\\start_ardy_server.cmd',
    alFresh ? `${al.characters} characters, ${al.steps} steps in ${al.seconds} s` : (al.last || (ar.listening ? 'no one is being animated' : null)),
    sys.miner ? 'slowed by a GPU miner' : null,
  ]));

  const br = sv.brain || {};
  if (b) {
    const cfg = b.config, clock = b.clock;
    st = clock.over ? ['idle', 'Finished: time is up'] : !b.unity_connected ? ['warning', 'Waiting for Unity'] : !clock.running ? ['idle', 'Connected'] : ['good', 'Running'];
    cards.push(service('AI Brain', st, `${b.deciding} deciding · ${b.musing} thinking`, [
      cfg.per_character ? 'an agent of its own per character' : 'one batched call for everyone',
      cfg.think_seconds ? `thinks between turns, every ${cfg.think_seconds} s, ${cfg.parallel} calls at once` : 'thinks only when it acts',
      `a turn every ${cfg.turn_seconds} s · ${cfg.max_seconds ? 'stops after ' + fmt.clock(cfg.max_seconds) : 'no time limit'}`,
    ]));
  } else if (br.running) {
    const o = br.options || {};
    cards.push(service('AI Brain', ['warning', 'Running, no reports'], 'pid ' + br.pid, [
      o.characters ? String(o.characters).split(/[\\/]/).pop() : null, 'started before the dashboard, or with --dashboard off', br.started ? 'up ' + fmt.span(d.now - br.started) : null]));
  } else {
    cards.push(service('AI Brain', ['idle', 'Not running'], 'character_system/run_server.py', ['start it once every character streams', 'it reports here by itself']));
  }

  const env = sv.brain_env || {}, endpoints = sv.llm_endpoints || [];
  const cfg = b ? b.config : { model: env.AI_BRAIN_MODEL, base_url: env.AI_BRAIN_BASE_URL || '', provider: env.AI_BRAIN_PROVIDER };
  const base = (cfg.base_url || '').replace(/\/v1\/?$/, '');
  const endpoint = endpoints.find(e => base && e.url === base);
  const loaded = endpoint && endpoint.loaded.find(m => m.id === cfg.model);
  if (!cfg.model) st = ['idle', 'Not set'];
  else if (base) st = endpoint ? (endpoint.up ? ['good', 'Answering'] : ['critical', 'Not answering']) : ['idle', b ? 'In use' : 'Set'];
  else st = [b ? 'good' : 'idle', b ? 'Cloud, in use' : 'Cloud, set in .env'];
  cards.push(service('Model', st, cfg.model || 'no model set', [
    base ? (endpoint ? endpoint.name + ' · ' : '') + base : (cfg.provider || 'provider by key') + ' API',
    loaded ? `${loaded.quant || ''} ${loaded.gb} GB · context ${fmt.compact(loaded.context)} · ${loaded.parallel} at once` : (base && endpoint && endpoint.up && cfg.model ? 'not loaded on that server' : null),
    d.llm ? `${d.llm.calls} calls in the last minute` + (d.llm.median != null ? ` · median ${d.llm.median} s` : '') : (b ? null : 'what the Brain will use when started'),
  ]));

  const lines = endpoints.map(e => h('div', { class: 'line' }, status(e.up ? 'good' : 'critical', e.name),
    h('span', { text: e.up ? `${e.ms} ms` : 'no answer', title: e.url + (e.error ? ': ' + e.error : '') })));
  const inMemory = [...new Set(endpoints.flatMap(e => e.loaded.map(m => m.id.split('/').pop())))];
  if (endpoints.some(e => e.up)) lines.push(h('div', { text: inMemory.length ? 'in memory: ' + inMemory.join(', ') : 'no model in memory' }));
  const up = endpoints.filter(e => e.up).length;
  cards.push(service('Model servers', !endpoints.length ? ['idle', 'None watched'] : up === endpoints.length ? ['good', 'All answer'] : up ? ['warning', `${up} of ${endpoints.length} answer`] : ['critical', 'None answers'],
    endpoints.length ? endpoints.length + ' watched' : 'own machines and relays', endpoints.length ? lines : ['list them in dashboard/config.local.json']));

  const gpu = (sys.gpus || [])[0];
  if (gpu) {
    st = sys.miner ? ['warning', 'Miner running'] : gpu.util >= 97 ? ['warning', 'Saturated'] : ['good', 'OK'];
    cards.push(service('Graphics card', st, `${fmt.int(gpu.util)}% · ${fmt.num(gpu.mem_used / 1024)} / ${fmt.num(gpu.mem_total / 1024)} GB`, [
      gpu.name, [gpu.temp != null ? gpu.temp + ' °C' : null, gpu.power != null ? Math.round(gpu.power) + ' W' : null].filter(Boolean).join(' · '),
      sys.cpu != null ? `CPU ${Math.round(sys.cpu)}% · memory ${sys.ram_used} / ${sys.ram_total} GB` : null]));
  } else {
    cards.push(service('Graphics card', ['idle', 'Unknown'], 'nvidia-smi gave nothing', [sys.cpu != null ? `CPU ${Math.round(sys.cpu)}% · memory ${sys.ram_used} / ${sys.ram_total} GB` : null]));
  }
  fill($('#services'), cards);
}

function tile(label, value, unit, sub, extra) {
  return h('div', { class: 'card tile' }, h('div', { class: 'tile-label', text: label }),
    h('div', { class: 'tile-value' }, value, unit ? h('small', { text: unit }) : null), h('div', { class: 'tile-sub', text: sub || '', title: sub || '' }), extra);
}
function recent(name, seconds = 300) {
  const from = (S.state ? S.state.now : Date.now() / 1000) - seconds;
  return (S.series[name] || []).filter(p => p[0] >= from);
}

function renderTiles(d) {
  const u = d.unity, b = d.brain, chars = d.characters || [], tiles = [];
  if (b) {
    const story = b.story, clock = b.clock, cfg = b.config;
    let sub = story ? story.title : 'no story: everyday life', extra = null;
    if (story && story.beats.length) {
      const n = story.beats.length, now = story.current_beat;
      sub = now == null ? story.title : now >= n ? `${story.title} · the story is over` : `${story.title} · beat ${now + 1} of ${n}`;
      extra = h('div', { class: 'beats', title: 'the beats of the story' }, story.beats.map((_, i) => {
        const done = now == null ? 0 : i < now ? 1 : i > now ? 0 : (clock.elapsed % cfg.beat_seconds) / cfg.beat_seconds;
        return h('i', {}, h('b', { style: { width: (done * 100).toFixed(0) + '%' } }));
      }));
    }
    // (Past its time the Brain decides nothing more: the clock is shown stopped there.)
    tiles.push(tile('Scene clock', fmt.clock(clock.over ? cfg.max_seconds : clock.elapsed),
      cfg.max_seconds ? (clock.over ? 'finished' : 'of ' + fmt.clock(cfg.max_seconds)) : '', sub, extra));
  } else {
    tiles.push(tile('Scene clock', u ? fmt.clock(u.time) : '—', u ? 'in Play mode' : '', u ? 'the story clock starts with the AI Brain' : 'nothing is playing'));
  }
  const inUnity = chars.filter(c => c.in_unity);
  tiles.push(tile('Characters', chars.length ? String(chars.length) : '—', '', chars.length
    ? `${inUnity.filter(c => c.streaming).length} streaming · ${chars.filter(c => c.place).length} indoors · ${chars.filter(c => c.holding).length} holding something` : 'none in the scene'));
  tiles.push(tile('Frame rate', u ? fmt.num(u.fps, 1) : '—', u ? 'fps' : '',
    u ? (u.capture_fps ? `recording: game time at ${u.capture_fps} fps` : u.replaying ? 'drawing videos from a tape' : `frame ${fmt.int(u.frame)}`) : 'Unity is not playing', sparkline(recent('fps'))));
  const ahead = inUnity.filter(c => c.streaming).map(c => c.ahead).sort((x, y) => x - y);
  tiles.push(tile('Motion ready ahead', ahead.length ? String(ahead[0]) : '—', ahead.length ? 'frames' : '',
    ahead.length ? `the least of anyone · median ${ahead[ahead.length >> 1]} · ${ahead.filter(a => a <= 1).length} starved` : 'no character is streaming', sparkline(recent('ahead_min'))));
  const po = d.posture;
  tiles.push(tile('Motion faults', po && po.share != null ? (po.share * 100).toFixed(1) + '%' : '—', '',
    !po ? 'Unity is not playing' : !po.interval ? 'posture checks are off' : po.top.length ? 'of checks, last minute · most: ' + po.top.slice(0, 2).map(([label, n]) => `${label} ${n}`).join(', ')
      : po.total_checks ? `of checks, last minute · nothing wrong in ${po.total_checks}` : 'waiting for the first checks', sparkline(recent('fault_share'), 'var(--series-2)')));
  // What the minds named that is not in the scene: none of it reaches Unity.
  const world = b && b.world, kb = world && world.kept_back;
  tiles.push(tile('Made-up things', kb ? String(kb.meant + kb.refused + kb.placed + kb.mime) : '—', kb ? 'kept back' : '',
    kb ? `${kb.meant} put right · ${kb.refused} refused · ${kb.placed} given a table · ${kb.mime} empty-handed motions · ${fmt.int(world.things)} things exist`
      : b ? 'this AI Brain does not say' : 'the AI Brain is not running'));
  const llm = d.llm;
  tiles.push(tile('Model calls', llm ? String(llm.calls) : '—', llm ? 'a minute' : '',
    llm ? (llm.median != null ? `median ${llm.median} s · 95% within ${llm.p95} s` : 'none answered yet') : 'the AI Brain is not running', sparkline(recent('llm_latency'), 'var(--series-2)')));
  tiles.push(tile('Model cost so far', llm ? (llm.local ? 'free' : llm.dollars != null ? fmt.money(llm.dollars) : '?') : '—', llm && llm.local ? 'own machine' : '',
    llm ? `${fmt.compact(llm.total_input)} tokens read · ${fmt.compact(llm.total_output)} written` : ''));
  fill($('#tiles'), tiles);
}

// ---------------------------------------------------------------- live: map, feed, people
let sceneMap = null;
function renderMap(d) {
  if (!sceneMap) {
    sceneMap = new SceneMap($('#map'), id => select(id));
    $('#map-people').onclick = () => sceneMap.framePeople();
    $('#map-site').onclick = () => sceneMap.frameSite();
    $('#map-in').onclick = () => sceneMap.zoom(1 / 1.3);
    $('#map-out').onclick = () => sceneMap.zoom(1.3);
  }
  const scene = (d.unity && d.unity.scene) || d.last.scene || null;
  if (scene !== S.scene) {
    S.scene = scene; S.sceneData = null; S.framedFor = null;
    sceneMap.setScene(null);
    // (The picture of the ground takes some seconds the first time a scene is shown: asked for again until it is there.)
    const load = first => api('/api/map?scene=' + encodeURIComponent(scene)).then(data => {
      if (S.scene !== scene) return;
      S.sceneData = data;
      sceneMap.setScene(data);
      if (first) S.framedFor = null;
      if (data.ground && data.ground.pending) setTimeout(() => { if (S.scene === scene) load(false); }, 2500);
    }).catch(() => {});
    if (scene) load(true);
  }
  const chars = d.characters || [];
  sceneMap.setPeople(chars, S.selected);
  $('#map-title').textContent = scene ? words(scene) + ' from above' : 'The scene from above';
  if (!scene && !chars.length) sceneMap.message('Nothing is playing', 'Press Play in Unity: the scene reports here by itself. Then start the AI Brain.');
  else if (S.sceneData && S.sceneData.error) sceneMap.message(chars.length ? '' : 'No plan of ' + scene, S.sceneData.error);
  else sceneMap.message('');
  // Framed once per scene: on the people when there are some, else on the whole site.
  const key = scene + '|' + (chars.some(c => c.position) ? 'people' : 'site') + '|' + (S.sceneData ? 'plan' : '');
  if (S.framedFor !== key && (S.sceneData || chars.length)) {
    S.framedFor = key;
    if (chars.some(c => c.position)) sceneMap.framePeople(); else sceneMap.frameSite();
  }
}

const KINDS = [['all', 'All'], ['say', 'Speech'], ['thought', 'Thoughts'], ['action', 'Actions'], ['world', 'In the world'], ['fault', 'Motion faults'], ['problem', 'Problems']];
const VERB = { pick_up: 'picks up', put_down: 'puts down', walk_to: 'walks to', run_to: 'runs to', sit: 'sits down on', eat: 'eats', drink: 'drinks',
  give: 'gives', pay: 'pays', talk_to: 'turns to', work: 'works', interact: 'uses', use: 'works with', read: 'reads', idle: 'stands idle',
  look_at: 'looks at', gesture: 'gestures', emote: 'shows', wander: 'wanders', sleep: 'sleeps', point_at: 'points at', follow: 'follows', body_pose: 'takes a pose' };

// The same while something is said ("while picking up the mug"); doing nothing much is not worth the words.
const DOING = { pick_up: 'picking up', put_down: 'putting down', walk_to: 'walking to', run_to: 'running to', sit: 'sitting down on', eat: 'eating',
  drink: 'drinking', give: 'giving', pay: 'paying', work: 'working', interact: 'using', use: 'working with', read: 'reading', follow: 'following' };

function phrase(e, verbs = VERB) {
  const verb = verbs[e.action] || words(e.action);
  if (e.action === 'give') return `${verb} ${e.item || 'what it holds'}${e.target ? ' to ' + e.target : ''}`;
  if (e.action === 'pay') return `${verb} ${e.target || ''}${e.item ? ' for the ' + e.item : ''}`;
  // (Somewhere to walk given as a point, not as a thing or a person: nothing to name.)
  let text = verb + (e.target ? ' ' + e.target : (e.action === 'walk_to' || e.action === 'run_to') ? ' a spot nearby' : '');
  if (e.detail && ['work', 'gesture', 'emote', 'interact'].includes(e.action)) text += ` (${words(e.detail)})`;
  return text;
}
function eventShown(e) {
  if (S.feedWho && e.character !== S.feedWho) return false;
  if (S.feedKind === 'all') return true;
  if (S.feedKind === 'action') return e.kind === 'action' || e.kind === 'say';
  return e.kind === S.feedKind;
}
function eventRow(e, pick = true) {
  const when = h('time', { text: e.t != null ? fmt.clock(e.t) : fmt.wall(e.wall).slice(0, 5), title: fmt.wall(e.wall) + (e.t != null ? ' · ' + e.t + ' s into the scene' : '') });
  if (e.kind === 'system' || e.kind === 'beat') return h('div', { class: 'ev ' + e.kind }, when, h('span', { class: 'txt', text: e.text }));
  const name = e.name ? h('span', { class: 'who-name', text: e.name, onclick: pick && e.character ? () => select(e.character) : null }) : null;
  const tags = [];
  let parts;
  if (e.kind === 'say') {
    parts = [name, e.to && e.to !== e.name ? ' to ' + e.to : '', ': ', h('span', { class: 'txt', text: '“' + e.text + '”' })];
    if (e.action && DOING[e.action]) tags.push('while ' + phrase(e, DOING));
  } else if (e.kind === 'action') {
    parts = [name, ' ', h('span', { class: 'txt', text: phrase(e) })];
  } else if (e.kind === 'thought') {
    parts = [name, ' thinks: ', h('span', { class: 'txt', text: plain(e.text) })];
    if (e.next) tags.push('next: ' + words(e.next));
  } else {
    parts = [name, name ? ': ' : '', h('span', { class: 'txt', text: e.text })];
  }
  if (e.why === 'not_there') tags.push('named something that is not in the scene: kept back');
  if (e.why === 'mime') tags.push('hands busy with nothing: its plain motion instead');
  if (e.how === 'prepared') tags.push('as planned while thinking');
  if (e.how === 'follow_up') tags.push('following from its choice');
  if (e.seconds) tags.push(`the model took ${e.seconds} s`);
  const body = h('div', {}, parts, tags.map(t => [' ', h('span', { class: 'tag', text: t })]));
  const more = [e.plan && e.plan.length ? 'Plan: ' + e.plan.join(' → ') : null, e.prompt ? 'Motion: ' + e.prompt : null, e.raw || null].filter(Boolean);
  if (more.length) body.title = more.join('\n');
  return h('div', { class: 'ev ' + e.kind }, when, h('span', { class: 'ic' }, icon(e.kind)), body);
}

function renderFeed(newEvents, rebuild) {
  const feed = $('#feed');
  if (!$('#feed-kinds').children.length) {
    fill($('#feed-kinds'), KINDS.map(([key, label]) => h('button', { class: 'btn' + (key === S.feedKind ? ' on' : ''), text: label, dataset: { kind: key },
      onclick: () => { S.feedKind = key; for (const b of $('#feed-kinds').children) b.classList.toggle('on', b.dataset.kind === key); renderFeed([], true); } })));
    $('#feed-who').onchange = event => { S.feedWho = event.target.value; renderFeed([], true); };
  }
  // The people one can pick: whoever is in the scene now.
  const chars = (S.state && S.state.characters) || [];
  const select = $('#feed-who'), want = ['', ...chars.map(c => c.id)].join('|');
  if (select.dataset.ids !== want) {
    select.dataset.ids = want;
    fill(select, h('option', { value: '', text: 'Everyone' }), chars.map(c => h('option', { value: c.id, text: c.name })));
    select.value = chars.some(c => c.id === S.feedWho) ? S.feedWho : '';
    if (select.value !== S.feedWho) { S.feedWho = select.value; rebuild = true; }
  }
  if (rebuild || !feed.dataset.built) {
    feed.dataset.built = '1';
    const shown = S.events.filter(eventShown).slice(-400).reverse();
    fill(feed, shown.length ? shown.map(e => eventRow(e)) : h('div', { class: 'empty' }, h('div', {}, h('b', { text: 'Nothing yet' }), 'What the characters do, say and think appears here as it happens.')));
    return;
  }
  const fresh = (newEvents || []).filter(eventShown);
  if (!fresh.length) return;
  if (feed.firstChild && feed.firstChild.classList.contains('empty')) feed.replaceChildren();
  for (const e of fresh) feed.prepend(eventRow(e));
  while (feed.children.length > 400) feed.lastChild.remove();
}

const NEEDS = [['hunger', 'Hunger'], ['thirst', 'Thirst'], ['tiredness', 'Tired']];
function needBars(needs) {
  const el = h('div', { class: 'needs' });
  for (const [key, label] of NEEDS) {
    const v = needs[key];
    if (v == null) continue;
    el.append(h('span', { text: label }), h('div', { class: 'bar' + (v >= 85 ? ' crit' : v >= 60 ? ' warn' : '') }, h('i', { style: { width: v + '%' } })), h('span', { class: 'val', text: Math.round(v) }));
  }
  return el;
}

function renderPeople(d) {
  const chars = [...(d.characters || [])].sort((a, b) => a.name.localeCompare(b.name));
  $('#people-note').textContent = chars.length ? (d.brain ? 'bodies from Unity, minds from the AI Brain' : 'bodies from Unity; minds appear when the AI Brain runs') : '';
  if (!chars.length) {
    fill($('#people'), h('div', { class: 'card empty', style: { gridColumn: '1 / -1' } }, h('div', {}, h('b', { text: 'No characters' }), 'They appear here when a scene with a cast plays.')));
    return;
  }
  const money = (d.brain && d.brain.config.money) || 'coins';
  fill($('#people'), chars.map(c => {
    const m = c.mind || {}, mind = m.mind || {};
    const thought = plain(c.bubble || (mind.thoughts && mind.thoughts[mind.thoughts.length - 1]) || '');
    const stateNote = m.thinking ? 'deciding…' : m.musing ? 'thinking…' : m.waiting ? `waiting to be served` : (m.queue && m.queue.length) ? 'then: ' + m.queue.map(q => words(q.action)).join(', ') : '';
    return h('button', { class: 'card person' + (c.id === S.selected ? ' sel' : ''), onclick: () => select(c.id) },
      h('div', { class: 'person-head' }, h('div', { class: 'avatar', text: c.name[0] }),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'person-name', text: c.name }), h('div', { class: 'person-role', text: c.role || c.id })),
        h('span', { class: 'pill' + (c.action !== 'idle' ? ' live' : ''), text: words(c.action) })),
      h('div', { class: 'facts' }, h('span', {}, c.place ? ['in ', h('b', { text: words(c.place) })] : whereabouts(c)),
        c.holding ? h('span', {}, 'holding ', h('b', { text: words(c.holding) })) : null,
        m.coins != null ? h('span', {}, h('b', { text: m.coins }), ' ' + money) : null),
      m.needs && Object.keys(m.needs).length ? needBars(m.needs) : null,
      h('div', { class: 'thought-line', text: c.speech ? '“' + c.speech + '”' : thought, style: c.speech ? { fontStyle: 'normal', color: 'var(--ink)' } : null }),
      h('div', { class: 'person-foot' },
        c.in_unity ? status(c.streaming ? 'good' : 'serious', c.streaming ? `motion ${c.ahead} ahead` : 'no motion stream') : status('idle', 'not in Unity'),
        mind.turns != null ? h('span', { text: `${mind.turns} turns` }) : null, stateNote ? h('span', { text: stateNote }) : null),
      c.faults && c.faults.length ? h('div', { class: 'person-foot', title: 'what the last posture check found' }, status('serious', c.faults.map(f => f.label).join(' · '))) : null);
  }));
}

function select(id) {
  S.selected = S.selected === id ? null : id;
  $('#drawer').hidden = !S.selected;
  document.body.classList.toggle('with-drawer', !!S.selected);
  if (S.state) { renderPeople(S.state); sceneMap && sceneMap.setPeople(S.state.characters || [], S.selected); }
  renderDrawer(true);
}

function renderDrawer(reset) {
  const drawer = $('#drawer');
  const c = S.selected && S.state && (S.state.characters || []).find(x => x.id === S.selected);
  if (!S.selected) { drawer.hidden = true; return; }
  const old = $('.drawer-body', drawer), scroll = old && !reset ? old.scrollTop : 0;
  const close = h('button', { class: 'icon-btn', style: { marginLeft: 'auto' }, 'aria-label': 'Close', text: '✕', onclick: () => select(S.selected) });
  if (!c) {
    fill(drawer, h('div', { class: 'drawer-head' }, h('h2', { text: S.selected }), close), h('div', { class: 'drawer-body' }, h('p', { class: 'muted', style: { marginTop: '16px' }, text: 'This character is no longer in the scene.' })));
    return;
  }
  const m = c.mind || {}, mind = m.mind || {}, p = c.persona || {}, d = S.state;
  const money = (d.brain && d.brain.config.money) || 'coins';
  const names = Object.fromEntries((d.characters || []).map(x => [x.id, x.name]));
  const kv = rows => h('dl', { class: 'kv' }, rows.filter(r => r && r[1] != null && r[1] !== '').flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, v)]));
  const body = h('div', { class: 'drawer-body' });
  const section = (title, ...content) => { if (content.flat().some(Boolean)) body.append(h('h4', { text: title }), ...content.flat().filter(Boolean)); };

  section('Now', kv([
    ['Doing', doing(c) + (m.acting_for != null ? ` · for ${Math.round(m.acting_for)} s` : '')],
    ['Where', whereabouts(c) + (c.position ? `  (${c.position[0].toFixed(1)}, ${c.position[2].toFixed(1)})` : '')],
    ['Holding', c.holding ? words(c.holding) + (m.carrying_use ? ` (to ${m.carrying_use})` : '') : 'nothing'],
    m.coins != null ? ['Money', `${m.coins} ${money}` + (m.owed && Object.keys(m.owed).length ? ' · paid and waiting at ' + Object.keys(m.owed).map(words).join(', ') : '')] : null,
    c.in_unity ? ['Body', [c.streaming ? `motion streaming, ${c.ahead} frames ahead` : 'no motion stream', c.seated ? 'seated' : null, c.busy ? 'in the middle of something' : null].filter(Boolean).join(' · ')] : ['Body', 'not in Unity now'],
    c.in_brain ? ['Mind', m.thinking ? 'deciding what to do now' : m.musing ? 'thinking between turns' : m.waiting ? `waiting to be served (${Math.round(m.waiting)} s more)` : m.refused ? 'its last choice could not be done' : 'at rest'] : ['Mind', 'the AI Brain is not running'],
    m.queue && m.queue.length ? ['Then', m.queue.map(q => words(q.action) + (q.target ? ' ' + thing(q.target) : '')).join(' → ')] : null,
  ]));
  if (m.needs && Object.keys(m.needs).length) section('Needs', needBars(m.needs));
  if (c.posture && c.posture.checks) section('Posture', kv([
    ['Now', c.faults.length ? c.faults.map(f => f.label).join(' · ') : 'nothing wrong at the last check'],
    ['Checked', `${c.posture.checks} times · ${c.posture.faulty} found something (${fmt.pct(c.posture.faulty / c.posture.checks)})`],
  ]), c.posture.counts.length ? h('div', { style: { marginTop: '8px' } }, barList(c.posture.counts, 'times')) : null);

  const thoughts = mind.thoughts || [];
  section('On its mind',
    thoughts.length ? h('p', { class: 'quote', text: plain(thoughts[thoughts.length - 1]) }) : null,
    mind.plan && mind.plan.length ? [h('div', { class: 'note', text: 'Plan' }), h('ol', { class: 'steps' }, mind.plan.map(step => h('li', { text: plain(step) })))] : null,
    mind.intent ? h('div', { class: 'note', style: { marginTop: '6px' }, text: 'Settled on next: ' + words(mind.intent.action) + (mind.intent.params && mind.intent.params.target_id ? ' ' + (names[mind.intent.params.target_id] || words(mind.intent.params.target_id)) : '') + (mind.intent.say ? ` — “${mind.intent.say}”` : '') }) : null,
    thoughts.length > 1 ? [h('div', { class: 'note', style: { marginTop: '8px' }, text: 'Earlier thoughts' }), h('ul', { class: 'list plain' }, thoughts.slice(0, -1).reverse().map(t => h('li', {}, h('span', { class: 'ink2', style: { fontStyle: 'italic' }, text: plain(t) }))))] : null);
  // (The model names the others as it likes: "Morgan", "seaside_fisher_01", "Morgan (seaside_fisher_01)".)
  if (mind.views && Object.keys(mind.views).length) section('What it makes of the others',
    kv(Object.entries(mind.views).map(([who, view]) => [names[who] || who.replace(/\s*\([^)]*\)\s*$/, '') || who, plain(view)])));
  if (mind.remembered) section('What it remembers of the day', h('p', { class: 'ink2', text: mind.remembered }));

  if (m.history && m.history.length) section('Recently', h('ul', { class: 'list' }, [...m.history].reverse().map(x => h('li', {}, h('span', { text: fmt.span(x.ago) + ' ago' }), h('span', { text: plain(x.text) })))));
  if (m.inbox && m.inbox.length) section('Noticed since its last turn', h('ul', { class: 'list plain' }, m.inbox.map(x => h('li', {}, h('span', { text: plain(x) })))));

  section('Who they are', kv([
    ['Goal', m.goal || p.goal], ['Background', p.background],
    ['Character', p.personality_tags ? h('div', { class: 'tagrow' }, p.personality_tags.map(t => h('span', { class: 'tagc', text: t }))) : null],
    ['Works at', p.workplace ? words(p.workplace) + (p.wares ? ` · ${p.sells ? 'sells' : 'has'} ${p.wares}` : '') : null],
    ...Object.entries(p.schedule || {}).map(([slot, what]) => [cap(slot), what]),
  ]));
  if (p.relationships && Object.keys(p.relationships).length) section('The people they know', kv(Object.entries(p.relationships).map(([who, how]) => [names[who] || who, how])));

  if (mind.turns != null) {
    const rate = d.llm && d.llm.rate, use = mind.usage || {}, think = mind.thinking_usage || {};
    const dollars = rate ? ((use.input + (think.input || 0)) * rate[0] + (use.output + (think.output || 0)) * rate[1]) / 1e6 : null;
    section('Use of the model', kv([
      ['Turns', `${mind.turns} · ${fmt.compact(use.input)} tokens read, ${fmt.compact(use.output)} written`],
      think.thoughts ? ['Thoughts', `${think.thoughts} · ${fmt.compact(think.input)} read, ${fmt.compact(think.output)} written`] : null,
      ['Memory', `${mind.kept_turns} turns kept word for word`],
      dollars != null ? ['Cost', d.llm.local ? 'free (own machine)' : fmt.money(dollars)] : null,
      mind.decided_ago != null ? ['Last turn', fmt.span(mind.decided_ago) + ' ago' + (mind.thought_ago != null ? ' · last thought ' + fmt.span(mind.thought_ago) + ' ago' : '')] : null,
    ]));
  }
  fill(drawer, h('div', { class: 'drawer-head' }, h('div', { class: 'avatar', text: c.name[0] }),
    h('div', {}, h('h2', { text: c.name }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: [c.role, c.id].filter(Boolean).join(' · ') })), close), body);
  body.scrollTop = scroll;
}

// ---------------------------------------------------------------- live: the curves
const CHARTS = [
  { id: 'fps', title: 'Frame rate', unit: 'fps', series: [['fps', 'Unity', 'var(--series-1)']], empty: 'Unity is not playing' },
  { id: 'ahead', title: 'Motion ready ahead', unit: 'frames', series: [['ahead_min', 'the least of any character', 'var(--series-1)'], ['ahead_median', 'median', 'var(--series-2)']], empty: 'no character is streaming' },
  { id: 'ardy', title: 'ARDY step time', unit: 'ms', series: [['ardy_ms', 'per step', 'var(--series-1)']], empty: 'ARDY is idle, or its log is not watched', gap: 25 },
  { id: 'faults', title: 'Motion faults', note: 'share of posture checks, last minute', unit: '%', series: [['fault_share', 'with a fault', 'var(--series-1)']], empty: 'no posture checks yet' },
  { id: 'latency', title: 'Model answer time', note: 'median of the last minute', unit: 's', series: [['llm_latency', 'median', 'var(--series-1)']], empty: 'the AI Brain is not running' },
  { id: 'calls', title: 'Model calls', note: 'in the last minute', unit: 'calls', series: [['llm_calls', 'calls', 'var(--series-1)']], empty: 'the AI Brain is not running' },
  { id: 'tokens', title: 'Tokens read by the model', note: 'in the last minute', unit: 'K', series: [['llm_tokens', 'thousand tokens', 'var(--series-1)']], empty: 'the AI Brain is not running' },
  { id: 'gpu', title: 'Graphics card load', unit: '%', yMax: 100, series: [['gpu_util', 'GPU', 'var(--series-1)']] },
  { id: 'gpumem', title: 'Graphics card memory', unit: 'GB', series: [['gpu_mem', 'in use', 'var(--series-1)']] },
];
const RANGES = [[300, '5 min'], [900, '15 min'], [3600, '1 hour']];

function renderCharts() {
  const host = $('#charts'), now = S.state ? S.state.now : Date.now() / 1000;
  if (!$('#range').children.length) {
    if (!RANGES.some(r => r[0] === S.range)) S.range = 900;
    fill($('#range'), RANGES.map(([seconds, label]) => h('button', { class: 'btn' + (seconds === S.range ? ' on' : ''), text: label, dataset: { s: seconds },
      onclick: () => { S.range = seconds; for (const b of $('#range').children) b.classList.toggle('on', +b.dataset.s === seconds); renderCharts(); } })));
  }
  if (!host.children.length) {
    for (const def of CHARTS) {
      const card = h('div', { class: 'card chart', dataset: { id: def.id } },
        h('div', { class: 'chart-head' }, h('h3', { text: def.title }), def.note ? h('span', { class: 'muted', style: { fontSize: '12px' }, text: def.note }) : null, h('span', { class: 'now' })),
        def.series.length > 1 ? h('div', { class: 'legend' }, def.series.map(([, name, color]) => h('span', {}, h('i', { style: { background: color } }), name))) : null,
        h('div', { class: 'plot' }),
        h('div', { class: 'chart-foot' }, h('button', { class: 'linkish', text: 'table', onclick: event => {
          S.chartTables.has(def.id) ? S.chartTables.delete(def.id) : S.chartTables.add(def.id);
          event.target.textContent = S.chartTables.has(def.id) ? 'chart' : 'table';
          renderCharts();
        } })));
      host.append(card);
    }
  }
  for (const def of CHARTS) {
    const card = $(`.chart[data-id="${def.id}"]`, host), plot = $('.plot', card);
    const series = def.series.map(([key, name, color]) => ({ name, color, points: S.series[key] || [] }));
    const last = series[0].points[series[0].points.length - 1];
    const live = last && now - last[0] < (def.gap || 8);
    fill($('.now', card), live ? [fmt.num(last[1], last[1] < 10 ? 2 : 1), h('small', { text: def.unit })] : '');
    if (plot.matches(':hover') && !S.chartTables.has(def.id)) continue;   // not redrawn under the pointer
    if (S.chartTables.has(def.id)) {
      const cut = series.map(se => ({ ...se, points: se.points.filter(p => p[0] >= now - S.range) }));
      fill(plot, pointsTable(cut, 'Time', x => fmt.wall(x), def.unit));
      continue;
    }
    lineChart(plot, { series, x0: now - S.range, x1: now, unit: def.unit, yMax: def.yMax, gap: def.gap || 7, live: true, empty: def.empty, label: def.title,
      ticks: [[now - S.range, '−' + fmt.span(S.range)], [now - S.range / 2, '−' + fmt.span(S.range / 2)], [now, 'now']],
      tipTime: x => fmt.wall(x) + ' · ' + fmt.span(Math.max(0, now - x)) + ' ago' });
  }
}

// ---------------------------------------------------------------- tables
/* columns: [{label, right, cell: row => text or node, sort: row => value}] */
function table(columns, rows, opts = {}) {
  const state = opts.state || {};
  const draw = () => {
    let shown = rows;
    if (state.by != null && columns[state.by].sort) {
      const key = columns[state.by].sort;
      shown = [...rows].sort((a, b) => { const x = key(a), y = key(b); return (x == null) - (y == null) || (x > y ? 1 : x < y ? -1 : 0) * (state.down ? -1 : 1); });
    }
    return h('table', {},
      h('thead', {}, h('tr', {}, columns.map((col, i) => h('th', { class: (col.right ? 'r ' : '') + (col.sort ? 'sortable' : ''), title: col.title,
        text: col.label + (state.by === i ? (state.down ? ' ↓' : ' ↑') : ''),
        onclick: col.sort ? () => { state.down = state.by === i ? !state.down : true; state.by = i; wrap.replaceChildren(draw()); } : null })))),
      h('tbody', {}, shown.map(row => h('tr', { class: opts.onRow ? 'click' : '', onclick: opts.onRow ? () => opts.onRow(row) : null },
        columns.map(col => { const v = col.cell(row); return h('td', { class: (col.right ? 'r ' : '') + (col.wrap ? 'wrap-cell' : '') }, v == null ? '—' : v); })))));
  };
  const wrap = h('div', { class: 'table-wrap' + (opts.small ? ' small-table' : '') });
  wrap.append(draw());
  return wrap;
}
/* A heading with a note beside it, then what it heads. (Content that begins with a .right block -- a button, a choice -- has it at the end of the heading's own line.) */
function section(title, note, ...content) {
  const beside = content[0] instanceof Element && content[0].classList.contains('right') ? content.shift() : null;
  return [h('div', { class: 'section-head' }, h('h2', { text: title }), note ? h('span', { class: 'muted', text: note }) : null, beside), ...content];
}

// ---------------------------------------------------------------- runs
const R = { list: null, sort: { by: 1, down: true }, open: null };

async function showRuns() {
  const host = $('#runs-list');
  $('#run-detail').hidden = true; host.hidden = false;
  if (!R.list) fill(host, h('div', { class: 'card empty' }, 'Reading the run folders…'));
  try { [R.list, R.kept] = await Promise.all([api('/api/runs'), api('/api/sessions')]); } catch (e) { fill(host, h('div', { class: 'card empty' }, String(e))); return; }
  const runs = R.list.runs.filter(r => !r.error);
  const text = v => v == null ? null : String(v);

  // What the dashboard itself kept: a session for every time a scene played while it ran.
  const kept = R.kept.sessions, events = s => (s.counts || {}).events || {};
  const out = section('Sessions kept by the dashboard', R.kept.keeps
    ? `${kept.length} in ${R.kept.folder} · ${fmt.bytes(kept.reduce((sum, s) => sum + (s.bytes || 0), 0))} · everything heard while a scene plays`
    : 'keeping is off (--no-record)', h('div', { class: 'right' }, h('button', { class: 'btn', text: 'Refresh', onclick: showRuns })));
  if (kept.length) {
    out.push(h('div', { class: 'card' }, table([
      { label: 'Session', cell: s => h('div', {}, h('b', { text: s.name }), s.open ? h('span', { class: 'tagc', style: { marginLeft: '8px' }, text: 'being kept now' }) : null,
          h('div', { class: 'sub', text: [s.scene, s.cast].filter(Boolean).join(' · ') })), sort: s => s.name },
      { label: 'When', cell: s => (s.started_text || '').slice(5, 16), sort: s => s.started },
      { label: 'Model', cell: s => s.model ? s.model.split('/').pop() : 'no Brain', sort: s => s.model || '' },
      { label: 'People', right: true, cell: s => text((s.characters || []).length), sort: s => (s.characters || []).length },
      { label: 'Length', right: true, cell: s => fmt.clock(s.seconds), sort: s => s.seconds },
      { label: 'Actions', right: true, cell: s => text((events(s).action || 0) + (events(s).say || 0)), sort: s => (events(s).action || 0) + (events(s).say || 0) },
      { label: 'Lines said', right: true, cell: s => text(events(s).say || 0), sort: s => events(s).say || 0 },
      { label: 'Thoughts', right: true, cell: s => text(events(s).thought || 0), sort: s => events(s).thought || 0 },
      { label: 'Motion faults', right: true, title: 'Share of posture checks that found a fault', cell: s => s.posture && s.posture.checks ? (s.posture.faulty / s.posture.checks * 100).toFixed(1) + '%' : null,
        sort: s => s.posture && s.posture.checks ? s.posture.faulty / s.posture.checks : null },
      { label: 'Frame rate', right: true, cell: s => s.fps && s.fps.mean != null ? s.fps.mean + ' fps' : null, sort: s => (s.fps || {}).mean },
      { label: 'Model calls', right: true, cell: s => text((s.llm || {}).calls || 0), sort: s => (s.llm || {}).calls || 0 },
      { label: 'On disk', right: true, cell: s => fmt.bytes(s.bytes), sort: s => s.bytes },
    ], kept, { state: R.keptSort || (R.keptSort = { by: 1, down: true }), onRow: s => showSession(s.name) })));
  } else {
    out.push(h('div', { class: 'card empty' }, h('div', {}, h('b', { text: 'Nothing kept yet' }),
      R.kept.keeps ? 'A session is kept whenever a scene plays while the dashboard runs.' : 'Start the dashboard without --no-record to keep what it hears.')));
  }
  if (!runs.length) {
    out.push(...section('Recorded runs'), h('div', { class: 'card empty' }, h('div', {}, h('b', { text: 'No runs found' }),
      'A run is a folder holding run.json. Looked in: ' + (R.list.configured || []).join(', ') + '. Name the folders in dashboard/config.local.json ("runs").')));
    fill(host, out);
    return;
  }
  const columns = [
    { label: 'Run', cell: r => h('div', {}, h('b', { text: r.name }), h('div', { class: 'sub', text: [r.scene, r.cast].filter(Boolean).join(' · ') })), sort: r => r.name },
    { label: 'When', cell: r => r.started ? r.started.slice(5, 16) : fmt.date(r.modified), sort: r => r.modified },
    { label: 'Model', cell: r => r.model ? h('div', {}, r.model.split('/').pop(), h('div', { class: 'sub', text: r.local ? 'own machine' : 'cloud' })) : (r.brain === false ? 'no Brain' : null), sort: r => r.model || '' },
    { label: 'People', right: true, cell: r => text(r.characters), sort: r => r.characters },
    { label: 'Length', right: true, cell: r => fmt.clock(r.seconds), sort: r => r.seconds },
    { label: 'Actions', right: true, cell: r => text(r.actions), sort: r => r.actions },
    { label: 'With things', right: true, title: 'Share of actions done with an object', cell: r => r.with_things == null ? null : fmt.pct(r.with_things), sort: r => r.with_things },
    { label: 'Lines said', right: true, cell: r => text(r.talk), sort: r => r.talk },
    { label: 'Thoughts', right: true, cell: r => text(r.thoughts), sort: r => r.thoughts },
    { label: 'Answer time', right: true, title: 'Median seconds for the model to answer', cell: r => r.latency == null ? null : r.latency + ' s', sort: r => r.latency },
    { label: 'Cost', right: true, title: 'A model on one\'s own machine costs nothing; what the tokens would cost in the cloud is in the run', cell: r => r.cloud_dollars == null ? null : r.local ? 'free' : fmt.money(r.dollars), sort: r => r.dollars },
    { label: 'Motion faults', right: true, title: 'Share of measured frames with a posture or clipping fault', cell: r => r.faults == null ? null : (r.faults * 100).toFixed(1) + '%', sort: r => r.faults },
  ];
  out.push(...section('Recorded runs', `${runs.length} in ${R.list.roots.join(', ')} · made with the recording script: videos and motion analysis`),
    h('div', { class: 'card' }, table(columns, runs, { state: R.sort, onRow: r => showRun(r.name) })));
  fill(host, out);
}

/* One session the dashboard kept: what it came to, its curves, its feed, its files. */
async function showSession(name) {
  const host = $('#run-detail');
  $('#runs-list').hidden = true; host.hidden = false;
  fill(host, h('div', { class: 'card empty' }, 'Reading ' + name + '…'));
  let d;
  try { d = await api('/api/session?name=' + encodeURIComponent(name)); } catch (e) { fill(host, h('div', { class: 'card empty' }, String(e))); return; }
  if (d.error) { fill(host, h('div', { class: 'card empty' }, d.error)); return; }
  const s = d.info, counts = (s.counts || {}).events || {}, reports = (s.counts || {}).reports || {}, llm = s.llm || {}, po = s.posture || {}, out = [];
  out.push(h('div', {}, h('button', { class: 'btn back', text: '← All runs', onclick: showRuns })));
  out.push(h('div', { class: 'run-head' }, h('h2', { text: s.name }), s.open ? h('span', { class: 'tagc', text: 'being kept now' }) : null,
    h('span', { class: 'ink2', text: [s.scene, s.cast, s.model, s.started_text].filter(Boolean).join(' · ') }), h('span', { class: 'muted mono', text: d.folder })));
  const actions = (counts.action || 0) + (counts.say || 0);
  out.push(h('div', { class: 'tiles four' },
    tile('Length', fmt.clock(s.seconds), '', `${(s.characters || []).length} characters` + (s.story ? ' · ' + s.story : '')),
    tile('Actions', fmt.int(actions), '', `${counts.say || 0} with a line said · ${counts.world || 0} things done in Unity`),
    tile('Thoughts', fmt.int(counts.thought || 0), '', s.brain && s.brain.think_seconds ? `thinking between turns, every ${s.brain.think_seconds} s` : (s.model ? 'minds only when acting' : 'no AI Brain')),
    tile('Motion faults', po.checks ? (po.faulty / po.checks * 100).toFixed(1) + '%' : '—', '', po.checks ? `${po.faulty} of ${fmt.int(po.checks)} posture checks · ${counts.fault || 0} said in the feed` : 'no posture checks'),
    tile('Frame rate', s.fps && s.fps.mean != null ? String(s.fps.mean) : '—', s.fps && s.fps.mean != null ? 'fps mean' : '', s.fps && s.fps.min != null ? `lowest ${s.fps.min} fps` : ''),
    tile('Model calls', fmt.int(llm.calls || 0), '', llm.calls ? `${fmt.compact(llm.input)} tokens read · ${fmt.compact(llm.output)} written · ${(llm.seconds / llm.calls).toFixed(1)} s a call` : ''),
    tile('Problems', fmt.int(counts.problem || 0), '', 'choices refused, things out of reach, failed calls'),
    tile('Kept', fmt.bytes(d.files.reduce((sum, f) => sum + f.bytes, 0)), '', `${fmt.int((reports.unity || 0) + (reports.brain || 0))} reports · ${fmt.int(d.events_in_all)} events`)));

  const x1 = Math.max(s.seconds || 0, 1), ticks = [[0, '0:00'], [x1 / 2, fmt.clock(x1 / 2)], [x1, fmt.clock(x1)]];
  const pts = key => d.samples[key] || [];
  const charts = [
    ['Frame rate', 'fps', [{ name: 'Unity', color: 'var(--series-1)', points: pts('fps') }]],
    ['Motion ready ahead', 'frames', [{ name: 'the least of any character', color: 'var(--series-1)', points: pts('ahead_min') }, { name: 'median', color: 'var(--series-2)', points: pts('ahead_median') }]],
    ['Motion faults, share of checks in the last minute', '%', [{ name: 'with a fault', color: 'var(--series-1)', points: pts('fault_share') }]],
    ['Model answer time, median of the last minute', 's', [{ name: 'median', color: 'var(--series-1)', points: pts('llm_latency') }]],
    ['Model calls in the last minute', 'calls', [{ name: 'calls', color: 'var(--series-1)', points: pts('llm_calls') }]],
    ['Graphics card load', '%', [{ name: 'GPU', color: 'var(--series-1)', points: pts('gpu_util') }], 100],
  ].filter(chart => chart[2].some(se => se.points.length));
  if (charts.length) {
    out.push(...section('Over the session', 'a point every two seconds'));
    const grid = h('div', { class: 'charts' });
    out.push(grid);
    for (const [title, unit, series, yMax] of charts) {
      const plot = h('div', { class: 'plot' });
      const draw = () => lineChart(plot, { series, x0: 0, x1, unit, yMax, ticks, gap: 7, tipTime: t => fmt.clock(t) + ' into the session', label: title });
      grid.append(h('div', { class: 'card chart' }, h('div', { class: 'chart-head' }, h('h3', { text: title })),
        series.length > 1 ? h('div', { class: 'legend' }, series.map(se => h('span', {}, h('i', { style: { background: se.color } }), se.name))) : null, plot,
        h('div', { class: 'chart-foot' }, h('button', { class: 'linkish', text: 'table', onclick: event => {
          const on = event.target.textContent === 'table';
          event.target.textContent = on ? 'chart' : 'table';
          on ? fill(plot, pointsTable(series, 'Session time', t => fmt.clock(t), unit, 300)) : draw();
        } }))));
      requestAnimationFrame(draw);
    }
  }

  let kind = 'all';
  const feed = h('div', { class: 'feed scroll', style: { maxHeight: '520px' } }), chips = h('div', { class: 'chips' });
  const drawFeed = () => {
    fill(chips, KINDS.map(([key, label]) => h('button', { class: 'btn' + (key === kind ? ' on' : ''), text: label, onclick: () => { kind = key; drawFeed(); } })));
    const shown = d.events.filter(e => kind === 'all' || e.kind === kind || (kind === 'action' && e.kind === 'say'));
    fill(feed, shown.length ? shown.slice(0, 3000).map(e => eventRow(e, false)) : h('div', { class: 'empty' }, 'Nothing of this kind in the session.'));
  };
  drawFeed();
  const about = {
    'session.json': 'what the session was and what it came to',
    'events.jsonl': 'the feed, a line each',
    'samples.jsonl': 'the curves, a line every two seconds',
    'reports.jsonl.gz': 'every report from Unity and the Brain as it came, once a second each: every character\'s whole state, what it has round it, everything its posture checks measured',
    'llm_calls.jsonl.gz': 'every call to the model, whole: what was sent, what came back, how long it took, whose it was',
    'scene.tape': 'every frame: every bone of every character, the objects that moved, what was over each head (Unity can draw the scene again from it)',
    'ardy_joints.bin': 'every frame: ARDY\'s own joints before retargeting, foot contacts, frames ahead',
    'unity.log': 'every line Unity\'s log gained while the session lasted',
    'brain.log': 'the AI Brain\'s own log',
    'ardy_server.log': 'the ARDY server\'s log',
    'system.jsonl': 'every ten seconds: the services, the processor, memory, the graphics card',
    'scene_manifest.json': 'the scene as it was then (its meshes stay in StreamingAssets)',
    'cast.json': 'the cast as it was then',
    'story.json': 'the story as it was then',
  };
  const told = name => about[name] || (/^scene\.\d+\.tape$/.test(name) ? about['scene.tape'] + ' (a further part: the cast changed)'
    : /^ardy_joints\.\d+\.bin$/.test(name) ? about['ardy_joints.bin'] + ' (a further part)' : null);
  out.push(...section('The session as it went', `${fmt.int(d.events_in_all)} events` + (d.events_in_all > d.events.length ? `, the last ${fmt.int(d.events.length)} shown` : '')),
    h('div', { class: 'two' }, h('div', { class: 'card', style: { overflow: 'hidden' } }, h('div', { class: 'panel-head' }, chips), feed),
      h('div', { class: 'card', style: { alignSelf: 'start' } }, table([
        { label: 'File', cell: f => h('a', { href: `/api/session/file?name=${encodeURIComponent(name)}&file=${encodeURIComponent(f.name)}`, download: f.name, text: f.name, style: { color: 'inherit', fontWeight: 600 } }) },
        { label: 'Holds', wrap: true, cell: f => told(f.name) },
        { label: 'Size', right: true, cell: f => fmt.bytes(f.bytes) },
      ], d.files), h('p', { class: 'note', style: { padding: '10px 12px' },
        text: 'The .gz files read as lines of JSON: gzip.open(path, "rt") in Python. dashboard/tape.py reads scene.tape and ardy_joints.bin.' }))));
  fill(host, out);
  scrollTo(0, 0);
}

async function showRun(name) {
  const host = $('#run-detail');
  $('#runs-list').hidden = true; host.hidden = false;
  fill(host, h('div', { class: 'card empty' }, 'Reading ' + name + '…'));
  let d;
  try { d = await api('/api/run?name=' + encodeURIComponent(name)); } catch (e) { fill(host, h('div', { class: 'card empty' }, String(e))); return; }
  if (d.error) { fill(host, h('div', { class: 'card empty' }, d.error)); return; }
  const r = d.summary, a = d.analysis || {}, out = [];
  out.push(h('div', {}, h('button', { class: 'btn back', text: '← All runs', onclick: showRuns })));
  out.push(h('div', { class: 'run-head' }, h('h2', { text: r.name }),
    h('span', { class: 'ink2', text: [r.scene, r.cast, r.model, r.started].filter(Boolean).join(' · ') }), h('span', { class: 'muted mono', text: d.folder })));

  const cost = a.cost || {}, lively = a.liveliness || {}, lat = a.latency_seconds || {}, think = a.thinking || {}, cap_ = a.capture || {}, mg = a.motion_generation || {}, mf = a.motion_faults || {};
  out.push(h('div', { class: 'tiles four' },
    tile('Length', fmt.clock(r.seconds), '', `${r.characters} characters · ${fmt.span(r.wall_seconds)} on the clock${r.realtime ? ' · real time' : ''}`),
    tile('Actions', fmt.int(lively.decisions), '', lively.with_things_share != null ? `${fmt.pct(lively.with_things_share)} with things · ${lively.walks_into_buildings || 0} walks into buildings` : ''),
    tile('Lines said', fmt.int((a.talk || {}).lines), '', a.talk ? `${a.talk.addressed_pairs} pairs spoke · ${a.talk.pairs_answered_back} answered back` : ''),
    tile('Thoughts', fmt.int(think.thoughts), '', think.thoughts ? `${think.per_character_per_minute} per character a minute · ${think.with_a_plan} with a plan` : 'minds only when acting'),
    tile('Model answer time', lat.median != null ? String(lat.median) : '—', lat.median != null ? 's median' : '', lat.p95 != null ? `95% within ${lat.p95} s · longest ${lat.max} s` : ''),
    tile('Model cost', cost.dollars == null ? '—' : r.local ? 'free' : fmt.money(cost.dollars), r.local ? 'own machine' : '',
      cost.dollars != null ? `${fmt.compact(cost.input_tokens + (think.input_tokens || 0))} tokens read${r.local ? ' · ' + fmt.money(cost.dollars) + ' in the cloud' : ''}` : ''),
    tile('Rendering', cap_.rendered_fps_wall != null ? String(cap_.rendered_fps_wall) : '—', 'fps', cap_.slowdown != null ? `slowdown ×${cap_.slowdown} · GPU ${cap_.gpu_util_mean}% · ${cap_.samples_with_starved_character} samples starved` : ''),
    tile('Motion faults', mf.share_of_frames_with_fault != null ? (mf.share_of_frames_with_fault * 100).toFixed(1) + '%' : '—', mf.share_of_frames_with_fault != null ? 'of frames' : '',
      mg.ms_per_step_mean != null ? `ARDY ${mg.ms_per_step_mean} ms per step, ${mg.steps_per_wall_second} steps a second` : '')));

  if (d.perf && d.perf.game) {
    const perf = d.perf, x = perf.game, x1 = Math.max(...x.filter(v => v != null), 1);
    const pts = key => x.map((t, i) => [t, perf[key] && perf[key][i]]).filter(p => p[0] != null && p[1] != null);
    const ticks = [[0, '0:00'], [x1 / 2, fmt.clock(x1 / 2)], [x1, fmt.clock(x1)]];
    const charts = [
      ['Frame rate', 'fps', [{ name: 'Unity', color: 'var(--series-1)', points: pts('unity_fps').slice(1) }]],
      ['Motion ready ahead', 'frames', [{ name: 'the least of any character', color: 'var(--series-1)', points: pts('min_ahead') }, { name: 'median', color: 'var(--series-2)', points: pts('median_ahead') }]],
      ['Graphics card load', '%', [{ name: 'GPU', color: 'var(--series-1)', points: pts('gpu_util') }], 100],
    ];
    out.push(...section('Performance over the scene', 'by the scene\'s clock'));
    const grid = h('div', { class: 'charts' });
    out.push(grid);
    for (const [title, unit, series, yMax] of charts) {
      const plot = h('div', { class: 'plot' });
      grid.append(h('div', { class: 'card chart' }, h('div', { class: 'chart-head' }, h('h3', { text: title })),
        series.length > 1 ? h('div', { class: 'legend' }, series.map(se => h('span', {}, h('i', { style: { background: se.color } }), se.name))) : null, plot,
        h('div', { class: 'chart-foot' }, h('button', { class: 'linkish', text: 'table', onclick: event => {
          const on = event.target.textContent === 'table';
          event.target.textContent = on ? 'chart' : 'table';
          on ? fill(plot, pointsTable(series, 'Scene time', t => fmt.clock(t), unit, 200)) : draw();
        } }))));
      const draw = () => lineChart(plot, { series, x0: 0, x1, unit, yMax, ticks, tipTime: t => fmt.clock(t) + ' into the scene', label: title });
      requestAnimationFrame(draw);
    }
  }

  const per = Object.entries(a.per_character || {}).map(([who, v]) => ({ who, ...v, faults: ((mf.per_character || {})[who] || {}), places: ((lively.places || {})[who] || {}) }));
  const two = h('div', { class: 'two' });
  out.push(...section('What they did'), two);
  if (a.actions) two.append(h('div', { class: 'card pad' }, h('div', { class: 'chart-head', style: { marginBottom: '10px' } }, h('h3', { text: 'Actions chosen' })),
    barList(Object.entries(a.actions).sort((x, y) => y[1] - x[1]).map(([k, v]) => [words(k), v]), 'times')));
  const done = lively.done_in_unity;
  if (done) two.append(h('div', { class: 'card pad' }, h('div', { class: 'chart-head', style: { marginBottom: '10px' } }, h('h3', { text: 'What came of it in Unity' })),
    barList(Object.entries(done).sort((x, y) => y[1] - x[1]).map(([k, v]) => [words(k), v]), 'times')));
  if (per.length) {
    out.push(h('div', { class: 'card' }, table([
      { label: 'Character', cell: c => h('div', {}, h('b', { text: c.who }), h('div', { class: 'sub', text: c.id })), sort: c => c.who },
      { label: 'Turns', right: true, cell: c => String(c.turns), sort: c => c.turns },
      { label: 'Lines', right: true, cell: c => String(c.lines), sort: c => c.lines },
      { label: 'Mostly', cell: c => Object.entries(c.actions || {}).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${words(k)} ${v}`).join(' · ') },
      { label: 'Indoors', right: true, cell: c => c.places.share_indoors == null ? null : fmt.pct(c.places.share_indoors), sort: c => c.places.share_indoors },
      { label: 'Walked', right: true, cell: c => c.faults.walked_m == null ? null : c.faults.walked_m + ' m', sort: c => c.faults.walked_m },
      { label: 'Tokens read', right: true, cell: c => fmt.compact(c.input), sort: c => c.input },
      { label: 'Faulty frames', right: true, cell: c => c.faults.frames ? (c.faults.frames_with_fault / c.faults.frames * 100).toFixed(1) + '%' : null, sort: c => c.faults.frames ? c.faults.frames_with_fault / c.faults.frames : null },
    ], per, { state: { by: 1, down: true } })));
  }

  const kinds = { all: 'All', say: 'Speech', thought: 'Thoughts', action: 'Actions' };
  let kind = 'say';
  const feed = h('div', { class: 'feed scroll', style: { maxHeight: '460px' } });
  const chips = h('div', { class: 'chips' });
  const drawFeed = () => {
    fill(chips, Object.entries(kinds).map(([key, label]) => h('button', { class: 'btn' + (key === kind ? ' on' : ''), text: label, onclick: () => { kind = key; drawFeed(); } })));
    const shown = (d.timeline || []).filter(e => kind === 'all' || e.kind === kind || (kind === 'action' && e.kind === 'say'));
    fill(feed, shown.length ? shown.slice(0, 1500).map(e => eventRow(e, false)) : h('div', { class: 'empty' }, 'Nothing of this kind in the run.'));
  };
  drawFeed();
  const story = a.story || {};
  const side = h('div', { class: 'card pad', style: { display: 'grid', gap: '10px', alignContent: 'start' } });
  if (story.title) side.append(h('div', {}, h('h3', { style: { fontSize: '14px' }, text: story.title }), h('p', { class: 'ink2', style: { fontSize: '13px', marginTop: '4px' }, text: story.premise })));
  if ((story.beats || []).length) side.append(table([
    { label: 'Beat', cell: x => String(x.beat) }, { label: 'From', right: true, cell: x => x.window ? fmt.clock(x.window[0]) : null },
    { label: 'Acted', right: true, cell: x => String(x.acted ?? '—') }, { label: 'Spoke', right: true, cell: x => String(x.spoke ?? '—') }], story.beats, { small: true }));
  if (a.refused && a.refused.count) side.append(h('div', {}, h('div', { class: 'note', style: { marginBottom: '6px' }, text: `${a.refused.count} choices could not be done` }),
    barList(Object.entries(a.refused.kinds || {}).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => [k.length > 54 ? k.slice(0, 52) + '…' : k, v, k]))));
  out.push(...section('The scene as it went', `${(d.timeline || []).length} things done, said and thought`),
    h('div', { class: 'two' }, h('div', { class: 'card', style: { overflow: 'hidden' } }, h('div', { class: 'panel-head' }, chips), feed), side));

  if (d.videos.length) {
    const video = h('video', { controls: true, preload: 'metadata' });
    const pick = h('select', { class: 'btn', onchange: e => { video.src = `/api/run/file?name=${encodeURIComponent(name)}&file=videos/${encodeURIComponent(e.target.value)}`; } },
      d.videos.map(v => h('option', { value: v, text: v })));
    const first = d.videos.includes('_everyone.mp4') ? '_everyone.mp4' : d.videos[0];
    pick.value = first;
    video.src = `/api/run/file?name=${encodeURIComponent(name)}&file=videos/${encodeURIComponent(first)}`;
    out.push(...section('Videos', `${d.videos.length} recorded`, h('div', { class: 'right' }, pick)), h('div', { class: 'card pad' }, video));
  }
  if (d.problems && d.problems.length) out.push(...section('What could not be done in Unity', `${d.problems.length} lines of its log`), h('div', { class: 'card' }, h('pre', { class: 'log', text: d.problems.join('\n') })));
  fill(host, out);
  scrollTo(0, 0);
}

// ---------------------------------------------------------------- library
async function showLibrary() {
  const host = $('#tab-library');
  if (!host.children.length) fill(host, h('div', { class: 'card empty' }, 'Reading the scenes…'));
  let lib;
  try { lib = await api('/api/library'); } catch (e) { fill(host, h('div', { class: 'card empty' }, String(e))); return; }
  const playing = S.state && S.state.unity && S.state.unity.scene;
  const scenes = lib.scenes.filter(x => !x.previous);
  const out = [];
  out.push(...section('Scenes', `${scenes.length} in ${lib.assets}` + (lib.scenes.length > scenes.length ? ` (and ${lib.scenes.length - scenes.length} kept earlier versions)` : '')),
    h('div', { class: 'card' }, table([
      { label: 'Scene', cell: x => h('div', {}, h('b', { text: x.name }), x.name === playing ? h('span', { class: 'tagc', style: { marginLeft: '8px' }, text: 'playing now' }) : null,
          x.error ? h('div', { class: 'sub', text: x.error }) : null), sort: x => x.name },
      { label: 'Kind', cell: x => [x.interior ? 'one room' : words(x.biome || ''), x.water ? 'water' : null].filter(Boolean).join(' · ') || null, sort: x => x.biome || '' },
      { label: 'Sky', cell: x => [x.time_of_day, x.weather].filter(Boolean).map(words).join(', ') || null },
      { label: 'Kinds of object', right: true, cell: x => x.kinds == null ? null : String(x.kinds), sort: x => x.kinds },
      { label: 'Placed', right: true, cell: x => x.placements == null ? null : String(x.placements), sort: x => x.placements },
      { label: 'Rooms to walk into', wrap: true, cell: x => (x.rooms || []).length ? h('div', { class: 'tagrow' }, x.rooms.map(r => h('span', { class: 'tagc', text: words(r) }))) : null, sort: x => (x.rooms || []).length },
      { label: 'Across', right: true, cell: x => x.extent ? Math.round(x.extent) + ' m' : null, sort: x => x.extent },
      { label: 'Size', right: true, cell: x => x.mb == null ? null : x.mb + ' MB', sort: x => x.mb },
      { label: 'Built', right: true, cell: x => fmt.date(x.modified), sort: x => x.modified },
    ], scenes, { state: { by: 8, down: true } })));

  out.push(...section('Casts', `${lib.casts.length} character lists`), h('div', { class: 'card' }, table([
    { label: 'File', cell: x => h('b', { text: x.file }), sort: x => x.file },
    { label: 'People', right: true, cell: x => String(x.people.length), sort: x => x.people.length },
    { label: 'Who', wrap: true, cell: x => h('div', { class: 'tagrow' }, x.people.map(p => h('span', { class: 'tagc', title: [p.id, p.workplace && 'works at ' + words(p.workplace)].filter(Boolean).join(' · '), text: p.name + (p.role ? ', ' + p.role : '') }))) },
    { label: 'Money', cell: x => x.money || null },
    { label: 'Written', right: true, cell: x => fmt.date(x.modified), sort: x => x.modified },
  ], lib.casts, { state: { by: 4, down: true } })));

  out.push(...section('Stories', `${lib.stories.length} written`), h('div', { class: 'cards' }, lib.stories.map(x => h('div', { class: 'card story-card' },
    h('h3', { text: x.title || x.file }), h('p', { class: 'ink2', style: { fontSize: '13px' }, text: x.premise || '' }),
    h('div', { class: 'note', text: `${x.file} · ${x.beats} beats · ${fmt.date(x.modified)}` })))));

  if (lib.pool.length) out.push(...section('The troupe', `${lib.pool.length} rigged character models to cast from`), h('div', { class: 'card' }, table([
    { label: 'Name', cell: x => h('div', {}, h('b', { text: x.name || x.id }), h('div', { class: 'sub', text: x.id })), sort: x => x.name || x.id },
    { label: 'Looks', wrap: true, cell: x => x.appearance || null },
    { label: 'Height', right: true, cell: x => x.height_m ? x.height_m + ' m' : null, sort: x => x.height_m },
  ], lib.pool)));

  if (lib.versions.length) out.push(...section('Generation history', `${lib.versions.length} worlds built`), h('div', { class: 'card' }, table([
    { label: 'When', cell: x => x.date || null, sort: x => x.date || '' },
    { label: 'Asked for', wrap: true, cell: x => x.prompt || x.id },
    { label: 'Objects', right: true, cell: x => x.objects == null ? null : String(x.objects), sort: x => x.objects },
    { label: 'Placed', right: true, cell: x => x.placements == null ? null : String(x.placements), sort: x => x.placements },
    { label: 'Took', right: true, cell: x => x.minutes == null ? null : x.minutes + ' min', sort: x => x.minutes },
    { label: 'Cost', right: true, cell: x => x.cost_usd == null ? null : fmt.money(x.cost_usd), sort: x => x.cost_usd },
  ], lib.versions, { state: { by: 0, down: true } })));
  fill(host, out);
}

// ---------------------------------------------------------------- data: everything the system keeps
const D = { view: 'overview', store: null, path: '', find: '', stores: [] };
const KEPT_IN = {
  data: ['good', 'the repository\'s data folder', 'on this disk, not in git'],
  repo: ['good', 'the repository', 'in git'],
  unity: ['good', 'the Unity project', 'on this disk'],
  outside: ['warning', 'outside the repository', 'only in a working folder: nothing else has a copy'],
};
const dataUrl = (what, store, path) => `/api/data/${what}?store=${encodeURIComponent(store)}&path=${encodeURIComponent(path || '')}`;

async function showData(view) {
  if (view) D.view = view;
  const host = $('#tab-data');
  const views = [['overview', 'Everything kept'], ['generation', 'Generation runs'], ['assets', 'Asset library'], ['llm', 'Model calls'], ['files', 'Files']];
  const head = h('div', { class: 'chips' }, views.map(([key, label]) => h('button', { class: 'btn' + (key === D.view ? ' on' : ''), text: label,
    onclick: () => showData(key) })));
  const body = h('div', { class: 'tab' }, h('div', { class: 'card empty' }, 'Reading…'));
  fill(host, head, body);
  try {
    if (D.view === 'overview') await dataOverview(body);
    else if (D.view === 'generation') await dataGeneration(body);
    else if (D.view === 'assets') await dataAssets(body);
    else if (D.view === 'llm') await dataCalls(body);
    else await dataFiles(body);
  } catch (e) { fill(body, h('div', { class: 'card empty' }, String(e))); }
}

async function dataOverview(body) {
  const d = await api('/api/data');
  D.stores = d.stores;
  const there = d.stores.filter(s => s.exists && !s.within);     // (a place inside another is in that one's figures)
  const sum = key => there.reduce((total, s) => total + (s[key] || 0), 0);
  const outside = there.filter(s => s.where === 'outside');
  fill(body,
    h('div', { class: 'tiles four' },
      tile('Kept in all', fmt.bytes(sum('bytes')), '', `${fmt.int(sum('files'))} files in ${there.length} places`),
      tile('In the repository\'s data folder', fmt.bytes(there.filter(s => s.where === 'data').reduce((t, s) => t + (s.bytes || 0), 0)), '', 'on this disk, not in git: runs, library, sessions, calls'),
      tile('In the Unity project', fmt.bytes(there.filter(s => s.where === 'unity').reduce((t, s) => t + (s.bytes || 0), 0)), '', 'scenes, versions, characters, ARDY'),
      tile('Outside the repository', fmt.bytes(outside.reduce((t, s) => t + (s.bytes || 0), 0)), '', outside.length ? outside.map(s => s.name).join(', ') + ': nothing else has a copy' : 'nothing')),
    section('Every place the system keeps something', d.measuring ? 'measuring…' : d.measured_at ? 'measured ' + fmt.span(Date.now() / 1000 - d.measured_at) + ' ago' : '',
      h('div', { class: 'right' }, h('button', { class: 'btn', text: 'Measure again', onclick: async () => { await api('/api/data?refresh=1'); showData(); } }))),
    h('div', { class: 'card' }, table([
      { label: 'What', cell: s => h('div', {}, h('b', { text: s.name }), h('div', { class: 'sub', text: s.what + (s.within ? ' (inside ' + (d.stores.find(o => o.id === s.within) || {}).name + ')' : '') })), sort: s => s.name, wrap: true },
      { label: 'Things', right: true, cell: s => s.exists ? fmt.int(s.entries) : null, sort: s => s.entries },
      { label: 'Files', right: true, cell: s => s.exists ? fmt.int(s.files) + (s.more ? '+' : '') : null, sort: s => s.files },
      { label: 'Size', right: true, cell: s => s.exists ? fmt.bytes(s.bytes) : null, sort: s => s.bytes },
      { label: 'Last change', right: true, cell: s => s.latest ? fmt.date(s.latest) : null, sort: s => s.latest },
      { label: 'Kept in', cell: s => s.exists === false ? status('idle', 'nothing there yet')
          : h('div', {}, status(KEPT_IN[s.where][0], KEPT_IN[s.where][1]), h('div', { class: 'sub', text: KEPT_IN[s.where][2] })) },
      { label: 'Where', wrap: true, cell: s => h('span', { class: 'mono', text: s.path }) },
    ], d.stores, { state: D.sort || (D.sort = { by: 3, down: true }), onRow: s => { if (s.exists !== false) { D.store = s.id; D.path = ''; showData('files'); } } })));
  if (d.measuring) setTimeout(() => { if (S.tab === 'data' && D.view === 'overview') showData(); }, 4000);
}

async function dataGeneration(body) {
  const runs = (await api('/api/data/generation')).runs;
  const done = runs.filter(r => r.finished);
  const text = v => v == null ? null : String(v);
  fill(body,
    h('div', { class: 'tiles four' },
      tile('Runs', String(runs.length), '', `${done.length} finished · ${runs.length - done.length} stopped before the end`),
      tile('Spent', fmt.money(done.reduce((t, r) => t + (r.dollars || 0), 0)), '', `${fmt.money(done.reduce((t, r) => t + (r.dollars_standard || 0), 0))} at the standard price`),
      tile('Tokens', fmt.compact(done.reduce((t, r) => t + (r.tokens_out || 0), 0)), 'written', `${fmt.compact(done.reduce((t, r) => t + (r.tokens_in || 0), 0))} read · ${done.reduce((t, r) => t + (r.calls || 0), 0)} calls`),
      tile('Models made', fmt.int(done.reduce((t, r) => t + r.generated.length, 0)), '', `${fmt.int(done.reduce((t, r) => t + (r.reused || 0), 0))} taken from the library instead`)),
    section('Every run of a prompt', 'data/runs: the layout, the timings, the tokens, the build' ),
    h('div', { class: 'card' }, table([
      { label: 'Run', wrap: true, cell: r => h('div', {}, h('b', { text: r.name }), h('div', { class: 'sub', text: r.prompt || r.note })), sort: r => r.name },
      { label: 'Kinds', right: true, cell: r => text(r.kinds), sort: r => r.kinds },
      { label: 'Placed', right: true, cell: r => text(r.placements), sort: r => r.placements },
      { label: 'Reused', right: true, cell: r => text(r.reused), sort: r => r.reused },
      { label: 'Made', right: true, title: 'Models generated for this run', cell: r => r.finished ? String(r.generated.length) : null, sort: r => (r.generated || []).length },
      { label: 'Failed', right: true, cell: r => r.finished ? String(r.failed.length) : null, sort: r => (r.failed || []).length },
      { label: 'Took', right: true, cell: r => r.seconds ? fmt.num(r.seconds / 60) + ' min' : null, sort: r => r.seconds },
      { label: 'Calls', right: true, cell: r => text(r.calls), sort: r => r.calls },
      { label: 'Read', right: true, cell: r => r.tokens_in == null ? null : fmt.compact(r.tokens_in), sort: r => r.tokens_in },
      { label: 'Written', right: true, cell: r => r.tokens_out == null ? null : fmt.compact(r.tokens_out), sort: r => r.tokens_out },
      { label: 'Cost', right: true, cell: r => r.dollars == null ? null : fmt.money(r.dollars), sort: r => r.dollars },
    ], runs, { state: D.genSort || (D.genSort = { by: 0, down: true }), onRow: r => showGeneration(r) })));
}

function showGeneration(r) {
  const body = $('#tab-data .tab');
  const out = [h('div', {}, h('button', { class: 'btn back', text: '← All generation runs', onclick: () => showData('generation') }))];
  out.push(h('div', { class: 'run-head' }, h('h2', { text: r.name }), h('span', { class: 'ink2', text: r.started || fmt.date(r.modified) })));
  if (r.prompt) out.push(h('p', { class: 'quote', text: r.prompt }));
  if (r.finished) {
    const usage = Object.entries(r.usage || {}).filter(([k]) => k !== 'total');
    out.push(h('div', { class: 'two' },
      h('div', { class: 'card pad' }, h('div', { class: 'chart-head', style: { marginBottom: '10px' } }, h('h3', { text: 'Where the time went' })),
        barList(Object.entries(r.phases || {}).map(([k, v]) => [words(k), Math.round(v)]), 'seconds')),
      h('div', { class: 'card' }, table([
        { label: 'Calls to the model for', cell: ([k]) => k }, { label: 'Calls', right: true, cell: ([, v]) => String(v.calls) },
        { label: 'Read', right: true, cell: ([, v]) => fmt.compact(v.input) }, { label: 'Written', right: true, cell: ([, v]) => fmt.compact(v.output) },
        { label: 'Of that, reasoning', right: true, cell: ([, v]) => fmt.compact(v.reasoning) }], usage, { small: true }),
        h('p', { class: 'note', style: { padding: '8px 12px' }, text: `${fmt.money(r.dollars)} (${fmt.money(r.dollars_standard)} at the standard price)`
          + (r.version ? ` · kept as version ${r.version}` : '') + (r.code ? ` · code ${String(r.code.commit).slice(0, 8)}, ${r.code.files_changed} files changed` : '') }))));
    const names = (title, list) => list.length ? h('div', { class: 'card pad' }, h('div', { class: 'note', style: { marginBottom: '6px' }, text: `${title} (${list.length})` }),
      h('div', { class: 'tagrow' }, list.slice(0, 400).map(n => h('span', { class: 'tagc', text: words(n) })))) : null;
    out.push(names('Models made for this run', r.generated), names('Could not be made', r.failed));
  }
  const files = h('div', { class: 'tab' });
  out.push(...section('Its files', 'the layout, the record, the log, the build'), files);
  fill(body, out);
  D.store = 'generation'; D.path = r.name;
  dataFiles(files, true);
}

async function dataAssets(body) {
  if (!D.assets) D.assets = (await api('/api/data/assets')).assets;
  const draw = () => {
    const q = D.find.trim().toLowerCase();
    const shown = D.assets.filter(a => !q || (a.name + ' ' + a.family + ' ' + a.form + ' ' + a.style + ' ' + a.source).toLowerCase().includes(q));
    const by = key => Object.entries(shown.reduce((m, a) => { m[a[key] || '(none)'] = (m[a[key] || '(none)'] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]);
    fill(list,
      h('div', { class: 'two' },
        h('div', { class: 'card pad' }, h('div', { class: 'chart-head', style: { marginBottom: '10px' } }, h('h3', { text: 'By family' })), barList(by('family').slice(0, 12), 'models')),
        h('div', { class: 'card pad' }, h('div', { class: 'chart-head', style: { marginBottom: '10px' } }, h('h3', { text: 'By the style they were made for' })), barList(by('style').slice(0, 12).map(([k, v]) => [k.length > 46 ? k.slice(0, 44) + '…' : k, v, k]), 'models'))),
      h('div', { class: 'card' }, table([
        { label: 'Model', cell: a => h('b', { text: a.name }), sort: a => a.name },
        { label: 'Family', cell: a => a.family || null, sort: a => a.family },
        { label: 'Form', cell: a => a.form || null, sort: a => a.form },
        { label: 'Made by', cell: a => a.source, sort: a => a.source },
        { label: 'For', wrap: true, cell: a => a.style || null, sort: a => a.style },
        { label: 'Size, m', right: true, cell: a => a.size ? a.size.map(v => fmt.num(v, 1)).join(' × ') : null },
        { label: 'Variants', right: true, cell: a => String(a.variants), sort: a => a.variants },
        { label: 'On disk', right: true, cell: a => fmt.bytes(a.bytes), sort: a => a.bytes },
        { label: 'Made', right: true, cell: a => (a.created || '').slice(0, 16) || null, sort: a => a.created },
      ], shown.slice(0, 400), { state: D.assetSort || (D.assetSort = { by: 8, down: true }), onRow: a => { D.store = 'library'; D.path = a.name; showData('files'); } })),
      shown.length > 400 ? h('p', { class: 'note', text: `The first 400 of ${fmt.int(shown.length)} shown: search to narrow them.` }) : null);
    count.textContent = `${fmt.int(shown.length)} of ${fmt.int(D.assets.length)} models`;
  };
  const count = h('span', { class: 'muted' }), list = h('div', { class: 'tab' });
  const input = h('input', { class: 'btn', type: 'search', placeholder: 'Search: a name, a family, a style…', value: D.find, style: { width: '320px', cursor: 'text' },
    oninput: e => { D.find = e.target.value; draw(); } });
  fill(body, h('div', { class: 'section-head' }, h('h2', { text: 'Asset library' }), count, h('div', { class: 'right' }, input)), list);
  draw();
}

async function dataCalls(body) {
  const d = await api('/api/data/llm');
  const view = h('div', { class: 'tab' });
  fill(body,
    section('Where the tokens went', 'everything that has called a model, by what it was for'),
    h('div', { class: 'card' }, table([
      { label: 'What', cell: t => h('div', {}, h('b', { text: t.what }), h('div', { class: 'sub mono', text: t.from })) },
      { label: 'Runs', right: true, cell: t => fmt.int(t.count) }, { label: 'Calls', right: true, cell: t => fmt.int(t.calls) },
      { label: 'Tokens read', right: true, cell: t => fmt.compact(t.input) }, { label: 'Tokens written', right: true, cell: t => fmt.compact(t.output) },
      { label: 'Cost', right: true, cell: t => t.dollars == null ? null : t.dollars === 0 ? 'free' : fmt.money(t.dollars) }], d.totals)),
    section('Calls kept whole, outside a playing scene', 'data/llm_calls: the pipeline, casting, profiles. A scene\'s own calls are in its session.'),
    d.by_day.length ? h('div', { class: 'card' }, table([
      { label: 'Day', cell: x => x.day, sort: x => x.day }, { label: 'For', cell: x => x.purpose, sort: x => x.purpose }, { label: 'Model', cell: x => x.model, sort: x => x.model },
      { label: 'Calls', right: true, cell: x => String(x.calls), sort: x => x.calls }, { label: 'Failed', right: true, cell: x => String(x.failed), sort: x => x.failed },
      { label: 'Read', right: true, cell: x => fmt.compact(x.input), sort: x => x.input }, { label: 'Written', right: true, cell: x => fmt.compact(x.output), sort: x => x.output },
      { label: 'Seconds', right: true, cell: x => String(x.seconds), sort: x => x.seconds }], d.by_day, { small: true }))
      : h('div', { class: 'card empty' }, h('div', {}, h('b', { text: 'None yet' }), 'From now on every call the pipeline, casting and profile writing make is kept here, whole.')),
    d.calls.length ? h('div', { class: 'two' }, h('div', { class: 'card scroll', style: { maxHeight: '640px' } }, table([
      { label: 'When', cell: c => (c.time || '').slice(5), sort: c => c.time }, { label: 'For', cell: c => c.purpose }, { label: 'Model', cell: c => (c.model || '').split('/').pop() },
      { label: 'Read', right: true, cell: c => c.input == null ? null : fmt.compact(c.input) }, { label: 'Written', right: true, cell: c => c.output == null ? null : fmt.compact(c.output) },
      { label: 'Took', right: true, cell: c => c.seconds == null ? null : c.seconds + ' s' }, { label: '', cell: c => c.error ? status('critical', 'failed') : null },
    ], d.calls, { small: true, onRow: c => showCall(view, c) })), view) : null);
  if (d.calls.length) showCall(view, d.calls[0]);
}

async function showCall(view, c) {
  fill(view, h('div', { class: 'card empty' }, 'Reading…'));
  const call = await api(`/api/data/llm/call?file=${encodeURIComponent(c.file)}&index=${c.index}`);
  const said = call.request;
  const block = (title, text) => [h('h4', { style: { margin: '14px 0 6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }, text: title }),
    h('pre', { class: 'log', style: { maxHeight: '300px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }, text: text == null ? '(nothing)' : String(text) })];
  const parts = Array.isArray(said) ? said.flatMap(m => block(m.role, typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 1)))
    : said && typeof said === 'object' ? [...block('system', said.system), ...(said.messages || []).flatMap(m => block(m.role, m.content))] : block('sent', said);
  fill(view, h('div', { class: 'card pad' },
    h('div', { class: 'run-head' }, h('h3', { style: { fontSize: '14px' }, text: call.purpose }), h('span', { class: 'ink2', text: [call.model, call.time, call.script].filter(Boolean).join(' · ') })),
    h('p', { class: 'note', text: [call.usage ? `${fmt.int(call.usage.input)} tokens read, ${fmt.int(call.usage.output)} written` + (call.usage.reasoning ? ` (${fmt.int(call.usage.reasoning)} of them reasoning)` : '') : null,
      call.seconds != null ? call.seconds + ' s' : null, call.run ? 'run ' + call.run.split(/[\\/]/).pop() : null, call.error ? 'failed: ' + call.error : null].filter(Boolean).join(' · ') }),
    parts, block('came back', call.reply),
    (call.images || []).filter(i => i.kept_as).map(i => h('img', { src: dataUrl('file', 'llm_calls', i.kept_as), style: { maxWidth: '100%', marginTop: '10px', borderRadius: '8px' } }))));
}

async function dataFiles(body, embedded) {
  if (!D.stores.length) D.stores = (await api('/api/data')).stores;
  if (!D.store) D.store = 'generation';
  const store = D.stores.find(s => s.id === D.store) || { name: D.store, path: '' };
  const d = await api(dataUrl('folder', D.store, D.path));
  const go = path => { D.path = path; embedded ? dataFiles(body, true) : showData('files'); };
  const parts = D.path.split('/').filter(Boolean);
  const crumbs = h('div', { class: 'chips', style: { alignItems: 'center' } },
    embedded ? null : h('select', { class: 'btn', onchange: e => { D.store = e.target.value; D.path = ''; showData('files'); } },
      D.stores.filter(s => s.exists !== false).map(s => h('option', { value: s.id, text: s.name, selected: s.id === D.store }))),
    h('button', { class: 'linkish', style: { fontSize: '13px' }, text: store.name, onclick: () => go(embedded ? parts[0] || '' : '') }),
    parts.map((part, i) => [h('span', { class: 'muted', text: '/' }), h('button', { class: 'linkish', style: { fontSize: '13px' }, text: part, onclick: () => go(parts.slice(0, i + 1).join('/')) })]));
  const view = h('div', { class: 'card pad', style: { alignSelf: 'start', position: 'sticky', top: '70px' } }, h('div', { class: 'empty' }, 'Choose a file to look at it.'));
  if (d.error) { fill(body, crumbs, h('div', { class: 'card empty' }, d.error)); return; }
  fill(body, crumbs, h('p', { class: 'note mono', text: d.path }),
    h('div', { class: 'two' }, h('div', { class: 'card scroll', style: { maxHeight: '720px' } }, d.entries.length ? table([
      { label: 'Name', cell: e => h('span', {}, h('span', { class: 'muted', style: { display: 'inline-block', width: '18px' }, text: e.folder ? '▸' : '' }), e.folder ? h('b', { text: e.name }) : e.name), sort: e => e.name.toLowerCase() },
      { label: 'Size', right: true, cell: e => e.bytes == null ? null : fmt.bytes(e.bytes) + (e.more ? '+' : ''), sort: e => e.bytes },
      { label: 'Holds', right: true, cell: e => e.folder ? (e.files != null ? fmt.int(e.files) + ' files' : null) : e.kind === 'other' ? null : e.kind },
      { label: 'Changed', right: true, cell: e => fmt.date(e.modified), sort: e => e.modified },
    ], d.entries, { small: true, onRow: e => e.folder ? go((D.path ? D.path + '/' : '') + e.name) : showFile(view, D.store, (D.path ? D.path + '/' : '') + e.name, e) })
      : h('div', { class: 'empty' }, 'Nothing in here.')), view),
    d.in_all > d.entries.length ? h('p', { class: 'note', text: `The first ${fmt.int(d.entries.length)} of ${fmt.int(d.in_all)} shown.` }) : null);
}

async function showFile(view, store, path, entry) {
  const raw = dataUrl('file', store, path);
  const top = h('div', { class: 'run-head', style: { marginBottom: '8px' } }, h('h3', { style: { fontSize: '14px' }, text: entry.name }),
    h('span', { class: 'muted', text: `${fmt.bytes(entry.bytes)} · ${fmt.date(entry.modified)}` }), h('a', { class: 'linkish', href: raw, download: entry.name, text: 'download' }));
  if (entry.kind === 'image') { fill(view, top, h('img', { src: raw, style: { maxWidth: '100%', borderRadius: '8px' } })); return; }
  if (entry.kind === 'video') { fill(view, top, h('video', { controls: true, preload: 'metadata', src: raw })); return; }
  if (entry.kind === 'other') { fill(view, top, h('p', { class: 'note', text: 'Not a kind of file that is shown here.' })); return; }
  fill(view, top, h('div', { class: 'empty' }, 'Reading…'));
  const d = await api(dataUrl('preview', store, path));
  fill(view, top, d.error ? h('p', { class: 'note', text: d.error }) : null,
    d.text != null ? h('pre', { class: 'log', style: { maxHeight: '620px', padding: 0 }, text: d.text }) : null,
    d.described ? h('pre', { class: 'log', style: { maxHeight: '620px', padding: 0 }, text: JSON.stringify(d.described, null, 1) }) : null,
    d.cut ? h('p', { class: 'note', text: 'Its beginning: the whole file is in the download.' }) : null, d.note ? h('p', { class: 'note', text: d.note }) : null);
}

// ---------------------------------------------------------------- system
async function showSystem() {
  const host = $('#tab-system');
  if (!host.children.length) fill(host, h('div', { class: 'card empty' }, 'Looking…'));
  let sys, unityLog, ardyLog;
  try {
    [sys, unityLog, ardyLog] = await Promise.all([api('/api/system'), api('/api/log?which=unity&lines=120'), api('/api/log?which=ardy&lines=60')]);
  } catch (e) { fill(host, h('div', { class: 'card empty' }, String(e))); return; }
  const now = Date.now() / 1000, out = [];
  out.push(...section('Programs of the system', 'that are running now', h('div', { class: 'right' }, h('button', { class: 'btn', text: 'Refresh', onclick: showSystem }))),
    h('div', { class: 'card' }, table([
      { label: 'Program', cell: p => h('b', { text: p.name }), sort: p => p.name.toLowerCase() },
      { label: 'Pid', right: true, cell: p => String(p.pid), sort: p => p.pid },
      { label: 'Listens on', cell: p => p.ports.length ? p.ports.join(', ') : null },
      { label: 'Up', right: true, cell: p => fmt.span(now - p.started), sort: p => now - p.started },
      { label: 'Memory', right: true, cell: p => p.ram_mb >= 1024 ? fmt.gb(p.ram_mb) : p.ram_mb + ' MB', sort: p => p.ram_mb },
      { label: 'Started as', wrap: true, cell: p => h('span', { class: 'mono', text: p.command }) },
    ], sys.processes, { state: { by: 4, down: true } })));

  const endpoints = (sys.services || {}).llm_endpoints || [];
  if (endpoints.length) out.push(...section('Model servers'), h('div', { class: 'card' }, table([
    { label: 'Server', cell: e => h('div', {}, status(e.up ? 'good' : 'critical', e.name), h('div', { class: 'sub mono', text: e.url })) },
    { label: 'Answers in', right: true, cell: e => e.up ? e.ms + ' ms' : null },
    { label: 'In memory', cell: e => e.loaded.length ? e.loaded.map(m => `${m.id} (${m.quant || '?'}, ${m.gb} GB, context ${fmt.compact(m.context)}, ${m.parallel} at once)`).join('; ') : (e.up ? 'nothing loaded' : e.error) },
    { label: 'On disk', wrap: true, cell: e => e.models.length ? h('div', { class: 'tagrow' }, e.models.map(m => h('span', { class: 'tagc', text: m }))) : null },
    { label: 'Reached through', cell: e => e.tunnel || null },
  ], endpoints)));

  const env = (sys.services || {}).brain_env || {};
  const kv = rows => h('dl', { class: 'kv', style: { gridTemplateColumns: '220px minmax(0, 1fr)' } }, rows.filter(r => r[1] != null && r[1] !== '').flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { class: 'mono', text: String(v) })]));
  out.push(...section('Where things are'), h('div', { class: 'two' },
    h('div', { class: 'card pad' }, kv([['Repository', sys.repo], ['Scenes (StreamingAssets)', sys.assets], ['Run folders', (sys.config.runs || []).join('; ')],
      ['ARDY log', sys.config.ardy_log || 'not watched'], ['Unity log', unityLog.path], ['Dashboard up', fmt.span(now - sys.started)], ['Python', sys.python]])),
    h('div', { class: 'card pad' }, kv([...Object.entries(env).map(([k, v]) => [k, v === true ? 'set' : v]),
      ...Object.entries(sys.prices || {}).map(([k, v]) => ['$ per million tokens: ' + k, `${v[0]} read, ${v[1]} written`])]))));

  out.push(...section('Unity log', 'the lines the system writes: [ARDY], [NPC], [AIBrain], …'),
    h('div', { class: 'card' }, h('pre', { class: 'log', text: unityLog.lines.join('\n') || 'nothing yet' })));
  if (sys.config.ardy_log) out.push(...section('ARDY server log'), h('div', { class: 'card' }, h('pre', { class: 'log', text: ardyLog.lines.join('\n') || 'nothing yet' })));
  fill(host, out);
  for (const log of host.querySelectorAll('.log')) log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------- the loop
function renderConn() {
  const el = $('#conn');
  const keeping = S.state && S.state.recording;
  if (S.ok) fill(el, status('good', 'live'), S.state ? ' · ' + fmt.wall(S.state.now) : '',
    keeping ? h('span', { title: 'Everything heard is being kept in ' + keeping.folder, text: ' · keeping this session, ' + fmt.clock(keeping.seconds) })
      : S.state && S.state.keeps === false ? ' · nothing is kept' : '');
  else fill(el, status('critical', 'the dashboard server does not answer'));
}

async function poll() {
  try {
    const d = await api(`/api/state?since=${S.seq}&from=${S.state ? S.state.now - 6 : 0}`);
    S.ok = true; S.failures = 0;
    if (d.seq < S.seq) { S.events = []; $('#feed').dataset.built = ''; }   // the server was started afresh
    S.state = d; S.seq = d.seq;
    S.events.push(...d.events);
    if (S.events.length > 4000) S.events.splice(0, S.events.length - 4000);
    for (const [name, points] of Object.entries(d.series)) {
      const have = S.series[name] || (S.series[name] = []);
      const last = have.length ? have[have.length - 1][0] : 0;
      for (const p of points) if (p[0] > last) have.push(p);
      const cut = d.now - 3700;
      while (have.length && have[0][0] < cut) have.shift();
    }
    if (S.tab === 'live') renderLive(d.events);
  } catch (e) {
    S.failures += 1;
    if (S.failures > 2) S.ok = false;
    if (!(window.REPLAY && window.REPLAY.waiting)) console.warn(e);
  }
  renderConn();
}

function showTab(tab) {
  S.tab = tab;
  for (const b of $('#tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
  for (const name of ['live', 'runs', 'library', 'data', 'system']) $('#tab-' + name).hidden = name !== tab;
  if (tab !== 'live') { S.selected = null; $('#drawer').hidden = true; document.body.classList.remove('with-drawer'); }
  tip.hide();
  if (tab === 'live' && S.state) { renderLive([]); renderFeed([], true); renderCharts(); }
  if (tab === 'runs') showRuns();
  if (tab === 'library') showLibrary();
  if (tab === 'data') showData();
  if (tab === 'system') showSystem();
  history.replaceState(null, '', '#' + tab);
}

function start() {
  const stored = localStorage.getItem('worldgen-theme');
  if (stored) document.documentElement.dataset.theme = stored;
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    localStorage.setItem('worldgen-theme', document.documentElement.dataset.theme);
  };
  $('#tabs').addEventListener('click', event => { const b = event.target.closest('button'); if (b) showTab(b.dataset.tab); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && S.selected) select(S.selected); });
  addEventListener('resize', () => { if (S.tab === 'live') renderCharts(); });
  const tabs = ['live', 'runs', 'library', 'data', 'system'];
  addEventListener('hashchange', () => { const tab = location.hash.slice(1); if (tab !== S.tab && tabs.includes(tab)) showTab(tab); });
  const wanted = location.hash.slice(1);
  showTab(tabs.includes(wanted) ? wanted : 'live');
  poll();
  setInterval(() => { if (!document.hidden) poll(); }, 1000);
}
start();
