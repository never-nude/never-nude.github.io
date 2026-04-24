export const DEFAULT_VIEWER_DEFAULTS = Object.freeze({
  spin: 0.0315,
  zoom: 3.18,
  lightAngle: 28,
  lightPower: 1.92,
  exposure: 0.36,
  rough: 0.52,
  canManipulate: true,
  autoRotate: true,
  multiLight: true,
  wire: false
});

export const RANGE_IDS = Object.freeze(["spin", "zoom", "lightAngle", "lightPower", "exposure", "rough"]);
export const CHECKBOX_IDS = Object.freeze(["canManipulate", "autoRotate", "multiLight", "wire"]);

const AUTO_HIDE_DELAY = 3000;

function checkedAttr(value) {
  return value ? " checked" : "";
}

function splitViewerTitle(viewerTitle = "") {
  const trimmedTitle = String(viewerTitle || "").trim();
  const openIndex = trimmedTitle.lastIndexOf(" (");
  if (openIndex === -1 || !trimmedTitle.endsWith(")")) {
    return {
      title: trimmedTitle,
      context: "",
      date: ""
    };
  }

  const title = trimmedTitle.slice(0, openIndex).trim();
  const detail = trimmedTitle.slice(openIndex + 2, -1).trim();
  const commaIndex = detail.lastIndexOf(",");

  if (commaIndex !== -1 && /\d/.test(detail.slice(commaIndex + 1))) {
    return {
      title,
      context: detail.slice(0, commaIndex).trim(),
      date: detail.slice(commaIndex + 1).trim()
    };
  }

  return {
    title,
    context: "",
    date: detail
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveSubtitleLine(subtitle = "", dateLine = "") {
  const cleanedSubtitle = String(subtitle || "").replace(/^Artist:\s*/i, "").trim();
  const trimmedDate = String(dateLine || "").trim();

  if (!trimmedDate) {
    return {
      subtitle: cleanedSubtitle,
      date: ""
    };
  }

  if (cleanedSubtitle.toLowerCase().includes(trimmedDate.toLowerCase())) {
    return {
      subtitle: cleanedSubtitle,
      date: ""
    };
  }

  return {
    subtitle: cleanedSubtitle,
    date: trimmedDate
  };
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

function renderMetadataRows(config) {
  const rows = [
    ["Medium", config.medium],
    ["Dimensions", config.dimensions],
    [config.locationLabel || "Location", config.location],
    ["Region", config.region],
    ["Period", config.period],
    ["Gallery", config.gallery],
    ["Source", config.scanSource],
    ["Mesh", config.meshFormat]
  ].filter(([, value]) => Boolean(value));

  if (!rows.length) return "";

  return rows
    .map(
      ([label, value]) => `
        <div class="fg-drawer-row">
          <span class="fg-drawer-label">${escapeHtml(label)}</span>
          <span class="fg-drawer-value">${escapeHtml(value)}</span>
        </div>
      `
    )
    .join("");
}

function renderRelatedWorks(relatedWorks = []) {
  if (!Array.isArray(relatedWorks) || !relatedWorks.length) return "";

  return `
    <div class="fg-related">
      <p class="fg-related-title">Continue Through the Collection</p>
      <div class="fg-related-scroll">
        ${relatedWorks.map((work) => `
          <a class="fg-related-card" href="${work.href}">
            <span class="fg-related-thumb" data-medium="${escapeHtml(work.medium || "")}">
              <span class="fg-thumb-glow" aria-hidden="true"></span>
              <span class="fg-thumb-form" aria-hidden="true"></span>
              <span class="fg-thumb-plinth" aria-hidden="true"></span>
            </span>
            <span class="fg-related-name">${escapeHtml(work.title)}</span>
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

export function createViewerDefaults(overrides = {}) {
  return { ...DEFAULT_VIEWER_DEFAULTS, ...overrides };
}

export function renderViewerShell(config) {
  const defaults = createViewerDefaults(config.defaults);
  const statsLoading = config.statsLoading || "Loading sculpture...";
  const loadingText = config.loadingText || statsLoading;
  const pageTitle = config.pageTitle || `${config.viewerTitle} — Atrium`;
  const atriumHref = config.atriumHref || document.body.dataset.atriumHref || "/museumv2/museum/";
  const searchParams = new URLSearchParams(window.location.search);
  const embedMode = config.embedMode || searchParams.get("embed") || searchParams.get("mode") || "";
  const isPreviewMode = Boolean(embedMode || searchParams.get("preview") === "1");
  const titleParts = splitViewerTitle(config.viewerTitle || "");
  const displayTitle = titleParts.title || config.viewerTitle || "";
  const titleContext = titleParts.context || "";
  const dateLine = titleParts.date || "";
  const subtitleLine = resolveSubtitleLine(config.subtitle, dateLine);
  const displaySubtitle = subtitleLine.subtitle;
  const displayDateLine = subtitleLine.date;
  const sourceCard = renderSourceCard(config.source);
  const relatedHtml = renderRelatedWorks(config.relatedWorks);
  const metadataRows = renderMetadataRows(config);
  const downloadHref = config.downloadHref || "";
  const downloadLabel = config.downloadLabel || (config.meshFormat ? `Download ${config.meshFormat}` : "Download Model");
  const prevPiece = config.prevPiece || null;
  const nextPiece = config.nextPiece || null;

  if (isPreviewMode) {
    document.body.innerHTML = `
      <div class="fg-viewer fg-viewer--preview ${embedMode ? `fg-viewer--${embedMode}` : ""}">
        <div class="fg-viewer-stage" id="stage" tabindex="-1" aria-busy="true">
          <div class="fg-loading" id="loading" role="status" aria-live="polite" data-state="loading">
            <strong class="fg-loading-title" data-loading-title>Lighting the sculpture</strong>
            <div class="fg-loading-bar"><div class="fg-loading-bar-fill"></div></div>
            <span class="fg-loading-message" data-loading-message>${loadingText}</span>
          </div>
        </div>
        <div class="fg-viewer-progress" data-loading-progress data-state="loading">
          <span class="fg-viewer-progress-bar"></span>
        </div>
      </div>
    `;
    document.title = pageTitle;
    document.body.dataset.atriumHref = atriumHref;
    return createViewerUi(defaults, { atriumHref, isPreviewMode: true });
  }

  document.body.innerHTML = `
    <a class="skip-link" href="#stage">Skip to 3D viewer</a>
    <div class="fg-viewer">
      <div class="fg-viewer-stage" id="stage" tabindex="-1" aria-busy="true" aria-label="3D sculpture viewer">
        <div class="fg-loading" id="loading" role="status" aria-live="polite" data-state="loading">
          <strong class="fg-loading-title" data-loading-title>Lighting the sculpture</strong>
          <div class="fg-loading-bar"><div class="fg-loading-bar-fill"></div></div>
          <span class="fg-loading-message" data-loading-message>${loadingText}</span>
        </div>
      </div>

      <div class="fg-viewer-progress" data-loading-progress data-state="loading">
        <span class="fg-viewer-progress-bar"></span>
      </div>

      <header class="fg-viewer-topbar" data-auto-hide>
        <a class="fg-topbar-back" href="${atriumHref}" aria-label="Back to collection">&larr;</a>
        <div class="fg-topbar-meta">
          <p class="fg-topbar-kicker">ATRIUM.EARTH</p>
          <h1 class="fg-topbar-title">${escapeHtml(displayTitle)}</h1>
          ${displaySubtitle || displayDateLine ? `
            <p class="fg-topbar-subtitle">
              ${displaySubtitle ? escapeHtml(displaySubtitle) : ""}
              ${displaySubtitle && displayDateLine ? " · " : ""}
              ${displayDateLine ? escapeHtml(displayDateLine) : ""}
            </p>
          ` : ""}
        </div>
      </header>

      ${prevPiece ? `
        <a class="fg-viewer-nav fg-viewer-nav--prev" data-auto-hide href="${prevPiece.href}" aria-label="Previous piece: ${escapeHtml(prevPiece.title)}">
          <span class="fg-viewer-nav-arrow" aria-hidden="true">&larr;</span>
          <span class="fg-viewer-nav-copy">
            <span class="fg-viewer-nav-kicker">Previous</span>
            <strong class="fg-viewer-nav-title">${escapeHtml(prevPiece.title)}</strong>
          </span>
        </a>
      ` : ""}

      ${nextPiece ? `
        <a class="fg-viewer-nav fg-viewer-nav--next" data-auto-hide href="${nextPiece.href}" aria-label="Next piece: ${escapeHtml(nextPiece.title)}">
          <span class="fg-viewer-nav-copy">
            <span class="fg-viewer-nav-kicker">Next</span>
            <strong class="fg-viewer-nav-title">${escapeHtml(nextPiece.title)}</strong>
          </span>
          <span class="fg-viewer-nav-arrow" aria-hidden="true">&rarr;</span>
        </a>
      ` : ""}

      <div class="fg-viewer-bottombar" data-auto-hide>
        <div class="fg-bottombar-scroll">
          <label class="fg-control-pill fg-control-pill--slider" for="lightAngle">
            <span class="fg-control-label">Light</span>
            <input id="lightAngle" type="range" min="-180" max="180" step="1" value="${defaults.lightAngle}" />
            <output id="lightAnglev">${Number(defaults.lightAngle).toFixed(0)}&deg;</output>
          </label>

          <label class="fg-control-pill fg-control-pill--slider" for="exposure">
            <span class="fg-control-label">Exposure</span>
            <input id="exposure" type="range" min="0" max="2.8" step="0.01" value="${defaults.exposure.toFixed(2)}" />
            <output id="exposurev">${defaults.exposure.toFixed(2)}</output>
          </label>

          <label class="fg-control-pill fg-control-pill--toggle">
            <input id="autoRotate" type="checkbox"${checkedAttr(defaults.autoRotate)} />
            <span class="fg-control-pill-text">Rotate</span>
          </label>

          <label class="fg-control-pill fg-control-pill--toggle">
            <input id="wire" type="checkbox"${checkedAttr(defaults.wire)} />
            <span class="fg-control-pill-text">Wireframe</span>
          </label>

          <button class="fg-control-pill fg-control-pill--button" id="resetBtn" type="button">Reset</button>
          <button class="fg-control-pill fg-control-pill--button" data-drawer-toggle type="button" aria-expanded="false">Info</button>
          <button class="fg-control-pill fg-control-pill--button" id="fullscreenBtn" type="button">Fullscreen</button>
          ${downloadHref ? `<a class="fg-control-pill fg-control-pill--button" id="downloadLink" href="${downloadHref}" target="_blank" rel="noreferrer">${escapeHtml(downloadLabel)}</a>` : ""}
        </div>

        <input id="spin" type="hidden" value="${defaults.spin.toFixed(4)}" />
        <output id="spinv" hidden>${defaults.spin.toFixed(4)}</output>
        <input id="zoom" type="hidden" value="${defaults.zoom.toFixed(2)}" />
        <output id="zoomv" hidden>${defaults.zoom.toFixed(2)}</output>
        <input id="lightPower" type="hidden" value="${defaults.lightPower.toFixed(2)}" />
        <output id="lightPowerv" hidden>${defaults.lightPower.toFixed(2)}</output>
        <input id="rough" type="hidden" value="${defaults.rough.toFixed(2)}" />
        <output id="roughv" hidden>${defaults.rough.toFixed(2)}</output>
        <input id="canManipulate" type="checkbox"${checkedAttr(defaults.canManipulate)} hidden />
        <input id="multiLight" type="checkbox"${checkedAttr(defaults.multiLight)} hidden />
      </div>

      <div class="fg-drawer is-closed" data-drawer>
        <div class="fg-drawer-scrim" data-drawer-close></div>
        <section class="fg-drawer-panel" aria-labelledby="viewerTitle">
          <button class="fg-drawer-handle" data-drawer-handle type="button" aria-label="Toggle object information"></button>
          <div class="fg-drawer-content">
            <div class="fg-drawer-grid">
              <div class="fg-drawer-lede">
                <p class="fg-drawer-kicker">ATRIUM.EARTH</p>
                <h2 class="fg-drawer-title" id="viewerTitle">${escapeHtml(displayTitle)}</h2>
                ${displaySubtitle ? `<p class="fg-drawer-artist">${escapeHtml(displaySubtitle)}</p>` : ""}
                ${displayDateLine ? `<p class="fg-drawer-date">${escapeHtml(displayDateLine)}</p>` : ""}
                ${titleContext ? `<p class="fg-drawer-context">${escapeHtml(titleContext)}</p>` : ""}
              </div>

              <div class="fg-drawer-meta">
                <p class="fg-drawer-section-label">Object Notes</p>
                <div class="fg-drawer-rows">
                  ${metadataRows}
                </div>
              </div>
            </div>

            <details class="fg-tech-details" open>
              <summary>Publication Metadata</summary>
              <p id="stats" class="fg-drawer-stats-text">${statsLoading}</p>
              ${sourceCard}
            </details>

            ${relatedHtml}
          </div>
        </section>
      </div>

      <div class="fg-gesture-hint" data-gesture-hint hidden>
        <p>Drag to rotate · Pinch to zoom</p>
      </div>
    </div>
  `;

  document.title = pageTitle;
  document.body.dataset.atriumHref = atriumHref;

  return createViewerUi(defaults, { atriumHref, isPreviewMode: false });
}

export function createViewerUi(defaults, options = {}) {
  const stage = document.getElementById("stage");
  const stats = document.getElementById("stats") || document.createElement("span");
  const loading = document.getElementById("loading");
  const loadingTitle = document.querySelector("[data-loading-title]");
  const loadingMessage = document.querySelector("[data-loading-message]");
  const progress = document.querySelector("[data-loading-progress]");
  const autoHideElements = Array.from(document.querySelectorAll("[data-auto-hide]"));
  const drawer = document.querySelector("[data-drawer]");
  const drawerToggle = document.querySelector("[data-drawer-toggle]");
  const drawerHandle = document.querySelector("[data-drawer-handle]");
  const drawerClose = document.querySelector("[data-drawer-close]");
  const fullscreenButton = document.getElementById("fullscreenBtn");
  const prevLink = document.querySelector(".fg-viewer-nav--prev");
  const nextLink = document.querySelector(".fg-viewer-nav--next");
  const gestureHint = document.querySelector("[data-gesture-hint]");

  let hideTimer = null;
  let drawerOpen = false;
  let boundHandlers = {};

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
          : n(id).toFixed(id === "spin" ? 4 : 2);
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

  function setLoadingState(message, stateOptions = {}) {
    const state = stateOptions.state || "loading";
    if (loading) {
      loading.dataset.state = state;
    }
    if (progress) {
      progress.dataset.state = state;
    }
    if (loadingTitle) {
      loadingTitle.textContent =
        stateOptions.title ||
        (state === "error" ? "Unable to load this sculpture" : "Lighting the sculpture");
    }
    if (loadingMessage) {
      loadingMessage.textContent = message;
    } else if (loading) {
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
    if (progress) {
      progress.dataset.state = "ready";
    }
    loading?.remove();
  }

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
    if (options.isPreviewMode || !autoHideElements.length) return;
    showBars();
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideBars, AUTO_HIDE_DELAY);
  }

  function registerActivity() {
    resetHideTimer();
  }

  function setDrawerState(nextOpen) {
    if (!drawer) return;
    drawerOpen = Boolean(nextOpen);
    drawer.classList.toggle("is-open", drawerOpen);
    drawer.classList.toggle("is-closed", !drawerOpen);
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

  function syncFullscreenLabel() {
    if (!fullscreenButton) return;
    fullscreenButton.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  }

  async function toggleFullscreen() {
    if (!stage) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen?.();
    }
  }

  function toggleCheckbox(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return true;
    }
    return Boolean(target.isContentEditable);
  }

  if (!options.isPreviewMode && autoHideElements.length) {
    document.addEventListener("pointermove", registerActivity, { passive: true });
    document.addEventListener("pointerdown", registerActivity, { passive: true });
    document.addEventListener("keydown", registerActivity);
    resetHideTimer();
  }

  if (drawerToggle) {
    drawerToggle.addEventListener("click", () => {
      setDrawerState(!drawerOpen);
    });
  }

  if (drawerHandle) {
    drawerHandle.addEventListener("click", () => {
      setDrawerState(!drawerOpen);
    });
  }

  if (drawerClose) {
    drawerClose.addEventListener("click", () => {
      setDrawerState(false);
    });
  }

  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
      registerActivity();
      await toggleFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFullscreenLabel);
    syncFullscreenLabel();
  }

  if (gestureHint) {
    const seen = localStorage.getItem("atrium-gesture-seen");
    if (!seen && window.innerWidth < 900) {
      gestureHint.hidden = false;
      const dismiss = () => {
        gestureHint.hidden = true;
        localStorage.setItem("atrium-gesture-seen", "1");
        document.removeEventListener("pointerdown", dismiss);
        document.removeEventListener("touchstart", dismiss);
      };
      document.addEventListener("pointerdown", dismiss, { once: true });
      document.addEventListener("touchstart", dismiss, { once: true });
      window.setTimeout(() => {
        if (!gestureHint.hidden) {
          gestureHint.hidden = true;
          localStorage.setItem("atrium-gesture-seen", "1");
        }
      }, 3600);
    }
  }

  document.addEventListener("keydown", async (event) => {
    if (options.isPreviewMode || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target) && event.code !== "Escape") {
      return;
    }

    switch (event.code) {
      case "KeyR":
        event.preventDefault();
        boundHandlers.onReset?.();
        registerActivity();
        break;
      case "KeyW":
        event.preventDefault();
        toggleCheckbox("wire");
        registerActivity();
        break;
      case "KeyF":
        event.preventDefault();
        await toggleFullscreen();
        registerActivity();
        break;
      case "Space":
        event.preventDefault();
        toggleCheckbox("autoRotate");
        registerActivity();
        break;
      case "ArrowLeft":
        if (prevLink) {
          window.location.href = prevLink.href;
        }
        break;
      case "ArrowRight":
        if (nextLink) {
          window.location.href = nextLink.href;
        }
        break;
      case "Escape":
        event.preventDefault();
        if (drawerOpen) {
          setDrawerState(false);
        } else if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          window.location.href = options.atriumHref || "/museumv2/museum/";
        }
        break;
      default:
        break;
    }
  });

  function bindControls(handlers = {}) {
    boundHandlers = handlers;

    for (const id of RANGE_IDS) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          refreshReadouts();
          registerActivity();
          handlers.onRangeInput?.(id);
        });
      }
    }

    for (const id of CHECKBOX_IDS) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          registerActivity();
          handlers.onCheckboxChange?.(id);
        });
      }
    }

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        registerActivity();
        handlers.onReset?.();
      });
    }

    const frontBtn = document.getElementById("frontBtn");
    if (frontBtn) {
      frontBtn.addEventListener("click", () => {
        registerActivity();
        handlers.onFront?.();
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
    bindControls,
    registerActivity,
    setDrawerState
  };
}
