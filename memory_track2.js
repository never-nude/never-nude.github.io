/* memory_track2.js — "hippocampus" landmarks + gentle steering
   Toggle: M
   Behavior: when exploring and hunger/low-oxygen rises, it biases wandering toward remembered food/vents.
*/
(() => {
  const ENABLE_KEY = "digital_brain_memory_enabled_v1";
  let enabled = (localStorage.getItem(ENABLE_KEY) ?? "1") !== "0";

  const notify = (msg) => {
    try{
      if(window.__dbTools && typeof window.__dbTools.status === "function"){
        window.__dbTools.status(msg);
      }
    }catch(e){}
  };

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };

  function mem(){
    try{
      if(typeof world === "undefined" || !world) return null;
      if(!world.memory || typeof world.memory !== "object") world.memory = {};
      if(!Array.isArray(world.memory.landmarks)) world.memory.landmarks = [];
      return world.memory;
    }catch(e){
      return null;
    }
  }

  function touch(type, x, y, boost){
    const m = mem(); if(!m) return;
    const L = m.landmarks;
    let best = null, bestD = 1e9;
    for(const it of L){
      if(it.type !== type) continue;
      const d = dist2(x,y,it.x,it.y);
      if(d < bestD){ bestD=d; best=it; }
    }
    if(best && bestD < 0.020){ // ~0.14 radius
      best.x = best.x*0.70 + x*0.30;
      best.y = best.y*0.70 + y*0.30;
      best.str = clamp((best.str||0) + boost, 0, 1);
      best.t = Date.now();
    }else{
      L.push({ type, x, y, str: clamp(boost,0,1), t: Date.now() });
    }
  }

  function bestLandmark(type){
    const m = mem(); if(!m) return null;
    let best = null, bestScore = -1;
    for(const it of m.landmarks){
      if(it.type !== type) continue;
      const d = Math.sqrt(dist2(agent.x, agent.y, it.x, it.y)) + 0.002;
      const str = (typeof it.str === "number") ? it.str : 0;
      const score = str / d;
      if(score > bestScore){ bestScore=score; best=it; }
    }
    return best;
  }

  let lastH = null, lastO = null;
  let lastT = Date.now();

  setInterval(() => {
    if(!enabled) return;
    if(typeof agent === "undefined" || typeof body === "undefined" || typeof world === "undefined") return;

    const now = Date.now();
    const dt = (now - lastT)/1000;
    lastT = now;

    // decay memory slowly
    const m = mem(); if(!m) return;
    const L = m.landmarks;
    const tau = 90; // seconds memory half-life-ish
    const decay = Math.exp(-dt/tau);
    for(let i=L.length-1;i>=0;i--){
      L[i].str *= decay;
      if(L[i].str < 0.03) L.splice(i,1);
    }

    // "see" nearby resources (not just when standing on them)
    const SEE_R = 0.35
    const SEE_R2 = SEE_R*SEE_R;

    const see = (arr, type) => {
      if(!Array.isArray(arr)) return;
      for(const it of arr){
        if(!it) continue;
        const d2 = dist2(agent.x, agent.y, it.x, it.y);
        if(d2 < SEE_R2) touch(type, it.x, it.y, 0.06);
      }
    };

    try{
      see(world.food, "food");
      see(world.vents, "vent");
      see(world.hazards, "hazard");
    }catch(e){}

    // success detection (learning): hunger drop → food, oxygen rise → vent
    try{
      if(lastH !== null && typeof body.hunger === "number"){
        if(body.hunger < lastH - 0.02) touch("food", agent.x, agent.y, 0.35);
      }
      if(lastO !== null && typeof body.oxygen === "number"){
        if(body.oxygen > lastO + 0.02) touch("vent", agent.x, agent.y, 0.35);
      }
      lastH = body.hunger;
      lastO = body.oxygen;
    }catch(e){}
  }, 250);

  // Hook driveTarget: bias exploration target toward remembered resources when urgency rises
  if(typeof driveTarget === "function"){
    const base = driveTarget;
    driveTarget = function(){
      base();
      if(!enabled) return;
      try{
        if(typeof drive === "undefined" || drive !== "explore") return;

        const hunger = (typeof body.hunger === "number") ? body.hunger : 0;
        const oxy = (typeof body.oxygen === "number") ? body.oxygen : 1;
        const lowOxy = 1 - oxy;

        let type = null, urge = 0;
        if(lowOxy > hunger && lowOxy > 0.18){ type = "vent"; urge = lowOxy; }
        else if(hunger > 0.18){ type = "food"; urge = hunger; }
        if(!type) return;

        const target = bestLandmark(type);
        if(!target) return;

        const a = clamp(0.18 + urge*0.45, 0.18, 0.55);
        agent.tx = agent.tx*(1-a) + target.x*a;
        agent.ty = agent.ty*(1-a) + target.y*a;

        // light feedback (not spam)
        const now = Date.now();
        if(!driveTarget._t || now - driveTarget._t > 1400){
          driveTarget._t = now;
          notify(`memory steering → ${type}  (toggle: M)`);
        }
      }catch(e){}
    };
  }

  // Toggle memory
  window.addEventListener("keydown", (e) => {
    if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if(e.key === "m" || e.key === "M"){
      enabled = !enabled;
      localStorage.setItem(ENABLE_KEY, enabled ? "1" : "0");
      notify(`memory ${enabled ? "ON" : "OFF"} (toggle: M)`);
    }
  });

  console.log("[memory] track2 installed. Toggle with M.");
})();
