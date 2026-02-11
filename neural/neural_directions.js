(() => {
  'use strict';

  const MAX_LINES = 8;
  const SPEED_MS = 14;        // typing cadence
  const CHARS_PER_TICK = 2;   // speed-up per tick

  const ROUTES = {
    'Vision': ['retina', 'thalamus (LGN)', 'V1', 'visual association', 'working memory'],
    'Sound': ['cochlea', 'brainstem', 'thalamus (MGN)', 'A1', 'auditory association'],
    'Touch': ['receptors', 'spinal pathways', 'thalamus', 'S1', 'somatosensory association'],
    'Smell': ['olfactory bulb', 'piriform cortex', 'amygdala', 'hippocampus', 'orbitofrontal'],
    'Taste': ['brainstem', 'thalamus', 'insula', 'orbitofrontal'],
    'Balance': ['vestibular nuclei', 'cerebellum', 'parietal integration'],
    'Proprioception': ['spinal pathways', 'cerebellum', 'parietal integration'],

    'Heat/Cold': ['spinal pathways', 'thalamus', 'insula', 'attention'],
    'Pain': ['nociceptors', 'spinal pathways', 'thalamus', 'insula/ACC', 'amygdala'],

    'Hunger': ['hypothalamus', 'insula', 'valuation (OFC)', 'planning'],
    'Thirst': ['osmoreceptors', 'hypothalamus', 'insula', 'action selection'],
    'Air hunger (CO₂)': ['brainstem chemoreceptors', 'insula', 'amygdala', 'urge to breathe'],
    'Heart pounding': ['interoception', 'insula', 'amygdala', 'threat appraisal'],
    'Nausea': ['brainstem', 'insula', 'avoidance'],
    'Fatigue': ['homeostasis', 'basal forebrain', 'attention downshift'],

    'Threat cue': ['amygdala', 'hypothalamus', 'brainstem', 'prefrontal check'],
    'Social threat': ['amygdala', 'ACC', 'PFC', 'reappraisal'],
    'Safety cue': ['vmPFC', 'amygdala inhibition', 'parasympathetic bias'],
    'Bonding cue': ['hypothalamus', 'ventral striatum', 'social approach'],
    'Novelty': ['hippocampus', 'VTA dopamine', 'PFC curiosity'],
    'Uncertainty': ['ACC', 'LC/NE', 'PFC hypothesis testing'],
    'Time pressure': ['basal ganglia', 'PFC', 'speed/accuracy tradeoff'],
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
