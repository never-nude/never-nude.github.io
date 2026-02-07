/* decision_timeline.js — last 20 drive selections + explicit reasons
   Toggle: H
   Adds: dual-drive rim highlight when close competition
*/
(() => {
  const PREF = "digital_brain_history_visible_v1";
  const MAX = 20;

  let on = (localStorage.getItem(PREF) ?? "1") !== "0";
  const events = [];
  let lastDrive = null;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const f2 = (x)=> (Number.isFinite(x) ? x.toFixed(2) : "?.??");

  const driveColor = (d) => ({
    rest:     "rgba(255,255,255,0.55)",
    forage:   "rgba(57,217,138,0.78)",
    breathe:  "rgba(58,214,255,0.84)",
    regulate: "rgba(255,176,32,0.80)",
    heal:     "rgba(255,77,77,0.74)",
    explore:  "rgba(167,139,250,0.78)",
  }[d] || "rgba(255,255,255,0.45)");

  function getPhys(){
    try{ return body?.phys || window.__dbPhys || null; }catch(e){ return null; }
  }

  function scoreState(){
    const p = getPhys();
    const oxy = body?.oxygen ?? 1;
    const lowOxy = clamp(1 - oxy, 0, 1);
    const hunger = clamp(body?.hunger ?? 0, 0, 1);
    const tempBad= clamp(body?.temp ?? 0, 0, 1);
    const injury = clamp(body?.injury ?? 0, 0, 1);
    const energyDef = clamp(1 - (body?.energy ?? 1), 0, 1);

    const co2 = (p && typeof p.co2==="number") ? p.co2 : 0.45;
    const co2High = clamp((co2 - 0.45) * 2.2, 0, 1);
    const air = (p && typeof p.airHunger==="number") ? p.airHunger : clamp(co2High + 0.85*lowOxy, 0, 1);

    const openness = traits?.openness ?? 0.45;

    const scores = {
      breathe:  clamp(Math.max(lowOxy, air), 0, 1),
      forage:   hunger,
      regulate: tempBad,
      heal:     injury,
      rest:     energyDef,
      explore:  clamp(openness * (1 - energyDef*0.6), 0, 1),
    };

    const entries = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    return {scores, entries, lowOxy, hunger, tempBad, injury, energyDef, co2, co2High, air};
  }

  function reasonFor(driveName){
    const s = scoreState();

    // choose the dominant “pressure”
    const pressures = [
      {k:"CO2 high", v:s.co2High},
      {k:"air hunger", v:s.air},
      {k:"O low", v:s.lowOxy},
      {k:"H high", v:s.hunger},
      {k:"T off", v:s.tempBad},
      {k:"I high", v:s.injury},
      {k:"E low", v:s.energyDef},
    ].sort((a,b)=>b.v-a.v);

    const primary = pressures[0] || {k:"—", v:0};

    let why = `${primary.k} ${f2(primary.v)}`;

    // If this is a breathe decision and CO2 is a real contributor, force CO2 visibility
    if(driveName === "breathe" && s.co2High > 0.20) {
      why = `CO2 high ${f2(s.co2)}  (air ${f2(s.air)})`;
    }

    // annotate recent memory steering
    try{
      const ls = window.__dbTools?.lastStatus;
      if(ls && typeof ls.msg === "string" && (Date.now()-ls.t) < 1800 && ls.msg.toLowerCase().includes("memory steering")){
        why += " +mem";
      }
    }catch(e){}

    // competitor (best scoring other drive)
    const winScore = s.scores[driveName] ?? 0;
    let rival = null, rivalScore = -1;
    for(const [k,v] of Object.entries(s.scores)){
      if(k === driveName) continue;
      if(v > rivalScore){ rival = k; rivalScore = v; }
    }
    const close = (rival != null) && (Math.abs(winScore - rivalScore) < 0.10);
    return {why, winScore, rival, rivalScore, close};
  }

  // UI
  const wrap = document.createElement("div");
  wrap.id = "dbHistory";
  wrap.style.position = "fixed";
  wrap.style.left = "12px";
  wrap.style.bottom = "12px";
  wrap.style.zIndex = "999997";
  wrap.style.padding = "10px 12px";
  wrap.style.borderRadius = "10px";
  wrap.style.border = "1px solid rgba(255,255,255,0.12)";
  wrap.style.background = "rgba(0,0,0,0.40)";
  wrap.style.backdropFilter = "blur(2px)";
  wrap.style.color = "rgba(255,255,255,0.85)";
  wrap.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  wrap.style.width = "520px";
  wrap.style.pointerEvents = "none";
  wrap.style.display = on ? "block" : "none";

  const header = document.createElement("div");
  header.style.opacity = "0.82";
  header.style.marginBottom = "6px";
  header.textContent = "HISTORY  [H]";

  const nowLine = document.createElement("div");
  nowLine.style.opacity = "0.82";
  nowLine.style.marginBottom = "8px";
  nowLine.textContent = "—";

  const canvas = document.createElement("canvas");
  canvas.width = 520;
  canvas.height = 52;
  canvas.style.width = "520px";
  canvas.style.height = "52px";
  canvas.style.opacity = "0.92";

  wrap.appendChild(header);
  wrap.appendChild(nowLine);
  wrap.appendChild(canvas);

  function render(){
    const ctx = canvas.getContext("2d");
    if(!ctx) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    const n = events.length;
    const w = canvas.width;
    const h = canvas.height;
    const pad = 2;
    const colW = Math.max(8, Math.floor((w - pad*2) / MAX));
    const x0 = w - pad - colW*n;

    // baseline
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, h-1, w, 1);

    for(let i=0;i<n;i++){
      const ev = events[i];
      const x = x0 + i*colW;

      // urgency encoded as bar height
      const urgency = clamp(ev.urgency ?? 0.2, 0.05, 1.0);
      const barH = Math.max(8, Math.floor(urgency * (h-6)));

      // main bar (winner)
      ctx.fillStyle = driveColor(ev.drive);
      ctx.fillRect(x, h-barH, colW-2, barH);

      // close-competition rim (rival)
      if(ev.close && ev.rival){
        ctx.fillStyle = driveColor(ev.rival);
        ctx.fillRect(x, h-barH, colW-2, 3);
      }

      // faint cap
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(x, h-barH, colW-2, 1);
    }
  }

  function pushDecision(d){
    const t = new Date();
    const hh = String(t.getHours()).padStart(2,"0");
    const mm = String(t.getMinutes()).padStart(2,"0");
    const ss = String(t.getSeconds()).padStart(2,"0");
    const clock = `${hh}:${mm}:${ss}`;

    const r = reasonFor(d);

    // urgency proxy uses physiology if present, otherwise vitals
    let urgency = 0.25;
    try{
      const p = getPhys();
      const demand = (p && typeof p.demand==="number") ? p.demand : 0;
      const air = (p && typeof p.airHunger==="number") ? p.airHunger : 0;
      const debt = (p && typeof p.o2Debt==="number") ? p.o2Debt : 0;
      urgency = Math.max(demand, air, debt, body?.injury ?? 0, body?.temp ?? 0, body?.hunger ?? 0);
      urgency = clamp(urgency, 0, 1);
    }catch(e){}

    events.push({ t: clock, drive: d, why: r.why, urgency, rival: r.rival, close: r.close });
    while(events.length > MAX) events.shift();

    const closeTxt = (r.close && r.rival) ? `  ~${r.rival}` : "";
    nowLine.textContent = `${clock}  →  ${d}${closeTxt}   (${r.why})`;
    render();
  }

  function sample(){
    try{
      if(typeof drive === "undefined") return;
      const d = drive;
      if(d !== lastDrive){
        lastDrive = d;
        pushDecision(d);
      }
    }catch(e){}
  }

  function setOn(v){
    on = !!v;
    localStorage.setItem(PREF, on ? "1" : "0");
    wrap.style.display = on ? "block" : "none";
    try{ window.__dbTools?.status(on ? "history on (H)" : "history off (H)"); }catch(e){}
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    document.body.appendChild(wrap);
    sample();
    setInterval(sample, 200);
  });

  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    if(e.key === "h" || e.key === "H") setOn(!on);
  });

  console.log("[history] installed. Toggle with H.");
})();
