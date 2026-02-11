(() => {
  'use strict';

  if (window.__DB_NEURAL_LOADED__) return;
  window.__DB_NEURAL_LOADED__ = true;

  const canvas = document.getElementById('neuralCanvas');
  if (!canvas) { console.warn('db_network_neural: #neuralCanvas not found'); return; }

  const ctx = canvas.getContext('2d', { alpha: true });

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp  = (a,b,t)=>a+(b-a)*t;

  function hexToRgb(hex){
    const h = String(hex||'#fff').replace('#','').trim();
    const hh = (h.length===3) ? h.split('').map(c=>c+c).join('') : h;
    const n = parseInt(hh,16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function rgba(hex,a){
    const {r,g,b}=hexToRgb(hex);
    return `rgba(${r},${g},${b},${clamp(a,0,1)})`;
  }

  // --- View controls
  const view = { yaw: 0.85, pitch: -0.40, zoom: 1.05, panX: 0, panY: 0 };
  let dragging = false;
  let dragMode = 'rotate';
  let lastX = 0, lastY = 0;
  let paused = false;

  function resetView(){
    view.yaw = 0.85; view.pitch = -0.40; view.zoom = 1.05; view.panX = 0; view.panY = 0;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    dragMode = e.shiftKey ? 'pan' : 'rotate';
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    if (dragMode === 'rotate'){
      view.yaw   += dx * 0.006;
      view.pitch += dy * 0.006;
      view.pitch = clamp(view.pitch, -1.25, 1.25);
    } else {
      view.panX += dx;
      view.panY += dy;
    }
  });
  function endDrag(){ dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mul = (e.deltaY > 0) ? 0.92 : 1.08;
    view.zoom = clamp(view.zoom * mul, 0.55, 2.6);
  }, { passive:false });

  window.addEventListener('keydown', (e) => {
  if (e && e.isTrusted === false) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'p' || e.key === 'P') paused = !paused;
    if (e.key === 'r' || e.key === 'R') resetView();
  }, { capture:true });

  // --- Regions (toy-anatomy, placed in 3D-ish space)
  const REGIONS = [
    // Cortex (L/R)
    { id:'PFC_L', label:'PFC L', color:'#74d4ff', p:[-0.72,  0.48,  0.85] },
    { id:'PFC_R', label:'PFC R', color:'#74d4ff', p:[ 0.72,  0.48,  0.85] },

    { id:'M1_L',  label:'Motor/S1 L', color:'#9ff0d0', p:[-0.45,  0.28,  0.30] },
    { id:'M1_R',  label:'Motor/S1 R', color:'#9ff0d0', p:[ 0.45,  0.28,  0.30] },

    { id:'PAR_L', label:'Parietal L', color:'#7dfc9a', p:[-0.55,  0.34, -0.05] },
    { id:'PAR_R', label:'Parietal R', color:'#7dfc9a', p:[ 0.55,  0.34, -0.05] },

    { id:'TMP_L', label:'Temporal/Aud L', color:'#b98cff', p:[-0.92,  0.05,  0.05] },
    { id:'TMP_R', label:'Temporal/Aud R', color:'#b98cff', p:[ 0.92,  0.05,  0.05] },

    { id:'OCC_L', label:'Visual L', color:'#ffb86b', p:[-0.82,  0.34, -0.90] },
    { id:'OCC_R', label:'Visual R', color:'#ffb86b', p:[ 0.82,  0.34, -0.90] },

    { id:'INS_L', label:'Insula L', color:'#66ffd6', p:[-0.32,  0.02,  0.18] },
    { id:'INS_R', label:'Insula R', color:'#66ffd6', p:[ 0.32,  0.02,  0.18] },

    // Midline/subcortex
    { id:'ACC',  label:'ACC', color:'#e7f0ff', p:[0.00, 0.32, 0.55] },
    { id:'CALL', label:'Corpus callosum', color:'#d7dbe6', p:[0.00, 0.44, 0.35] },
    { id:'THAL', label:'Thalamus', color:'#cbd5e1', p:[0.00, 0.16, 0.10] },
    { id:'HYPO', label:'Hypothalamus', color:'#ff7aa2', p:[0.00, 0.00, 0.20] },

    // Limbic
    { id:'AMY_L', label:'Amygdala L', color:'#ff5a6a', p:[-0.18, -0.04, 0.08] },
    { id:'AMY_R', label:'Amygdala R', color:'#ff5a6a', p:[ 0.18, -0.04, 0.08] },
    { id:'HIP_L', label:'Hippocampus L', color:'#52ffd0', p:[-0.20, -0.12,-0.12] },
    { id:'HIP_R', label:'Hippocampus R', color:'#52ffd0', p:[ 0.20, -0.12,-0.12] },

    // Action gating
    { id:'STR_L', label:'Striatum L', color:'#ffd66b', p:[-0.28,  0.06,  0.30] },
    { id:'STR_R', label:'Striatum R', color:'#ffd66b', p:[ 0.28,  0.06,  0.30] },

    // Hindbrain
    { id:'CBL', label:'Cerebellum', color:'#9aa7ff', p:[0.00, -0.40, -0.95] },
    { id:'BST', label:'Brainstem', color:'#9aa0aa', p:[0.00, -0.70, -0.35] },
  ];
  const R = Object.fromEntries(REGIONS.map(r=>[r.id,r]));

  // --- Region edges (more than before: “traffic”)
  const E = (a,b,w,tag)=>({a,b,w,tag,fibers:[]});
  const EDGES = [
    // Sensory relay → cortex
    E('THAL','OCC_L',0.9,'relay'), E('THAL','OCC_R',0.9,'relay'),
    E('THAL','TMP_L',0.8,'relay'), E('THAL','TMP_R',0.8,'relay'),
    E('THAL','PAR_L',0.7,'relay'), E('THAL','PAR_R',0.7,'relay'),
    E('THAL','INS_L',0.6,'relay'), E('THAL','INS_R',0.6,'relay'),
    E('THAL','PFC_L',0.4,'relay'), E('THAL','PFC_R',0.4,'relay'),

    // Cortex integration
    E('OCC_L','PAR_L',0.55,'integrate'), E('OCC_R','PAR_R',0.55,'integrate'),
    E('PAR_L','PFC_L',0.55,'integrate'), E('PAR_R','PFC_R',0.55,'integrate'),
    E('TMP_L','PFC_L',0.45,'integrate'), E('TMP_R','PFC_R',0.45,'integrate'),

    // Limbic ↔ executive
    E('AMY_L','ACC',0.65,'alarm'), E('AMY_R','ACC',0.65,'alarm'),
    E('AMY_L','HYPO',0.75,'alarm'), E('AMY_R','HYPO',0.75,'alarm'),
    E('AMY_L','PFC_L',0.45,'alarm'), E('AMY_R','PFC_R',0.45,'alarm'),
    E('HIP_L','PFC_L',0.45,'recall'), E('HIP_R','PFC_R',0.45,'recall'),
    E('HIP_L','AMY_L',0.25,'context'), E('HIP_R','AMY_R',0.25,'context'),
    E('ACC','PFC_L',0.55,'monitor'), E('ACC','PFC_R',0.55,'monitor'),

    // Action gating
    E('PFC_L','STR_L',0.65,'gate'), E('PFC_R','STR_R',0.65,'gate'),
    E('STR_L','M1_L',0.70,'gate'), E('STR_R','M1_R',0.70,'gate'),

    // Interoception loop
    E('INS_L','ACC',0.55,'body'), E('INS_R','ACC',0.55,'body'),
    E('BST','INS_L',0.55,'body'), E('BST','INS_R',0.55,'body'),
    E('BST','HYPO',0.65,'reg'),  E('HYPO','BST',0.55,'reg'),

    // Coordination loop
    E('M1_L','CBL',0.40,'coord'), E('M1_R','CBL',0.40,'coord'),
    E('CBL','M1_L',0.40,'coord'), E('CBL','M1_R',0.40,'coord'),

    // Callosal bridge (L ↔ CALL ↔ R)
    E('PFC_L','CALL',0.30,'cc'), E('CALL','PFC_R',0.30,'cc'),
    E('PFC_R','CALL',0.30,'cc'), E('CALL','PFC_L',0.30,'cc'),

    E('PAR_L','CALL',0.24,'cc'), E('CALL','PAR_R',0.24,'cc'),
    E('PAR_R','CALL',0.24,'cc'), E('CALL','PAR_L',0.24,'cc'),

    E('TMP_L','CALL',0.20,'cc'), E('CALL','TMP_R',0.20,'cc'),
    E('TMP_R','CALL',0.20,'cc'), E('CALL','TMP_L',0.20,'cc'),

    E('OCC_L','CALL',0.20,'cc'), E('CALL','OCC_R',0.20,'cc'),
    E('OCC_R','CALL',0.20,'cc'), E('CALL','OCC_L',0.20,'cc'),
  ];

  // --- Stimuli mapping (reads window.DB_STIM from db_stimuli_panel.js)
  const STIM_MAP = {
    'Vision':         [['THAL',0.8],['OCC_L',1.0],['OCC_R',1.0],['PFC_L',0.2],['PFC_R',0.2]],
    'Sound':          [['THAL',0.6],['TMP_L',1.0],['TMP_R',1.0]],
    'Smell':          [['TMP_L',0.7],['TMP_R',0.7],['HIP_L',0.4],['HIP_R',0.4],['AMY_L',0.25],['AMY_R',0.25]],
    'Taste':          [['INS_L',0.7],['INS_R',0.7],['HYPO',0.25]],
    'Touch':          [['PAR_L',0.7],['PAR_R',0.7],['M1_L',0.35],['M1_R',0.35],['INS_L',0.25],['INS_R',0.25]],
    'Pain':           [['AMY_L',0.9],['AMY_R',0.9],['ACC',0.8],['INS_L',0.7],['INS_R',0.7],['HYPO',0.5]],
    'Heat/Cold':      [['HYPO',0.8],['INS_L',0.35],['INS_R',0.35],['ACC',0.3]],
    'Proprioception': [['PAR_L',0.6],['PAR_R',0.6],['CBL',0.4]],
    'Balance':        [['CBL',0.9],['THAL',0.25]],

    'Hunger':         [['HYPO',1.0],['INS_L',0.35],['INS_R',0.35],['ACC',0.25]],
    'Thirst':         [['HYPO',1.0],['INS_L',0.35],['INS_R',0.35],['ACC',0.25]],
    'Air hunger (CO₂)':[["BST",1.0],['INS_L',0.8],['INS_R',0.8],['ACC',0.45],['AMY_L',0.25],['AMY_R',0.25]],
    'Heart pounding': [['BST',0.8],['INS_L',0.55],['INS_R',0.55],['ACC',0.35],['AMY_L',0.20],['AMY_R',0.20]],
    'Nausea':         [['BST',0.7],['INS_L',0.7],['INS_R',0.7],['HYPO',0.4]],
    'Fatigue':        [['BST',0.55],['THAL',0.35],['PFC_L',0.20],['PFC_R',0.20]],

    'Threat cue':     [['AMY_L',1.0],['AMY_R',1.0],['ACC',0.5],['HYPO',0.5]],
    'Social threat':  [['AMY_L',0.8],['AMY_R',0.8],['ACC',0.7],['PFC_L',0.3],['PFC_R',0.3]],
    'Safety cue':     [['PFC_L',0.4],['PFC_R',0.4],['ACC',0.15],['HYPO',0.2]],
    'Bonding cue':    [['TMP_L',0.3],['TMP_R',0.3],['PFC_L',0.3],['PFC_R',0.3],['HIP_L',0.2],['HIP_R',0.2]],

    'Novelty':        [['HIP_L',0.9],['HIP_R',0.9],['THAL',0.4],['PFC_L',0.25],['PFC_R',0.25]],
    'Uncertainty':    [['ACC',1.0],['PFC_L',0.55],['PFC_R',0.55]],
    'Time pressure':  [['ACC',0.5],['PFC_L',0.7],['PFC_R',0.7],['BST',0.25]],
    'Reward cue':     [['STR_L',0.9],['STR_R',0.9],['PFC_L',0.25],['PFC_R',0.25]],
    'Memory cue':     [['HIP_L',0.9],['HIP_R',0.9],['PFC_L',0.2],['PFC_R',0.2]],
  };

  // --- Build nodes: clusters per region
  const NODES_PER_REGION = 18;
  const nodes = [];
  const regionNodeIdx = {};
  function randn(){
    // cheap-ish gaussian-ish
    return (Math.random()+Math.random()+Math.random()+Math.random()-2.0) * 0.5;
  }
  for (const r of REGIONS){
    regionNodeIdx[r.id] = [];
    for (let i=0;i<NODES_PER_REGION;i++){
      const s = 0.07;
      const p = [r.p[0] + randn()*s, r.p[1] + randn()*s, r.p[2] + randn()*s];
      const idx = nodes.length;
      nodes.push({ rid:r.id, p, seed: Math.random()*10 });
      regionNodeIdx[r.id].push(idx);
    }
  }

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

  // Fibers per edge: multiple strands so “communication” reads as bundles
  const FIBERS_PER_EDGE = 7;
  for (const e of EDGES){
    const A = regionNodeIdx[e.a] || [];
    const B = regionNodeIdx[e.b] || [];
    for (let i=0;i<FIBERS_PER_EDGE;i++){
      if (!A.length || !B.length) break;
      e.fibers.push([ pick(A), pick(B), (i - (FIBERS_PER_EDGE-1)/2) ]);
    }
  }

  // --- Activation state
  const act = {};
  for (const r of REGIONS) act[r.id] = 0;
  act.THAL = 0.22;
  act.PFC_L = 0.08;
  act.PFC_R = 0.08;

  // --- Packets (moving beads)
  const packets = [];
  let lastSpawn = 0;

  // --- Canvas sizing
  let W = 0, H = 0, dpr = 1;
  function resize(){
    dpr = Math.max(1, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W*dpr);
    canvas.height = Math.floor(H*dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- 3D helpers
  function rotY(p,a){
    const [x,y,z]=p; const c=Math.cos(a), s=Math.sin(a);
    return [x*c + z*s, y, -x*s + z*c];
  }
  function rotX(p,a){
    const [x,y,z]=p; const c=Math.cos(a), s=Math.sin(a);
    return [x, y*c - z*s, y*s + z*c];
  }
  function project(p){
    let q = rotY(p, view.yaw);
    q = rotX(q, view.pitch);
    const z = q[2];
    const persp = 1 / (1 + z*0.55);
    const scale = Math.min(W,H) * 0.45 * view.zoom;
    const cx = W*0.5 + view.panX;
    const cy = H*0.5 + view.panY;
    const sx = cx + q[0] * scale * persp;
    const sy = cy - q[1] * scale * persp;
    return { x:sx, y:sy, persp };
  }

  function bezierCurve(ax,ay,bx,by, bend){
    const mx=(ax+bx)/2, my=(ay+by)/2;
    const dx=bx-ax, dy=by-ay;
    const len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    const cx=mx + nx*bend;
    const cy=my + ny*bend;
    ctx.beginPath();
    ctx.moveTo(ax,ay);
    ctx.quadraticCurveTo(cx,cy,bx,by);
  }

  // --- Read stimuli levels (24 stimuli panel sets window.DB_STIM)
  window.DB_STIM = (window.DB_STIM && typeof window.DB_STIM === 'object') ? window.DB_STIM : Object.create(null);

  // Provide DB_NETVIEW for the panel (push = no-op but safe)
  window.DB_NETVIEW = window.DB_NETVIEW || {};
  window.DB_NETVIEW.push = window.DB_NETVIEW.push || function(){};

  // --- Simulation step
  function simStep(dt){
    // inputs from stimuli
    const input = {};
    let anyStim = false;

    for (const [name, v0] of Object.entries(window.DB_STIM)){
      const v = clamp(Number(v0)||0, 0, 1);
      if (v <= 0) continue;
      anyStim = true;
      const map = STIM_MAP[name];
      if (!map) continue;
      for (const [rid,w] of map){
        input[rid] = (input[rid] || 0) + v*w;
      }
    }

    // decay + propagation
    const next = {};
    for (const r of REGIONS) next[r.id] = act[r.id] * 0.86;

    // Keep a faint background relay so it’s never “dead”
    next.THAL += 0.04;
    next.CALL += 0.01;

    for (const e of EDGES){
      const a = act[e.a] || 0;
      if (a <= 0) continue;
      next[e.b] += a * (e.w * 0.18);
    }

    for (const [rid,v] of Object.entries(input)){
      next[rid] = (next[rid] || 0) + v * 0.55;
    }

    for (const r of REGIONS){
      act[r.id] = clamp(next[r.id] || 0, 0, 1);
    }

    // Packet spawning on the most active edges
    const now = performance.now();
    if (now - lastSpawn > 180){
      lastSpawn = now;

      // score edges
      const scored = [];
      for (let i=0;i<EDGES.length;i++){
        const e = EDGES[i];
        const s = (act[e.a]||0) * (0.35 + 0.65*(act[e.b]||0)) * e.w;
        if (s > 0.02) scored.push([s,i]);
      }
      scored.sort((a,b)=>b[0]-a[0]);

      // spawn multiple at once when stimuli present
      const k = anyStim ? 4 : 2;
      for (let j=0;j<Math.min(k, scored.length); j++){
        const ei = scored[j][1];
        const e = EDGES[ei];
        if (!e.fibers.length) continue;
        const fi = Math.floor(Math.random()*e.fibers.length);
        packets.push({ ei, fi, t: 0, speed: 0.8 + Math.random()*0.8 });
      }

      // keep bounded
      if (packets.length > 60) packets.splice(0, packets.length-60);
    }
  }

  // --- Render
  const screen = new Array(nodes.length);

  function draw(){
    // background
    ctx.fillStyle = '#050608';
    ctx.fillRect(0,0,W,H);

    // project nodes once
    for (let i=0;i<nodes.length;i++){
      const n = nodes[i];
      // tiny “breathing jitter” so clusters feel alive
      const a = act[n.rid] || 0;
      const t = performance.now()*0.001 + n.seed;
      const jig = 0.008 + a*0.010;
      const p = [ n.p[0] + Math.sin(t)*jig, n.p[1] + Math.cos(t*0.9)*jig, n.p[2] ];
      screen[i] = project(p);
    }

    // score edges
    const scored = [];
    for (let i=0;i<EDGES.length;i++){
      const e = EDGES[i];
      const s = (act[e.a]||0) * (0.35 + 0.65*(act[e.b]||0)) * e.w;
      scored.push([s,i]);
    }
    scored.sort((a,b)=>b[0]-a[0]);
    const topEdges = scored.slice(0, 28);

    // faint scaffold: all region-to-region connections
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    for (const e of EDGES){
      const ra = R[e.a], rb = R[e.b];
      if (!ra || !rb) continue;
      const A = project(ra.p), B = project(rb.p);
      ctx.strokeStyle = 'rgba(190,205,225,0.06)';
      ctx.beginPath();
      ctx.moveTo(A.x,A.y);
      ctx.lineTo(B.x,B.y);
      ctx.stroke();
    }

    // active bundles: multiple fibers per edge (gradient)
    for (const [s, ei] of topEdges){
      if (s < 0.012) break;
      const e = EDGES[ei];
      const ra = R[e.a], rb = R[e.b];
      if (!ra || !rb) continue;

      const alpha = clamp(0.10 + s*1.8, 0.10, 0.85);
      const width = clamp(1.0 + s*9.0, 1.0, 6.0);

      for (let k=0;k<e.fibers.length;k++){
        const [ia, ib, bendIdx] = e.fibers[k];
        const A = screen[ia], B = screen[ib];
        if (!A || !B) continue;

        const grad = ctx.createLinearGradient(A.x,A.y,B.x,B.y);
        grad.addColorStop(0, rgba(ra.color, alpha));
        grad.addColorStop(1, rgba(rb.color, alpha));

        ctx.strokeStyle = grad;
        ctx.lineWidth = width * (0.55 + 0.15*k);
        const bend = bendIdx * 6.0; // makes “tract bundles”
        bezierCurve(A.x,A.y,B.x,B.y,bend);
        ctx.stroke();
      }
    }

    // moving packet dots
    for (let i=packets.length-1;i>=0;i--){
      const p = packets[i];
      const e = EDGES[p.ei];
      if (!e) { packets.splice(i,1); continue; }
      const f = e.fibers[p.fi];
      if (!f) { packets.splice(i,1); continue; }
      const [ia, ib] = f;
      const A = screen[ia], B = screen[ib];
      if (!A || !B) { packets.splice(i,1); continue; }

      p.t += (1/60) * p.speed;
      if (p.t >= 1.0){ packets.splice(i,1); continue; }

      const t = p.t;
      const x = lerp(A.x, B.x, t);
      const y = lerp(A.y, B.y, t);

      ctx.fillStyle = 'rgba(230,245,255,0.90)';
      ctx.beginPath();
      ctx.arc(x,y,2.2,0,Math.PI*2);
      ctx.fill();
    }

    // nodes (clusters)
    for (let i=0;i<nodes.length;i++){
      const n = nodes[i];
      const r = R[n.rid];
      const a = clamp(act[n.rid]||0, 0, 1);
      const P = screen[i];

      const rad = 1.1 + a*1.6;
      ctx.fillStyle = rgba(r.color, 0.18 + a*0.62);
      ctx.beginPath();
      ctx.arc(P.x, P.y, rad, 0, Math.PI*2);
      ctx.fill();
    }

    // region labels (subtle)
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    for (const r of REGIONS){
      const a = clamp(act[r.id]||0, 0, 1);
      const P = project(r.p);
      ctx.fillStyle = `rgba(210,225,240,${0.20 + a*0.55})`;
      ctx.fillText(r.label, P.x + 8, P.y - 8);
    }

    // status
    ctx.fillStyle = 'rgba(200,210,225,0.55)';
    ctx.fillText(paused ? 'PAUSED (P to resume)' : 'running (P to pause)', 18, 22);
  }

  let last = 0;
  function loop(t){
    const dt = last ? Math.min(0.05, (t-last)/1000) : 0.016;
    last = t;
    if (!paused) simStep(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();

// --- UI bridge (safe typeof checks)
window.NEURAL_RESET_VIEW = window.NEURAL_RESET_VIEW || function(){
  if (typeof resetView === 'function') return resetView();
  if (typeof recenterView === 'function') return recenterView();
  if (typeof reset_view === 'function') return reset_view();
  if (typeof resetCamera === 'function') return resetCamera();
};
