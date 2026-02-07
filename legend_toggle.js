/* legend_toggle.js — Color legend overlay (toggle: C; auto-fade) */
(() => {
  const rows = [
    {name:"REST",     key:"white",  note:"idle / recover",        dot:"rgba(255,255,255,0.85)"},
    {name:"BREATHE",  key:"cyan",   note:"O₂ / CO₂ pressure",     dot:"rgba(58,214,255,0.95)"},
    {name:"FORAGE",   key:"green",  note:"fuel seeking",          dot:"rgba(57,217,138,0.95)"},
    {name:"REGULATE", key:"amber",  note:"temperature control",   dot:"rgba(255,176,32,0.95)"},
    {name:"HEAL",     key:"red",    note:"injury response",       dot:"rgba(255,77,77,0.92)"},
    {name:"EXPLORE",  key:"violet", note:"curiosity / wander",    dot:"rgba(167,139,250,0.92)"},
  ];

  const box = document.createElement("div");
  box.id = "dbLegend";
  box.style.position = "fixed";
  box.style.right = "12px";
  box.style.bottom = "12px";
  box.style.zIndex = "999996";
  box.style.padding = "10px 12px";
  box.style.borderRadius = "10px";
  box.style.border = "1px solid rgba(255,255,255,0.12)";
  box.style.background = "rgba(0,0,0,0.38)";
  box.style.backdropFilter = "blur(2px)";
  box.style.color = "rgba(255,255,255,0.86)";
  box.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  box.style.pointerEvents = "none";
  box.style.opacity = "0";
  box.style.transform = "translateY(6px)";
  box.style.transition = "opacity .18s ease, transform .18s ease";
  box.style.display = "none";

  const title = document.createElement("div");
  title.textContent = "COLORS  [C]";
  title.style.opacity = "0.82";
  title.style.marginBottom = "8px";
  box.appendChild(title);

  for(const r of rows){
    const line = document.createElement("div");
    line.style.display = "flex";
    line.style.alignItems = "center";
    line.style.gap = "8px";
    line.style.margin = "4px 0";

    const dot = document.createElement("div");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "999px";
    dot.style.background = r.dot;
    dot.style.boxShadow = "0 0 12px rgba(255,255,255,0.10)";

    const txt = document.createElement("div");
    txt.textContent = `${r.name} — ${r.note}`;
    txt.style.opacity = "0.88";

    line.appendChild(dot);
    line.appendChild(txt);
    box.appendChild(line);
  }

  let t = null;

  function show(){
    box.style.display = "block";
    requestAnimationFrame(() => {
      box.style.opacity = "1";
      box.style.transform = "translateY(0)";
    });
    try{ window.__dbTools?.status("colors (C)"); }catch(e){}
    clearTimeout(t);
    t = setTimeout(hide, 2300);
  }

  function hide(){
    box.style.opacity = "0";
    box.style.transform = "translateY(6px)";
    clearTimeout(t);
    t = setTimeout(()=>{ box.style.display = "none"; }, 220);
  }

  document.addEventListener("DOMContentLoaded", ()=>document.body.appendChild(box));

  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    if(e.key === "c" || e.key === "C") show();
  });
})();
