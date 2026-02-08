/* legend_toggle.js — Color meaning overlay (C; auto-fade)
   Mapping:
     WHITE  = calm/rest
     GREEN  = energy / recovery / fuel
     AMBER  = hunger / food seeking
     CYAN   = oxygen / breathing
     PURPLE = temperature regulation
     RED    = injury / healing
     MIX    = competing needs
*/
(() => {
  const rows = [
    {dot:"rgba(255,255,255,0.85)", text:"WHITE — calm / rest / neutral"},
    {dot:"rgba(57,217,138,0.95)",  text:"GREEN — energy / recovery / fuel"},
    {dot:"rgba(255,176,32,0.95)",  text:"AMBER — hunger / food seeking"},
    {dot:"rgba(58,214,255,0.95)",  text:"CYAN — oxygen / breathing"},
    {dot:"rgba(167,139,250,0.92)", text:"PURPLE — temperature / regulation"},
    {dot:"rgba(255,77,77,0.92)",   text:"RED — injury / healing"},
    {dot:"rgba(255,255,255,0.55)", text:"MIX — two needs close at once"},
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
    txt.textContent = r.text;
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
    t = setTimeout(hide, 2400);
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
