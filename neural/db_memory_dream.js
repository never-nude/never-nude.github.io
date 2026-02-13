(() => {
  const MARK = 'DB_MEMORY_DREAM_V1';
  if (window[MARK]) return;
  window[MARK] = true;

  const CONFIG = {
    idleMs: 4500,
    dreamEveryMs: 2800,
    activeHoldMs: 1600,
    traceHalfLifeMs: 35000,
    maxRoutes: 40,
    maxEdgesDraw: 22,
    maxLabelsDraw: 10,
    overlaySyncMs: 500,
    idleScanMs: 700,
  };

  const mem = {
    edges: new Map(),
    nodes: new Map(),
    recentRoutes: [],
    lastInputMs: Date.now(),
    nextDreamMs: 0,
    nextIdleScanMs: 0,
    nextOverlaySyncMs: 0,
    activeTerms: [],
    activeUntil: 0,
    lastFrameMs: Date.now(),
  };

  const norm = (s) => String(s || '').trim();
  const key  = (s) => norm(s).toLowerCase();

  function uniq(arr){
    const out = [];
    const seen = new Set();
    for (const x of arr){
      const k = key(x);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(norm(x));
    }
    return out;
  }

  function parseRouting(line){
    const s = norm(line);
    if (!s) return [];
    const m = s.match(/Routing(?:\s+to)?\s*:?\s*(.*)$/i);
    if (!m) return [];
    let tail = (m[1] || '').trim();
    if (!tail) return [];
    tail = tail.replace(/\s*->\s*/g, ' → ');
    const chunks = tail.split('→').map(x => x.trim()).filter(Boolean);

    const terms = [];
    for (const ch of chunks){
      const parts = ch.split(/[+,/&]/g).map(x => x.trim()).filter(Boolean);
      for (let t of parts){
        t = t.replace(/^(to|via|from)\s+/i, '').trim();
        if (t.length < 3) continue;
        terms.push(t);
      }
    }
    return uniq(terms).slice(0, 14);
  }

  function bumpMap(map, k, amt){
    if (!k) return;
    map.set(k, (map.get(k) || 0) + amt);
  }

  function noteRoute(terms){
    if (!terms || terms.length < 2) return;

    const now = Date.now();
    mem.lastInputMs = now;
    mem.activeTerms = terms.slice();
    mem.activeUntil = now + CONFIG.activeHoldMs;

    mem.recentRoutes.unshift({ terms: terms.slice(), t: now });
    if (mem.recentRoutes.length > CONFIG.maxRoutes) mem.recentRoutes.length = CONFIG.maxRoutes;

    for (let i = 0; i < terms.length; i++){
      bumpMap(mem.nodes, key(terms[i]), 0.6);
      if (i < terms.length - 1){
        const a = key(terms[i]);
        const b = key(terms[i+1]);
        bumpMap(mem.edges, `${a}|${b}`, 1.0);
      }
    }
  }

  function hasActiveStimuli(){
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns){
      const pressed =
        b.getAttribute('aria-pressed') === 'true' ||
        b.classList.contains('active') ||
        b.classList.contains('on') ||
        b.classList.contains('selected');

      if (!pressed) continue;

      const t = norm(b.textContent);
      if (!t) continue;
      if (/^(stimuli|directions|pause|reset)$/i.test(t)) continue;

      if (/(cue|pain|sound|vision|touch|smell|taste|balance|hunger|thirst|memory)/i.test(t)) return true;
    }
    return false;
  }

  function pickDreamRoute(){
    const routes = mem.recentRoutes;
    if (!routes.length) return null;

    const now = Date.now();
    let total = 0;
    const weights = [];

    for (const r of routes){
      const age = Math.max(0, now - (r.t || now));
      const rec = Math.exp(-age / 45000);
      const w = rec * (0.7 + 0.08 * Math.min(8, (r.terms || []).length));
      total += w;
      weights.push(w);
    }

    let x = Math.random() * total;
    for (let i = 0; i < routes.length; i++){
      x -= weights[i];
      if (x <= 0) return routes[i].terms;
    }
    return routes[0].terms;
  }

  function maybeDream(){
    const now = Date.now();
    if (now < mem.nextIdleScanMs) return;
    mem.nextIdleScanMs = now + CONFIG.idleScanMs;

    if (now < mem.nextDreamMs) return;
    if (hasActiveStimuli()) return;
    if (now - mem.lastInputMs < CONFIG.idleMs) return;

    const route = pickDreamRoute();
    if (!route) return;

    mem.activeTerms = route.slice();
    mem.activeUntil = now + 1200;
    mem.nextDreamMs = now + CONFIG.dreamEveryMs;

    try{
      if (typeof window.dbDirectionsAdd === 'function'){
        const a = route[0] || 'memory';
        const b = route[route.length - 1] || 'association';
        window.dbDirectionsAdd(`Dream replay. Routing: ${a} → ${b}.`);
      }
    }catch(_){}
  }

  const labels = new Map();
  function fontSizePx(font){
    const m = String(font || '').match(/(\d+(?:\.\d+)?)px/);
    return m ? parseFloat(m[1]) : 0;
  }

  function findMainCanvas(){
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (!canvases.length) return null;
    canvases.sort((a,b) => (b.width*b.height) - (a.width*a.height));
    return canvases[0];
  }

  function wrapCtx(ctx){
    if (!ctx || ctx.__dbMemWrapped) return;
    ctx.__dbMemWrapped = true;

    const oldFillText = ctx.fillText.bind(ctx);
    ctx.fillText = function(text, x, y, maxWidth){
      try{
        const t = norm(text);
        if (t && t.length <= 48){
          const fs = fontSizePx(ctx.font);
          if (fs >= 10){
            labels.set(key(t), { label: t, x: Number(x), y: Number(y), fs: fs, t: Date.now() });
          }
        }
      }catch(_){}
      return oldFillText(text, x, y, maxWidth);
    };
  }

  let overlay = null;
  let overlayCtx = null;
  let mainCanvas = null;
  let mainCtx = null;

  function ensureOverlay(){
    const now = Date.now();

    mainCanvas = mainCanvas || findMainCanvas();
    if (!mainCanvas) return false;

    mainCtx = mainCtx || mainCanvas.getContext('2d');
    if (!mainCtx) return false;

    wrapCtx(mainCtx);

    if (!overlay){
      overlay = document.createElement('canvas');
      overlay.id = 'dbMemOverlay';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '6';

      const parent = mainCanvas.parentElement || document.body;
      const cs = window.getComputedStyle(parent);
      if (cs.position === 'static') parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    if (now < mem.nextOverlaySyncMs && overlayCtx) return true;
    mem.nextOverlaySyncMs = now + CONFIG.overlaySyncMs;

    const rect = mainCanvas.getBoundingClientRect();
    const parentRect = overlay.parentElement.getBoundingClientRect();

    overlay.style.left = (rect.left - parentRect.left) + 'px';
    overlay.style.top  = (rect.top  - parentRect.top)  + 'px';
    overlay.style.width  = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    overlay.width  = mainCanvas.width;
    overlay.height = mainCanvas.height;

    overlayCtx = overlay.getContext('2d');
    return !!overlayCtx;
  }

  function bestPos(term){
    const t = key(term);
    if (!t) return null;

    if (labels.has(t)) return labels.get(t);

    let best = null;
    let bestScore = 0;
    const now = Date.now();

    for (const [k, v] of labels.entries()){
      if (!v) continue;
      if (now - (v.t || now) > 5000) continue;

      if (k.includes(t) || t.includes(k)){
        const score = Math.min(k.length, t.length);
        if (score > bestScore){
          bestScore = score;
          best = v;
        }
      }
    }
    return best;
  }

  function decay(dt){
    const factor = Math.pow(0.5, dt / CONFIG.traceHalfLifeMs);

    for (const [k, v] of mem.edges.entries()){
      const nv = v * factor;
      if (nv < 0.02) mem.edges.delete(k);
      else mem.edges.set(k, nv);
    }

    for (const [k, v] of mem.nodes.entries()){
      const nv = v * factor;
      if (nv < 0.02) mem.nodes.delete(k);
      else mem.nodes.set(k, nv);
    }
  }

  function draw(){
    if (!ensureOverlay()) return;

    const ctx = overlayCtx;
    const now = Date.now();
    const dt = Math.max(0, now - mem.lastFrameMs);
    mem.lastFrameMs = now;

    decay(dt);
    maybeDream();

    ctx.clearRect(0,0,overlay.width, overlay.height);

    const active = (now < mem.activeUntil) ? mem.activeTerms : [];
    const pulse = 0.65 + 0.35 * Math.sin(now / 180);

    const edges = Array.from(mem.edges.entries());
    edges.sort((a,b) => b[1] - a[1]);

    ctx.save();
    ctx.strokeStyle = 'rgba(150,180,230,1)';

    for (let i = 0; i < Math.min(CONFIG.maxEdgesDraw, edges.length); i++){
      const [k, strength] = edges[i];
      const parts = k.split('|');
      if (parts.length !== 2) continue;

      const aPos = bestPos(parts[0]);
      const bPos = bestPos(parts[1]);
      if (!aPos || !bPos) continue;

      const alpha = Math.min(0.18, 0.04 + strength * 0.03);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(aPos.x, aPos.y);
      ctx.lineTo(bPos.x, bPos.y);
      ctx.stroke();
    }

    ctx.restore();

    if (active && active.length >= 2){
      for (let i = 0; i < active.length - 1; i++){
        const aPos = bestPos(active[i]);
        const bPos = bestPos(active[i+1]);
        if (!aPos || !bPos) continue;

        const grad = ctx.createLinearGradient(aPos.x, aPos.y, bPos.x, bPos.y);
        grad.addColorStop(0, `rgba(180,205,255,${0.90*pulse})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.95*pulse})`);

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(aPos.x, aPos.y);
        ctx.lineTo(bPos.x, bPos.y);
        ctx.stroke();
        ctx.restore();
      }

      const seen = new Set();
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = '12px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';
      ctx.fillStyle = 'rgba(230,240,255,0.95)';

      for (const term of active.slice(0, CONFIG.maxLabelsDraw)){
        const pos = bestPos(term);
        if (!pos) continue;

        const k = key(pos.label);
        if (seen.has(k)) continue;
        seen.add(k);

        ctx.fillText(pos.label, pos.x, pos.y);
      }

      ctx.restore();
    }
  }

  const oldAdd = window.dbDirectionsAdd;
  if (typeof oldAdd === 'function'){
    window.dbDirectionsAdd = function(line){
      const r = oldAdd(line);
      try{
        const terms = parseRouting(line);
        if (terms.length >= 2) noteRoute(terms);
      }catch(_){}
      return r;
    };
  } else {
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button');
      if (!btn) return;
      mem.lastInputMs = Date.now();
    }, { capture: true });
  }

  function loop(){
    try{ draw(); }catch(_){}
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(loop), { once:true });
  } else {
    requestAnimationFrame(loop);
  }
})();