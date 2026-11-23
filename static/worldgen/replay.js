'use strict';
/* The dashboard page on a website, with no dashboard server beside it. app.js asks api() for
   everything; while window.REPLAY is there, api() is answered from here, in one of two ways:

   live    a scene plays now in the lab: the page asks the lab's server (index.json "live"), which
           passes the questions to the dashboard's public port (dashboard/server.py, PublicHandler):
           the scene and the people, nothing of the machine;
   replay  nothing plays (or ?replay, or ?run=<name>): a run that was kept (data/sessions), played
           back from the files dashboard/export_replay.py writes beside the page (replay/...), on
           its own clock, which can be paused, sped up and moved.

   Only the Live view is shown.

   With a password (dashboard/access.py) the page shows nothing before it is given: the replay's
   files are sealed (AES-GCM, with a key that only the password opens: index.json "lock"), and the
   lab's machine answers only questions that bring the token worked out from it. */
(function () {
  const ROOT = 'replay/';
  // (The Live view is the only one there is here: a link to another opens it.)
  if (location.hash && location.hash !== '#live') history.replaceState(null, '', '#live');
  const params = new URLSearchParams(location.search);

  const R = window.REPLAY = {
    mode: null, base: '', live: false, peek: null, refused: false,
    content: null, token: '', waiting: false, grounds: {},
    ready: null, meta: null, times: [], frames: [], pool: [], resolved: [], events: [], series: {}, plan: null,
    t: 0, speed: 1, playing: true, last: 0, installed: false, list: [],
  };

  // (The list is asked of the site each time; a replay's files by its version, so that an older one held by the browser is not mixed in.)
  async function get(path, version) {
    const response = await fetch(ROOT + path + (version ? '?v=' + version : ''), version ? {} : { cache: 'no-cache' });
    if (!response.ok) throw new Error(path + ': ' + response.status);
    return response.json();
  }

  // A file of a replay: sealed (<name>.bin) when the page has a password.
  async function bytesOf(path, version) {
    const response = await fetch(ROOT + path + '?v=' + version);
    if (!response.ok) throw new Error(path + ': ' + response.status);
    return unpack(await unseal(R.content, await response.arrayBuffer()));
  }
  async function file(path, version) {
    if (!R.content) return get(path, version);
    return JSON.parse(new TextDecoder().decode(await bytesOf(path.replace(/\.json$/, '.bin'), version)));
  }

  // A question to the lab's server, given up after a while (the machine behind it may be off).
  async function ask(path, ms, picture) {
    const control = new AbortController(), timer = setTimeout(() => control.abort(), ms || 8000);
    try {
      const response = await fetch(R.base + path, { cache: 'no-store', signal: control.signal, headers: R.token ? { Authorization: 'Bearer ' + R.token } : {} });
      R.refused = response.status === 401;
      if (!response.ok) throw new Error(path + ': ' + response.status);
      return await (picture ? response.blob() : response.json());
    } finally { clearTimeout(timer); }
  }

  // The live scene's ground: with a password, asked with the token (an <image> cannot bring it) and shown from here.
  async function groundOf(url) {
    if (!R.token) return R.base + url;
    if (!R.grounds[url]) {
      try { R.grounds[url] = URL.createObjectURL(await ask(url, 20000, true)); } catch (e) { return ''; }
    }
    return R.grounds[url];
  }

  // ------------------------------------------------------------ the password (dashboard/access.py)
  const utf8 = s => new TextEncoder().encode(s);
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = s => new Uint8Array((s.match(/../g) || []).map(x => parseInt(x, 16)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const aes = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);

  function unseal(key, sealed) {
    const bytes = new Uint8Array(sealed);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  }
  function unpack(packed) {
    return new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }

  async function derive(password, lock) {
    const base = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(lock.salt), iterations: lock.rounds }, base, 256));
  }

  // What the password's key opens: the files' key, the list of replays, and the token for the lab's machine. It throws if the key is not the one.
  async function openWith(key, index) {
    const mac = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const content = await aes(await unseal(await aes(await crypto.subtle.sign('HMAC', mac, utf8('worldgen files'))), unb64(index.lock.wrapped)));
    const listing = JSON.parse(new TextDecoder().decode(await unpack(await unseal(content, unb64(index.sealed)))));
    R.content = content;
    R.token = hex(await crypto.subtle.sign('HMAC', mac, utf8('worldgen live')));
    return listing;
  }

  // (For this tab only: another tab, or the browser opened again, asks again.)
  const KEPT = 'worldgen-key';
  function kept(lock) {
    try { const k = JSON.parse(sessionStorage.getItem(KEPT) || 'null'); return k && k.salt === lock.salt ? unhex(k.key) : null; } catch (e) { return null; }
  }
  function keep(lock, key) {
    try { if (key) sessionStorage.setItem(KEPT, JSON.stringify({ salt: lock.salt, key: hex(key) })); else sessionStorage.removeItem(KEPT); } catch (e) { /* not kept */ }
  }

  // The page under a card that asks for the password, until it is given. (Plain DOM: app.js may not be there yet.)
  function askPassword(index) {
    return new Promise(resolve => {
      const el = (tag, attrs, ...kids) => { const n = Object.assign(document.createElement(tag), attrs); n.append(...kids); return n; };
      const input = el('input', { type: 'password', id: 'lock-password', autocomplete: 'current-password', placeholder: 'Password', required: true });
      input.setAttribute('aria-label', 'Password');
      const button = el('button', { className: 'btn', type: 'submit', textContent: 'Open' });
      const wrong = el('p', { className: 'lock-wrong' });
      wrong.setAttribute('role', 'alert');
      const form = el('form', { className: 'card lock-card' },
        el('h2', { textContent: 'WorldGen' }),
        el('p', { textContent: 'Live and recorded runs of WorldGen from the Extended Horizon Lab. This page is for the lab: it asks for the password.' }),
        input, button, wrong);
      const cover = el('div', { className: 'lock' }, form);
      document.body.append(cover);
      if (!window.crypto || !crypto.subtle || !window.DecompressionStream) {
        input.disabled = button.disabled = true;
        wrong.textContent = 'This browser cannot open the page (it needs https and a recent browser).';
        return;
      }
      input.focus();
      form.addEventListener('submit', async e => {
        e.preventDefault();
        button.disabled = true; button.textContent = 'Opening…'; wrong.textContent = '';
        try {
          const key = await derive(input.value, index.lock);
          const listing = await openWith(key, index);
          keep(index.lock, key);
          cover.remove();
          resolve(listing);
        } catch (error) {
          wrong.textContent = 'That is not the password.';
          button.disabled = false; button.textContent = 'Open';
          input.select();
        }
      });
    });
  }

  // Whether a scene plays in the lab now (the scene only: no feed, no curves).
  async function playingNow() {
    if (!R.base) return false;
    try { R.peek = await ask('/api/state?since=4503599627370496&from=1e15', 5000); return !!R.peek.live; } catch (e) { return false; }
  }

  // A value written once and named where it came again ({"$": n}): the whole of it, once worked out.
  function whole(value) {
    if (Array.isArray(value)) return value.map(whole);
    if (value && typeof value === 'object') {
      if (typeof value.$ === 'number' && Object.keys(value).length === 1) {
        const n = value.$;
        if (!(n in R.resolved)) R.resolved[n] = whole(R.pool[n]);
        return R.resolved[n];
      }
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = whole(v);
      return out;
    }
    return value;
  }

  async function load(entry) {
    const dir = (entry.dir || entry.name) + '/', v = entry.version || 1;
    const [meta, frames, events, series, plan] = await Promise.all(['meta', 'frames', 'events', 'series', 'map'].map(n => file(dir + n + '.json', v)));
    // (Its ground is beside the other files: a picture, or sealed like them.)
    if (plan.ground) plan.ground.url = R.content ? URL.createObjectURL(new Blob([await bytesOf(dir + 'ground.bin', v)], { type: 'image/png' })) : ROOT + dir + 'ground.png?v=' + v;
    Object.assign(R, { meta, times: frames.times, frames: frames.frames, pool: frames.pool, resolved: [], events, series, plan });
    R.t = meta.begin; R.last = performance.now(); R.playing = true;
  }

  R.ready = (async () => {
    const index = await get('index.json');
    let listing = index;
    if (index.lock) {
      listing = null;
      const key = kept(index.lock);
      if (key) try { listing = await openWith(key, index); } catch (e) { keep(index.lock, null); }
      if (!listing) { R.waiting = true; listing = await askPassword(index); R.waiting = false; }
    }
    R.list = listing.replays || [];
    // (Another server than the lab's only to try the page on this machine.)
    const asked = params.get('live');
    R.base = (asked && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(asked) ? asked : index.live || '').replace(/\/$/, '');
    if (!params.has('run') && !params.has('replay') && await playingNow()) { R.mode = 'live'; R.live = true; return; }
    if (!R.list.length) throw new Error('no replay here');
    R.mode = 'replay';
    await load(R.list.find(r => r.name === params.get('run')) || R.list[0]);
  })();

  // The replay's clock: it runs while playing, at its speed, and stops at the end.
  function now() {
    const at = performance.now();
    if (R.playing) {
      R.t = Math.min(R.meta.end, R.t + (at - R.last) / 1000 * R.speed);
      if (R.t >= R.meta.end) R.playing = false;
    }
    R.last = at;
    return R.t;
  }

  function frameAt(t) {
    let lo = 0, hi = R.times.length - 1;
    if (t < R.times[0]) return 0;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (R.times[mid] <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function state(since, from) {
    const t = now();
    const d = structuredClone(whole(R.frames[frameAt(t)]));
    d.now = t;
    const seen = R.events.filter(e => e.wall <= t);
    d.seq = seen.length ? seen[seen.length - 1].seq : 0;
    d.events = seen.filter(e => e.seq > since);
    d.series = {};
    for (const [name, points] of Object.entries(R.series)) d.series[name] = points.filter(p => p[0] > from && p[0] <= t);
    return d;
  }

  R.api = async function (path) {
    // (Not one question more each second while the password is asked for: they would all go at once after it.)
    if (R.waiting) throw new Error('the page waits for its password');
    await R.ready;
    install();
    const url = new URL(path, location.href), q = url.searchParams;
    if (R.mode === 'live') {
      if (!/\/api\/(state|map)$/.test(url.pathname)) throw new Error('not shown here: ' + url.pathname);
      const d = await ask(url.pathname + url.search);
      if (url.pathname.endsWith('/api/map') && d.ground && d.ground.url) d.ground = { ...d.ground, url: await groundOf(d.ground.url) };
      if (url.pathname.endsWith('/api/state')) R.live = !!d.live;
      return d;
    }
    if (url.pathname.endsWith('/api/state')) return state(Number(q.get('since') || 0), Number(q.get('from') || 0));
    if (url.pathname.endsWith('/api/map')) return R.plan;
    throw new Error('not in a replay: ' + url.pathname);
  };

  // ------------------------------------------------------------ the card on top
  function explain(model, local) {
    return `Every character is an agent of its own on a language model${model ? ` (${model}${local ? ', running on a laptop GPU' : ''})` : ''}: ` +
      'it sees what is around it, decides what to do and say, and thinks between turns. Its body is a rigged figure whose motion ARDY ' +
      'generates as it goes. The map shows where everyone is; the feed shows what they said, thought and did; click a character to see its mind.';
  }

  // (After app.js has made its page: its functions and state are there to be used.)
  function install() {
    if (R.installed) return;
    R.installed = true;
    for (const b of $('#tabs').children) b.hidden = b.dataset.tab !== 'live';
    $('#tabs').hidden = true;
    if (R.mode === 'live') installLive(); else installReplay();
  }

  // Live: what plays, for how long, and a way to a recorded run (always, and above all once it ends).
  function installLive() {
    document.title = 'WorldGen Live';
    const about = h('div', { class: 'card pad replay-about' },
      h('div', { class: 'replay-head' },
        h('div', {}, h('h2', { id: 'rp-title', text: 'Live from the lab' }), h('p', { class: 'muted', id: 'rp-sub' })),
        R.list.length ? h('a', { class: 'btn', id: 'rp-recorded', href: '?replay#live', text: 'Watch a recorded run' }) : null),
      h('p', { class: 'replay-text', id: 'rp-text' }));
    $('#tab-live').prepend(about);
    renderConn = function () {
      if (R.refused) return fill($('#conn'), status('critical', "the lab's machine takes another password than this page's"));
      if (S.ok === false) return fill($('#conn'), status('critical', "the lab's machine does not answer"));
      fill($('#conn'), status(R.live ? 'good' : 'idle', R.live ? 'live' : 'nothing plays now'), S.state ? ' · ' + fmt.wall(S.state.now) : '');
    };
    setInterval(refreshLive, 1000);
    refreshLive();
  }

  function refreshLive() {
    const d = S.state || R.peek || {};
    const brain = d.brain || {}, cfg = brain.config || {}, clock = brain.clock || {};
    const who = (d.characters || []).length, scene = (d.unity || {}).scene || (d.last || {}).scene || '';
    $('#rp-title').textContent = (brain.story && brain.story.title) || (scene ? words(scene) : 'Live from the lab');
    $('#rp-sub').textContent = R.live
      ? `WorldGen running now in our lab: ${who} characters${scene ? ' in ' + words(scene) : ''}` + (clock.elapsed != null ? `, ${fmt.clock(clock.elapsed)} so far.` : '.')
      : 'Nothing plays in the lab at the moment' + (R.list.length ? ': a recorded run can be watched instead.' : '.');
    $('#rp-text').textContent = explain(cfg.model, !!cfg.base_url);
    const recorded = $('#rp-recorded');
    if (recorded) recorded.classList.toggle('on', !R.live);
  }

  // A recorded run: its controls, and word of a live one when a scene starts to play in the lab.
  function installReplay() {
    const m = R.meta;
    const play = h('button', { class: 'btn', id: 'rp-play', onclick: () => { if (R.t >= m.end) seek(m.begin); else { now(); R.playing = !R.playing; } refresh(); } });
    const speeds = h('div', { class: 'chips' }, [1, 2, 4, 8].map(k => h('button', { class: 'btn', dataset: { speed: k }, text: k + '×', onclick: () => { now(); R.speed = k; refresh(); } })));
    const bar = h('input', { type: 'range', id: 'rp-bar', min: 0, max: Math.round(m.end - m.begin), step: 1, value: 0, 'aria-label': 'Where in the run',
      oninput: e => seek(m.begin + Number(e.target.value)) });
    const time = h('span', { class: 'num muted', id: 'rp-time' });
    const pick = R.list.length > 1 ? h('select', { class: 'btn', 'aria-label': 'Which run', onchange: e => { location.search = '?run=' + encodeURIComponent(e.target.value); } },
      R.list.map(r => h('option', { value: r.name, selected: r.name === m.name, text: `${r.story || words(r.scene)} · ${r.started_text}` }))) : null;
    const liveLink = h('a', { class: 'btn on', id: 'rp-live', href: './#live', text: 'A run is live now: watch it', hidden: true });
    const who = (m.characters || []).length;
    const about = h('div', { class: 'card pad replay-about' },
      h('div', { class: 'replay-head' },
        h('div', {},
          h('h2', { text: m.story || words(m.scene) }),
          h('p', { class: 'muted', text: `A recorded run of WorldGen, played back: ${who} characters in a generated village, ${fmt.clock(m.seconds)} long, ${m.started_text}.` })),
        h('div', { class: 'chips' }, liveLink, pick)),
      h('p', { class: 'replay-text', text: explain(m.model, m.local) }),
      h('div', { class: 'replay-controls' }, play, speeds, bar, time));
    $('#tab-live').prepend(about);
    // The page's own line at the top right: that this is a replay, and of when.
    renderConn = function () {
      fill($('#conn'), status(R.playing ? 'good' : 'idle', R.playing ? 'replay' : (R.t >= m.end ? 'replay finished' : 'replay paused')),
        S.state ? ' · ' + fmt.wall(S.state.now) : '');
    };
    // Faster than once a second while it plays fast, so that the people move on the map.
    setInterval(() => { if (!document.hidden && R.playing && R.speed > 1) poll(); refresh(); }, 500);
    if (R.base) {
      const check = async () => { if (!document.hidden) liveLink.hidden = !(await playingNow()); };
      check();
      setInterval(check, 30000);
    }
    refresh();
  }

  function refresh() {
    const m = R.meta;
    if (!m || !R.installed) return;
    const play = $('#rp-play');
    play.textContent = R.t >= m.end ? 'Again' : R.playing ? 'Pause' : 'Play';
    for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === R.speed);
    const bar = $('#rp-bar');
    if (document.activeElement !== bar) bar.value = Math.round(R.t - m.begin);
    $('#rp-time').textContent = `${fmt.clock(R.t - m.begin)} / ${fmt.clock(m.end - m.begin)}`;
    renderConn();
  }

  // To another moment: the feed and the curves are built again up to it.
  function seek(t) {
    R.t = Math.max(R.meta.begin, Math.min(R.meta.end, t));
    R.last = performance.now();
    if (R.t >= R.meta.end) R.playing = false;
    else if (!R.playing && t === R.meta.begin) R.playing = true;
    // (No state: the next answer brings the whole feed and every curve up to the new moment.)
    S.events = []; S.seq = 0; S.series = {}; S.lastCharts = 0; S.state = null;
    $('#feed').dataset.built = '';
    poll();
    refresh();
  }
})();
