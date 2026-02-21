window.AD_ARMA_BUILD_ID = "20260219-163801";

// --- Quality outlines (emerald/silver/gold) ---
function qualityOutlineStyle(q) {
  const s = String(q || "Regular").toLowerCase();
  if (s.startsWith("g")) return { color: "rgba(46,204,113,0.95)", w: 3 };
  if (s.startsWith("v")) return { color: "rgba(255,215,0,0.95)",    w: 3 };
  return { color: "rgba(192,192,192,0.95)",  w: 3 };
}
window.AD_ARMA_PROJECT  = "Ad Arma v2";
