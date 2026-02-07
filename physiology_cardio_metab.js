/* physiology_cardio_metab.js
   Cardio-respiratory + metabolism + CO₂/air-hunger (bites)
*/
(() => {
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);

  function ensurePhys(){
    if(typeof body === "undefined" || !body) return null;
    body.phys = (body.phys && typeof body.phys==="object") ? body.phys : {};
    const p = body.phys;

    if(typeof p.hr      !== "number") p.hr = 72;   // bpm
    if(typeof p.rr      !== "number") p.rr = 12;   // breaths/min
    if(typeof p.spo2    !== "number") p.spo2 = clamp01(typeof body.oxygen==="number" ? body.oxygen : 0.95);
    if(typeof p.stomach !== "number") p.stomach = 0.12;
    if(typeof p.glucose !== "number") p.glucose = clamp01(0.30 + 0.55*(typeof body.energy==="number" ? body.energy : 0.6));
    if(typeof p.o2Debt  !== "number") p.o2Debt = 0.0;
    if(typeof p.activity!== "number") p.activity = 0.0;
    if(typeof p.demand  !== "number") p.demand = 0.22;

    // CO2: baseline ~0.45, higher = air hunger
    if(typeof p.co2     !== "number") p.co2 = 0.45;
    if(typeof p.airHunger !== "number") p.airHunger = 0.0;

    if(typeof p._breatheHoldUntil !== "number") p._breatheHoldUntil = 0;

    p.spo2 = clamp01(p.spo2);
    p.stomach = clamp01(p.stomach);
    p.glucose = clamp01(p.glucose);
    p.o2Debt = clamp01(p.o2Debt);
    p.activity = clamp01(p.activity);
    p.demand = clamp01(p.demand);
    p.co2 = clamp(p.co2, 0.20, 1.00);
    p.airHunger = clamp01(p.airHunger);

    window.__dbPhys = p;
    return p;
  }

  // ----- Hook updateAgent: activity + ingestion -----
  if(typeof updateAgent === "function" && !updateAgent.__dbPhysWrapped){
    const base = updateAgent;

    updateAgent = function(dt){
      const p = ensurePhys();
      const h0 = (typeof body?.hunger === "number") ? body.hunger : 0;
      const o0 = (typeof body?.oxygen === "number") ? body.oxygen : 1;

      base(dt);

      if(!p || typeof agent === "undefined" || !agent) return;

      const vx = (typeof agent.vx==="number") ? agent.vx : 0;
      const vy = (typeof agent.vy==="number") ? agent.vy : 0;
      const sp = Math.sqrt(vx*vx + vy*vy);
      p.activity = clamp01(sp / 0.22);

      const h1 = (typeof body?.hunger === "number") ? body.hunger : h0;
      const dH = h0 - h1;
      if(dH > 0.0005){
        p.stomach = clamp01(p.stomach + dH*1.6);
        p.glucose = clamp01(p.glucose + dH*0.35);
      }

      const o1 = (typeof body?.oxygen === "number") ? body.oxygen : o0;
      const dO = o1 - o0;
      if(dO > 0.0005){
        p.o2Debt = clamp01(p.o2Debt - dO*1.1);
      }
    };

    updateAgent.__dbPhysWrapped = true;
  }

  // ----- Hook bodyTick: digestion + demand + HR/RR + CO2 -----
  if(typeof bodyTick === "function" && !bodyTick.__dbPhysWrapped){
    const base = bodyTick;

    bodyTick = function(){
      base.apply(this, arguments);

      const dtSec = (typeof arguments[0] === "number" && isFinite(arguments[0])) ? arguments[0] : 0.016;
      const d = arguments[1] || {};

      const p = ensurePhys();
      if(!p) return;

      const oxy = (typeof body.oxygen==="number") ? body.oxygen : 1;
      const lowOxy = clamp01(1 - oxy);
      const hunger = (typeof body.hunger==="number") ? body.hunger : 0;
      const injury = (typeof body.injury==="number") ? body.injury : 0;
      const tempBad= (typeof body.temp==="number") ? body.temp : 0;
      const energyDef = (typeof body.energy==="number") ? clamp01(1 - body.energy) : 0;

      const stress = (typeof d.stress==="number") ? d.stress : 0;
      const calm   = (typeof d.calmFactor==="number") ? d.calmFactor : 0;

      const driveNow = (typeof drive === "string") ? drive : "rest";

      // Demand proxy
      const basal = 0.18 + 0.22*stress + 0.08*tempBad;
      const act = 0.85*(p.activity || 0);
      const mode = (driveNow === "explore") ? 0.12 : (driveNow === "rest" ? -0.06 : 0.02);
      const demand = clamp01(basal + act + mode);
      p.demand = demand;

      // Metabolism: stomach -> glucose; glucose use -> energy coupling
      const digRate = (0.050 + 0.020*calm - 0.015*stress);
      const dig = Math.min(p.stomach, Math.max(0, digRate) * dtSec);
      p.stomach = clamp01(p.stomach - dig);
      p.glucose = clamp01(p.glucose + dig*0.85);

      const use = (0.010 + 0.040*demand) * dtSec;
      p.glucose = clamp01(p.glucose - use);

      // hunger coupling (gentle)
      if(typeof body.hunger === "number"){
        const relief = dig * 0.18;
        const lowFuel = clamp01(0.18 - p.glucose);
        const push = lowFuel * 0.0035 * dtSec * (0.4 + 0.6*demand);
        body.hunger = clamp01(body.hunger - relief + push);
      }

      // energy coupling (gentle)
      if(typeof body.energy === "number"){
        const supply = clamp01(p.glucose * (0.65 + 0.35*oxy));
        const gain = (driveNow === "rest" ? 0.010 : 0.0045) * supply * dtSec;
        const lowFuel = clamp01(0.18 - p.glucose);
        const penalty = (0.004 + 0.006*demand) * lowFuel * dtSec;
        body.energy = clamp01(body.energy + gain - penalty);
      }

      // O2 debt
      const debtUp = demand * clamp01(0.55 - oxy) * 0.85;
      const debtDown = (0.06 + 0.12*calm + 0.18*(driveNow==="rest") + 0.10*(oxy>0.70)) * dtSec;
      p.o2Debt = clamp01(p.o2Debt + debtUp*dtSec - debtDown);

      // HR/RR targets
      const hrTarget = clamp(62 + 118*demand + 58*lowOxy + 22*injury + 22*p.o2Debt, 48, 190);
      const rrTarget = clamp(10 +  28*demand + 32*lowOxy + 18*p.o2Debt + 10*injury,  8, 46);

      const aHr = 1 - Math.exp(-dtSec / 2.1);
      const aRr = 1 - Math.exp(-dtSec / 1.6);

      p.hr = p.hr + (hrTarget - p.hr) * aHr;
      p.rr = p.rr + (rrTarget - p.rr) * aRr;

      // CO2 dynamics (production ~ demand; clearance ~ ventilation)
      const vent = clamp01((p.rr - 8) / 38);             // 0..1
      const prod = (0.18 + 0.82*demand);                 // 0..1
      const clear = (0.12 + 0.88*vent) * (0.70 + 0.30*oxy);

      // update CO2 gently
      p.co2 = clamp(p.co2 + (prod - clear) * dtSec * 0.30, 0.20, 1.00);

      // air hunger (CO2 is primary; O2 and debt contribute)
      const co2Drive = clamp01((p.co2 - 0.45) * 2.2);     // 0 at ~0.45
      p.airHunger = clamp01(co2Drive + 0.85*lowOxy + 0.55*p.o2Debt);

      // SpO2 proxy: oxygen minus debt penalty (CO2 indirectly impacts via airHunger)
      const spo2Target = clamp01(oxy - 0.35*p.o2Debt);
      const aS = 1 - Math.exp(-dtSec / 1.2);
      p.spo2 = clamp01(p.spo2 + (spo2Target - p.spo2) * aS);

      window.__dbPhys = p;
    };

    bodyTick.__dbPhysWrapped = true;
  }

  // ----- Bite: wrap chooseDrive using air hunger -----
  function hookChooseDrive(){
    if(typeof chooseDrive !== "function") return false;
    if(chooseDrive.__dbCo2Wrapped) return true;

    const base = chooseDrive;

    chooseDrive = function(){
      const baseDrive = base.apply(this, arguments);
      const p = ensurePhys();
      if(!p) return baseDrive;

      const now = performance.now();

      // keep breathe for a short hold window once triggered
      if(p._breatheHoldUntil && now < p._breatheHoldUntil) return "breathe";

      const ah = (typeof p.airHunger==="number") ? p.airHunger : 0;

      // other competing urgencies
      const hunger = (typeof body?.hunger==="number") ? body.hunger : 0;
      const injury = (typeof body?.injury==="number") ? body.injury : 0;
      const temp   = (typeof body?.temp==="number") ? body.temp : 0;
      const energyDef = (typeof body?.energy==="number") ? clamp01(1 - body.energy) : 0;

      const other = Math.max(hunger, injury, temp, energyDef);

      // Hard override if air hunger is high; soft override if it clearly dominates
      if(ah > 0.60 || (ah > 0.35 && ah > other + 0.10)){
        p._breatheHoldUntil = now + 1800; // 1.8s
        return "breathe";
      }

      // If baseline already chose breathe, keep a tiny hold for stability
      if(baseDrive === "breathe"){
        p._breatheHoldUntil = now + 900;
        return "breathe";
      }

      return baseDrive;
    };

    chooseDrive.__dbCo2Wrapped = true;
    console.log("[phys] chooseDrive wrapped (CO2/airHunger bite)");
    return true;
  }

  // hook now or soon
  if(!hookChooseDrive()){
    const t = setInterval(() => {
      if(hookChooseDrive()) clearInterval(t);
    }, 120);
    setTimeout(()=>clearInterval(t), 4000);
  }

  console.log("[phys] cardio-resp + metabolism + CO2 installed");
})();
