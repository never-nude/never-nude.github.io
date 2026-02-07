/* thinking_depth.js — deeper "thinking" depiction (read-only)
   Toggle: T
*/
(() => {
  const PREF = "digital_brain_thoughts_visible_v1";
  let on = (localStorage.getItem(PREF) ?? "1") !== "0";

  const box = document.createElement("div");
  box.id = "dbThoughts";
  box.style.position = "fixed";
  box.style.right = "12px";
  box.style.top = "12px";
  box.style.zIndex = "999998";
  box.style.padding = "10px 12px";
  box.style.borderRadius = "10px";
  box.style.border = "1px solid rgba(255,255,255,0.14)";
  box.style.background = "rgba(0,0,0,0.45)";
  box.style.color = "rgba(255,255,255,0.86)";
  box.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  box.style.backdropFilter = "blur(2px)";
  box.style.whiteSpace = "pre";
  box.style.pointerEvents = "none";
  box.style.maxWidth = "520px";
  box.style.display = on ? "block" : "none";

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const f2 = (x)=> (Number.isFinite(x) ? x.toFixed(2) : "?.??");
  const i0 = (x)=> (Number.isFinite(x) ? String(Math.round(x)).padStart(3," ") : " ??");

  function memCounts(){
    try{
      if(!world || !world.memory || !Array.isArray(world.memory.landmarks)) return {food:0, vent:0, hazard:0, n:0};
      const c = {food:0, vent:0, hazard:0, n: world.memory.landmarks.length};
      for(const it of world.memory.landmarks){
        if(it && it.type && c.hasOwnProperty(it.type)) c[it.type] += 1;
      }
      return c;
    }catch(e){
      return {food:0, vent:0, hazard:0, n:0};
    }
  }

  function driveScores(){
    try{
      const oxy = body?.oxygen ?? 1;
      const lowOxy = 1 - oxy;
      const hunger = body?.hunger ?? 0;
      const tempBad = body?.temp ?? 0;
      const injury = body?.injury ?? 0;
      const energyDef = 1 - (body?.energy ?? 1);

      const p = body?.phys || window.__dbPhys || null;
      const air = (p && typeof p.airHunger==="number") ? p.airHunger : 0;

      const scores = {
        breathe:  clamp(Math.max(lowOxy, air), 0, 1),
        forage:   clamp(hunger, 0, 1),
        regulate: clamp(tempBad, 0, 1),
        heal:     clamp(injury, 0, 1),
        rest:     clamp(energyDef, 0, 1),
        explore:  clamp((traits?.openness ?? 0.4) * (1 - energyDef*0.6), 0, 1),
      };

      const top = Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,3);
      return {scores, top};
    }catch(e){
      return {scores:{}, top:[]};
    }
  }

  function physLine(){
    try{
      const p = body?.phys || window.__dbPhys;
      if(!p) return "phys: —";

      const hr = p.hr, rr = p.rr, spo2 = p.spo2;
      const co2 = p.co2, air = p.airHunger;
      const glu = p.glucose, sto = p.stomach;
      const debt = p.o2Debt, dem = p.demand;

      return `phys: HR ${i0(hr)} RR ${i0(rr)} SpO2 ${f2(spo2)} CO2 ${f2(co2)} Air ${f2(air)} | Glu ${f2(glu)} Sto ${f2(sto)} Debt ${f2(debt)} Dem ${f2(dem)}`;
    }catch(e){
      return "phys: —";
    }
  }

  function render(){
    try{
      const holding = (window.__dbView && window.__dbView.holding) ? "YES" : "no";
      const zoom = (window.__dbView && typeof window.__dbView.zoom === "number") ? window.__dbView.zoom : (window.__vizZoom || 1);

      const d = (typeof drive !== "undefined") ? drive : "?";
      const energy = body?.energy;
      const hunger = body?.hunger;
      const oxygen = body?.oxygen;
      const temp   = body?.temp;
      const injury = body?.injury;

      const mc = memCounts();
      const ds = driveScores();

      const tx = agent?.tx; const ty = agent?.ty;
      const ax = agent?.x;  const ay = agent?.y;

      let last = "";
      try{
        const ls = window.__dbTools?.lastStatus;
        if(ls && Date.now() - ls.t < 1600) last = `note: ${ls.msg}`;
      }catch(e){}

      const top = ds.top.map(([k,v])=>`${k}:${f2(v)}`).join("  ");

      box.textContent =
`THOUGHTS  [T]
drive: ${d}
vitals: E ${f2(energy)}  H ${f2(hunger)}  O ${f2(oxygen)}  T ${f2(temp)}  I ${f2(injury)}
${physLine()}
scores: ${top}
memory: food ${mc.food}  vent ${mc.vent}  hazard ${mc.hazard}  (n=${mc.n})
agent:  x ${f2(ax)}  y ${f2(ay)}   target: ${f2(tx)},${f2(ty)}
view:   zoom ${f2(zoom)}   holding ${holding}
${last}`.trimEnd();
    } catch (e) {}
  }

  function setOn(v){
    on = !!v;
    box.style.display = on ? "block" : "none";
    localStorage.setItem(PREF, on ? "1" : "0");
    try{ window.__dbTools?.status(on ? "thoughts on (T)" : "thoughts off (T)"); }catch(e){}
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    document.body.appendChild(box);
    render();
    setInterval(render, 150);
  });

  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    if(e.key === "t" || e.key === "T") setOn(!on);
  });
})();
