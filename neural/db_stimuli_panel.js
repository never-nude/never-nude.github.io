/* DigitalBrain — Stimuli Panel v1
   Toggle: S
   Multi-stim: click toggles on/off; Shift-click latches; slider sets intensity for new toggles
*/
(() => {
  'use strict';

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  const STIM_LIST = [
    // External senses
    'Vision','Sound','Touch','Pain','Heat/Cold','Proprioception','Balance','Smell','Taste',
    // Interoception
    'Hunger','Thirst','Air hunger (CO₂)','Heart pounding','Nausea','Fatigue',
    // Threat / safety / social
    'Threat cue','Social threat','Safety cue','Bonding cue',
    // Cognition-ish
    'Novelty','Uncertainty','Time pressure','Reward cue','Memory cue'
  ];

  // Global store
  window.DB_STIM = (window.DB_STIM && typeof window.DB_STIM === 'object') ? window.DB_STIM : Object.create(null);

  const STATE = {
    visible: false,
    intensity: 0.75,
    latched: Object.create(null),
    el: null,
    buttons: Object.create(null),
  };

  function ensurePanel() {
    if (STATE.el) return;

    const wrap = document.createElement('div');
    wrap.id = 'dbStimPanel';
    wrap.style.position = 'fixed';
    wrap.style.right = '16px';
    wrap.style.bottom = '16px';
    wrap.style.width = 'min(520px, calc(92vw - 32px))';
    wrap.style.maxWidth = '520px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '14px';
    wrap.style.background = 'rgba(0,0,0,0.35)';
    wrap.style.border = '1px solid rgba(255,255,255,0.10)';
    wrap.style.backdropFilter = 'blur(8px)';
    wrap.style.zIndex = '9999';
    wrap.style.display = 'none';
    wrap.style.userSelect = 'none';

    const title = document.createElement('div');
    title.textContent = 'Stimuli (multi-select)';
    title.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    title.style.fontSize = '13px';
    title.style.color = 'rgba(235,245,255,0.85)';
    title.style.marginBottom = '10px';

    const hint = document.createElement('div');
    hint.textContent = 'Click = toggle • Shift-click = latch • Slider sets intensity';
    hint.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    hint.style.fontSize = '11px';
    hint.style.color = 'rgba(200,210,220,0.65)';
    hint.style.marginTop = '-6px';
    hint.style.marginBottom = '10px';

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
    grid.style.gap = '8px';

    function btnStyle(b, on, latched) {
      b.style.padding = '8px 10px';
      b.style.borderRadius = '10px';
      b.style.border = '1px solid rgba(255,255,255,0.10)';
      b.style.background = on ? 'rgba(120,170,255,0.18)' : 'rgba(255,255,255,0.06)';
      b.style.color = on ? 'rgba(235,245,255,0.92)' : 'rgba(225,235,245,0.72)';
      b.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      b.style.fontSize = '12px';
      b.style.textAlign = 'left';
      b.style.cursor = 'pointer';
      b.style.boxShadow = latched ? '0 0 0 2px rgba(255,255,255,0.10) inset' : 'none';
      b.style.opacity = latched ? '1' : '0.96';
    }

    for (const name of STIM_LIST) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.onclick = (e) => {
        const latch = !!e.shiftKey;
        const currentlyOn = (Number(window.DB_STIM[name]) || 0) > 0;

        if (latch) {
          STATE.latched[name] = !STATE.latched[name];
        }

        const turnOn = latch ? STATE.latched[name] : !currentlyOn;
        window.DB_STIM[name] = turnOn ? STATE.intensity : 0;

        btnStyle(b, turnOn, !!STATE.latched[name]);

        if (window.DB_NETVIEW && typeof window.DB_NETVIEW.push === 'function') {
          window.DB_NETVIEW.push(turnOn ? `Stimulus on: ${name}` : `Stimulus off: ${name}`);
        }
      };

      // initial style
      btnStyle(b, false, false);
      grid.appendChild(b);
      STATE.buttons[name] = b;
    }

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '10px';
    controls.style.marginTop = '12px';

    const label = document.createElement('div');
    label.textContent = 'Intensity';
    label.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    label.style.fontSize = '12px';
    label.style.color = 'rgba(235,245,255,0.78)';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(STATE.intensity * 100));
    slider.style.flex = '1';
    slider.oninput = () => {
      STATE.intensity = clamp(Number(slider.value)/100, 0, 1);
    };

    const pulse = document.createElement('button');
    pulse.type = 'button';
    pulse.textContent = 'Pulse selected';
    pulse.style.padding = '8px 10px';
    pulse.style.borderRadius = '10px';
    pulse.style.border = '1px solid rgba(255,255,255,0.10)';
    pulse.style.background = 'rgba(255,255,255,0.06)';
    pulse.style.color = 'rgba(235,245,255,0.80)';
    pulse.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    pulse.style.fontSize = '12px';
    pulse.style.cursor = 'pointer';
    pulse.onclick = () => {
      const active = Object.entries(window.DB_STIM).filter(([_,v]) => (Number(v)||0) > 0).map(([k,_]) => k);
      if (!active.length) return;

      if (window.DB_NETVIEW && typeof window.DB_NETVIEW.push === 'function') {
        window.DB_NETVIEW.push(`Pulse: ${active.join(', ')}`);
      }

      const old = {};
      for (const k of active) old[k] = Number(window.DB_STIM[k]) || 0;

      for (const k of active) window.DB_STIM[k] = STATE.intensity;

      setTimeout(() => {
        for (const k of active) window.DB_STIM[k] = old[k];
      }, 450);
    };

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear all';
    clear.style.padding = '8px 10px';
    clear.style.borderRadius = '10px';
    clear.style.border = '1px solid rgba(255,255,255,0.10)';
    clear.style.background = 'rgba(255,255,255,0.06)';
    clear.style.color = 'rgba(235,245,255,0.80)';
    clear.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    clear.style.fontSize = '12px';
    clear.style.cursor = 'pointer';
    clear.onclick = () => {
      for (const k of Object.keys(window.DB_STIM)) window.DB_STIM[k] = 0;
      for (const k of Object.keys(STATE.latched)) delete STATE.latched[k];
      for (const name of STIM_LIST) {
        const b = STATE.buttons[name];
        if (b) {
          b.style.boxShadow = 'none';
          b.style.background = 'rgba(255,255,255,0.06)';
          b.style.color = 'rgba(225,235,245,0.72)';
        }
      }
      if (window.DB_NETVIEW && typeof window.DB_NETVIEW.push === 'function') {
        window.DB_NETVIEW.push('Stimuli cleared.');
      }
    };

    controls.appendChild(label);
    controls.appendChild(slider);
    controls.appendChild(pulse);
    controls.appendChild(clear);

    wrap.appendChild(title);
    wrap.appendChild(hint);
    wrap.appendChild(grid);
    wrap.appendChild(controls);

    document.body.appendChild(wrap);
    STATE.el = wrap;
  }

  function setVisible(on) {
    ensurePanel();
    STATE.visible = !!on;
    STATE.el.style.display = STATE.visible ? 'block' : 'none';
    if (window.DB_NETVIEW && typeof window.DB_NETVIEW.push === 'function') {
      window.DB_NETVIEW.push(STATE.visible ? 'Stimuli panel opened.' : 'Stimuli panel closed.');
    }
  }

  function toggle() { setVisible(!STATE.visible); }

  function installKeys() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'S' || e.key === 's') { toggle(); e.preventDefault(); }
    }, { capture: true });
  }

  function boot() {
    ensurePanel();
    installKeys();
    // tiny hint for the network log (if present)
    if (window.DB_NETVIEW && typeof window.DB_NETVIEW.push === 'function') {
      window.DB_NETVIEW.push('Tip: press S for stimuli, N for neural view.');
    }
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
