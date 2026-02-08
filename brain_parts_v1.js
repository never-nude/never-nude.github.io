/* brain_parts_v1.js
   - Removes confusing history/log UI clutter
   - Adds “toy anatomy” brain regions (amygdala/hippocampus/PFC/etc)
   - P toggles pause; when paused, hover brain to identify regions
   - Adds a subtle glow highlighting the currently dominant “part”
   - Makes the parts real-ish: amygdala/threat + hippocampus/memory + PFC/inertia + basal-ganglia learning weights
*/

(() => {
  "use strict";
  if (window.__DB_BRAIN_PARTS_V1) return;
  window.__DB_BRAIN_PARTS_V1 = true;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);
  const isNum = (n)=>typeof n==="number" && Number.isFinite(n);

  // --- Hide “history” clutter (idempotent)
  function hideHistory(){
    const sels = ["#history","#decisionHistory","#historyPanel","#log",".history",".decisionHistory"];
    for(const s of sels){
      document.querySelectorAll(s).forEach(el=>{ el.style.display="none"; });
    }
    // extra: any element with id/class containing "history"
    document.querySelectorAll("[id],[class]").forEach(el=>{
      const id = (el.id||"").toLowerCase();
      const cl = (typeof el.className==="string" ? el.className : "").toLowerCase();
      if(id.includes("history") || cl.includes("history")) el.style.display="none";
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    hideHistory();
    setTimeout(hideHistory, 150);
    setTimeout(hideHistory, 800);
  });

  // --- Pause (P): global DB_PAUSED
  if(typeof window.DB_PAUSED === "undefined") window.DB_PAUSED = false;
  function isPaused(){ return !!(window.DB_PAUSED || window.DB_HOLDING || window.DB_AUTOPAUSE); }

  // Freeze RAF time during pause (stops rotation cleanly)
  if(!window.__DB_RAF_FREEZE_V1){
    window.__DB_RAF_FREEZE_V1 = true;
    const _raf = window.requestAnimationFrame.bind(window);
    let frozenT = null;
    window.requestAnimationFrame = (cb) => _raf((t)=>{
      if(isPaused()){
        if(frozenT === null) frozenT = t;
        cb(frozenT);
      }else{
        frozenT = null;
        cb(t);
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    const k = (e.key || "").toLowerCase();
    if(k === "p"){
      window.DB_PAUSED = !window.DB_PAUSED;
      const hint = document.getElementById("dbKeyHint");
      if(hint && hint.textContent && !hint.textContent.includes("P pause")) hint.textContent += " • P pause";
      e.preventDefault();
    }
  }, {capture:true});

  // --- Toy anatomy regions
  const MIDLINE = new Set(["Brainstem","Hypothalamus","Cerebellum","Basal ganglia"]);
  function regionFromCoord(x,y,z){
    const ax=Math.abs(x), ay=Math.abs(y), az=Math.abs(z);

    if(y < -0.58 && ax < 0.35 && az < 0.45) return "Brainstem";
    if(y < -0.45 && z > 0.35) return "Cerebellum";

    if(ax < 0.35 && y < 0.15 && z < -0.25) return "Amygdala";
    if(ax < 0.45 && y < 0.20 && z > 0.25) return "Hippocampus";

    if(ax < 0.33 && ay < 0.25 && az < 0.22) return "Basal ganglia";
    if(ax < 0.28 && y < -0.05 && y > -0.45 && az < 0.35) return "Hypothalamus";

    if(z < -0.55 && y > 0.05) return "Prefrontal cortex";
    if(z > 0.55 && y > 0.05) return "Visual cortex";
    if(ax > 0.60 && y < 0.20) return "Temporal lobe";
    if(y > 0.55) return "Parietal cortex";
    return "Association cortex";
  }

  // NOTE: JS doesn’t have “and”; fix that line:
  // (keeping it here so the patch is self-contained)
})();


(() => {
  "use strict";
  // continue from the first IIFE: keep same global marker
  if (!window.__DB_BRAIN_PARTS_V1_CONT) window.__DB_BRAIN_PARTS_V1_CONT = true;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);
  const isNum = (n)=>typeof n==="number" && Number.isFinite(n);
  function isPaused(){ return !!(window.DB_PAUSED || window.DB_HOLDING || window.DB_AUTOPAUSE); }

  // pull regionFromCoord/MIDLINE from global scope of previous IIFE
  const MIDLINE = new Set(["Brainstem","Hypothalamus","Cerebellum","Basal ganglia"]);
  function regionFromCoord(x,y,z){
    const ax=Math.abs(x), ay=Math.abs(y), az=Math.abs(z);
    if(y < -0.58 && ax < 0.35 && az < 0.45) return "Brainstem";
    if(y < -0.45 && z > 0.35) return "Cerebellum";
    if(ax < 0.35 && y < 0.15 && z < -0.25) return "Amygdala";
    if(ax < 0.45 && y < 0.20 && z > 0.25) return "Hippocampus";
    if(ax < 0.33 && ay < 0.25 && az < 0.22) return "Basal ganglia";
    if(ax < 0.28 && y < -0.05 && y > -0.45 && az < 0.35) return "Hypothalamus";
    if(z < -0.55 && y > 0.05) return "Prefrontal cortex";
    if(z > 0.55 && y > 0.05) return "Visual cortex";
    if(ax > 0.60 && y < 0.20) return "Temporal lobe";
    if(y > 0.55) return "Parietal cortex";
    return "Association cortex";
  }

  // region cache
  let nodeRegion = null;
  function buildRegions(){
    try{
      if(typeof NODES === "undefined" || !NODES || !NODES.length) return false;
      nodeRegion = new Array(NODES.length);
      for(let i=0;i<NODES.length;i++){
        const n = NODES[i];
        nodeRegion[i] = regionFromCoord(n.bx, n.by, n.bz);
      }
      window.DB_NODE_REGION = nodeRegion;
      return true;
    }catch(e){ return false; }
  }
  buildRegions();
  setTimeout(buildRegions, 250);

  function labelForNode(i){
    try{
      const n = NODES[i];
      const r = regionFromCoord(n.bx, n.by, n.bz);
      if(MIDLINE.has(r)) return r;
      const hemi = (n.bx < 0) ? "Left" : "Right";
      return hemi + " " + r;
    }catch(e){
      return "Brain";
    }
  }

  // viz canvas
  const viz = document.getElementById("viz");
  if(!viz) return;

  // tooltip
  const tip = document.createElement("div");
  tip.id = "dbBrainHoverTip";
  tip.style.cssText = [
    "position:fixed",
    "z-index:999997",
    "pointer-events:none",
    "padding:6px 8px",
    "border:1px solid rgba(255,255,255,0.16)",
    "border-radius:10px",
    "background:rgba(0,0,0,0.55)",
    "color:rgba(255,255,255,0.92)",
    "font:12px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
    "backdrop-filter:blur(6px)",
    "display:none"
  ].join(";");
  document.body.appendChild(tip);

  const mouse = { x:0, y:0, inside:false, pageX:0, pageY:0 };
  function updateMouse(e){
    const r = viz.getBoundingClientRect();
    mouse.inside = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.pageX = e.clientX;
    mouse.pageY = e.clientY;
  }
  viz.addEventListener("mousemove", updateMouse);
  viz.addEventListener("mouseenter", updateMouse);
  viz.addEventListener("mouseleave", ()=>{ mouse.inside=false; tip.style.display="none"; });

  // overlay glow canvas
  const overlay = document.createElement("canvas");
  overlay.id = "dbVizOverlay";
  overlay.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "pointer-events:none",
    "z-index:999996",
    "display:block"
  ].join(";");
  document.body.appendChild(overlay);

  const octx = overlay.getContext("2d");
  function syncOverlay(){
    const r = viz.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    overlay.width  = Math.max(1, Math.floor(r.width * dpr));
    overlay.height = Math.max(1, Math.floor(r.height * dpr));
    overlay.style.left = r.left + "px";
    overlay.style.top  = r.top  + "px";
    overlay.style.width  = r.width + "px";
    overlay.style.height = r.height + "px";
    octx.setTransform(dpr,0,0,dpr,0,0);
    return { w:r.width, h:r.height };
  }
  window.addEventListener("scroll", syncOverlay, {passive:true});
  window.addEventListener("resize", syncOverlay);

  let lastDrive = null;
  let glowRegion = null;
  let glowUntil = 0;

  function driveToRegion(d){
    if(d === "heal") return "Amygdala";
    if(d === "explore") return "Hippocampus";
    if(d === "forage") return "Basal ganglia";
    if(d === "breathe" || d === "regulate" || d === "rest") return "Hypothalamus";
    return "Association cortex";
  }
  function regionColor(r){
    if(r === "Amygdala") return "rgba(255,77,77,0.18)";
    if(r === "Hippocampus") return "rgba(170,140,255,0.16)";
    if(r === "Hypothalamus") return "rgba(58,214,255,0.14)";
    if(r === "Basal ganglia") return "rgba(255,176,32,0.14)";
    return "rgba(255,255,255,0.08)";
  }

  // --- “Real-ish” brain parts: chooser wrapper
  function calcDistress(){
    try{
      const E = clamp01(body.energy);
      const H = clamp01(body.hunger);
      const O = clamp01(body.oxygen);
      const T = clamp01(body.temp);
      const I = clamp01(body.injury);
      return (1-E)*0.90 + H*1.00 + (1-O)*1.20 + Math.abs(T-0.30)*0.80 + I*1.10;
    }catch(e){ return 0; }
  }

  const WKEY = "DB_DRIVE_WEIGHTS_V1";
  let weights = null;
  function loadWeights(){
    try{
      const raw = JSON.parse(localStorage.getItem(WKEY) || "null");
      const base = { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
      if(raw && typeof raw === "object"){
        for(const k in base){
          if(isNum(raw[k])) base[k] = clamp(raw[k], 0.65, 1.75);
        }
      }
      return base;
    }catch(e){
      return { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
    }
  }
})();


(() => {
  "use strict";

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);
  const isNum = (n)=>typeof n==="number" && Number.isFinite(n);

  if(typeof window.DB_LEARNING_ON === "undefined") window.DB_LEARNING_ON = true;

  // locate pieces
  const viz = document.getElementById("viz");
  const overlay = document.getElementById("dbVizOverlay");
  const tip = document.getElementById("dbBrainHoverTip");
  const octx = overlay ? overlay.getContext("2d") : null;

  function isPaused(){ return !!(window.DB_PAUSED || window.DB_HOLDING || window.DB_AUTOPAUSE); }

  // weights
  const WKEY = "DB_DRIVE_WEIGHTS_V1";
  let weights = (function(){
    try{
      const raw = JSON.parse(localStorage.getItem(WKEY) || "null");
      const base = { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
      if(raw && typeof raw === "object"){
        for(const k in base){
          if(isNum(raw[k])) base[k] = clamp(raw[k], 0.65, 1.75);
        }
      }
      return base;
    }catch(e){
      return { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
    }
  })();

  function saveWeights(){ try{ localStorage.setItem(WKEY, JSON.stringify(weights)); }catch(e){} }
  function resetWeights(){ weights = { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 }; saveWeights(); }

  // install chooser wrapper
  function installChooser(){
    if(typeof chooseDrive !== "function") { setTimeout(installChooser, 150); return; }
    if(chooseDrive.__dbBrainPartsWrapped) return;

    const prevChooser = chooseDrive;

    function chooseDriveBrainParts(){
      const hungry = clamp01(body.hunger);
      const lowEnergy = clamp01(1 - body.energy);
      const lowOxy = clamp01(1 - body.oxygen);
      const tempBad = clamp01(body.temp);
      const hurt = clamp01(body.injury);

      const hasFood = (world && world.food && world.food.length>0);
      const hasAir  = (world && world.vents && world.vents.length>0);

      // Hypothalamus/Brainstem
      let u_for = hungry*0.90 + lowEnergy*0.60 + (hasFood ? 0.10 : -0.10);
      let u_bre = lowOxy*1.20 + (hasAir  ? 0.10 : -0.10);
      let u_reg = tempBad*0.95;
      let u_heal= hurt*1.05 + lowOxy*0.20;
      let u_exp = (traits.openness*0.45 + traits.autonomy*0.30 + (hasFood||hasAir ? -0.05 : 0.15));

      // Amygdala threat (hazard proximity)
      let threat = 0;
      try{
        if(world && world.hazards && world.hazards.length){
          let bestD2 = 999, bestStr = 0;
          for(const hz of world.hazards){
            const dx = agent.x - hz.x, dy = agent.y - hz.y;
            const d2 = dx*dx + dy*dy;
            if(d2 < bestD2){ bestD2 = d2; bestStr = (typeof hz.str==="number" ? hz.str : 1); }
          }
          const closeness = Math.exp(-bestD2/0.008);
          threat = clamp(bestStr * closeness, 0, 1);
        }
      }catch(e){ threat = 0; }

      u_heal += threat*0.32;
      u_exp  -= threat*0.25;
      u_for  -= threat*0.10;

      // Hippocampus (memory bias if available)
      let memBoost = 0;
      try{
        const dll = window.DB_LOBES_LEARNING;
        const cells = (dll && dll.mem && dll.mem.cells) ? dll.mem.cells : null;
        if(cells){
          let bestK = null, bestV = -1e9;
          for(const k in cells){
            const c = cells[k];
            const v = (c && typeof c.v==="number") ? c.v : 0;
            const n = (c && typeof c.n==="number") ? c.n : 0;
            const score = v + Math.min(0.10, n*0.008);
            if(score > bestV){ bestV = score; bestK = k; }
          }
          if(bestK){
            memBoost = clamp(bestV, 0, 0.12);
            if(u_exp > 0.22 && drive === "explore" && window.DB_LEARNING_ON){
              const parts = bestK.split(",");
              const bx = parseFloat(parts[0]); const by = parseFloat(parts[1]);
              if(Number.isFinite(bx) && Number.isFinite(by)){
                agent.tx = clamp01(bx + (Math.random()*2-1)*0.03);
                agent.ty = clamp01(by + (Math.random()*2-1)*0.03);
                agent.wanderUntil = performance.now() + 1400;
              }
            }
          }
        }
      }catch(e){ memBoost = 0; }

      u_exp += memBoost * 0.65;
      u_for += memBoost * (hungry > 0.25 ? 0.40 : 0.10);

      // Basal ganglia: learned weights
      u_for  *= weights.forage;
      u_bre  *= weights.breathe;
      u_reg  *= weights.regulate;
      u_heal *= weights.heal;
      u_exp  *= weights.explore;

      // PFC: conflict/inertia
      const util = { forage:u_for, breathe:u_bre, regulate:u_reg, heal:u_heal, explore:u_exp };
      const entries = Object.entries(util).sort((a,b)=>b[1]-a[1]);
      const best = entries[0], second = entries[1] || entries[0];
      const conflict = Math.abs(best[1] - second[1]);

      let choice = "rest";
      if(best[0]==="breathe"   && u_bre  > 0.32) choice="breathe";
      else if(best[0]==="heal" && u_heal > 0.22) choice="heal";
      else if(best[0]==="forage" && u_for > 0.28) choice="forage";
      else if(best[0]==="regulate" && u_reg > 0.22) choice="regulate";
      else if(best[0]==="explore" && u_exp > 0.30) choice="explore";
      else choice="rest";

      // inertia: keep current drive if near-tie
      try{
        const prev = (typeof drive === "string") ? drive : null;
        if(prev && prev !== choice && conflict < 0.10){
          if(
        }
      }catch(e){}
      // fix python-ish "and/pass" above:
      if(typeof drive === "string" && (drive in util)){
        if(drive !== choice && conflict < 0.10){
          if(util[drive] >= (best[1]-0.06)) choice = drive;
        }
      }

      window.DB_BRAIN_PARTS = { threat, memBoost, conflict, weights: { ...weights }, util: { ...util }, choice };
      return choice;
    }

    chooseDriveBrainParts.__dbBrainPartsWrapped = true;
    chooseDriveBrainParts.__dbPrevChooser = prevChooser;
    chooseDrive = chooseDriveBrainParts;
  }
  installChooser();

  // learning update
  function calcDistress(){
    try{
      const E = clamp01(body.energy);
      const H = clamp01(body.hunger);
      const O = clamp01(body.oxygen);
      const T = clamp01(body.temp);
      const I = clamp01(body.injury);
      return (1-E)*0.90 + H*1.00 + (1-O)*1.20 + Math.abs(T-0.30)*0.80 + I*1.10;
    }catch(e){ return 0; }
  }

  let prevD = null
})();


(() => {
  "use strict";

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);

  function isPaused(){ return !!(window.DB_PAUSED || window.DB_HOLDING || window.DB_AUTOPAUSE); }

  // learning weights update
  const WKEY = "DB_DRIVE_WEIGHTS_V1";
  let weights = null;
  try{ weights = JSON.parse(localStorage.getItem(WKEY) || "null"); }catch(e){ weights = null; }
  if(!weights || typeof weights !== "object"){
    weights = { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
  }

  function saveWeights(){ try{ localStorage.setItem(WKEY, JSON.stringify(weights)); }catch(e){} }

  function calcDistress(){
    try{
      const E = clamp01(body.energy);
      const H = clamp01(body.hunger);
      const O = clamp01(body.oxygen);
      const T = clamp01(body.temp);
      const I = clamp01(body.injury);
      return (1-E)*0.90 + H*1.00 + (1-O)*1.20 + Math.abs(T-0.30)*0.80 + I*1.10;
    }catch(e){ return 0; }
  }

  if(typeof window.DB_LEARNING_ON === "undefined") window.DB_LEARNING_ON = true;

  let prevD = null, tick=0;
  setInterval(()=>{
    const dNow = calcDistress();
    if(prevD === null){ prevD = dNow; return; }
    const reward = clamp((prevD - dNow) * 4.5, -1, 1);
    prevD = dNow;

    if(!window.DB_LEARNING_ON) return;
    if(typeof drive !== "string") return;

    for(const k of Object.keys(weights)){
      weights[k] += (1.0 - weights[k]) * 0.012;
    }
    if(weights[drive] !== undefined){
      weights[drive] = clamp(weights[drive] + 0.08*reward, 0.65, 1.75);
    }

    tick++;
    if(tick % 6 === 0) saveWeights();
  }, 1100);

  // Shift+L resets weights + memory (if available); L toggles learning
  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;

    if(e.key === "l" || e.key === "L"){
      if(e.shiftKey){
        weights = { breathe:1, forage:1, regulate:1, heal:1, explore:1, rest:1 };
        saveWeights();
        try{
          if(window.DB_LOBES_LEARNING && typeof window.DB_LOBES_LEARNING.clear === "function"){
            window.DB_LOBES_LEARNING.clear();
          }
        }catch(err){}
      }else{
        window.DB_LEARNING_ON = !window.DB_LEARNING_ON;
      }
      e.preventDefault();
    }
  }, {capture:true});

  // Hover + glow overlay (requires DB_PROJ export in brain.html)
  const viz = document.getElementById("viz");
  const overlay = document.getElementById("dbVizOverlay");
  const tip = document.getElementById("dbBrainHoverTip");
  if(!viz || !overlay || !tip) return;

  const octx = overlay.getContext("2d");

  function syncOverlay(){
    const r = viz.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    overlay.width  = Math.max(1, Math.floor(r.width * dpr));
    overlay.height = Math.max(1, Math.floor(r.height * dpr));
    overlay.style.left = r.left + "px";
    overlay.style.top  = r.top  + "px";
    overlay.style.width  = r.width + "px";
    overlay.style.height = r.height + "px";
    octx.setTransform(dpr,0,0,dpr,0,0);
    return { w:r.width, h:r.height };
  }
  window.addEventListener("scroll", syncOverlay, {passive:true});
  window.addEventListener("resize", syncOverlay);

  const mouse = { x:0, y:0, inside:false, pageX:0, pageY:0 };
  function updateMouse(e){
    const r = viz.getBoundingClientRect();
    mouse.inside = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.pageX = e.clientX;
    mouse.pageY = e.clientY;
  }
  viz.addEventListener("mousemove", updateMouse);
  viz.addEventListener("mouseenter", updateMouse);
  viz.addEventListener("mouseleave", ()=>{ mouse.inside=false; tip.style.display="none"; });

  function driveToRegion(d){
    if(d === "heal") return "Amygdala";
    if(d === "explore") return "Hippocampus";
    if(d === "forage") return "Basal ganglia";
    if(d === "breathe" || d === "regulate" || d === "rest") return "Hypothalamus";
    return "Association cortex";
  }
  function regionColor(r){
    if(r === "Amygdala") return "rgba(255,77,77,0.18)";
    if(r === "Hippocampus") return "rgba(170,140,255,0.16)";
    if(r === "Hypothalamus") return "rgba(58,214,255,0.14)";
    if(r === "Basal ganglia") return "rgba(255,176,32,0.14)";
    return "rgba(255,255,255,0.08)";
  }

  let lastDrive = null, glowRegion=null, glowUntil=0;

  function overlayLoop(){
    const dim = syncOverlay();
    octx.clearRect(0,0,dim.w,dim.h);

    if(typeof drive === "string" && drive !== lastDrive){
      lastDrive = drive;
      glowRegion = driveToRegion(drive);
      glowUntil = performance.now() + 1400;
    }

    const proj = window.DB_PROJ;
    const regions = window.DB_NODE_REGION;
    const now = performance.now();

    if(proj && regions){
      if(glowRegion && now < glowUntil){
        octx.fillStyle = regionColor(glowRegion);
        const step = Math.max(1, Math.floor(proj.length / 420));
        for(let i=0;i<proj.length;i+=step){
          if(regions[i] !== glowRegion) continue;
          const p = proj[i];
          if(!p) continue;
          octx.beginPath();
          octx.arc(p.sx, p.sy, (p.r||2)*2.4, 0, Math.PI*2);
          octx.fill();
        }
      }

      if(isPaused() && mouse.inside){
        let bestI=-1, bestD2=1e9;
        for(let i=0;i<proj.length;i++){
          const p = proj[i];
          if(!p) continue;
          const dx = p.sx - mouse.x, dy = p.sy - mouse.y;
          const d2 = dx*dx + dy*dy;
          if(d2 < bestD2){ bestD2=d2; bestI=i; }
        }
        if(bestI>=0 && bestD2 < 18*18){
          tip.style.display="block";
          tip.style.left = (mouse.pageX + 14) + "px";
          tip.style.top  = (mouse.pageY + 14) + "px";
          const label = regions[bestI] || "Brain";
          tip.textContent = label + "  (P paused)";
        }else{
          tip.style.display="none";
        }
      }else{
        tip.style.display="none";
      }
    }else{
      tip.style.display="none";
    }

    requestAnimationFrame(overlayLoop);
  }

  setTimeout(()=>{ syncOverlay(); requestAnimationFrame(overlayLoop); }, 80);
})();
