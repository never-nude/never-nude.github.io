/*
  Functional lobes (committee drive selection)
  - Adds a small readout (shown only when debug is on)
  - Toggle on/off with key: L
*/

(function(){
  "use strict";

  // If the core functions aren't present, do nothing.
  if(typeof chooseDrive !== "function"){
    console.warn("[lobes] chooseDrive not found; not installing lobes.");
    return;
  }

  const DRIVES = ["rest","forage","breathe","regulate","heal","explore"];

  const baseChooseDrive = chooseDrive;
  const baseDriveTarget = (typeof driveTarget === "function") ? driveTarget : null;
  const baseUpdateAgent = (typeof updateAgent === "function") ? updateAgent : null;

  const state = {
    enabled: true,
    last: { winner: "?", votes: [], tallies: {} }
  };

  // ----- UI: tiny readout (only visible when debugOn is true) -----
  const el = document.createElement("div");
  el.id = "lobesReadout";
  el.style.position = "fixed";
  el.style.left = "14px";
  el.style.top = "14px";
  el.style.zIndex = "9999";
  el.style.padding = "10px 12px";
  el.style.border = "1px solid rgba(255,255,255,0.12)";
  el.style.borderRadius = "10px";
  el.style.background = "rgba(0,0,0,0.55)";
  el.style.color = "rgba(255,255,255,0.85)";
  el.style.font = "12px/1.25 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "pre";
  el.style.display = "none";
  document.addEventListener("DOMContentLoaded", ()=>document.body.appendChild(el));

  function showIfDebug(){
    try{
      if(typeof debugOn !== "undefined" && debugOn) el.style.display = "block";
      else el.style.display = "none";
    }catch(e){
      // If debugOn is not readable for some reason, keep it hidden.
      el.style.display = "none";
    }
  }
  setInterval(showIfDebug, 250);

  // ----- helpers -----
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
  function clamp01(x){ return clamp(x,0,1); }
  function safeNum(x){ return Number.isFinite(x) ? x : 0; }

  function globalsOk(){
    return (
      typeof body   !== "undefined" &&
      typeof world  !== "undefined" &&
      typeof agent  !== "undefined" &&
      typeof traits !== "undefined"
    );
  }

  function hazardsNearScore(){
    if(!globalsOk() || !world.hazards) return 0;
    let score = 0;
    for(const hz of world.hazards){
      const dx = agent.x - hz.x;
      const dy = agent.y - hz.y;
      const d2 = dx*dx + dy*dy;
      const w = hz.str || 1;
      score += w / (d2 + 0.0025); // eps ~ (0.05)^2
    }
    return score;
  }

  function hazardRepulsion(){
    if(!globalsOk() || !world.hazards) return {x:0,y:0,mag:0};
    let rx=0, ry=0;
    for(const hz of world.hazards){
      const dx = agent.x - hz.x;
      const dy = agent.y - hz.y;
      const d2 = dx*dx + dy*dy;
      const w = hz.str || 1;
      const f = w / (d2 + 0.004); // eps ~ (0.063)^2
      rx += dx * f;
      ry += dy * f;
    }
    const mag = Math.sqrt(rx*rx + ry*ry) || 0;
    if(mag > 0){ rx /= mag; ry /= mag; }
    return {x:rx, y:ry, mag};
  }

  function voteBrainstem(){
    const hungry    = safeNum(body.hunger);
    const lowEnergy = 1 - safeNum(body.energy);
    const lowOxy    = 1 - safeNum(body.oxygen);
    const tempBad   = safeNum(body.temp);
    const hurt      = safeNum(body.injury);

    let best = "rest";
    let bestU = 0.5*lowEnergy;

    const cand = [
      ["breathe",   1.2*lowOxy],
      ["heal",      hurt + 0.2*lowOxy],
      ["forage",    hungry + 0.4*lowEnergy],
      ["regulate",  tempBad],
      ["rest",      0.5*lowEnergy]
    ];
    for(const [d,u] of cand){
      if(u > bestU){ bestU = u; best = d; }
    }
    return { lobe:"brainstem", drive:best, weight:1.00, note:`def=${bestU.toFixed(2)}` };
  }

  function voteLimbic(){
    const hz = hazardsNearScore();
    const threat = clamp01(safeNum(body.injury) + clamp01(hz/1500));
    const hunger = safeNum(body.hunger);
    const lowOxy = 1 - safeNum(body.oxygen);

    let best = "explore";
    if(threat > 0.35) best = "heal";
    else if(lowOxy > 0.30) best = "breathe";
    else if(hunger > 0.28) best = "forage";
    else best = "explore";

    return { lobe:"limbic", drive:best, weight:0.85, note:`thr=${threat.toFixed(2)}` };
  }

  function voteTemporal(){
    const hunger = safeNum(body.hunger);
    const lowOxy = 1 - safeNum(body.oxygen);

    let best = "explore";
    if(world.food && world.food.length && hunger > 0.18) best = "forage";
    else if(world.vents && world.vents.length && lowOxy > 0.20) best = "breathe";
    else best = "explore";

    return { lobe:"temporal", drive:best, weight:0.55, note:"mem" };
  }

  function voteFrontal(){
    // Planning + inhibition + stickiness
    const lowEnergy = 1 - safeNum(body.energy);
    const hurt      = safeNum(body.injury);
    const hunger    = safeNum(body.hunger);
    const lowOxy    = 1 - safeNum(body.oxygen);
    const tempBad   = safeNum(body.temp);

    const urgent = Math.max(1.2*lowOxy, 1.0*hurt, 0.9*hunger, 0.9*tempBad);

    let best = (typeof drive !== "undefined") ? drive : baseChooseDrive();

    if(urgent > 0.55){
      best = baseChooseDrive();
    }else{
      const open = safeNum(traits.openness);
      if(lowEnergy > 0.65) best = "rest";
      else if(hurt > 0.40) best = "heal";
      else if(open > 0.58 && lowEnergy < 0.40) best = "explore";
      else if(hunger > 0.45) best = "forage";
    }

    return { lobe:"frontal", drive:best, weight:0.75, note:`urg=${urgent.toFixed(2)}` };
  }

  function tally(votes){
    const t = {};
    for(const d of DRIVES) t[d]=0;
    for(const v of votes){
      if(t.hasOwnProperty(v.drive)) t[v.drive] += v.weight;
    }
    return t;
  }

  function pick(tallies){
    let best="rest", bestV=-1e9;
    for(const d of DRIVES){
      const v = tallies[d];
      if(v > bestV){ bestV=v; best=d; }
    }
    return {drive:best, score:bestV};
  }

  function fmt(){
    const last = state.last;
    const lines = [];
    lines.push(`lobes: ${last.winner}   (toggle: L)`);
    for(const v of last.votes){
      lines.push(`${v.lobe.padEnd(9)} → ${v.drive.padEnd(8)}  w=${v.weight.toFixed(2)}  ${v.note||""}`);
    }
    const entries = Object.entries(last.tallies||{}).sort((a,b)=>b[1]-a[1]);
    if(entries.length){
      lines.push(`tally: ${entries.slice(0,3).map(([d,s])=>`${d}:${s.toFixed(2)}`).join("  ")}`);
    }
    return lines.join("\n");
  }

  // ----- install: chooseDrive wrapper -----
  chooseDrive = function(){
    if(!state.enabled || !globalsOk()) return baseChooseDrive();

    const base = baseChooseDrive();

    const votes = [
      { lobe:"baseline", drive:base, weight:1.00, note:"base" },
      voteBrainstem(),
      voteLimbic(),
      voteTemporal(),
      voteFrontal()
    ];

    const tallies = tally(votes);
    const win = pick(tallies);

    // Inertia: don't switch unless there's a real margin (unless urgent).
    try{
      const current = (typeof drive !== "undefined") ? drive : base;
      if(current && current !== win.drive){
        const curScore = tallies[current] || 0;

        const urgent = Math.max(
          1.2*(1-safeNum(body.oxygen)),
          1.0*safeNum(body.injury),
          0.9*safeNum(body.hunger),
          0.9*safeNum(body.temp)
        );

        const margin = win.score - curScore;
        const need = (urgent > 0.55) ? 0.05 : 0.28;

        if(margin < need) win.drive = current;
      }
    }catch(e){}

    state.last = { winner: win.drive, votes, tallies };
    el.textContent = fmt();

    return win.drive;
  };

  // ----- install: driveTarget wrapper (hazard-aware targeting) -----
  if(baseDriveTarget){
    driveTarget = function(){
      baseDriveTarget();

      // push target away from hazards slightly
      if(globalsOk()){
        const rep = hazardRepulsion();
        if(rep.mag > 0){
          const strength = 0.08;
          agent.tx = clamp(agent.tx + rep.x*strength, 0.05, 0.95);
          agent.ty = clamp(agent.ty + rep.y*strength, 0.05, 0.95);
        }
      }
    };
  }

  // ----- install: updateAgent wrapper (extra “careful” damping when injured) -----
  if(baseUpdateAgent){
    updateAgent = function(dt){
      baseUpdateAgent(dt);
      if(!globalsOk()) return;

      const extra = 0.10 + safeNum(body.injury)*0.28;
      agent.vx *= (1 - extra*dt);
      agent.vy *= (1 - extra*dt);
    };
  }

  // Toggle lobes on/off with L
  window.addEventListener("keydown", (e)=>{
    const k = (e.key||"").toLowerCase();
    if(k === "l"){
      state.enabled = !state.enabled;
      try{ if(typeof triggerPulse === "function") triggerPulse(state.enabled ? "init" : "rest"); }catch(_){}
      console.log("[lobes] enabled:", state.enabled);
    }
  });

  console.log("[lobes] functional lobes installed. Toggle with L.");

})();
