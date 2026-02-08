/* viz_think_halo.js — size boost + thinking halo + anti-dim guard */
(() => {
  const CFG = {
    zoomMin: 1.45,
    nodeScale: 1.55,
    lineScale: 1.85,
    alphaMinStrokeFill: 0.18, // prevents slow fade-to-invisible on strokes/fills
    haloOn: true
  };

  let brainCache = new WeakMap();

  function isBrainCanvas(c){
    try{
      if(!c || !c.getBoundingClientRect) return false;
      if(brainCache.has(c)) return brainCache.get(c);
      const r = c.getBoundingClientRect();
      const v = (r.width > 300 && r.height > 180 && r.top < window.innerHeight * 0.50);
      brainCache.set(c, v);
      return v;
    }catch(e){
      return false;
    }
  }

  const P = CanvasRenderingContext2D.prototype;
  if(!P.__dbVizPatched){
    P.__dbVizPatched = true;

    const _arc = P.arc;
    P.arc = function(x, y, r, sa, ea, ccw){
      try{
        if(isBrainCanvas(this.canvas)) r *= CFG.nodeScale;
      }catch(e){}
      return _arc.call(this, x, y, r, sa, ea, ccw);
    };

    const _stroke = P.stroke;
    P.stroke = function(...args){
      try{
        if(isBrainCanvas(this.canvas)){
          const lw = this.lineWidth;
          const ga = this.globalAlpha;

          this.lineWidth = lw * CFG.lineScale;
          this.globalAlpha = Math.max(ga, CFG.alphaMinStrokeFill);

          const out = _stroke.apply(this, args);

          this.lineWidth = lw;
          this.globalAlpha = ga;
          return out;
        }
      }catch(e){}
      return _stroke.apply(this, args);
    };

    const _fill = P.fill;
    P.fill = function(...args){
      try{
        if(isBrainCanvas(this.canvas)){
          const ga = this.globalAlpha;
          this.globalAlpha = Math.max(ga, CFG.alphaMinStrokeFill);
          const out = _fill.apply(this, args);
          this.globalAlpha = ga;
          return out;
        }
      }catch(e){}
      return _fill.apply(this, args);
    };
  }

  function boostZoom(){
    try{
      if(window.view && typeof view.zoom === "number"){
        view.zoom = Math.max(view.zoom, CFG.zoomMin);
      }
    }catch(e){}
  }

  // Halo overlay
  let overlay = null, ctx = null, brainCanvas = null;

  function pickBrainCanvas(){
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let best = null, bestTop = 1e9;
    for(const c of canvases){
      const r = c.getBoundingClientRect();
      if(r.width < 300 || r.height < 180) continue;
      if(r.top < bestTop){
        bestTop = r.top;
        best = c;
      }
    }
    return best;
  }

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clamp01 = (v)=>clamp(v,0,1);
  const lerp = (a,b,t)=>a+(b-a)*t;

  function rgbFor(kind){
    switch(kind){
      case "injury": return [255,77,77];
      case "temp":   return [167,139,250];
      case "oxygen": return [58,214,255];
      case "hunger": return [255,176,32];
      case "energy": return [57,217,138];
      default:       return [255,255,255];
    }
  }

  function computeDominantNeed(){
    try{
      const e = (typeof body?.energy === "number") ? clamp01(body.energy) : 1;
      const h = (typeof body?.hunger === "number") ? clamp01(body.hunger) : 0;
      const o = (typeof body?.oxygen === "number") ? clamp01(body.oxygen) : 1;
      const t = (typeof body?.temp === "number") ? clamp01(body.temp) : 0;
      const i = (typeof body?.injury === "number") ? clamp01(body.injury) : 0;

      const needEnergy = clamp01(1 - e);
      const needHunger = h;
      const needOxy    = clamp01(1 - o);
      const needTemp   = t;
      const needInjury = i;

      const arr = [
        ["injury", needInjury],
        ["temp",   needTemp],
        ["oxygen", needOxy],
        ["hunger", needHunger],
        ["energy", needEnergy],
      ].sort((a,b)=>b[1]-a[1]);

      return { kind: arr[0][0], val: arr[0][1] };
    }catch(e){
      return { kind:"energy", val:0 };
    }
  }

  let lastNeed = 0;
  let lastRGB = [255,255,255];

  function ensureOverlay(){
    if(!CFG.haloOn) return false;
    if(!brainCanvas) brainCanvas = pickBrainCanvas();
    if(!brainCanvas) return false;

    if(overlay && overlay.parentElement) return true;

    overlay = document.createElement("canvas");
    overlay.id = "dbHalo";
    overlay.style.position = "fixed";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "999990";
    overlay.style.mixBlendMode = "screen";
    ctx = overlay.getContext("2d");
    document.body.appendChild(overlay);
    return true;
  }

  function sizeOverlay(){
    if(!brainCanvas || !overlay) return;
    const r = brainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    overlay.width  = Math.max(1, Math.floor(r.width * dpr));
    overlay.height = Math.max(1, Math.floor(r.height * dpr));
    overlay.style.left = `${r.left}px`;
    overlay.style.top  = `${r.top}px`;
    overlay.style.width = `${r.width}px`;
    overlay.style.height = `${r.height}px`;

    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function drawHalo(){
    try{
      if(!ensureOverlay()){ requestAnimationFrame(drawHalo); return; }
      sizeOverlay();

      const r = brainCanvas.getBoundingClientRect();
      const w = r.width, h = r.height;

      const dom = computeDominantNeed();
      const need = clamp01(dom.val);

      lastNeed = lerp(lastNeed, need, 0.08);
      const targetRGB = rgbFor(dom.kind);
      lastRGB = [
        Math.round(lerp(lastRGB[0], targetRGB[0], 0.08)),
        Math.round(lerp(lastRGB[1], targetRGB[1], 0.08)),
        Math.round(lerp(lastRGB[2], targetRGB[2], 0.08)),
      ];

      ctx.clearRect(0,0,w,h);
      if(lastNeed < 0.02){ requestAnimationFrame(drawHalo); return; }

      const t = performance.now() / 1000;
      const pulse = 0.55 + 0.45*Math.sin(t*2.1);
      const intensity = clamp01(lastNeed * 0.95) * pulse;

      const cx = w*0.5, cy = h*0.5;
      const glowR = Math.min(w,h) * (0.58 + 0.10*lastNeed);
      const col = `rgba(${lastRGB[0]},${lastRGB[1]},${lastRGB[2]},`;

      const g = ctx.createRadialGradient(cx,cy, glowR*0.10, cx,cy, glowR);
      g.addColorStop(0.0, col + (0.20*intensity).toFixed(3) + ")");
      g.addColorStop(0.5, col + (0.10*intensity).toFixed(3) + ")");
      g.addColorStop(1.0, col + "0)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
    }catch(e){}
    requestAnimationFrame(drawHalo);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(boostZoom, 0);
    requestAnimationFrame(drawHalo);
  });

  window.addEventListener("resize", () => {
    brainCanvas = null;
    if(overlay){ overlay.remove(); overlay = null; ctx = null; }
    brainCache = new WeakMap();
  });
})();
