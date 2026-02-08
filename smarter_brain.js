/* smarter_brain.js — Lobe arbitration + learning (trust weights)
   - Wraps existing chooseDrive() if present.
   - Lobes vote; executive blends them with learned trust.
   Keys:
     L        toggle learning on/off
     Shift+L  reset learning (trust -> 1.0)
*/

(() => {
  if (window.__DB_SMART_INSTALLED) return;
  window.__DB_SMART_INSTALLED = true;

  const CFG = {
    alpha: 0.08,       // learning rate for trust updates
    decayTo1: 0.012,   // drift trust back toward 1.0 slowly
    rewardScale: 5.0,  // scales distress improvement into [-1..1]
    minTrust: 0.45,
    maxTrust: 2.30,
    intervalMs: 1100,
    saveEvery: 6        // save trust every N ticks
  };

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(Number.isFinite(v)?v:0, 0, 1);

  function note(msg){
    try{
      if (typeof logLine === "function") logLine("🧠 " + msg);
      else console.log("[DigitalBrain]", msg);
    }catch(e){
      console.log("[DigitalBrain]", msg);
    }
  }

  // ---- Storage keys (scoped per BUILD_ID if available)
  const BUILD = (typeof BUILD_ID !== "undefined") ? BUILD_ID : "v1";
  const LS_KEY = "digitalbrain_smart_trust_" + BUILD;
  const LS_ON  = LS_KEY + "_learning_on";

  // ---- Lobes: fixed heuristics + reasons; learning changes trust in each lobe
  const LOBES = [
    { key:"resp",  name:"Respiration", color:"#3ad6ff",
      vote(c){
        const s = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
        s.breathe = c.lowOxy*1.2 + (c.hasAir ? 0.10 : -0.10);
        s.heal    = c.lowOxy*0.20;
        const reason = (c.lowOxy > 0.28)
          ? "Air feels uncertain; breathing wants priority."
          : "Breathing feels stable.";
        return {scores:s, reason};
      }
    },
    { key:"threat", name:"Threat", color:"#ff4d4d",
      vote(c){
        const s = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
        s.heal = c.injury*1.05 + c.lowOxy*0.20 + (c.hazards ? 0.08 : 0);
        const reason = (c.injury > 0.18)
          ? "Pain is noisy; I want damage control."
          : "Threat is quiet enough to ignore for a moment.";
        return {scores:s, reason};
      }
    },
    { key:"forage", name:"Foraging", color:"#ffb020",
      vote(c){
        const s = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
        s.forage = c.hunger*0.9 + c.lowEnergy*0.6 + (c.hasFood ? 0.10 : -0.10);
        s.rest   = c.lowEnergy*0.55;
        const reason = (c.hunger > 0.30)
          ? "Hunger keeps interrupting; food is a clean solution."
          : (c.lowEnergy > 0.35)
            ? "Energy is low; rest is tempting."
            : "Food can wait.";
        return {scores:s, reason};
      }
    },
    { key:"thermo", name:"Thermoregulation", color:"#a78bfa",
      vote(c){
        const s = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
        s.regulate = c.tempBad*0.95;
        const reason = (c.tempBad > 0.22)
          ? "Temperature is irritating; comfort matters for judgment."
          : "Temperature feels fine.";
        return {scores:s, reason};
      }
    },
    { key:"curio", name:"Curiosity", color:"#d0d0d0",
      vote(c){
        const s = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
        let u = c.openness*0.45 + c.autonomy*0.30 + (c.hasAny ? -0.05 : 0.15);
        // Exploration should shut up when something is screaming.
        u -= Math.max(c.lowOxy, c.hunger, c.injury, c.tempBad) * 0.30;
        if (c.hazards) u -= 0.06;
        s.explore = u;
        const reason = (u > 0.26)
          ? "I want a better map; guessing feels expensive."
          : "Exploration can wait until I’m stable.";
        return {scores:s, reason};
      }
    },
  ];

  function loadTrust(){
    let raw = null;
    try{ raw = JSON.parse(localStorage.getItem(LS_KEY) || "null"); }catch(e){}
    const t = {};
    for(const l of LOBES){
      const v = raw && typeof raw[l.key] === "number" ? raw[l.key] : 1.0;
      t[l.key] = clamp(v, CFG.minTrust, CFG.maxTrust);
    }
    return t;
  }
  function saveTrust(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(trust)); }catch(e){}
  }

  let trust = loadTrust();
  let learningOn = (localStorage.getItem(LS_ON) ?? "1") !== "0";

  function setLearning(on){
    learningOn = !!on;
    try{ localStorage.setItem(LS_ON, learningOn ? "1" : "0"); }catch(e){}
    note("Learning " + (learningOn ? "ON" : "OFF") + ".  (L toggle, Shift+L reset)");
  }

  function resetLearning(){
    for(const l of LOBES) trust[l.key] = 1.0;
    saveTrust();
    note("Learning reset: trust weights -> 1.0.");
  }

  function readContext(){
    if (typeof body === "undefined" || !body) return null;
    const w = (typeof world !== "undefined" && world) ? world : {food:[], vents:[], hazards:[]};
    const t = (typeof traits !== "undefined" && traits) ? traits : {openness:0.5, autonomy:0.5};

    const hunger    = clamp01(body.hunger);
    const lowEnergy = clamp01(1 - body.energy);
    const lowOxy    = clamp01(1 - body.oxygen);
    const tempBad   = clamp01(body.temp);
    const injury    = clamp01(body.injury);

    const hasFood = (w.food && w.food.length) ? 1 : 0;
    const hasAir  = (w.vents && w.vents.length) ? 1 : 0;
    const hasAny  = (hasFood || hasAir) ? 1 : 0;
    const hazards = (w.hazards && w.hazards.length) ? 1 : 0;

    return {
      hunger, lowEnergy, lowOxy, tempBad, injury,
      hasFood, hasAir, hasAny, hazards,
      openness: clamp01(t.openness),
      autonomy: clamp01(t.autonomy),
    };
  }

  function distress(c){
    // Higher = worse. Reward = decrease in this value.
    return (
      c.hunger*0.90 +
      c.lowEnergy*0.60 +
      c.lowOxy*1.20 +
      c.tempBad*0.95 +
      c.injury*1.05
    );
  }

  function blendVotes(c){
    const util = {rest:0, forage:0, breathe:0, regulate:0, heal:0, explore:0};
    const reports = [];

    for(const l of LOBES){
      const v = l.vote(c);
      const w = trust[l.key] ?? 1.0;

      // accumulate weighted scores
      for(const k of Object.keys(util)){
        util[k] += w * (v.scores[k] || 0);
      }

      // top drive for that lobe (for learning credit assignment)
      let top = "rest", topV = -1e9;
      for(const k of Object.keys(v.scores)){
        const val = v.scores[k] || 0;
        if(val > topV){ topV = val; top = k; }
      }

      reports.push({
        key:l.key, name:l.name, color:l.color,
        trust:w, top, reason:v.reason
      });
    }

    // add a baseline rest pressure so the system can “choose to stop”
    util.rest += c.lowEnergy*0.65 + c.injury*0.10;

    return {util, reports};
  }

  function pickDrive(util){
    // pick highest utility
    let best = "rest", bestU = -1e9;
    for(const [k,v] of Object.entries(util)){
      if(v > bestU){ bestU = v; best = k; }
    }

    // thresholds to keep behavior similar to your current feel
    if(best === "breathe"   && util.breathe   > 0.32) return "breathe";
    if(best === "heal"      && util.heal      > 0.22) return "heal";
    if(best === "forage"    && util.forage    > 0.28) return "forage";
    if(best === "regulate"  && util.regulate  > 0.22) return "regulate";
    if(best === "explore"   && util.explore   > 0.30) return "explore";
    return "rest";
  }

  // ---- Smart chooser state (exposed for monologue/debug)
  const state = {
    trust,
    learningOn,
    last: {
      choice: null,
      reports: null,
      prevDistress: null,
      lastReward: 0
    }
  };
  window.DB_SMART = state;

  function smartChooseDrive(){
    const c = readContext();
    if(!c) return null;

    const {util, reports} = blendVotes(c);
    const choice = pickDrive(util);

    // store last decision for learning + visibility
    state.last.choice = choice;
    state.last.reports = reports;
    state.last._distressNow = distress(c);
    state.last._util = util;

    return choice;
  }

  // ---- Learning update loop
  let tick = 0;
  setInterval(() => {
    const c = readContext();
    if(!c) return;

    const dNow = distress(c);

    if(state.last.prevDistress == null){
      state.last.prevDistress = dNow;
      return;
    }

    const rewardRaw = (state.last.prevDistress - dNow);
    const reward = clamp(rewardRaw * CFG.rewardScale, -1, 1);
    state.last.lastReward = reward;

    if(learningOn && state.last.reports && state.last.choice){
      // Credit: lobes that supported the executed choice
      for(const r of state.last.reports){
        // drift back toward 1.0
        trust[r.key] = trust[r.key] + (1.0 - trust[r.key]) * CFG.decayTo1;

        if(r.top === state.last.choice){
          trust[r.key] = clamp(trust[r.key] + CFG.alpha * reward, CFG.minTrust, CFG.maxTrust);
        }
      }

      tick++;
      if(tick % CFG.saveEvery === 0) saveTrust();
    }

    state.last.prevDistress = dNow;
  }, CFG.intervalMs);

  // ---- Install: wrap chooseDrive once it exists
  function install(){
    if (typeof chooseDrive !== "function"){
      setTimeout(install, 200);
      return;
    }
    if (chooseDrive.__dbSmartWrapped) return;

    const orig = chooseDrive;

    const wrapped = function(){
      const smart = smartChooseDrive();
      state.learningOn = learningOn;
      if (smart) return smart;
      return orig();
    };
    wrapped.__dbSmartWrapped = true;
    wrapped.__dbOrig = orig;

    try{
      chooseDrive = wrapped;
      note("Smart brain installed. " + (learningOn ? "Learning ON." : "Learning OFF.") + "  (L toggle, Shift+L reset)");
    }catch(e){
      note("Could not wrap chooseDrive (non-writable). Smart brain loaded but not controlling drives.");
      console.error(e);
    }
  }
  install();

  // ---- Keys
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;

    if(e.key === "l" || e.key === "L"){
      if(e.shiftKey) resetLearning();
      else setLearning(!learningOn);
    }
  }, {capture:true});
})();
