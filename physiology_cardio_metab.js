/* physiology_cardio_metab.js
   Cardio-respiratory + metabolism layer (gentle coupling)

   Adds:
     body.phys = {
       hr: bpm, rr: breaths/min, spo2: 0..1,
       stomach: 0..1, glucose: 0..1,
       o2Debt: 0..1, demand: 0..1, activity: 0..1
     }

   Philosophy:
     - Observe first, couple gently.
     - Do NOT fight the existing sim; interpret it.
*/

(() => {
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);

  function okGlobals(){
    return (typeof body !== "undefined" && body && typeof agent !== "undefined" && agent);
  }

  function ensurePhys(){
    if(!okGlobals()) return null;
    if(!body.phys || typeof body.phys !== "object") body.phys = {};
    const p = body.phys;

    if(typeof p.hr      !== "number") p.hr = 72;     // bpm
    if(typeof p.rr      !== "number") p.rr = 12;     // breaths/min
    if(typeof p.spo2    !== "number") p.spo2 = clamp01(typeof body.oxygen==="number" ? body.oxygen : 0.95);
    if(typeof p.stomach !== "number") p.stomach = 0.12;
    if(typeof p.glucose !== "number") p.glucose = clamp01(0.30 + 0.55*(typeof body.energy==="number" ? body.energy : 0.6));
    if(typeof p.o2Debt  !== "number") p.o2Debt = 0.0;
    if(typeof p.activity!== "number") p.activity = 0.0;
    if(typeof p.demand  !== "number") p.demand = 0.22;
    if(typeof p.lastIngestAt !== "number") p.lastIngestAt = 0;

    // keep bounds sane
    p.spo2 = clamp01(p.spo2);
    p.stomach = clamp01(p.stomach);
    p.glucose = clamp01(p.glucose);
    p.o2Debt = clamp01(p.o2Debt);
    p.activity = clamp01(p.activity);
    p.demand = clamp01(p.demand);

    window.__dbPhys = p;
    return p;
  }

  // ---- Hook updateAgent: detect activity + ingestion + vent recovery ----
  if(typeof updateAgent === "function" && !updateAgent.__dbPhysWrapped){
    const baseUpdateAgent = updateAgent;

    updateAgent = function(dt){
      const p = ensurePhys();
      if(!p) return baseUpdateAgent(dt);

      const h0 = (typeof body.hunger==="number") ? body.hunger : 0;
      const o0 = (typeof body.oxygen==="number") ? body.oxygen : 1;

      baseUpdateAgent(dt);

      // activity from velocity (normalize by typical max speed ~0.22)
      const vx = (typeof agent.vx==="number") ? agent.vx : 0;
      const vy = (typeof agent.vy==="number") ? agent.vy : 0;
      const sp = Math.sqrt(vx*vx + vy*vy);
      p.activity = clamp01(sp / 0.22);

      // ingestion detection: hunger drop = food intake (from eating or care)
      const h1 = (typeof body.hunger==="number") ? body.hunger : h0;
      const dH = h0 - h1;
      if(dH > 0.0005){
        // fill stomach; small immediate glucose bump
        p.stomach = clamp01(p.stomach + dH*1.6);
        p.glucose = clamp01(p.glucose + dH*0.35);
        p.lastIngestAt = performance.now();
      }

      // vent detection: oxygen increase reduces debt
      const o1 = (typeof body.oxygen==="number") ? body.oxygen : o0;
      const dO = o1 - o0;
      if(dO > 0.0005){
        p.o2Debt = clamp01(p.o2Debt - dO*1.1);
      }

      return;
    };

    updateAgent.__dbPhysWrapped = true;
  }

  // ---- Hook bodyTick: digest + glucose use + cardio-resp dynamics ----
  if(typeof bodyTick === "function" && !bodyTick.__dbPhysWrapped){
    const baseBodyTick = bodyTick;

    bodyTick = function(dtSec, d){
      baseBodyTick(dtSec, d);

      const p = ensurePhys();
      if(!p) return;

      const stress = (d && typeof d.stress==="number") ? d.stress : 0;
      const calm   = (d && typeof d.calmFactor==="number") ? d.calmFactor : 0;

      const oxy = (typeof body.oxygen==="number") ? body.oxygen : 1;
      const lowOxy = clamp01(1 - oxy);
      const injury = (typeof body.injury==="number") ? body.injury : 0;
      const tempBad= (typeof body.temp==="number") ? body.temp : 0;

      const driveNow = (typeof drive === "string") ? drive : "rest";

      // Demand proxy: basal + activity + stress
      const basal = 0.18 + 0.22*stress + 0.08*tempBad;
      const activity = 0.85*(p.activity || 0);
      const mode = (driveNow === "explore") ? 0.12 : (driveNow === "rest" ? -0.06 : 0.02);
      const demand = clamp01(basal + activity + mode);
      p.demand = demand;

      // ---- Metabolism ----
      // Digestion: stomach -> glucose (slower at high stress)
      const digRate = (0.050 + 0.020*calm - 0.015*stress);  // per second
      const dig = Math.min(p.stomach, Math.max(0, digRate) * dtSec);
      p.stomach = clamp01(p.stomach - dig);
      p.glucose = clamp01(p.glucose + dig*0.85);

      // Glucose usage: basal + demand-driven
      const use = (0.010 + 0.040*demand) * dtSec;
      p.glucose = clamp01(p.glucose - use);

      // Gentle coupling to hunger: digestion slightly relieves hunger; low glucose slightly increases it
      if(typeof body.hunger === "number"){
        const relief = dig * 0.18;
        const lowFuel = clamp01(0.18 - p.glucose);
        const push = lowFuel * 0.0035 * dtSec * (0.4 + 0.6*demand);
        body.hunger = clamp01(body.hunger - relief + push);
      }

      // Gentle coupling to energy: fuel+oxygen produce “usable energy”
      if(typeof body.energy === "number"){
        const supply = clamp01(p.glucose * (0.65 + 0.35*oxy));
        const gain = (driveNow === "rest" ? 0.010 : 0.0045) * supply * dtSec;
        const lowFuel = clamp01(0.18 - p.glucose);
        const penalty = (0.004 + 0.006*demand) * lowFuel * dtSec;
        body.energy = clamp01(body.energy + gain - penalty);
      }

      // ---- Oxygen debt + cardio-resp ----
      // debt rises with demand if oxygen is low; falls with calm and high oxygen (rest helps)
      const debtUp = demand * clamp01(0.55 - oxy) * 0.85;
      const debtDown = (0.06 + 0.12*calm + 0.18*(driveNow==="rest") + 0.10*(oxy>0.70)) * dtSec;
      p.o2Debt = clamp01(p.o2Debt + debtUp*dtSec - debtDown);

      const hrTarget = clamp(62 + 118*demand + 58*lowOxy + 22*injury + 22*p.o2Debt, 48, 190);
      const rrTarget = clamp(10 +  28*demand + 32*lowOxy + 16*p.o2Debt + 10*injury,  8, 44);

      const aHr = 1 - Math.exp(-dtSec / 2.1);
      const aRr = 1 - Math.exp(-dtSec / 1.6);

      p.hr = p.hr + (hrTarget - p.hr) * aHr;
      p.rr = p.rr + (rrTarget - p.rr) * aRr;

      // SpO2 tracks oxygen, degraded slightly by debt (read-only proxy)
      const spo2Target = clamp01(oxy - 0.35*p.o2Debt);
      const aS = 1 - Math.exp(-dtSec / 1.2);
      p.spo2 = clamp01(p.spo2 + (spo2Target - p.spo2) * aS);

      window.__dbPhys = p;
    };

    bodyTick.__dbPhysWrapped = true;
  }

  console.log("[phys] cardio-resp + metabolism installed");
})();
