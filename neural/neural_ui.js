(() => {
  'use strict';

  // Shared stimuli state (network should read this if baseline supports stimuli)
  window.DB_STIM = (window.DB_STIM && typeof window.DB_STIM === 'object') ? window.DB_STIM : Object.create(null);
  window.DB_STIM_INTENSITY = (typeof window.DB_STIM_INTENSITY === 'number') ? window.DB_STIM_INTENSITY : 0.75;

  const GROUPS = {
    Senses: ['Vision','Sound','Touch','Smell','Taste','Balance','Proprioception','Heat/Cold','Pain'],
    Body:   ['Hunger','Thirst','Air hunger (CO₂)','Heart pounding','Nausea','Fatigue'],
    Cues:   ['Threat cue','Social threat','Safety cue','Bonding cue','Novelty','Uncertainty','Time pressure','Reward cue','Memory cue']
  };
  const GROUP_ORDER = ['Senses','Body','Cues'];

  const LEVELS = [
    {name:'Low', v:0.35},
    {name:'Med', v:0.75},
    {name:'High',v:1.00}
  ];

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const $ = (sel, root=document)=>root.querySelector(sel);

  const S = {
    open: false,
    group: 'Senses',
    levelIdx: 1
  };

  // --- Hide legacy stimuli overlay (baseline panel) so it doesn't conflict.
  function hideLegacyStimuliUI(){
    // Find an element that contains "Stimuli (multi-select)" and hide its container.
    const nodes = Array.from(document.querySelectorAll('div'));
    for (const n of nodes){
      const t = (n.textContent || '');
      if (t.includes('Stimuli (multi-select)') && n.getBoundingClientRect().height > 80){
        n.style.display = 'none';
        return;
      }
    }
  }

  function ensureStyle(){
    if (document.getElementById('dbNeuralUIStyle')) return;
    const st = document.createElement('style');
    st.id = 'dbNeuralUIStyle';
    st.textContent = `
      :root{ --safeB: env(safe-area-inset-bottom); }

      #dbCtlStack{
        position: fixed;
        right: 16px;
        bottom: calc(16px + var(--safeB));
        z-index: 10060;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .dbBtn{
        min-height: 46px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(190,220,255,0.20);
        background: rgba(12,14,18,0.62);
        color: rgba(220,235,255,0.92);
        font: 14px/1.1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        letter-spacing: 0.2px;
        box-shadow: 0 12px 34px rgba(0,0,0,0.55);
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
      }
      .dbBtn:active{ transform: translateY(1px); }

      .dbBtn.primary{
        background: rgba(70,110,255,0.18);
        border-color: rgba(120,170,255,0.30);
      }
      .dbBtn.primary.on{
        background: rgba(120,170,255,0.26);
        border-color: rgba(120,170,255,0.50);
        box-shadow: 0 12px 34px rgba(0,0,0,0.55), 0 0 18px rgba(120,170,255,0.22);
      }

      /* Bottom sheet */
      #dbSheet{
        position: fixed;
        left: 0; right: 0; bottom: 0;
        margin: 0 auto;
        max-width: 980px;
        z-index: 10050;

        height: min(46vh, 440px);
        max-height: calc(100vh - 120px);

        border: 1px solid rgba(255,255,255,0.12);
        border-bottom: none;
        border-radius: 18px 18px 0 0;
        background: rgba(10,12,16,0.86); /* no blur, no frosted glass */
        box-shadow: 0 20px 60px rgba(0,0,0,0.60);

        transform: translateY(calc(100% + 18px));
        transition: transform 200ms ease;
        pointer-events: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      #dbSheet.open{
        transform: translateY(0);
        pointer-events: auto;
      }

      #dbSheet .hdr{
        padding: 10px 14px 8px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #dbSheet .handle{
        width: 44px; height: 5px; border-radius: 999px;
        background: rgba(230,245,255,0.18);
        margin: 4px auto 10px;
      }
      #dbSheet .top{
        display:flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        color: rgba(235,245,255,0.90);
        font: 14px/1.2 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      }
      #dbSheet .top .title{ font-weight: 700; }
      #dbSheet .top .meta{ opacity: 0.70; font-size: 12px; }

      #dbTabs{
        margin-top: 10px;
        display:flex;
        gap: 8px;
        overflow-x:auto;
        padding-bottom: 4px;
        -webkit-overflow-scrolling: touch;
      }
      #dbTabs::-webkit-scrollbar{ height: 0; }

      .dbTab{
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: rgba(220,235,255,0.82);
        font: 13px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
        cursor:pointer;
        touch-action: manipulation;
        user-select:none;
        white-space:nowrap;
      }
      .dbTab.on{
        background: rgba(120,170,255,0.18);
        border-color: rgba(120,170,255,0.28);
        color: rgba(235,245,255,0.92);
      }

      #dbSheet .body{
        padding: 12px 14px calc(14px + var(--safeB));
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        flex: 1 1 auto;
      }

      #dbGrid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      @media (min-width: 560px){ #dbGrid{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (min-width: 900px){ #dbGrid{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }

      .dbStim{
        min-height: 44px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.06);
        color: rgba(225,235,245,0.82);
        font: 13px/1.15 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
        text-align:left;
        cursor:pointer;
        touch-action: manipulation;
        user-select:none;
      }
      .dbStim.on{
        background: rgba(120,170,255,0.18);
        border-color: rgba(120,170,255,0.28);
        color: rgba(235,245,255,0.94);
      }
    `;
    document.head.appendChild(st);
  }

  function selectedNames(){
    const out = [];
    for (const g of GROUP_ORDER){
      for (const name of GROUPS[g]){
        if ((Number(window.DB_STIM[name]) || 0) > 0) out.push(name);
      }
    }
    return out;
  }

  function setIntensity(v){
    window.DB_STIM_INTENSITY = clamp(v, 0, 1);
    // apply to selected
    for (const name of selectedNames()){
      window.DB_STIM[name] = window.DB_STIM_INTENSITY;
    }
  }

  function updateIntensityBtn(){
    const b = $('#dbIntensityBtn');
    if (!b) return;
    b.textContent = `Intensity: ${LEVELS[S.levelIdx].name}`;
  }

  function cycleIntensity(){
    S.levelIdx = (S.levelIdx + 1) % LEVELS.length;
    setIntensity(LEVELS[S.levelIdx].v);
    updateIntensityBtn();
    refreshGrid();
  }

  function ensureControls(){
    if ($('#dbCtlStack')) return;

    const stack = document.createElement('div');
    stack.id = 'dbCtlStack';
    stack.innerHTML = `
      <button id="dbStimBtn" class="dbBtn primary" type="button">Stimuli</button>
      <button id="dbIntensityBtn" class="dbBtn" type="button">Intensity: Med</button>
      <button id="dbRecenterBtn" class="dbBtn" type="button">Recenter</button>
    `;
    document.body.appendChild(stack);

    $('#dbStimBtn').addEventListener('click', toggleSheet);
    $('#dbIntensityBtn').addEventListener('click', cycleIntensity);
    $('#dbRecenterBtn').addEventListener('click', recenter);

    updateIntensityBtn();
  }

  function ensureSheet(){
    if ($('#dbSheet')) return;

    const sheet = document.createElement('div');
    sheet.id = 'dbSheet';
    sheet.innerHTML = `
      <div class="hdr">
        <div class="handle"></div>
        <div class="top">
          <div class="title">Stimuli</div>
          <div class="meta">Selected: <span id="dbSelCount">0</span></div>
        </div>
        <div id="dbTabs"></div>
      </div>
      <div class="body">
        <div id="dbGrid"></div>
      </div>
    `;
    document.body.appendChild(sheet);

    const tabs = $('#dbTabs');
    for (const g of GROUP_ORDER){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dbTab' + (g === S.group ? ' on' : '');
      b.textContent = g;
      b.addEventListener('click', () => setGroup(g));
      tabs.appendChild(b);
    }

    buildGrid();
    updateSelCount();
  }

  function setGroup(g){
    S.group = g;
    // tab styling
    for (const b of Array.from(document.querySelectorAll('.dbTab'))){
      b.classList.toggle('on', b.textContent === g);
    }
    buildGrid();
    refreshGrid();
  }

  function buildGrid(){
    const grid = $('#dbGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const name of (GROUPS[S.group] || [])){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dbStim';
      b.textContent = name;
      b.addEventListener('click', () => toggleStim(name));
      grid.appendChild(b);
    }
  }

  function refreshGrid(){
    const grid = $('#dbGrid');
    if (!grid) return;
    for (const b of Array.from(grid.querySelectorAll('button'))){
      const name = (b.textContent || '').trim();
      const on = (Number(window.DB_STIM[name]) || 0) > 0;
      b.classList.toggle('on', on);
    }
    updateSelCount();
  }

  function toggleStim(name){
    const on = (Number(window.DB_STIM[name]) || 0) > 0;
    window.DB_STIM[name] = on ? 0 : window.DB_STIM_INTENSITY;
    refreshGrid();
  }

  function updateSelCount(){
    const el = $('#dbSelCount');
    if (!el) return;
    el.textContent = String(selectedNames().length);
  }

  function openSheet(on){
    S.open = !!on;
    const sheet = $('#dbSheet');
    const btn = $('#dbStimBtn');
    if (!sheet || !btn) return;

    sheet.classList.toggle('open', S.open);
    btn.classList.toggle('on', S.open);

    // keep label always Stimuli (mode toggle)
    btn.textContent = 'Stimuli';
  }

  function toggleSheet(){
    openSheet(!S.open);
    refreshGrid();
  }

  function recenter(e){
    // safest recenter: try known global functions, else reload
    const hard = !!(e && e.shiftKey);
    if (!hard){
      try {
        if (typeof window.NEURAL_RESET_VIEW === 'function') return window.NEURAL_RESET_VIEW();
        if (typeof window.resetView === 'function') return window.resetView();
        if (typeof window.recenterView === 'function') return window.recenterView();
        if (typeof window.NEURAL === 'object' && typeof window.NEURAL.recenter === 'function') return window.NEURAL.recenter();
      } catch {}
    }
    const url = new URL(window.location.href);
    url.searchParams.set('cb', String(Date.now()));
    window.location.replace(url.toString());
  }

  function boot(){
    ensureStyle();
    hideLegacyStimuliUI();
    ensureControls();
    ensureSheet();

    // initialize intensity to Med
    setIntensity(LEVELS[S.levelIdx].v);
    refreshGrid();

    // keyboard optional: S toggles stimuli, I cycles intensity, R recenters
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = (e.key || '').toLowerCase();
      if (k === 's') { toggleSheet(); e.preventDefault(); }
      if (k === 'i') { cycleIntensity(); e.preventDefault(); }
      if (k === 'r') { recenter(e); e.preventDefault(); }
    }, { capture:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
