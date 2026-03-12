export const DEFAULT_VIEWER_DEFAULTS = Object.freeze({
  spin: 0.12,
  zoom: 3.3,
  lightAngle: 34,
  lightPower: 2.2,
  exposure: 0.39,
  rough: 0.58,
  canManipulate: true,
  autoRotate: true,
  multiLight: true,
  wire: false
});

export const RANGE_IDS = Object.freeze(["spin", "zoom", "lightAngle", "lightPower", "exposure", "rough"]);
export const CHECKBOX_IDS = Object.freeze(["canManipulate", "autoRotate", "multiLight", "wire"]);

function checkedAttr(value) {
  return value ? " checked" : "";
}

function titleParagraph(className, value) {
  return value ? `<p class="${className}">${value}</p>` : "";
}

export function createViewerDefaults(overrides = {}) {
  return { ...DEFAULT_VIEWER_DEFAULTS, ...overrides };
}

export function renderViewerShell(config) {
  const defaults = createViewerDefaults(config.defaults);
  const statsLoading = config.statsLoading || "Loading high-fidelity STL sculpture...";
  const loadingText = config.loadingText || statsLoading;
  const showMuseumButton = config.showMuseumButton !== false;

  document.body.innerHTML = `
    <div class="app viewer-app">
      <section class="panel">
        <h1 class="title">${config.viewerTitle}</h1>
        ${titleParagraph("sub", config.subtitle)}
        <p id="stats" class="sub">${statsLoading}</p>

        <div class="grid">
          <div class="control"><label for="spin">Spin</label><input id="spin" type="range" min="0" max="1.6" step="0.01" value="${defaults.spin.toFixed(2)}" /><output id="spinv">${defaults.spin.toFixed(2)}</output></div>
          <div class="control"><label for="zoom">Zoom</label><input id="zoom" type="range" min="1.2" max="6.4" step="0.01" value="${defaults.zoom.toFixed(2)}" /><output id="zoomv">${defaults.zoom.toFixed(2)}</output></div>
          <div class="control"><label for="lightAngle">Key Angle</label><input id="lightAngle" type="range" min="-180" max="180" step="1" value="${defaults.lightAngle}" /><output id="lightAnglev">${Number(defaults.lightAngle).toFixed(2)}</output></div>
          <div class="control"><label for="lightPower">Light Power</label><input id="lightPower" type="range" min="0.2" max="4.5" step="0.01" value="${defaults.lightPower.toFixed(2)}" /><output id="lightPowerv">${defaults.lightPower.toFixed(2)}</output></div>
          <div class="control"><label for="exposure">Exposure</label><input id="exposure" type="range" min="0" max="2.8" step="0.01" value="${defaults.exposure.toFixed(2)}" /><output id="exposurev">${defaults.exposure.toFixed(2)}</output></div>
          <div class="control"><label for="rough">Roughness</label><input id="rough" type="range" min="0.2" max="1" step="0.01" value="${defaults.rough.toFixed(2)}" /><output id="roughv">${defaults.rough.toFixed(2)}</output></div>
        </div>

        <div class="row">
          <label><input id="canManipulate" type="checkbox"${checkedAttr(defaults.canManipulate)} /> Manipulate</label>
          <label><input id="autoRotate" type="checkbox"${checkedAttr(defaults.autoRotate)} /> Auto Rotate</label>
          <label><input id="multiLight" type="checkbox"${checkedAttr(defaults.multiLight)} /> Multi-Light</label>
          <label><input id="wire" type="checkbox"${checkedAttr(defaults.wire)} /> Wireframe</label>
          <button id="frontBtn" class="btn" type="button">Front</button>
          <button id="resetBtn" class="btn" type="button">Reset</button>
          ${showMuseumButton ? '<button id="museumBtn" class="btn" type="button">Museum</button>' : ""}
          <span>${config.controlsHint || "Drag to rotate. Scroll/pinch to zoom. Shift+drag to pan."}</span>
        </div>
      </section>

      <section id="stage">
        <div class="loading" id="loading">${loadingText}</div>
      </section>
    </div>
  `;

  if (config.pageTitle) {
    document.title = config.pageTitle;
  }

  return createViewerUi(defaults);
}

export function createViewerUi(defaults) {
  const stage = document.getElementById("stage");
  const stats = document.getElementById("stats");
  const loading = document.getElementById("loading");

  function n(id) {
    return Number(document.getElementById(id).value);
  }

  function refreshReadouts() {
    for (const id of RANGE_IDS) {
      document.getElementById(`${id}v`).textContent = n(id).toFixed(2);
    }
  }

  function setDefaults() {
    for (const id of RANGE_IDS) {
      document.getElementById(id).value = String(defaults[id]);
    }
    for (const id of CHECKBOX_IDS) {
      document.getElementById(id).checked = defaults[id];
    }
    refreshReadouts();
  }

  function bindControls(handlers = {}) {
    for (const id of RANGE_IDS) {
      document.getElementById(id).addEventListener("input", () => {
        refreshReadouts();
        handlers.onRangeInput?.(id);
      });
    }

    for (const id of CHECKBOX_IDS) {
      document.getElementById(id).addEventListener("change", () => {
        handlers.onCheckboxChange?.(id);
      });
    }

    document.getElementById("frontBtn").addEventListener("click", () => {
      handlers.onFront?.();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      handlers.onReset?.();
    });

    const museumBtn = document.getElementById("museumBtn");
    if (museumBtn) {
      museumBtn.addEventListener("click", () => {
        if (handlers.onMuseum) {
          handlers.onMuseum();
        } else {
          window.location.href = "/museum/";
        }
      });
    }
  }

  return {
    stage,
    stats,
    loading,
    defaults,
    n,
    refreshReadouts,
    setDefaults,
    bindControls
  };
}
