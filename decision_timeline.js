/* decision_timeline.js — last 20 drive selections + readable "reasons"
   Toggle: H
   Visual: faint strip bottom-left
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
    forage:   "rgba(57,217,138,0.75)",
    breathe:  "rgba(58,214,255,0.80)",
    regulate: "rgba(255,176,32,0.75)",
    heal:     "rgba(255,77,77,0.70)",
    explore:  "rgba(167,139,250,0.75)",
  }[d] || "rgba(255,255,255,0.45)");

  function scoresProxy(){
    try{
      const energyDef = 1 - (body?.energy ?? 1);
      const lowOxy    = 1 - (body?.oxygen ?? 1);
      const hunger    = (body?.hunger ?? 0);
      const tempBad   = (body?.temp ?? 0);
      const injury    = (body?.injury ?? 0);
      const openness  = (traits?.openness ?? 0.45);

      const scores = {
        breathe:  clamp(lowOxy, 0, 1),
        forage:   clamp(hunger, 0, 1),
        regulate: clamp(tempBad, 0, 1),
        heal:     clamp(injury, 0, 1),
        rest:     clamp(energyDef, 0, 1),
        explore:  clamp(openness * (1 - energyDef*0.6), 0, 1),
      };

      const top = Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,3);
      return {scores, top, energyDef, lowOxy, hunger, tempBad, injury};
    }catch(e){
      return {scores:{}, top:[], energyDef:0, lowOxy:0, hunger:0, tempBad:0, injury:0};
    }
  }

  function reasonProxy(drive){
    const s = scoresProxy();
    const d = {
      "O low":  s.lowOxy,
      "H high": s.hunger,
      "T off":  s.tempBad,
      "I high": s.injury,
      "E low":  s.energyDef,
    };
    const primary = Object.entries(d).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
    let why = `${primary[0]} ${f2(primary[1])}`;

    // annotate recent memory steering
    try{
      const ls = window.__dbTools?.lastStatus;
      if(ls && typeof ls.msg === "string" && (Date.now()-ls.t) < 1800 && ls.msg.toLowerCase().includes("memory steering")){
        why += " +mem";
      }
    }catch(e){}

    return {why, top:s.top};
  }

  // ---------- UI ----------
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
  wrap.style.width = "480px";
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
  canvas.width = 480;
  canvas.height = 48;
  canvas.style.width = "480px";
  canvas.style.height = "48px";
  canvas.style.opacity = "0.90";

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
    const colW = Math.max(7, Math.floor((w - pad*2) / MAX));
    const x0 = w - pad - colW*n;

    // baseline
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, h-1, w, 1);

    for(let i=0;i<n;i++){
      const ev = events[i];
      const x = x0 + i*colW;
      const urgency = clamp(ev.urgency ?? 0.2, 0.05, 1.0);
      const barH = Math.max(7, Math.floor(urgency * (h-6)));

      ctx.fillStyle = driveColor(ev.drive);
      ctx.fillRect(x, h-barH, colW-2, barH);

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

    const proxy = scoresProxy();
    const reason = reasonProxy(d);

    const urgency = Math.max(proxy.lowOxy, proxy.hunger, proxy.tempBad, proxy.injury, proxy.energyDef);

    events.push({ t: clock, drive: d, why: reason.why, urgency });
    while(events.length > MAX) events.shift();

    nowLine.textContent = `${clock}  →  ${d}   (${reason.why})`;
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

  console.log("[history] decision_timeline installed. Toggle with H.");
})();
