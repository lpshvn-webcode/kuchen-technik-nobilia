import {getShowroomConfig} from './config.js';
import {Stage, loadBitmap, clamp, clampCam, viewRect} from './stage.js';

const mobile = () => matchMedia('(max-width:700px)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeO = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const ICONS = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  tone: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z"/>',
  spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const ARROW = '<svg class="ui-arrow" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 26 26 6M15 6h11v11"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
const SIDE = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d < 0 ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'}"/></svg>`;
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.800 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></svg>';
const SWIPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.500a1.500 1.500 0 0 1 3 0V11m0-1.500a1.500 1.500 0 0 1 3 0V12m0-1a1.500 1.500 0 0 1 3 0v4.500A5.500 5.500 0 0 1 12.500 21h-1.200a5.500 5.500 0 0 1-4.600-2.500L4.500 15a1.500 1.500 0 0 1 2.300-1.900L9 15.500"/><path d="M3 4.500 1.500 6 3 7.500M7 4.500 8.500 6 7 7.500"/></svg>';
const PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.500 20a5.500 5.500 0 0 1 11 0M16 5.200a3 3 0 0 1 0 5.600M17.500 14.300A5.500 5.500 0 0 1 21 19.500"/></svg>';

let stylesPromise;
function loadStyles() {
  if (stylesPromise) return stylesPromise;
  stylesPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'showroom/showroom.css?v=20261008-photo2';
    link.onload = resolve;
    link.onerror = () => { stylesPromise = null; reject(new Error('Showroom styles unavailable')); };
    document.head.append(link);
  });
  return stylesPromise;
}

export async function mountShowroom({host, modelId, analytics, onClose}) {
  const cfg = getShowroomConfig(modelId);
  await loadStyles();
  const controller = new AbortController(), signal = controller.signal;
  const previousOverflow = document.body.style.overflow;
  const opener = document.activeElement;
  const saveData = navigator.connection?.saveData === true;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  let closed = false, stage, cur = null, out = null, busy = false, si = 0, detail = null, camBefore = null;
  let liveOn = false, liveBusy = false, hintOn = sessionStorage.getItem('showroom-hint-seen') !== '1', chipOn = sessionStorage.getItem('showroom-chip-seen') !== '1';
  const cam = {x: .5, y: .5, z: 1};
  const entries = new Map();
  let anim = null, xfade = null, raf = 0, last = performance.now(), lastInput = -1e9, lastMouse = -1e9, hintTimer = 0;
  const shift = {x: 0, y: 0}, swing = {x: 0, y: 0}, mouse = {x: 0, y: 0}, tilt = {x: 0, y: 0, on: false};
  const vel = {x: 0, y: 0};
  const ev = (name, extra = {}) => analytics(name, {kitchen_id: modelId, viewpoint_id: cfg.stations[si]?.id, ...extra});

  host.hidden = false; host.style.visibility = 'hidden';
  host.innerHTML = `<div class="sr-shell" role="dialog" aria-modal="true" aria-label="Интерактивный шоурум ${cfg.title}">
  <div class="sr-top"><button class="sr-back" type="button" data-close-showroom aria-label="Закрыть шоурум">← <span>К кухне</span></button><div class="sr-title"><span class="sr-kicker">Интерактивный шоурум</span><strong>${cfg.title}</strong></div><a class="sr-quote" href="#popup1" data-popup="estimate" data-source="mini-showroom" data-interest="${modelId}"><span>Рассчитать<i> стоимость</i></span></a></div>
  <div class="sr-stage" tabindex="0" aria-label="Осмотр кухни: перетащите, чтобы повернуть камеру, прокрутите для приближения">
   <div class="sr-shade"></div><div class="sr-flash"></div><div class="sr-points" aria-label="Детали кухни"></div>
   <div class="sr-hud">
    <button class="sr-look sr-look-l" type="button" data-look="-1" aria-label="Осмотреть левее">${SIDE(-1)}</button>
    <button class="sr-look sr-look-r" type="button" data-look="1" aria-label="Осмотреть правее">${SIDE(1)}</button>
    <button class="sr-live" type="button" aria-pressed="false" hidden>${PEOPLE}<span>Оживить сцену</span></button>
    <div class="sr-bottom">
     <div class="sr-chip" ${chipOn ? '' : 'hidden'}><i></i>Нажмите на детали</div>
     <div class="sr-center"><button class="sr-go" type="button" data-go aria-label="Дальше">${CHEVRON}</button><div class="sr-hint" ${hintOn ? '' : 'hidden'}>${SWIPE}<span>Проведите, чтобы осмотреть</span></div></div>
     <div class="sr-nav" role="group" aria-label="Точки осмотра"><span class="sr-nav-name"></span><span class="sr-nav-dots">${PIN}${cfg.stations.map((s, i) => `<button type="button" data-step="${i}" aria-label="${s.title}"></button>`).join('')}</span></div>
    </div>
   </div>
   <div class="sr-loading"><span></span></div><div class="sr-live-region" aria-live="polite"></div>
  </div>
  <aside class="sr-detail" hidden role="dialog" aria-label="Деталь кухни"></aside>
 </div>`;
  const shell = host.querySelector('.sr-shell'), stageEl = host.querySelector('.sr-stage'), pointsEl = host.querySelector('.sr-points'), detailEl = host.querySelector('.sr-detail');
  const liveBtn = host.querySelector('.sr-live'), navName = host.querySelector('.sr-nav-name'), liveRegion = host.querySelector('.sr-live-region');
  const flashEl = host.querySelector('.sr-flash'), hintEl = host.querySelector('.sr-hint'), chipEl = host.querySelector('.sr-chip'), goBtn = host.querySelector('.sr-go'), dots = [...host.querySelectorAll('[data-step]')];
  stageEl.style.setProperty('--lqip', `url(${cfg.photos[cfg.stations[0].photo].lqip})`);
  document.body.style.overflow = 'hidden';

  try { stage = new Stage(stageEl); } catch (error) { console.error(error); host.replaceChildren(); host.hidden = true; document.body.style.overflow = previousOverflow; throw error; }
  stage.onresize = () => { const c = clampCam(cur?.layer || {w: 3, h: 2}, cam, stage.aspect); if (cur) { cam.x = c.x; cam.y = c.y; } };

  const pose = s => { const p = s.pose[mobile() ? 'm' : 'd']; return {x: p[0] / 100, y: p[1] / 100, z: p[2]}; };
  const strength = () => reduced() ? 0 : mobile() ? .018 : .021;
  const zmax = entry => entry.hd || !entry.ph.hd ? entry.ph.zmax : Math.min(entry.ph.zmax, 1.7);

  async function ensure(key) {
    if (entries.has(key)) return entries.get(key);
    const promise = (async () => {
      const ph = cfg.photos[key];
      const [bitmap, depth] = await Promise.all([loadBitmap(ph.sd.base, ph.sd.formats, signal), ph.depth ? loadBitmap(ph.depth.base, ph.depth.formats, signal).catch(() => null) : null]);
      if (closed) throw new Error('closed');
      return {key, ph, layer: stage.createLayer(bitmap, depth), depth, hd: false, hdPromise: null, liveLayer: null, livePromise: null, liveAlpha: 0};
    })();
    entries.set(key, promise);
    promise.catch(() => entries.delete(key));
    return promise;
  }
  function upgrade(entry) {
    if (entry.hd || entry.hdPromise || !entry.ph.hd || saveData || lowMemory) return;
    entry.hdPromise = loadBitmap(entry.ph.hd.base, entry.ph.hd.formats, signal).then(b => { if (!closed) { stage.upgradeLayer(entry.layer, b); entry.hd = true; } }).catch(() => {});
  }
  function ensureLive(entry) {
    if (!entry.ph.live) return Promise.resolve(null);
    entry.livePromise ||= loadBitmap(entry.ph.live.base, entry.ph.live.formats, signal).then(b => (entry.liveLayer = stage.createLayer(b, entry.depth))).catch(error => { entry.livePromise = null; throw error; });
    return entry.livePromise;
  }
  const preloadNeighbours = () => { if (saveData) return; for (const d of [1, -1]) { const s = cfg.stations[si + d]; if (s) ensure(s.photo).catch(() => {}); } };

  // ---- animation helpers
  function flyTo(target, duration, ease = easeIO, done) {
    const from = {...cam};
    const dur = reduced() ? Math.min(duration, 260) : duration;
    anim = {t0: performance.now(), dur, ease, done, step: t => { cam.x = lerp(from.x, target.x, t); cam.y = lerp(from.y, target.y, t); cam.z = lerp(from.z, target.z, t); }};
  }
  function setShellState() {
    shell.classList.toggle('sr-moving', busy);
    shell.classList.toggle('sr-detail-open', !!detail);
  }
  function renderNav() {
    const s = cfg.stations[si];
    dots.forEach((d, i) => d.setAttribute('aria-current', i === si ? 'step' : 'false'));
    navName.textContent = `${String(si + 1).padStart(2, '0')} / ${String(cfg.stations.length).padStart(2, '0')} · ${s.title}`;
    const last = si === cfg.stations.length - 1, next = cfg.stations[last ? 0 : si + 1];
    goBtn.classList.toggle('sr-go-restart', last);
    goBtn.setAttribute('aria-label', last ? `Вернуться: ${next.title}` : `Дальше: ${next.title}`);
    goBtn.dataset.label = last ? 'К началу' : next.title;
    liveBtn.hidden = !cur?.ph.live;
    liveRegion.textContent = s.title;
  }
  function buildSpots() {
    pointsEl.replaceChildren();
    for (const spot of cfg.hotspots) {
      const c = cfg.cards[spot.card];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sr-hotspot'; b.dataset.spot = spot.id; b.hidden = true;
      b.setAttribute('aria-label', `Открыть деталь: ${c.title}`);
      b.innerHTML = `<span class="sr-hotspot-ring"></span><span class="sr-hotspot-dot"><i></i></span><span class="sr-hotspot-label">${c.title}</span>`;
      pointsEl.append(b); spot.el = b;
    }
  }
  function placeSpots() {
    const show = cur && !busy;
    for (const spot of cfg.hotspots) {
      const el = spot.el, mine = show && spot.photo === cur.key;
      if (!mine) { if (!el.hidden) el.hidden = true; continue; }
      const p = stage.project(cur.layer, cam, shift, strength(), spot.x / 100, spot.y / 100);
      const ok = p.inside && p.x > 26 && p.x < stage.cw - 26 && p.y > 26 && p.y < stage.ch - 26;
      if (el.hidden === ok) el.hidden = !ok;
      if (ok) { el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`; el.classList.toggle('sr-hotspot-active', detail === spot); }
    }
  }

  // ---- main loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (anim) {
      const t = clamp((now - anim.t0) / anim.dur, 0, 1);
      anim.step(anim.ease(t));
      if (t >= 1) { const done = anim.done; anim = null; done?.(); }
    } else if (Math.abs(vel.x) + Math.abs(vel.y) > .00002 && !dragging) {
      cam.x += vel.x * dt; cam.y += vel.y * dt; vel.x *= Math.pow(.92, dt / 16); vel.y *= Math.pow(.92, dt / 16);
      const c = clampCam(cur.layer, cam, stage.aspect); cam.x = c.x; cam.y = c.y;
    }
    // parallax: mouse, device tilt or a slow idle drift
    let tx, ty;
    if (now - lastMouse < 3200) { tx = mouse.x; ty = mouse.y; }
    else if (tilt.on && now - lastInput > 600) { tx = tilt.x; ty = tilt.y; }
    else if (reduced()) { tx = 0; ty = 0; }
    else { const t = now / 1000; tx = Math.sin(t / 2.8) * .55; ty = Math.cos(t / 4.1) * .3; }
    swing.x *= Math.pow(.9, dt / 16); swing.y *= Math.pow(.9, dt / 16);
    const k = 1 - Math.pow(.003, dt / 1000);
    shift.x += (clamp(tx + swing.x, -1.2, 1.2) - shift.x) * k;
    shift.y += (clamp(ty + swing.y, -1.2, 1.2) - shift.y) * k;
    if (!cur) return;
    // layers
    const items = [];
    const push = (entry, c, a) => {
      items.push({layer: entry.layer, cam: c, alpha: a});
      if (entry.liveLayer && entry.liveAlpha > .004) items.push({layer: entry.liveLayer, cam: c, alpha: entry.liveAlpha * a});
    };
    if (xfade) {
      const t = clamp((now - xfade.t0) / xfade.dur, 0, 1), e = easeIO(t);
      const oc = {x: xfade.outCam.x, y: xfade.outCam.y, z: lerp(xfade.outCam.z, xfade.outCam.z * 1.3, easeO(t))};
      push(out.entry, oc, 1);
      cam.x = lerp(xfade.from.x, xfade.to.x, e); cam.y = lerp(xfade.from.y, xfade.to.y, e); cam.z = lerp(xfade.from.z, xfade.to.z, e);
      const fa = clamp((t - .26) / .34, 0, 1);
      push(cur, cam, fa * fa * (3 - 2 * fa));
      flashEl.style.opacity = (.34 * Math.pow(Math.sin(Math.PI * clamp((t - .12) / .7, 0, 1)), 2)).toFixed(3);
      if (t >= 1) { const done = xfade.done; xfade = null; out = null; flashEl.style.opacity = 0; done(); }
    } else push(cur, cam, 1);
    stage.render(items, shift, strength());
    placeSpots();
  }

  // ---- navigation
  async function goTo(index, method = 'ui') {
    if (busy || closed || index === si && cur) return;
    const target = cfg.stations[index]; if (!target) return;
    hideHint(); if (detail) await closeDetail(true);
    busy = true; setShellState();
    const slow = setTimeout(() => shell.classList.add('sr-loading-more'), 280);
    try {
      const entry = await ensure(target.photo);
      if (liveOn && entry.ph.live) await ensureLive(entry);
      if (closed) return;
      const to = pose(target), sameShot = entry === cur;
      si = index;
      if (sameShot) {
        const dist = Math.hypot(to.x - cam.x, to.y - cam.y) + Math.abs(Math.log(to.z / cam.z)) * .6;
        await new Promise(resolve => flyTo(to, clamp(900 + dist * 1500, 1000, 1900), easeIO, resolve));
      } else {
        out = {entry: cur}; xfade = {t0: performance.now(), dur: reduced() ? 260 : 1400, outCam: {...cam}, from: {x: to.x, y: to.y, z: to.z * 1.12}, to, done: null};
        entry.liveAlpha = liveOn && entry.liveLayer ? 1 : 0;
        cur = entry;
        await new Promise(resolve => { xfade.done = resolve; });
        upgrade(cur);
      }
      if (closed) return;
      const c = clampCam(cur.layer, cam, stage.aspect); cam.x = c.x; cam.y = c.y;
      renderNav(); ev('showroom_viewpoint_change', {method}); preloadNeighbours();
    } catch (error) {
      if (closed) return;
      console.error(error); ev('showroom_error', {reason: 'viewpoint_image'}); showSceneError(index);
    } finally {
      clearTimeout(slow); shell.classList.remove('sr-loading-more'); busy = false; if (!closed) setShellState();
    }
  }
  function showSceneError(index) {
    stageEl.querySelector('.sr-scene-error')?.remove();
    const box = document.createElement('div');
    box.className = 'sr-scene-error';
    box.innerHTML = '<p>Не удалось загрузить ракурс.</p><button type="button">Попробовать ещё раз</button>';
    box.querySelector('button').addEventListener('click', () => { box.remove(); goTo(index); }, {once: true, signal});
    stageEl.append(box);
  }
  function hideHint() {
    lastInput = performance.now();
    if (!hintOn) return;
    hintOn = false; hintEl.classList.add('sr-fade'); setTimeout(() => { hintEl.hidden = true; }, 500);
    sessionStorage.setItem('showroom-hint-seen', '1');
  }
  function hideChip() { if (!chipOn) return; chipOn = false; chipEl.hidden = true; sessionStorage.setItem('showroom-chip-seen', '1'); }

  // ---- details
  function openDetail(spot) {
    if (busy || !cur) return;
    hideHint(); hideChip();
    const c = cfg.cards[spot.card];
    if (detail) { camBefore = camBefore || {...cam}; } else camBefore = {...cam};
    detail = spot;
    ev('showroom_hotspot_click', {hotspot_id: spot.card, category: c.category}); ev('showroom_detail_open', {hotspot_id: spot.card, category: c.category});
    const specs = (c.specs || []).map(([label, value], i) => `<div>${icon(['layers', 'tone', 'spark'][i % 3])}<dt>${label}</dt><dd>${value}</dd></div>`).join('');
    detailEl.innerHTML = `<div class="sr-detail-handle" aria-hidden="true"></div><button class="sr-detail-x" type="button" aria-label="Закрыть карточку">×</button>
     <div class="sr-detail-media"><img src="${c.image}" alt="${c.title}" decoding="async"></div>
     <div class="sr-detail-copy"><p class="sr-eyebrow">${cfg.title} · ${c.category}</p><h3>${c.title}</h3><p class="sr-detail-text">${c.text}</p>${specs ? `<dl class="sr-specs">${specs}</dl>` : ''}
     <a class="sr-cta" href="#popup1" data-popup="estimate" data-source="mini-showroom" data-interest="${modelId}:${spot.card}"><span>Узнать стоимость</span>${ARROW}</a>
     <button class="sr-return" type="button">Вернуться к обзору кухни</button></div>`;
    detailEl.hidden = false; detailEl.scrollTop = 0;
    requestAnimationFrame(() => { shell.classList.add('sr-detail-open'); detailEl.classList.add('sr-open'); });
    detailEl.querySelector('.sr-detail-x').focus({preventScroll: true});
    // bring the detail into the free part of the screen: the panel opens on the side away from the spot
    const mob = mobile(), pw = Math.min(470, stage.cw * .42) / stage.cw, left = !mob && spot.x >= 50;
    detailEl.classList.toggle('sr-left', left);
    const sx = mob ? .5 : left ? 1 - (1 - pw) / 2 : (1 - pw) / 2, sy = mob ? .22 : .5;
    const base = clamp(Math.max(cam.z, mob ? 1.55 : 1.75), 1, zmax(cur)), at = z => {
      const r = viewRect(cur.layer, {x: .5, y: .5, z}, stage.aspect);
      const want = {x: spot.x / 100 - (sx - .5) * r.vw, y: spot.y / 100 - (sy - .5) * r.vh, z};
      const got = clampCam(cur.layer, want, stage.aspect);
      return {got, err: Math.hypot((got.x - want.x) / r.vw, (got.y - want.y) / r.vh)};
    };
    let z = base, tgt = at(z);
    while (tgt.err > .02 && z < zmax(cur)) { z = Math.min(zmax(cur), z + .1); tgt = at(z); }
    tgt = tgt.got;
    vel.x = vel.y = 0; flyTo(tgt, 1000, easeIO);
    setShellState();
  }
  function closeDetail(instant = false) {
    if (!detail) return Promise.resolve();
    const old = detail, c = cfg.cards[old.card];
    detail = null; detailEl.classList.remove('sr-open'); shell.classList.remove('sr-detail-open');
    ev('showroom_detail_close', {hotspot_id: old.card, category: c.category});
    const back = camBefore; camBefore = null;
    if (back && !instant) flyTo(back, 900, easeIO);
    const wait = new Promise(resolve => setTimeout(() => { if (!detail) { detailEl.hidden = true; detailEl.replaceChildren(); } resolve(); }, reduced() ? 0 : 420));
    if (!instant) stageEl.focus({preventScroll: true});
    setShellState();
    return wait;
  }

  // ---- live scene toggle
  async function toggleLive() {
    if (liveBusy || busy || !cur?.ph.live) return;
    liveBusy = true; liveBtn.classList.add('sr-pending');
    try {
      const next = !liveOn;
      if (next) await ensureLive(cur);
      if (closed) return;
      liveOn = next; const entry = cur, from = entry.liveAlpha, to = liveOn ? 1 : 0, t0 = performance.now(), dur = reduced() ? 200 : 1300;
      await new Promise(resolve => { const tick = now => { const t = clamp((now - t0) / dur, 0, 1); entry.liveAlpha = lerp(from, to, easeIO(t)); if (t < 1 && !closed) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      liveBtn.setAttribute('aria-pressed', String(liveOn)); liveBtn.querySelector('span').textContent = liveOn ? 'Без людей' : 'Оживить сцену';
      ev('showroom_live_toggle', {enabled: liveOn});
    } catch (error) { console.error(error); ev('showroom_error', {reason: 'live_image'}); }
    finally { liveBusy = false; liveBtn.classList.remove('sr-pending'); }
  }

  // ---- pointer, wheel, keyboard
  const pointers = new Map();
  let dragging = false, moved = false, pinch = null, lastMoveT = 0;
  const panBy = (dxPx, dyPx) => {
    const r = viewRect(cur.layer, cam, stage.aspect);
    cam.x -= dxPx / stage.cw * r.vw; cam.y -= dyPx / stage.ch * r.vh;
    const c = clampCam(cur.layer, cam, stage.aspect); cam.x = c.x; cam.y = c.y;
  };
  function zoomAt(factor, px, py) {
    const r = viewRect(cur.layer, cam, stage.aspect), u = r.x0 + px / stage.cw * r.vw, v = r.y0 + py / stage.ch * r.vh;
    const z = clamp(cam.z * factor, 1, zmax(cur)); if (z === cam.z) return;
    const r2 = viewRect(cur.layer, {x: cam.x, y: cam.y, z}, stage.aspect);
    cam.x += u - (r2.x0 + px / stage.cw * r2.vw); cam.y += v - (r2.y0 + py / stage.ch * r2.vh); cam.z = z;
    const c = clampCam(cur.layer, cam, stage.aspect); cam.x = c.x; cam.y = c.y;
  }
  const interactive = e => e.target.closest('button,a');
  stageEl.addEventListener('pointerdown', e => {
    if (interactive(e) || busy || !cur || xfade) return;
    anim = null; vel.x = vel.y = 0; lastInput = performance.now(); moved = false;
    stageEl.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y)}; }
    dragging = true; lastMoveT = performance.now(); stageEl.classList.add('sr-grabbing');
    if (tilt.pending) { tilt.pending(); tilt.pending = null; }
  }, {signal});
  stageEl.addEventListener('pointermove', e => {
    const rect = stageEl.getBoundingClientRect();
    if (e.pointerType === 'mouse') { mouse.x = clamp(((e.clientX - rect.left) / rect.width - .5) * 2, -1, 1); mouse.y = clamp(((e.clientY - rect.top) / rect.height - .5) * 2, -1, 1); lastMouse = performance.now(); }
    const p = pointers.get(e.pointerId); if (!p || !cur) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(d / pinch.d, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top); pinch.d = d; moved = true; hideHint(); return;
    }
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    moved = true; hideHint();
    const now = performance.now(), el = Math.max(8, now - lastMoveT); lastMoveT = now;
    const r = viewRect(cur.layer, cam, stage.aspect);
    vel.x = -dx / stage.cw * r.vw / el * .9; vel.y = -dy / stage.ch * r.vh / el * .9;
    panBy(dx, dy); swing.x = clamp(-dx / 22, -1, 1) * .9; swing.y = clamp(-dy / 30, -1, 1) * .6;
  }, {signal});
  const endPointer = e => {
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) { dragging = false; stageEl.classList.remove('sr-grabbing'); if (moved) { ev('showroom_camera_drag', {method: 'gesture'}); if (reduced() || performance.now() - lastMoveT > 90) vel.x = vel.y = 0; } }
  };
  stageEl.addEventListener('pointerup', endPointer, {signal}); stageEl.addEventListener('pointercancel', endPointer, {signal});
  stageEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') lastMouse = performance.now() - 2500; }, {signal});
  stageEl.addEventListener('wheel', e => {
    if (!cur || busy) return; e.preventDefault(); hideHint(); anim = null;
    const rect = stageEl.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - rect.left, e.clientY - rect.top);
  }, {passive: false, signal});
  stageEl.addEventListener('dblclick', e => {
    if (interactive(e) || !cur || busy) return; const rect = stageEl.getBoundingClientRect();
    const z = cam.z > 1.3 ? 1 : Math.min(2, zmax(cur));
    zoomAt(z / cam.z, e.clientX - rect.left, e.clientY - rect.top);
  }, {signal});

  function look(dir) {
    if (busy || !cur) return; hideHint(); vel.x = vel.y = 0;
    const r = viewRect(cur.layer, cam, stage.aspect), c = clampCam(cur.layer, {x: cam.x + dir * r.vw * .34, y: cam.y, z: cam.z}, stage.aspect);
    flyTo(c, 650, easeO); ev('showroom_camera_drag', {method: 'button'});
  }
  const goNext = () => goTo(si === cfg.stations.length - 1 ? 0 : si + 1, 'forward');

  host.addEventListener('click', e => {
    if (e.target.closest('[data-close-showroom]')) return close();
    const spotEl = e.target.closest('[data-spot]');
    if (spotEl) { const spot = cfg.hotspots.find(h => h.id === spotEl.dataset.spot); if (spot) openDetail(spot); return; }
    const lookBtn = e.target.closest('[data-look]'); if (lookBtn) return look(Number(lookBtn.dataset.look));
    if (e.target.closest('[data-go]')) return goNext();
    const step = e.target.closest('[data-step]'); if (step) return goTo(Number(step.dataset.step), 'dots');
    if (e.target.closest('.sr-live')) return toggleLive();
    if (e.target.closest('.sr-detail-x,.sr-return')) return closeDetail();
    if (e.target.closest('.sr-cta')) ev('showroom_cta_click', {hotspot_id: detail?.card, category: detail && cfg.cards[detail.card].category});
    if (e.target.closest('.sr-quote')) ev('showroom_cta_click', {hotspot_id: 'header'});
  }, {signal});
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (detail) closeDetail(); else if (!closed) close(); return; }
    if (e.key === 'Tab') {
      const nodes = [...shell.querySelectorAll('button:not([hidden]),a[href],[tabindex="0"]')].filter(n => n.offsetParent !== null && !n.closest('[hidden]'));
      if (!nodes.length) return;
      const first = nodes[0], lastNode = nodes[nodes.length - 1];
      if (!shell.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && document.activeElement === lastNode) { e.preventDefault(); first.focus(); }
      return;
    }
    if (document.activeElement !== stageEl || busy || !cur) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); look(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); look(1); }
    else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.2, stage.cw / 2, stage.ch / 2); }
    else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); zoomAt(1 / 1.2, stage.cw / 2, stage.ch / 2); }
    else if (e.key === 'PageDown') goNext();
  }, {signal});
  let sheetStart = null;
  detailEl.addEventListener('pointerdown', e => { if (!mobile() || !e.target.closest('.sr-detail-handle')) return; sheetStart = e.clientY; detailEl.setPointerCapture(e.pointerId); }, {signal});
  detailEl.addEventListener('pointerup', e => { if (sheetStart === null) return; if (e.clientY - sheetStart > 60) closeDetail(); sheetStart = null; }, {signal});
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!closed) { last = performance.now(); raf = requestAnimationFrame(frame); } }, {signal});

  // device tilt (phones): near objects shift against the tilt
  if (matchMedia('(pointer:coarse)').matches && 'DeviceOrientationEvent' in window && !reduced()) {
    let base = null;
    const onTilt = e => {
      if (e.gamma == null) return;
      if (!base) base = {g: e.gamma, b: e.beta};
      tilt.on = true; tilt.x = clamp((e.gamma - base.g) / 18, -1, 1); tilt.y = clamp((e.beta - base.b) / 24, -1, 1);
      base.g += (e.gamma - base.g) * .003; base.b += (e.beta - base.b) * .003;
    };
    const arm = () => addEventListener('deviceorientation', onTilt, {signal});
    if (typeof DeviceOrientationEvent.requestPermission === 'function') tilt.pending = () => DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') arm(); }).catch(() => {});
    else arm();
  }

  function close() {
    if (closed) return;
    closed = true; ev('showroom_close');
    cancelAnimationFrame(raf); clearTimeout(hintTimer); controller.abort();
    stage.destroy(); entries.clear();
    document.body.style.overflow = previousOverflow; host.style.visibility = '';
    host.replaceChildren(); onClose();
    (document.querySelector('#showroom-open') || opener)?.focus?.({preventScroll: true});
  }

  // ---- start
  buildSpots();
  try {
    const first = cfg.stations[0];
    cur = await ensure(first.photo);
    if (closed) return;
    const to = pose(first);
    Object.assign(cam, reduced() ? to : {x: to.x, y: to.y + .018, z: to.z * 1.17});
    renderNav(); host.style.visibility = ''; stageEl.classList.add('sr-ready');
    last = performance.now(); raf = requestAnimationFrame(frame);
    if (!reduced()) flyTo(to, 2800, easeO);
    upgrade(cur); preloadNeighbours(); lastInput = performance.now();
    setTimeout(() => shell.classList.add('sr-hud-on'), reduced() ? 0 : 900);
    hintTimer = setTimeout(hideHint, 9000);
    shell.querySelector('.sr-back').focus({preventScroll: true});
  } catch (error) { if (!closed) { controller.abort(); stage.destroy(); host.replaceChildren(); host.hidden = true; document.body.style.overflow = previousOverflow; } throw error; }
  return {close, destroy: close};
}
