/* urgency_brightness.js — tie brightness to physiological demand (subtle)
   Purpose: urgency becomes visible before a color flip.
*/
(() => {
  const canvas = document.getElementById("viz") || document.querySelector("canvas#viz") || document.querySelector("canvas");
  if(!canvas) return;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  let last = null;

  function getU(){
    try{
      const p = (typeof body !== "undefined" && body && body.phys) ? body.phys : (window.__dbPhys || null);
      const demand = p && typeof p.demand==="number" ? p.demand : 0;
      const air    = p && typeof p.airHunger==="number" ? p.airHunger : 0;
      const debt   = p && typeof p.o2Debt==="number" ? p.o2Debt : 0;
      const injury = (typeof body!=="undefined" && body && typeof body.injury==="number") ? body.injury : 0;
      const temp   = (typeof body!=="undefined" && body && typeof body.temp==="number") ? body.temp : 0;
      const hunger = (typeof body!=="undefined" && body && typeof body.hunger==="number") ? body.hunger : 0;
      return clamp(Math.max(demand, air, debt, injury, temp, hunger), 0, 1);
    }catch(e){
      return 0;
    }
  }

  setInterval(() => {
    const u = getU();
    const b = 1 + 0.28*u; // 1.00 .. 1.28 (subtle but real)
    if(last === null || Math.abs(b-last) > 0.01){
      canvas.style.filter = `brightness(${b.toFixed(3)})`;
      last = b;
    }
  }, 140);
})();
