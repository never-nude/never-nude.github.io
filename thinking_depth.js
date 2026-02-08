/* thinking_depth.js — Inner Monologue v5
   - Less obtrusive (compact by default)
   - Not stuck on “booting”: scans likely globals for vitals
   - T cycles: off -> compact -> full -> off
*/
(() => {
  const ID = "dbMonologue";
  const old = document.getElementById(ID);
  if (old) old.remove();

  const PREF = "digitalbrain_thoughts_mode_v5"; // 0 off, 1 compact, 2 full
  let mode = parseInt(localStorage.getItem(PREF) || "1", 10);
  if (![0,1,2].includes(mode)) mode = 1;

  const MAX = 7;
  const thoughts = [];
  let lastTopic = null;
  let lastDrive = null;
  let warnedNoVitals = false;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);
  const num = (x)=>typeof x==="number" && isFinite(x);

  function normalize(o){
    if (!o || typeof o !== "object") return null;

    // Accept multiple possible schemas:
    // {energy,hunger,oxygen,temp,injury}
    // {e,h,o,t,i}
    // {pain} (maps to injury)
    const e = num(o.energy) ? o.energy : (num(o.e) ? o.e : null);
    const h = num(o.hunger) ? o.hunger : (num(o.h) ? o.h : null);
    const ox = num(o.oxygen) ? o.oxygen : (num(o.o) ? o.o : null);
    const t = num(o.temp) ? o.temp : (num(o.t) ? o.t : null);
    const i = num(o.injury) ? o.injury : (num(o.i) ? o.i : (num(o.pain) ? o.pain : null));

    if ([e,h,ox,t,i].some(v => v === null)) return null;

    return {
      e: clamp01(e),
      h: clamp01(h),
      o: clamp01(ox),
      t: clamp01(t),
      i: clamp01(i),
    };
  }

  function findVitals(){
    const roots = [
      window.body,
      window.vitals,
      window.state,
      window.sim,
      window.world,
      window.organism,
      window.agent,
      window.db,
      window.DB,
      window.__db,
    ].filter(Boolean);

    const seen = new Set();
    const q = [];

    const push = (x) => {
      if (!x || typeof x !== "object") return;
      if (seen.has(x)) return;
      seen.add(x);
      q.push(x);
    };

    for (const r of roots) push(r);

    // Search depth 2 in likely objects only (avoid scanning window itself)
    for (let depth = 0; depth < 2; depth++){
      const n = q.length;
      for (let i = 0; i < n; i++){
        const o = q[i];
        try{
          for (const k of Object.keys(o)){
            const v = o[k];
            if (v && typeof v === "object") push(v);
          }
        }catch(e){}
      }
    }

    for (const o of q){
      const v = normalize(o);
      if (v) return v;
    }
    return null;
  }

  function scores(v){
    // “thinking” priorities from internal pressures (legible, not mystical)
    const airNeed = clamp01(1 - v.o);
    const hungerNeed = v.h;
    const painNeed = v.i;
    const tempNeed = v.t;
    const fatigue = clamp01(1 - v.e);

    const breathe = airNeed;
    const forage = hungerNeed;
    const heal = painNeed;
    const regulate = tempNeed;
    const rest = fatigue * 0.85;

    const urgent = Math.max(breathe, forage, heal, regulate, rest);
    const explore = clamp01(0.55 - urgent);

    return { explore, rest, forage, breathe, regulate, heal };
  }

  function top2(sc){
    const arr = Object.entries(sc).filter(([k,v]) => num(v));
    arr.sort((a,b)=>b[1]-a[1]);
    return arr.slice(0,2);
  }

  const pretty = (d)=>({
    explore:"explore",
    rest:"rest",
    forage:"forage",
    breathe:"breathe",
    regulate:"regulate",
    heal:"heal",
  }[d]||d);

  function chooseTopic(ctx){
    const topics = [];
    if (ctx.diff < 0.08 && ctx.b) topics.push("conflict");
    if (ctx.pressureVal > 0.28) topics.push(ctx.pressureKind);
    topics.push("intent");
    for (const t of topics) if (t !== lastTopic) return t;
    return topics[0] || "intent";
  }

  function thought(ctx, topic){
    const d = ctx.a?.[0] || "explore";
    const d2 = ctx.b?.[0] || null;

    if (topic === "conflict" && d2){
      return `Two pulls are competing: ${pretty(d)} vs ${pretty(d2)}. I’ll follow the stronger signal instead of dithering.`;
    }
    if (topic === "air") return `Air is taking priority. My attention narrows when breathing becomes uncertain.`;
    if (topic === "pain") return `Pain is loud. I want stability before I try to be clever.`;
    if (topic === "hunger") return `Hunger keeps interrupting. I’m tempted to simplify everything into “find food.”`;
    if (topic === "temperature") return `Temperature is irritating enough to degrade my judgment. I want relief.`;
    if (topic === "fatigue") return `My energy budget is thinning. I should stop gambling and recover.`; // may not appear often

    // intent
    if (d !== lastDrive){
      return `A plan crystallizes: ${pretty(d)}. I’ll commit briefly and reassess as signals shift.`;
    }
    return `Staying with ${pretty(d)}. Not perfect — just the least-wrong given what I can sense.`;
  }

  function dominantPressure(v){
    const air = clamp01(1 - v.o);
    const pain = v.i;
    const temp = v.t;
    const hunger = v.h;
    const fatigue = clamp01(1 - v.e);

    const arr = [
      ["air", air],
      ["pain", pain],
      ["temperature", temp],
      ["hunger", hunger],
      ["fatigue", fatigue],
    ].sort((a,b)=>b[1]-a[1]);

    return arr[0];
  }

  function pushThought(){
    const v = findVitals();

    if (!v){
      if (!warnedNoVitals){
        thoughts.unshift("• I can’t find my telemetry yet. My thoughts are disconnected from my body.");
        thoughts.unshift("• If this persists, I’m reading the wrong global state (or it’s not exposed).");
        thoughts.unshift("• Try RESET / reset.html; if still stuck, we’ll add a tiny debug probe.");
        warnedNoVitals = true;
      }
      while(thoughts.length > MAX) thoughts.pop();
      return;
    }

    warnedNoVitals = false;

    const sc = scores(v);
    const t2 = top2(sc);
    const a = t2[0] || null;
    const b = t2[1] || null;
    const diff = (a && b) ? Math.abs(a[1] - b[1]) : 1.0;

    const [pk,pv] = dominantPressure(v);

    const ctx = { a, b, diff, pressureKind: pk, pressureVal: pv };

    const topic = chooseTopic(ctx);
    const line = thought(ctx, topic);

    lastTopic = topic;
    lastDrive = a ? a[0] : lastDrive;

    thoughts.unshift("• " + line);
    while(thoughts.length > MAX) thoughts.pop();
  }

  const box = document.createElement("div");
  box.id = ID;
  box.style.position = "fixed";
  box.style.right = "12px";
  box.style.top = "12px";
  box.style.zIndex = "999998";
  box.style.padding = "8px 10px";
  box.style.borderRadius = "10px";
  box.style.border = "1px solid rgba(255,255,255,0.14)";
  box.style.background = "rgba(0,0,0,0.30)";
  box.style.color = "rgba(255,255,255,0.82)";
  box.style.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  box.style.backdropFilter = "blur(2px)";
  box.style.whiteSpace = "pre-wrap";
  box.style.pointerEvents = "none";
  box.style.maxWidth = "420px";
  box.style.maxHeight = "170px";
  box.style.overflow = "hidden";
  box.style.opacity = "0.62";

  function render(){
    if (mode === 0){ box.style.display = "none"; return; }
    box.style.display = "block";

    const head = (mode === 2) ? "INNER MONOLOGUE  [T]" : "THOUGHTS  [T]";
    const showN = (mode === 2) ? MAX : 3;
    const lines = thoughts.slice(0, showN);

    const keys = "Keys: T thoughts • P pause • C colors";
    box.textContent = [head, "", ...lines, "", keys].join("\n");
  }

  function cycle(){
    mode = (mode + 1) % 3; // 0->1->2->0
    localStorage.setItem(PREF, String(mode));
    render();
  }

  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    if(e.key === "t" || e.key === "T") cycle();
  });

  document.addEventListener("DOMContentLoaded", ()=>{
    document.body.appendChild(box);
    // Seed with a few lines, but don’t spam boot messages.
    for (let i=0;i<3;i++) pushThought();
    render();

    setInterval(() => {
      if (window.__dbPaused) { render(); return; }
      pushThought();
      render();
    }, 1200);
  });
})();
