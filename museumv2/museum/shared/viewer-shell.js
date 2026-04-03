export const DEFAULT_VIEWER_DEFAULTS = Object.freeze({
  spin: 0.12,
  zoom: 3.3,
  lightAngle: 34,
  lightPower: 2.2,
  exposure: 0.24,
  rough: 0.2,
  canManipulate: true,
  autoRotate: true,
  multiLight: true,
  wire: false
});

export const RANGE_IDS = Object.freeze(["spin", "zoom", "lightAngle", "lightPower", "exposure", "rough"]);
export const CHECKBOX_IDS = Object.freeze(["canManipulate", "autoRotate", "multiLight", "wire"]);

const LIGHTING_PRESETS = {
  museum: { lightAngle: 34, lightPower: 2.2, exposure: 0.24, multiLight: true },
  dramatic: { lightAngle: -60, lightPower: 3.2, exposure: 0.18, multiLight: false },
  soft: { lightAngle: 0, lightPower: 1.4, exposure: 0.42, multiLight: true },
  rim: { lightAngle: 150, lightPower: 2.8, exposure: 0.2, multiLight: true }
};

const AUTO_HIDE_DELAY = 3000;
const PRESET_ANIM_DURATION = 600;

function checkedAttr(value) {
  return value ? " checked" : "";
}

function renderSourceCard(source) {
  if (!source) return "";

  const links = Array.isArray(source.links)
    ? source.links
        .map((item) => `<a href="${item.url}" target="_blank" rel="noreferrer">${item.label}</a>`)
        .join(" | ")
    : "";

  return `
    <details class="fg-source-card">
      <summary>Source & Attribution</summary>
      ${source.summary ? `<p class="fg-source-copy">${source.summary}</p>` : ""}
      ${links ? `<p class="fg-source-links">${links}</p>` : ""}
      ${source.note ? `<p class="fg-source-note">${source.note}</p>` : ""}
    </details>
  `;
}

export function createViewerDefaults(overrides = {}) {
  return { ...DEFAULT_VIEWER_DEFAULTS, ...overrides };
}

export function renderViewerShell(config) {
  const defaults = createViewerDefaults(config.defaults);
  const statsLoading = config.statsLoading || "Loading high-fidelity STL sculpture...";
  const loadingText = config.loadingText || statsLoading;
  const pageTitle = config.pageTitle || `${config.viewerTitle} — Form Gallery`;
  const searchParams = new URLSearchParams(window.location.search);
  const embedMode = config.embedMode || searchParams.get("embed") || searchParams.get("mode") || "";
  const isHeroEmbed = embedMode === "hero";
  const sourceCard = renderSourceCard(config.source);
  const loadingEyebrow = isHeroEmbed ? "Preview" : "Preparing Viewer";
  const loadingTitle = isHeroEmbed ? "Loading sculpture preview" : "Building the gallery stage";

  if (isHeroEmbed) {
    document.body.innerHTML = `
      <div class="fg-viewer fg-viewer--hero viewer-app viewer-app--hero">
        <div class="fg-viewer-stage viewer-stage-shell" id="stage" tabindex="-1" aria-busy="true">
          <div class="fg-loading loading" id="loading" role="status" aria-live="polite" data-state="loading">
            <span class="loading-eyebrow">${loadingEyebrow}</span>
            <strong class="loading-title" data-loading-title>${loadingTitle}</strong>
            <span class="loading-message" data-loading-message>${loadingText}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    const relatedHtml = config.relatedWorks?.length
      ? `
        <div class="fg-related">
          <p class="fg-related-title">Related Works</p>
          <div class="fg-related-scroll">
            ${config.relatedWorks.map(w => `
              <a class="fg-related-card" href="${w.href}">
                <span class="fg-related-thumb" data-medium="${w.medium || ''}"></span>
                <span class="fg-related-name">${w.title}</span>
              </a>
            `).join("")}
          </div>
        </div>
      `
      : "";

    document.body.innerHTML = `
      <a class="skip-link" href="#stage">Skip to 3D viewer</a>
      <div class="fg-viewer ${embedMode ? 'fg-viewer--' + embedMode : ''}">
        <div class="fg-viewer-stage" id="stage" tabindex="-1" aria-busy="true" aria-label="3D sculpture viewer">
          <div class="fg-loading" id="loading" role="status" aria-live="polite" data-state="loading">
            <strong class="fg-loading-title" data-loading-title>${loadingTitle}</strong>
            <div class="fg-loading-bar"><div class="fg-loading-bar-fill"></div></div>
            <span class="fg-loading-message" data-loading-message>${loadingText}</span>
          </div>
        </div>

        <div class="fg-viewer-topbar" data-auto-hide>
          <a class="fg-topbar-back" href="/museumv2/museum/" aria-label="Back to collection">&larr;</a>
          <div class="fg-topbar-info">
            <h1 class="fg-topbar-title">${config.viewerTitle}</h1>
            ${config.subtitle ? `<p class="fg-topbar-artist">${config.subtitle}</p>` : ""}
          </div>
        </div>

        <div class="fg-viewer-bottombar" data-auto-hide>
          <div class="fg-bottombar-row fg-bottombar-presets">
            <div class="fg-preset-group" role="group" aria-label="Lighting presets">
              <button class="fg-preset-btn is-active" type="button" data-preset="museum">Museum</button>
              <button class="fg-preset-btn" type="button" data-preset="dramatic">Dramatic</button>
              <button class="fg-preset-btn" type="button" data-preset="soft">Soft</button>
              <button class="fg-preset-btn" type="button" data-preset="rim">Rim</button>
            </div>
          </div>
          <div class="fg-bottombar-row fg-bottombar-controls">
            <div class="fg-bottombar-slider">
              <label for="lightAngle">Light Angle</label>
              <input id="lightAngle" type="range" min="-180" max="180" step="1" value="${defaults.lightAngle}" />
              <output id="lightAnglev">${Number(defaults.lightAngle).toFixed(0)}&deg;</output>
            </div>
            <label class="fg-bottombar-toggle"><input id="wire" type="checkbox"${checkedAttr(defaults.wire)} /> Wireframe</label>
          </div>
          <div class="fg-bottombar-row fg-bottombar-actions">
            <button class="fg-btn fg-btn-ghost" id="resetBtn" type="button">Reset</button>
            <button class="fg-btn fg-btn-ghost fg-info-toggle" type="button" data-drawer-toggle aria-expanded="false">Info</button>
          </div>
        </div>

        <div class="fg-drawer is-closed" data-drawer>
          <div class="fg-drawer-handle" data-drawer-handle></div>
          <div class="fg-drawer-content">
            <div class="fg-drawer-meta">
              <p class="fg-drawer-kicker">Form Gallery</p>
              <h2 class="fg-drawer-title">${config.viewerTitle}</h2>
              ${config.subtitle ? `<p class="fg-drawer-artist">${config.subtitle}</p>` : ""}
              ${config.medium ? `<p class="fg-drawer-detail"><span class="fg-drawer-label">Medium</span> ${config.medium}</p>` : ""}
              ${config.dimensions ? `<p class="fg-drawer-detail"><span class="fg-drawer-label">Dimensions</span> ${config.dimensions}</p>` : ""}
              ${config.location ? `<p class="fg-drawer-detail"><span class="fg-drawer-label">${config.locationLabel || "Location"}</span> ${config.location}</p>` : ""}
            </div>

            <div class="fg-drawer-stats">
              <p class="fg-drawer-section-label">Publication Metadata</p>
              <p id="stats" class="fg-drawer-stats-text">${statsLoading}</p>
              ${sourceCard}
            </div>

            <details class="fg-drawer-advanced">
              <summary>Advanced Controls</summary>
              <div class="fg-drawer-controls">
                <input id="spin" type="hidden" value="${defaults.spin.toFixed(2)}" />
                <output id="spinv" hidden>${defaults.spin.toFixed(2)}</output>
                <div class="fg-control-grid">
                  <div class="fg-control"><label for="zoom">Zoom</label><input id="zoom" type="range" min="0.55" max="6.4" step="0.01" value="${defaults.zoom.toFixed(2)}" /><output id="zoomv">${defaults.zoom.toFixed(2)}</output></div>
                  <div class="fg-control"><label for="lightPower">Light Power</label><input id="lightPower" type="range" min="0.2" max="4.5" step="0.01" value="${defaults.lightPower.toFixed(2)}" /><output id="lightPowerv">${defaults.lightPower.toFixed(2)}</output></div>
                  <div class="fg-control"><label for="exposure">Exposure</label><input id="exposure" type="range" min="0" max="2.8" step="0.01" value="${defaults.exposure.toFixed(2)}" /><output id="exposurev">${defaults.exposure.toFixed(2)}</output></div>
                  <div class="fg-control"><label for="rough">Roughness</label><input id="rough" type="range" min="0.2" max="1" step="0.01" value="${defaults.rough.toFixed(2)}" /><output id="roughv">${defaults.rough.toFixed(2)}</output></div>
                </div>
                <div class="fg-toggle-row">
                  <label><input id="canManipulate" type="checkbox"${checkedAttr(defaults.canManipulate)} /> Manipulate</label>
                  <label><input id="autoRotate" type="checkbox"${checkedAttr(defaults.autoRotate)} /> Auto Rotate</label>
                  <label><input id="multiLight" type="checkbox"${checkedAttr(defaults.multiLight)} /> Multi-Light</label>
                </div>
                <button id="frontBtn" class="fg-btn fg-btn-ghost" type="button">Front View</button>
                <p class="fg-controls-hint">${config.controlsHint || "Drag to rotate. Scroll or pinch to zoom. Shift-drag to pan."}</p>
              </div>
            </details>

            ${relatedHtml}

            <a class="fg-btn fg-btn-ghost fg-drawer-back" href="/museumv2/museum/">Back to Collection</a>
          </div>
        </div>

        <div class="fg-gesture-hint" data-gesture-hint hidden>
          <p>Drag to rotate &middot; Pinch to zoom</p>
        </div>
      </div>
    `;
  }

  document.title = pageTitle;

  return createViewerUi(defaults);
}

export function createViewerUi(defaults) {
  const stage = document.getElementById("stage");
  const stats = document.getElementById("stats") || document.createElement("span");
  const loading = document.getElementById("loading");
  const loadingTitle = document.querySelector("[data-loading-title]");
  const loadingMessage = document.querySelector("[data-loading-message]");
  const defaultLoadingTitle = loadingTitle?.textContent || "Building the gallery stage";

  function n(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : (defaults[id] ?? 0);
  }

  function refreshReadouts() {
    for (const id of RANGE_IDS) {
      const out = document.getElementById(`${id}v`);
      if (out) {
        out.textContent = id === "lightAngle"
          ? `${Math.round(n(id))}\u00b0`
          : n(id).toFixed(2);
      }
    }
  }

  function setDefaults() {
    for (const id of RANGE_IDS) {
      const el = document.getElementById(id);
      if (el) el.value = String(defaults[id]);
    }
    for (const id of CHECKBOX_IDS) {
      const el = document.getElementById(id);
      if (el) el.checked = defaults[id];
    }
    refreshReadouts();
  }

  function setLoadingState(message, options = {}) {
    if (!loading) return;
    const state = options.state || "loading";
    loading.dataset.state = state;
    if (loadingTitle) {
      loadingTitle.textContent =
        options.title ||
        (state === "error" ? "Unable to load this sculpture" : defaultLoadingTitle);
    }
    if (loadingMessage) {
      loadingMessage.textContent = message;
    } else {
      loading.textContent = message;
    }
    if (stage) {
      stage.setAttribute("aria-busy", state === "ready" ? "false" : "true");
    }
  }

  function clearLoading() {
    if (stage) {
      stage.setAttribute("aria-busy", "false");
    }
    loading?.remove();
  }

  // --- Auto-hide behavior ---
  const autoHideElements = document.querySelectorAll("[data-auto-hide]");
  const drawer = document.querySelector("[data-drawer]");
  const drawerToggle = document.querySelector("[data-drawer-toggle]");
  let hideTimer = null;
  let drawerOpen = false;

  function showBars() {
    for (const el of autoHideElements) {
      el.classList.remove("is-hidden");
    }
  }

  function hideBars() {
    if (drawerOpen) return;
    for (const el of autoHideElements) {
      el.classList.add("is-hidden");
    }
  }

  function resetHideTimer() {
    showBars();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBars, AUTO_HIDE_DELAY);
  }

  if (autoHideElements.length > 0) {
    document.addEventListener("pointermove", resetHideTimer);
    document.addEventListener("pointerdown", resetHideTimer);
    document.addEventListener("focusin", (e) => {
      if (
        e.target.closest("[data-auto-hide]") ||
        e.target.closest("[data-drawer]") ||
        e.target.matches("input, button, select, textarea, a, [tabindex]")
      ) {
        resetHideTimer();
      }
    });
    // Start the initial hide timer
    resetHideTimer();
  }

  // --- Drawer behavior ---
  function setDrawerState(state) {
    if (!drawer) return;
    drawer.classList.remove("is-closed", "is-peek", "is-open");
    drawer.classList.add(state);
    drawerOpen = state === "is-open";
    if (drawerToggle) {
      drawerToggle.setAttribute("aria-expanded", String(drawerOpen));
    }
    if (drawerOpen) {
      clearTimeout(hideTimer);
      showBars();
    } else {
      resetHideTimer();
    }
  }

  if (drawerToggle) {
    drawerToggle.addEventListener("click", () => {
      if (drawerOpen) {
        setDrawerState("is-closed");
      } else {
        setDrawerState("is-open");
      }
    });
  }

  // --- Drawer touch drag on handle ---
  const drawerHandle = document.querySelector("[data-drawer-handle]");
  if (drawerHandle && drawer) {
    let startY = 0;
    let startHeight = 0;

    drawerHandle.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
      const rect = drawer.getBoundingClientRect();
      startHeight = window.innerHeight - rect.top;
      drawer.style.transition = "none";
    }, { passive: true });

    drawerHandle.addEventListener("touchmove", (e) => {
      const dy = startY - e.touches[0].clientY;
      const newHeight = Math.max(0, Math.min(window.innerHeight * 0.7, startHeight + dy));
      drawer.style.transform = `translateY(calc(100% - ${newHeight}px))`;
    }, { passive: true });

    drawerHandle.addEventListener("touchend", () => {
      drawer.style.transition = "";
      drawer.style.transform = "";
      const rect = drawer.getBoundingClientRect();
      const visibleHeight = window.innerHeight - rect.top;
      if (visibleHeight < 60) {
        setDrawerState("is-closed");
      } else if (visibleHeight < 200) {
        setDrawerState("is-peek");
      } else {
        setDrawerState("is-open");
      }
    });
  }

  // --- Gesture hint ---
  const gestureHint = document.querySelector("[data-gesture-hint]");
  if (gestureHint) {
    const seen = localStorage.getItem("fg-gesture-seen");
    if (!seen && window.innerWidth < 820) {
      gestureHint.hidden = false;
      const dismiss = () => {
        gestureHint.hidden = true;
        localStorage.setItem("fg-gesture-seen", "1");
        document.removeEventListener("pointerdown", dismiss);
        document.removeEventListener("touchstart", dismiss);
      };
      document.addEventListener("pointerdown", dismiss);
      document.addEventListener("touchstart", dismiss);
    }
  }

  // --- Preset animation helper ---
  function animatePreset(preset, handlers) {
    const target = LIGHTING_PRESETS[preset];
    if (!target) return;

    const rangeKeys = ["lightAngle", "lightPower", "exposure"];
    const checkboxKeys = ["multiLight"];

    // Capture starting values
    const startValues = {};
    for (const key of rangeKeys) {
      startValues[key] = n(key);
    }

    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / PRESET_ANIM_DURATION, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      for (const key of rangeKeys) {
        if (key in target) {
          const current = startValues[key] + (target[key] - startValues[key]) * ease;
          const el = document.getElementById(key);
          if (el) {
            el.value = String(current);
            handlers?.onRangeInput?.(key);
          }
        }
      }
      refreshReadouts();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Set final checkbox values at end of animation
        for (const key of checkboxKeys) {
          if (key in target) {
            const el = document.getElementById(key);
            if (el) {
              el.checked = target[key];
              handlers?.onCheckboxChange?.(key);
            }
          }
        }
      }
    }

    requestAnimationFrame(tick);
  }

  function bindControls(handlers = {}) {
    for (const id of RANGE_IDS) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          refreshReadouts();
          handlers.onRangeInput?.(id);
        });
      }
    }

    for (const id of CHECKBOX_IDS) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          handlers.onCheckboxChange?.(id);
        });
      }
    }

    const frontBtn = document.getElementById("frontBtn");
    if (frontBtn) {
      frontBtn.addEventListener("click", () => {
        handlers.onFront?.();
      });
    }

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        handlers.onReset?.();
      });
    }

    // Legacy museumBtn support (old layout)
    const museumBtn = document.getElementById("museumBtn");
    if (museumBtn) {
      museumBtn.addEventListener("click", () => {
        if (handlers.onMuseum) {
          handlers.onMuseum();
        } else {
          window.location.href = "/museumv2/museum/";
        }
      });
    }

    // --- Preset buttons ---
    const presetButtons = document.querySelectorAll("[data-preset]");
    for (const btn of presetButtons) {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        // Update active state
        for (const b of presetButtons) {
          b.classList.toggle("is-active", b === btn);
        }
        animatePreset(preset, handlers);
      });
    }
  }

  return {
    stage,
    stats,
    loading,
    defaults,
    n,
    setLoadingState,
    clearLoading,
    refreshReadouts,
    setDefaults,
    bindControls
  };
}
