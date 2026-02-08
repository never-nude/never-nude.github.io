(() => {
  'use strict';

  // ---------------------------
  // Global state (single source)
  // ---------------------------
  window.DB_PAUSED = !!window.DB_PAUSED;
  window.DB_HOLDING = !!window.DB_HOLDING;
  window.DB_AUTOPAUSE = false; // auto-freeze when tab is hidden

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---------------------------
  // Time-freeze wrapper for RAF
  // (pause/hold freezes sim time but still draws frames)
  // Also prevents dt spikes when returning to the tab.
  // ---------------------------
  const raf0 = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  if (raf0 && !window.__DB_RAF_PATCHED__) {
    window.__DB_RAF_PATCHED__ = true;

    let offsetMs = 0;
    let freezeVirtualMs = null;

    const frozen = () => !!(window.DB_PAUSED || window.DB_HOLDING || window.DB_AUTOPAUSE);

    window.requestAnimationFrame = function patchedRAF(cb) {
      return raf0((tsReal) => {
        let tsVirtual = tsReal - offsetMs;

        if (frozen()) {
          if (freezeVirtualMs === null) freezeVirtualMs = tsVirtual;
          tsVirtual = freezeVirtualMs;
        } else {
          if (freezeVirtualMs !== null) {
            offsetMs = tsReal - freezeVirtualMs;
            freezeVirtualMs = null;
            tsVirtual = tsReal - offsetMs;
          }
        }

        try { cb(tsVirtual); } catch (e) { console.error('[DB RAF patch] callback error', e); }
      });
    };

    document.addEventListener('visibilitychange', () => {
      window.DB_AUTOPAUSE = document.hidden;
    });
  }

  // ---------------------------
  // Hold-to-freeze targeting:
  // bind to the largest canvas (likely the brain view)
  // ---------------------------
  function pickLargestCanvas() {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (!canvases.length) return null;
    canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return canvases[0];
  }

  function bindHolding() {
    const c = pickLargestCanvas();
    if (!c || c.__db_hold_bound) return false;
    c.__db_hold_bound = true;

    c.addEventListener('pointerdown', (e) => {
      if (e.button === 0) window.DB_HOLDING = true;
    });
    window.addEventListener('pointerup', () => { window.DB_HOLDING = false; });
    window.addEventListener('pointercancel', () => { window.DB_HOLDING = false; });
    window.addEventListener('blur', () => { window.DB_HOLDING = false; });
    return true;
  }

  // Canvas may be created after scripts load; retry a few times.
  let holdTries = 0;
  const holdTimer = setInterval(() => {
    holdTries++;
    if (bindHolding() || holdTries > 20) clearInterval(holdTimer);
  }, 250);

  // ---------------------------
  // Hide the old monologue box (the big, stuck one)
  // ---------------------------
  function hideOldMonologueBox() {
    const boxes = Array.from(document.querySelectorAll('div, pre, section'))
      .filter(el => (el.textContent || '').includes('INNER MONOLOGUE'))
      .map(el => el.closest('div') || el);

    for (const b of boxes) {
      if (b && b.id !== 'db_monologue') b.style.display = 'none';
    }
  }

  // ---------------------------
  // Color legend overlay (C)
  // ---------------------------
  function ensureLegend() {
    let el = document.getElementById('db_color_legend');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'db_color_legend';
    el.style.position = 'fixed';
    el.style.left = '16px';
    el.style.bottom = '16px';
    el.style.maxWidth = '420px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '10px';
    el.style.background = 'rgba(0,0,0,0.42)';
    el.style.border = '1px solid rgba(255,255,255,0.10)';
    el.style.backdropFilter = 'blur(8px)';
    el.style.color = 'rgba(255,255,255,0.9)';
    el.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    el.style.zIndex = 9999;
    el.style.opacity = '0';
    el.style.transition = 'opacity 220ms ease';

    el.innerHTML = [
      '<div style="opacity:.9; font-weight:700; margin-bottom:6px;">Color legend</div>',
      '<div style="opacity:.85;">WHITE = Rest / idle</div>',
      '<div style="opacity:.85;">CYAN = Breathe / oxygen-seeking</div>',
      '<div style="opacity:.85;">ORANGE = Eat / hunger-driven</div>',
      '<div style="opacity:.85;">PURPLE = Regulate / temperature-focused</div>',
      '<div style="opacity:.85;">RED = Pain / avoid hazards</div>',
      '<div style="opacity:.7; margin-top:6px;">Press C to flash this legend.</div>',
    ].join('');

    document.body.appendChild(el);
    return el;
  }

  let legendTimer = null;
  function flashLegend() {
    const el = ensureLegend();
    el.style.opacity = '1';
    clearTimeout(legendTimer);
    legendTimer = setTimeout(() => { el.style.opacity = '0'; }, 1600);
  }

  // ---------------------------
  // Telemetry sniffing
  // (so we don't get stuck on "booting up")
  // ---------------------------
  const isFiniteNum = (x) => (typeof x === 'number' && Number.isFinite(x));
  const getNum = (x) => (isFiniteNum(x) ? x : NaN);

  function scoreVitalsObject(o) {
    if (!o || typeof o !== 'object') return 0;
    if (o === window || o === document) return 0;
    if (o instanceof Node) return 0;

    const has = (k) => isFiniteNum(o[k]);
    let s = 0;

    // common names
    if (has('energy') || has('E')) s++;
    if (has('hunger') || has('H')) s++;
    if (has('oxygen') || has('O')) s++;
    if (has('temp') || has('T')) s++;
    if (has('injury') || has('I')) s++;
    if (has('co2') || has('CO2')) s++;

    if (typeof o.drive === 'string') s += 1;
    if (o.vitals && typeof o.vitals === 'object') s += 2;
    if (o.scores && typeof o.scores === 'object') s += 2;

    return s;
  }

  let cachedTelem = null;
  let cachedTelemScore = 0;
  let lastScan = 0;

  function findTelemetry() {
    const t = nowMs();
    if (cachedTelem && (t - lastScan) < 5000) return cachedTelem;

    lastScan = t;
    let best = null;
    let bestScore = 0;

    const keys = Object.keys(window);
    for (const k of keys) {
      let v;
      try { v = window[k]; } catch { continue; }
      if (!v || typeof v !== 'object') continue;
      if (v === window || v === document) continue;
      if (v instanceof Node) continue;

      const s = scoreVitalsObject(v) + scoreVitalsObject(v.vitals);
      if (s > bestScore) { bestScore = s; best = v; }
    }

    cachedTelem = bestScore >= 3 ? best : null;
    cachedTelemScore = bestScore;
    return cachedTelem;
  }

  function readVitals(telem) {
    if (!telem) return null;
    const v = (telem.vitals && typeof telem.vitals === 'object') ? telem.vitals : telem;

    const E = getNum(v.energy ?? v.E);
    const H = getNum(v.hunger ?? v.H);
    const O = getNum(v.oxygen ?? v.O);
    const T = getNum(v.temp   ?? v.T);
    const I = getNum(v.injury ?? v.I);
    const CO2 = getNum(v.co2 ?? v.CO2);

    // If nothing numeric, bail.
    const nums = [E,H,O,T,I,CO2].filter(x => Number.isFinite(x));
    if (!nums.length) return null;

    return { E,H,O,T,I,CO2 };
  }

  function topScore(scores) {
    if (!scores || typeof scores !== 'object') return null;
    let bestK = null;
    let bestV = -Infinity;
    for (const [k, v] of Object.entries(scores)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > bestV) {
        bestV = v; bestK = k;
      }
    }
    return bestK;
  }

  // ---------------------------
  // New monologue UI (small, toggleable)
  // ---------------------------
  function ensureMonologueBox() {
    let box = document.getElementById('db_monologue');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'db_monologue';
    box.style.position = 'fixed';
    box.style.right = '16px';
    box.style.top = '16px';
    box.style.width = '380px';
    box.style.maxWidth = '42vw';
    box.style.padding = '10px 12px';
    box.style.borderRadius = '12px';
    box.style.background = 'rgba(0,0,0,0.32)';
    box.style.border = '1px solid rgba(255,255,255,0.10)';
    box.style.backdropFilter = 'blur(8px)';
    box.style.color = 'rgba(255,255,255,0.92)';
    box.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    box.style.zIndex = 9999;

    box.innerHTML = `
      <div id="db_m_hdr" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px;">
        <div style="font-weight:800; letter-spacing:.06em; opacity:.92;">INNER MONOLOGUE <span style="opacity:.65;">[T]</span></div>
        <div id="db_m_state" style="opacity:.72;"></div>
      </div>
      <div id="db_m_lines" style="line-height:1.35; opacity:.92;"></div>
      <div style="margin-top:8px; opacity:.55;">
        Keys: T monologue • C colors • P pause • hold = freeze
      </div>
    `;
    document.body.appendChild(box);
    return box;
  }

  let monologueVisible = true;
  let monologueLines = [];
  let lastUtterance = '';
  let lastBootLineAt = 0;

  function setMonologueVisible(v) {
    monologueVisible = !!v;
    const box = ensureMonologueBox();
    box.style.display = monologueVisible ? 'block' : 'none';
  }

  function pushLine(s) {
    const text = (s || '').trim();
    if (!text) return;
    if (text === lastUtterance) return;
    lastUtterance = text;

    monologueLines.unshift(text);
    monologueLines = monologueLines.slice(0, 7);

    const box = ensureMonologueBox();
    const linesEl = box.querySelector('#db_m_lines');
    linesEl.innerHTML = monologueLines.map((ln, i) => {
      const a = Math.max(0.35, 1 - i * 0.12);
      return `<div style="opacity:${a};">• ${ln}</div>`;
    }).join('');
  }

  function updateStateLabel() {
    const box = ensureMonologueBox();
    const st = box.querySelector('#db_m_state');
    const bits = [];
    if (window.DB_PAUSED) bits.push('PAUSED');
    if (window.DB_HOLDING) bits.push('HOLDING');
    if (window.DB_AUTOPAUSE) bits.push('TAB-HIDDEN');
    st.textContent = bits.length ? bits.join(' • ') : '';
  }

  function describeNeed(v) {
    // Heuristic: energy/oxygen "low is bad", hunger/injury/temp "high is bad"
    const demands = [];
    if (Number.isFinite(v.E)) demands.push(['energy', 1 - v.E]);
    if (Number.isFinite(v.O)) demands.push(['oxygen', 1 - v.O]);
    if (Number.isFinite(v.H)) demands.push(['hunger', v.H]);
    if (Number.isFinite(v.I)) demands.push(['pain', v.I]);
    if (Number.isFinite(v.T)) demands.push(['temperature', v.T]);
    if (Number.isFinite(v.CO2)) demands.push(['air hunger', v.CO2]);

    demands.sort((a,b) => b[1] - a[1]);
    return demands.slice(0, 2);
  }

  function generateUtterance() {
    if (window.DB_PAUSED || window.DB_HOLDING) {
      return 'Holding still. I’m scanning the pattern without moving it.';
    }

    const telem = findTelemetry();
    const v = readVitals(telem);

    if (!v) {
      const t = nowMs();
      if ((t - lastBootLineAt) > 8000) {
        lastBootLineAt = t;
        return 'Boot sequence: I don’t have reliable body signals yet. Waiting for telemetry.';
      }
      return '';
    }

    const drive = (telem && typeof telem.drive === 'string') ? telem.drive
                : (telem && telem.scores ? topScore(telem.scores) : null);

    const needs = describeNeed(v);
    const primary = needs[0] ? needs[0][0] : null;
    const secondary = needs[1] ? needs[1][0] : null;

    // Make it sound like thought, not narration of actions.
    const lead = [
      'My attention is narrowing.',
      'I can feel the weights shifting.',
      'One signal is louder than the others.',
      'I’m sorting urgency from noise.',
      'I’m prioritizing without certainty.',
    ];

    const reasons = [];
    if (primary) reasons.push(`${primary} is demanding space in my head`);
    if (secondary) reasons.push(`${secondary} is tugging in the background`);

    const intention = drive
      ? `Right now, the impulse labeled “${drive}” has the clearest argument.`
      : 'I don’t have a single clean impulse yet — just competing pressures.';

    const tail = [
      'If I ignore it, things drift fast.',
      'I can’t do everything at once. I’m choosing the least-wrong move.',
      'I’ll reassess as soon as the world pushes back.',
      'This is a temporary stance, not a belief.',
    ];

    // Deterministic-ish selection to reduce repetitiveness
    const pick = (arr) => arr[Math.floor((nowMs()/1000) % arr.length)];

    return `${pick(lead)} ${intention} ${reasons.length ? ('Because ' + reasons.join(', ') + '.') : ''} ${pick(tail)}`;
  }

  // Main loop: hide old box, create ours, and update steadily.
  hideOldMonologueBox();
  ensureMonologueBox();
  updateStateLabel();
  pushLine('Online. I’m listening for signals.');

  setInterval(() => {
    updateStateLabel();
    if (!monologueVisible) return;
    const u = generateUtterance();
    if (u) pushLine(u);
  }, 1200);

  // ---------------------------
  // Gentle scale-back for node/line boost
  // (best-effort: only touches obvious viz config objects)
  // ---------------------------
  function maybeScaleBackOnce() {
    const propsNode = ['nodeR','nodeRadius','nodeSize','NODE_R','NODE_RADIUS','NODE_SIZE'];
    const propsLine = ['lineW','lineWidth','edgeW','linkW','LINE_W','EDGE_W','LINK_W'];

    const keys = Object.keys(window);
    for (const k of keys) {
      let o;
      try { o = window[k]; } catch { continue; }
      if (!o || typeof o !== 'object') continue;
      if (o instanceof Node) continue;
      if (o.__db_scaled) continue;

      let pn = null, pl = null;
      for (const p of propsNode) if (typeof o[p] === 'number' && Number.isFinite(o[p])) { pn = p; break; }
      for (const p of propsLine) if (typeof o[p] === 'number' && Number.isFinite(o[p])) { pl = p; break; }

      if (pn && pl) {
        // Scale back a bit (not dramatic)
        o[pn] *= 0.82;
        o[pl] *= 0.82;
        o.__db_scaled = true;
      }
    }
  }

  // Try a few times in case viz config initializes late
  setTimeout(maybeScaleBackOnce, 400);
  setTimeout(maybeScaleBackOnce, 1400);
  setTimeout(maybeScaleBackOnce, 2800);

  // ---------------------------
  // Keys: T toggle, P pause, C legend
  // ---------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'T' || e.key === 't') {
      setMonologueVisible(!monologueVisible);
      e.preventDefault();
    }
    if (e.key === 'P' || e.key === 'p') {
      window.DB_PAUSED = !window.DB_PAUSED;
      updateStateLabel();
      pushLine(window.DB_PAUSED ? 'Pause engaged. Time is held.' : 'Pause released. Time resumes.');
      e.preventDefault();
    }
    if (e.key === 'C' || e.key === 'c') {
      flashLegend();
      e.preventDefault();
    }
  }, { capture: true });

})();
