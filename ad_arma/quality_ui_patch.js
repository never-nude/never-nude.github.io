(() => {
  const $ = (id) => document.getElementById(id);

  function ensurePickedSpan(afterBtnId) {
    if ($("qualityPicked")) return $("qualityPicked");
    const after = $(afterBtnId);
    if (!after) return null;
    const span = document.createElement("span");
    span.id = "qualityPicked";
    span.textContent = "—";
    span.style.marginLeft = "8px";
    span.style.fontWeight = "600";
    span.style.opacity = "0.9";
    after.insertAdjacentElement("afterend", span);
    return span;
  }

  function setActive(q) {
    const btnG = $("qGreenBtn");
    const btnR = $("qRegBtn");
    const btnV = $("qVetBtn");
    const picked = ensurePickedSpan("qVetBtn") || $("qualityPicked");

    const label = (q === "green") ? "Green" : (q === "veteran") ? "Veteran" : "Regular";

    if (btnG) btnG.classList.toggle("active", q === "green");
    if (btnR) btnR.classList.toggle("active", q === "regular");
    if (btnV) btnV.classList.toggle("active", q === "veteran");
    if (picked) picked.textContent = `Quality: ${label}`;

    // Best-effort wiring into whatever the engine uses
    try {
      if (typeof window.setUnitQuality === "function") window.setUnitQuality(q);
    } catch(e) {}
    try {
      if (window.state && typeof window.state === "object") window.state.unitQuality = q;
    } catch(e) {}
    window.POLEMOS_SELECTED_QUALITY = q;
  }

  function boot() {
    const btnG = $("qGreenBtn");
    const btnR = $("qRegBtn");
    const btnV = $("qVetBtn");

    // If buttons don't exist, do nothing (no crash)
    if (!btnG && !btnR && !btnV) return;

    ensurePickedSpan("qVetBtn");

    // Default to whatever button is already marked active; else regular
    let q = "regular";
    if (btnG && btnG.classList.contains("active")) q = "green";
    if (btnV && btnV.classList.contains("active")) q = "veteran";
    setActive(q);

    if (btnG) btnG.addEventListener("click", () => setActive("green"));
    if (btnR) btnR.addEventListener("click", () => setActive("regular"));
    if (btnV) btnV.addEventListener("click", () => setActive("veteran"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
