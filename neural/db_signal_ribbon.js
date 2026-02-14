(() => {
  const MARK = 'DB_SIGNAL_RIBBON_V1';
  if (window[MARK]) return;
  window[MARK] = true;

  const CONFIG = {
    holdMs: 1500,
    idleFadeMs: 700,
    labelWindowMs: 7000,
    maxLabels: 12,
    dashSpeed: 18,
    baseWidth: 7.0,
    flowWidth: 3.4,
  };

  const state = {
    activeTerms: [],
    activeUntil: 0,
    lastLine: '',
  };

  window.__dbActiveTerms = window.__dbActiveTerms || [];
  window.__dbDimPaths = window.__dbDimPaths || false;

  const labels = new Map();

  const norm = (s) => String(s || '').trim();
  const key  = (s) => norm(s).toLowerCase();

  function parseRouting(line){
    const s = norm(line);
    if (!s) return [];
    const m = s.match(/Routing(?:\s+to)?\s*:?\s*(.*)$/i);
    if (!m) return [];
    let tail = (m[1] || '').trim();
    if (!tail) return [];
    tail = tail.replace(/\s*->\s*/g, ' → ');
    const chunks = tail.split('→').map(x => x.trim()).filter(Boolean);

    const out = [];
    const seen = new Set();
    for (const ch of chunks){
      const parts = ch.split(/[+,/&]/g).map(x => x.trim()).filter(Boolean);
      for (let t of parts){
        t = t.replace(/^(to|via|from)\s+/i, '').trim();
        if (t.length < 3) continue;
        const k = key(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
    }
    return out.slice(0, 14);
  }

  function noteRoute(terms, rawLine){
    if (!terms || terms.length < 2) return;
    const now = Date.now();

    state.activeTerms = terms.slice();
    state.activeUntil = now + CONFIG.holdMs;
    state.lastLine = rawLine || '';

    window.__dbActiveTerms = terms.slice();
    window.__dbDimPaths = true;

    setTimeout(() => {
      if (Date.now() > state.activeUntil + CONFIG.idleFadeMs){
        window.__dbDimPaths = false;
        window.__dbActiveTerms = [];
      }
    }, CONFIG.holdMs + CONFIG.idleFadeMs + 30);
  }

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

  function wrapFillText(ctx){
    if (!ctx || ctx.__dbRibbonFillWrapped) return;
    ctx.__dbRibbonFillWrapped = true;
    const old = ctx.fillText.bind(ctx);
    ctx.fillText = function(text, x, y, maxWidth){
      try{
        const t = norm(text);
        const fs = fontSizePx(ctx.font);
        if (t && t.length <= 52 && fs >= 10){
          labels.set(key(t), { label: t, x: Number(x), y: Number(y), t: Date.now(), fs: fs });
        }
      }catch(_){}
      return old(text, x, y, maxWidth);
    };
  }

  function bestPos(term){
    const t = key(term);
    if (!t) return null;

    if (labels.has(t)) return labels.get(t);

    const now = Date.now();
    let best = null;
    let bestScore = 0;

    for (const [k, v] of labels.entries()){
      if (!v) continue;
      if (now - (v.t || now) > CONFIG.labelWindowMs) continue;

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

  let overlay = null;
  let octx = null;
  let mainCanvas = null;
  let mainCtx = null;
  let nextSync = 0;

  function ensureOverlay(){
    const now = Date.now();

    mainCanvas = mainCanvas || findMainCanvas();
    if (!mainCanvas) return false;

    mainCtx = mainCtx || mainCanvas.getContext('2d');
    if (!mainCtx) return false;

    wrapFillText(mainCtx);

    if (!overlay){
      overlay = document.createElement('canvas');
      overlay.id = 'dbSignalRibbonOverlay';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '7';
      const parent = mainCanvas.parentElement || document.body;
      const cs = window.getComputedStyle(parent);
      if (cs.position === 'static') parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    if (octx && now < nextSync) return true;
    nextSync = now + 400;

    const rect = mainCanvas.getBoundingClientRect();
    const parentRect = overlay.parentElement.getBoundingClientRect();

    overlay.style.left = (rect.left - parentRect.left) + 'px';
    overlay.style.top  = (rect.top  - parentRect.top)  + 'px';
    overlay.style.width  = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    overlay.width  = mainCanvas.width;
    overlay.height = mainCanvas.height;

    octx = overlay.getContext('2d');
    return !!octx;
  }

  function drawArrow(ctx, ax, ay, bx, by, alpha){
    const dx = bx - ax, dy = by - ay;
    const L = Math.hypot(dx, dy);
    if (L < 1e-3) return;
    const ux = dx / L, uy = dy / L;

    const size = 9;
    const px = -uy, py = ux;

    const tipx = bx, tipy = by;
    const backx = bx - ux * size;
    const backy = by - uy * size;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(tipx, tipy);
    ctx.lineTo(backx + px * (size * 0.55), backy + py * (size * 0.55));
    ctx.lineTo(backx - px * (size * 0.55), backy - py * (size * 0.55));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRibbon(points){
    const ctx = octx;
    if (!ctx || points.length < 2) return;

    const now = Date.now();
    const pulse = 0.65 + 0.35 * Math.sin(now / 170);

    ctx.save();
    ctx.clearRect(0,0,overlay.width, overlay.height);
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    ctx.globalCompositeOperation = 'lighter';

    const a = points[0];
    const b = points[points.length - 1];

    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, `rgba(110,0,0,${0.45*pulse})`);
    grad.addColorStop(1, `rgba(190,30,30,${0.85*pulse})`);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++){
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(140,175,240,${0.20*pulse})`;
    ctx.lineWidth = CONFIG.baseWidth;
    ctx.stroke();

    ctx.strokeStyle = grad;
    ctx.lineWidth = CONFIG.flowWidth;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -(now / CONFIG.dashSpeed);
    ctx.globalAlpha = 1;
    ctx.stroke();

    ctx.fillStyle = `rgba(190,30,30,${0.9*pulse})`;
    const pN = points.length;
    drawArrow(ctx, points[pN-2].x, points[pN-2].y, points[pN-1].x, points[pN-1].y, 0.9*pulse);

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = '12px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';
    ctx.fillStyle = `rgba(235,245,255,${0.95*pulse})`;

    for (const pt of points.slice(0, CONFIG.maxLabels)){
      ctx.fillText(pt.label, pt.x + 4, pt.y - 4);
    }
    ctx.restore();
  }

  function tick(){
    try{
      if (ensureOverlay()){
        const now = Date.now();
        const active = (now < state.activeUntil) ? state.activeTerms : [];
        if (active && active.length >= 2){
          const pts = [];
          for (const term of active){
            const pos = bestPos(term);
            if (!pos) continue;
            pts.push({ x: pos.x, y: pos.y, label: pos.label });
          }
          const uniqPts = [];
          const seen = new Set();
          for (const p of pts){
            const k = key(p.label);
            if (seen.has(k)) continue;
            seen.add(k);
            uniqPts.push(p);
          }
          drawRibbon(uniqPts);
        } else if (octx) {
          octx.clearRect(0,0,overlay.width, overlay.height);
        }
      }
    }catch(_){}
    requestAnimationFrame(tick);
  }

  const oldAdd = window.dbDirectionsAdd;
  if (typeof oldAdd === 'function'){
    window.dbDirectionsAdd = function(line){
      const r = oldAdd(line);
      try{
        const terms = parseRouting(line);
        if (terms.length >= 2) noteRoute(terms, line);
      }catch(_){}
      return r;
    };
  } else {
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const c = document.getElementById('dbDirectionsLines') || document.getElementById('dbDirectionsLog') || document.getElementById('dbDirectionsText');
      if (c){
        const obs = new MutationObserver(() => {
          try{
            const nodes = Array.from(c.querySelectorAll('.line'));
            const last = nodes.length ? nodes[nodes.length - 1].textContent : c.textContent;
            const terms = parseRouting(last || '');
            if (terms.length >= 2) noteRoute(terms, last || '');
          }catch(_){}
        });
        obs.observe(c, { childList:true, subtree:true, characterData:true });
        clearInterval(t);
      }
      if (tries > 100) clearInterval(t);
    }, 100);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick), { once:true });
  } else {
    requestAnimationFrame(tick);
  }
})();