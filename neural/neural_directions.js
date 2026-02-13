(() => {
  'use strict';

  const MAX_LINES = 8;
  const SPEED_MS = 14;        // typing cadence
  const CHARS_PER_TICK = 2;   // speed-up per tick

  const ROUTES = {
    'Vision': ['retina', 'thalamus (visual relay)', 'primary visual cortex', 'visual association', 'working memory'],
    'Sound': ['cochlea', 'brainstem', 'thalamus (auditory relay)', 'primary auditory cortex', 'auditory association'],
    'Touch': ['receptors', 'spinal pathways', 'thalamus', 'S1', 'somatosensory association'],
    'Smell': ['olfactory bulb', 'piriform cortex', 'amygdala', 'hippocampus', 'orbitofrontal'],
    'Taste': ['brainstem', 'thalamus', 'insula', 'orbitofrontal'],
    'Balance': ['vestibular nuclei', 'cerebellum', 'parietal integration'],
    'Proprioception': ['spinal pathways', 'cerebellum', 'parietal integration'],

    'Heat/Cold': ['spinal pathways', 'thalamus', 'insula', 'attention'],
    'Pain': ['nociceptors', 'spinal pathways', 'thalamus', 'insula + anterior cingulate cortex', 'amygdala'],

    'Hunger': ['hypothalamus', 'insula', 'valuation (orbitofrontal cortex)', 'planning'],
    'Thirst': ['osmoreceptors', 'hypothalamus', 'insula', 'action selection'],
    'Air hunger (CO₂)': ['brainstem chemoreceptors', 'insula', 'amygdala', 'urge to breathe'],
    'Heart pounding': ['interoception', 'insula', 'amygdala', 'threat appraisal'],
    'Nausea': ['brainstem', 'insula', 'avoidance'],
    'Fatigue': ['homeostasis', 'basal forebrain', 'attention downshift'],

    'Threat cue': ['amygdala', 'hypothalamus', 'brainstem', 'prefrontal check'],
    'Social threat': ['amygdala', 'anterior cingulate cortex', 'prefrontal cortex', 'reappraisal'],
    'Safety cue': ['ventromedial prefrontal cortex', 'amygdala inhibition', 'parasympathetic bias'],
    'Bonding cue': ['hypothalamus', 'ventral striatum', 'social approach'],
    'Novelty': ['hippocampus', 'midbrain dopamine system', 'prefrontal cortex curiosity'],
    'Uncertainty': ['anterior cingulate cortex', 'arousal system (noradrenaline)', 'prefrontal cortex hypothesis testing'],
    'Time pressure': ['basal ganglia', 'prefrontal cortex', 'speed/accuracy tradeoff'],
    'Reward cue': ['ventral striatum', 'dopamine', 'approach drive'],
    'Memory cue': ['hippocampus', 'association cortex', 'prediction']
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function $(sel, root=document){ return root.querySelector(sel); }

  function ensureStyle(){
    if (document.getElementById('dbDirectionsStyle')) return;
    const st = document.createElement('style');
    st.id = 'dbDirectionsStyle';
    st.textContent = `
      #dbDirections{
        position: fixed;
        left: 16px;
        top: 16px;
        z-index: 10040;

        width: min(360px, calc(100vw - 32px));
        max-height: 54vh;
        overflow: hidden;

        padding: 12px 12px 10px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(10,12,16,0.54);
        box-shadow: 0 18px 50px rgba(0,0,0,0.45);

        color: rgba(190,210,230,0.86);
        font: 13px/1.38 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        letter-spacing: 0.15px;

        pointer-events: none; /* doesn't block dragging the map */
      }

      #dbDirections .title{
        color: rgba(210,225,242,0.92);
        font-weight: 700;
        margin-bottom: 6px;
      }
      #dbDirections .hint{
        color: rgba(190,210,230,0.66);
        font-size: 12px;
        margin-bottom: 10px;
      }
      #dbDirections .line{
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
        overflow-wrap: anywhere;
        word-break: break-word;
        margin: 4px 0;
      }
    `;
    document.head.appendChild(st);
  }

  let panel, linesEl;
  let queue = [];
  let typingTimer = null;
  let prevActive = new Map();
  let prevIntensity = null;

  function ensurePanel(){
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'dbDirections';
    panel.innerHTML = `
      <div class="title">Directions</div>
      <div class="hint">Toggle stimuli → I’ll narrate the routing.</div>
      <div id="dbDirectionsLines"></div>
    `;
    document.body.appendChild(panel);
    linesEl = $('#dbDirectionsLines', panel);
  }

  function activeStimuli(){
    const stim = (window.DB_STIM && typeof window.DB_STIM === 'object') ? window.DB_STIM : {};
    const entries = [];
    for (const [k,v] of Object.entries(stim)){
      const val = Number(v) || 0;
      if (val > 0.001) entries.push([k, val]);
    }
    entries.sort((a,b)=>b[1]-a[1]);
    return entries;
  }

  function intensityLabel(v){
    v = clamp(Number(v)||0, 0, 1);
    if (v < 0.45) return 'Low';
    if (v < 0.90) return 'Med';
    return 'High';
  }

  function routeFor(name){
    const r = ROUTES[name];
    if (r) return r.join(' → ');
    return 'sensory gating → attention → association → decision';
  }

  function enqueue(msg){
    msg = (msg || '').trim();
    if (!msg) return;

    const lastQueued = queue.length ? queue[queue.length-1] : null;
    const lastShown = linesEl && linesEl.lastElementChild ? linesEl.lastElementChild.dataset.full : null;
    if (msg === lastQueued || msg === lastShown) return;

    queue.push(msg);
    pump();
  }

  function addLineEl(full){
    const el = document.createElement('div');
    el.className = 'line';
    el.dataset.full = full;
    el.textContent = '• ';
    linesEl.appendChild(el);

    // trim old
    while (linesEl.children.length > MAX_LINES){
      linesEl.removeChild(linesEl.firstElementChild);
    }

    return el;
  }

  function pump(){
    if (typingTimer || !queue.length) return;

    const full = queue.shift();
    const el = addLineEl(full);

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion){
      el.textContent = '• ' + full;
      typingTimer = null;
      pump();
      return;
    }

    let i = 0;
    typingTimer = setInterval(() => {
      i += CHARS_PER_TICK;
      el.textContent = '• ' + full.slice(0, i);
      if (i >= full.length){
        clearInterval(typingTimer);
        typingTimer = null;
        pump();
      }
    }, SPEED_MS);
  }

  function diffAndLog(){
    const cur = new Map(activeStimuli());
    const curI = (typeof window.DB_STIM_INTENSITY === 'number') ? window.DB_STIM_INTENSITY : null;

    const added = [];
    const removed = [];

    for (const [k,v] of cur.entries()){
      if (!prevActive.has(k)) added.push([k,v]);
    }
    for (const [k,v] of prevActive.entries()){
      if (!cur.has(k)) removed.push([k,v]);
    }

    if (curI !== null && curI !== prevIntensity){
      enqueue(`Intensity set to ${intensityLabel(curI)}.`);
    }

    for (const [k,v] of added){
      enqueue(`${k} on. Routing: ${routeFor(k)}.`);
    }
    for (const [k,v] of removed){
      enqueue(`${k} off. De‑emphasizing that channel.`);
    }

    const count = cur.size;
    if ((added.length || removed.length) && count >= 2){
      const top = Array.from(cur.entries()).slice(0,2).map(x=>x[0]).join(' + ');
      enqueue(`Integrating ${top}; salience arbitrates bandwidth.`);
    }

    prevActive = cur;
    prevIntensity = curI;
  }

  function boot(){
    ensureStyle();
    ensurePanel();

    enqueue('Standing by. Tap “Stimuli” to inject inputs.');

    // Poll is deliberate: it keeps this module decoupled and avoids patch-layer fights.
    setInterval(diffAndLog, 220);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();


// UI declutter: hide Intensity/Recenter buttons
// (We keep keyboard shortcuts and internal wiring; we just remove the on-screen clutter.)
(function(){
  const MAX_TRIES = 40;   // ~10s worst-case
  let tries = 0;

  const timer = setInterval(() => {
    tries++;
    let hidAny = false;

    for (const btn of document.querySelectorAll('button')) {
      const t = (btn.textContent || '').trim();
      if (t === 'Recenter' || /^Intensity\b/.test(t)) {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
        hidAny = true;
      }
    }

    // Stop early if we found/hid them, or stop eventually regardless.
    if (hidAny || tries >= MAX_TRIES) clearInterval(timer);
  }, 250);
})();


;(() => {
  const PATCH = 'DB_DIRECTIONS_V4_PATCH';
  if (window[PATCH]) return;
  window[PATCH] = true;

  const STYLE_ID = 'dbDirectionsTickerCSS_v4';
  const KEEP = 60;
  const buf = [];

  const isMobile = () =>
    !!(window.matchMedia && window.matchMedia('(pointer: coarse), (max-width: 700px)').matches);

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));

  const normalizeLine = (line) => {
    if (line == null) return '';
    let t = String(line).trim();
    if (!t) return '';
    t = t.replace(/^[•\-\*]+\s*/, '');
    if (/^running\b/i.test(t)) return '';
    if (/^standing by\b/i.test(t)) return '';
    if (/^intensity set\b/i.test(t)) return '';
    if (/^toggle stimuli\b/i.test(t)) return '';
    return t;
  };

  const pushLine = (line) => {
    const t = normalizeLine(line);
    if (!t) return;
    if (buf.length && buf[buf.length - 1] === t) return;
    buf.push(t);
    if (buf.length > KEEP) buf.splice(0, buf.length - KEEP);
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
#dbDirectionsLines .line, #dbDirectionsLog .line { display: block !important; }
#dbDirections .line { white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
#dbDirections .dbDirectionsBody { max-height: 190px !important; overflow: hidden !important; }
@media (pointer: coarse), (max-width: 700px){
  #dbDirections { max-width: 92vw !important; }
  #dbDirections .dbDirectionsBody { max-height: 150px !important; }
}
`;
    document.head.appendChild(st);
  };

  const render = () => {
    ensureStyle();
    const root = document.getElementById('dbDirections');
    if (!root) return;

    const linesEl =
      document.getElementById('dbDirectionsLines') ||
      document.getElementById('dbDirectionsLog') ||
      document.getElementById('dbDirectionsText') ||
      root;

    const maxVisible = isMobile() ? 2 : 4;
    const visible = buf.slice(-maxVisible);
    linesEl.innerHTML = visible.map(v => `<div class="line">${escapeHtml(v)}</div>`).join('');
  };

  window.dbDirectionsAdd = (line) => { pushLine(line); render(); };
  window.dbDirectionsClear = () => { buf.length = 0; render(); };
  window.renderDirections = render;

  const hideButtonByText = (re) => {
    for (const b of Array.from(document.querySelectorAll('button'))) {
      const t = (b.textContent || '').trim();
      if (t && re.test(t)) b.style.display = 'none';
    }
  };

  const cleanup = () => {
    hideButtonByText(/^Intensity\s*:/i);
    hideButtonByText(/^Recenter$/i);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { render(); cleanup(); }, { once: true });
  } else {
    render();
    cleanup();
  }
  setTimeout(cleanup, 300);
  setTimeout(cleanup, 1200);
})();


;(() => {
  const PATCH = 'DB_DIRECTIONS_V5_CLAMP';
  if (window[PATCH]) return;
  window[PATCH] = true;

  const STYLE_ID = 'dbDirectionsTickerCSS_v5';
  const OLD_STYLE_IDS = ['dbDirectionsTickerCSS_v2','dbDirectionsTickerCSS_v3','dbDirectionsTickerCSS_v4'];

  const MAX_DESKTOP = 4;
  const MAX_MOBILE  = 2;

  const isMobile = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse), (max-width: 700px)').matches);

  const boringRe = /^(running|standing by|intensity set|toggle stimuli)\b/i;
  const stripLead = (s) => String(s || '').replace(/^[•\-\*]+\s*/, '').trim();

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;

    for (const id of OLD_STYLE_IDS) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
#dbDirections .line{
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
#dbDirections .dbDirectionsBody{
  max-height: 160px !important;
  overflow: hidden !important;
}
@media (pointer: coarse), (max-width: 700px){
  #dbDirections{ max-width: 92vw !important; }
  #dbDirections .dbDirectionsBody{ max-height: 130px !important; }
}
`;
    document.head.appendChild(st);
  }

  function getContainer(){
    return (
      document.getElementById('dbDirectionsLines') ||
      document.getElementById('dbDirectionsLog') ||
      document.getElementById('dbDirectionsText') ||
      null
    );
  }

  function getNodes(container){
    const q = container.querySelectorAll('.line');
    if (q && q.length) return Array.from(q);
    return Array.from(container.children || []);
  }

  function clampNow(){
    ensureStyle();
    const c = getContainer();
    if (!c) return;

    const nodes = getNodes(c);
    if (!nodes.length) return;

    const meaningful = [];
    for (const n of nodes) {
      const t = stripLead(n.textContent);
      if (!t) continue;
      if (boringRe.test(t)) continue;
      meaningful.push(n);
    }

    for (const n of nodes) n.style.display = 'none';

    const max = isMobile() ? MAX_MOBILE : MAX_DESKTOP;
    for (const n of meaningful.slice(-max)) n.style.display = 'block';
  }

  function wrapFn(obj, key){
    try {
      if (!obj) return;
      const fn = obj[key];
      if (typeof fn !== 'function') return;
      if (fn.__dbWrappedV5) return;
      const wrapped = function(...args){
        const r = fn.apply(this, args);
        try { clampNow(); } catch (_) {}
        return r;
      };
      wrapped.__dbWrappedV5 = true;
      obj[key] = wrapped;
    } catch (_) {}
  }

  function start(){
    clampNow();
    wrapFn(window, 'renderDirections');
    wrapFn(window, 'dbDirectionsRender');
    wrapFn(window, 'dbDirectionsAdd');
    wrapFn(window, 'dbDirectionsClear');

    const c = getContainer();
    if (c) {
      try {
        if (window.__dbDirectionsV5Observer) window.__dbDirectionsV5Observer.disconnect();
      } catch (_) {}
      const obs = new MutationObserver(() => { try { clampNow(); } catch (_) {} });
      obs.observe(c, { childList: true, subtree: true, characterData: true });
      window.__dbDirectionsV5Observer = obs;
    }

    window.addEventListener('resize', () => setTimeout(clampNow, 0));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  setTimeout(start, 300);
  setTimeout(start, 1200);
})();

