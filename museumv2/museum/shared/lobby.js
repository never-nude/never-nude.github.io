const ANCIENT_ROOM_IDS = Object.freeze([
  "egypt-mesopotamia",
  "greek-classical",
  "hellenistic-world",
  "roman-world"
]);

const ERA_ORDER = Object.freeze([
  "Ancient Origins",
  "Greek Foundations",
  "Hellenistic World",
  "Roman World",
  "Parallel Traditions",
  "Rebirth of Antiquity",
  "High Renaissance",
  "Enlightenment Sculpture",
  "Nineteenth Century",
  "Modern Sculpture"
]);

const REGION_ORDER = Object.freeze([
  "Egypt & Mesopotamia",
  "Greek world",
  "Roman world",
  "Asia",
  "Sub-Saharan Africa",
  "Americas",
  "Italy",
  "France"
]);

const ARTIST_ORDER = Object.freeze([
  "Unknown / workshop",
  "Donatello",
  "Benedetto da Maiano",
  "Battista Lorenzi",
  "Michelangelo",
  "Bouchardon",
  "James Pradier",
  "Rodin"
]);

function resolveLobbyEntry(entry, pieces) {
  if (typeof entry === "string") {
    const piece = pieces[entry];
    return {
      pieceId: entry,
      piece,
      href: piece?.path
    };
  }

  if (entry?.pieceId) {
    const piece = pieces[entry.pieceId];
    return {
      pieceId: entry.pieceId,
      piece,
      href: entry.href || piece?.path
    };
  }

  return entry;
}

function splitViewerTitle(viewerTitle = "") {
  const trimmedTitle = viewerTitle.trim();
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

function cleanArtistLine(value = "") {
  return value.replace(/^Artist:\s*/i, "").trim();
}

function approximateCenturyYear(century, era, qualifier = "") {
  const normalizedQualifier = qualifier.toLowerCase();
  const start = era === "bce" ? -century * 100 : (century - 1) * 100;
  const offset =
    normalizedQualifier.includes("late") ? 84 :
    normalizedQualifier.includes("mid") ? 50 :
    normalizedQualifier.includes("early") ? 16 :
    50;
  return start + offset;
}

function parseApproxYear(piece) {
  const text = `${piece?.viewerTitle || ""} ${piece?.subtitle || ""}`;

  if (/mid-19th\s+to\s+early\s+20th\s+century/i.test(text)) {
    return 1885;
  }

  const decadeMatch = text.match(/(\d{3,4})0s/i);
  if (decadeMatch) {
    return Number.parseInt(decadeMatch[1], 10) + 5;
  }

  const yearRangeMatch = text.match(/(\d{1,4})\s*[-–]\s*(\d{1,4})\s*(bce|ce)/i);
  if (yearRangeMatch) {
    const start = Number.parseInt(yearRangeMatch[1], 10);
    const end = Number.parseInt(yearRangeMatch[2], 10);
    const era = yearRangeMatch[3].toLowerCase();
    const signedStart = era === "bce" ? -start : start;
    const signedEnd = era === "bce" ? -end : end;
    return Math.round((signedStart + signedEnd) * 0.5);
  }

  const explicitYearMatch = text.match(/(\d{1,4})\s*(bce|ce)/i);
  if (explicitYearMatch) {
    const year = Number.parseInt(explicitYearMatch[1], 10);
    return explicitYearMatch[2].toLowerCase() === "bce" ? -year : year;
  }

  const centuryRangeMatch = text.match(
    /(early|mid|late)?-?\s*(\d{1,2})(?:st|nd|rd|th)\s+to\s+(early|mid|late)?-?\s*(\d{1,2})(?:st|nd|rd|th)\s+century/i
  );
  if (centuryRangeMatch) {
    const startYear = approximateCenturyYear(
      Number.parseInt(centuryRangeMatch[2], 10),
      "ce",
      centuryRangeMatch[1] || ""
    );
    const endYear = approximateCenturyYear(
      Number.parseInt(centuryRangeMatch[4], 10),
      "ce",
      centuryRangeMatch[3] || ""
    );
    return Math.round((startYear + endYear) * 0.5);
  }

  const centuryMatch = text.match(/(early|mid|late)?-?\s*(\d{1,2})(?:st|nd|rd|th)(?:-century)?(?:\s+type)?(?:\s+(bce|ce))?/i);
  if (centuryMatch && /century/i.test(text)) {
    const era = centuryMatch[3]?.toLowerCase() || "ce";
    return approximateCenturyYear(Number.parseInt(centuryMatch[2], 10), era, centuryMatch[1] || "");
  }

  const plainYearRange = text.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (plainYearRange) {
    return Math.round((Number.parseInt(plainYearRange[1], 10) + Number.parseInt(plainYearRange[2], 10)) * 0.5);
  }

  const plainYear = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (plainYear) {
    return Number.parseInt(plainYear[1], 10);
  }

  return null;
}

function formatApproxYear(year) {
  if (year == null) return "Date uncertain";
  const rounded = Math.round(year);
  return rounded < 0 ? `${Math.abs(rounded)} BCE` : `${rounded} CE`;
}

function formatYearRange(entries) {
  const years = entries.map((entry) => parseApproxYear(entry.piece)).filter((value) => value != null);
  if (!years.length) return "Date range pending";
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (min === max) return formatApproxYear(min);
  return `${formatApproxYear(min)} - ${formatApproxYear(max)}`;
}

function formatWorkCount(count, active) {
  return `${count} ${active ? "matching works" : count === 1 ? "work" : "works"}`;
}

function getRegionLabel(piece) {
  if (piece?.region) return piece.region;
  const text = `${piece?.viewerTitle || ""} ${piece?.subtitle || ""} ${piece?.lobbyMeta || ""}`.toLowerCase();

  if (piece?.sectionId === "asia") return "Asia";
  if (piece?.sectionId === "sub-saharan-africa") return "Sub-Saharan Africa";
  if (piece?.sectionId === "americas") return "Americas";
  if (piece?.sectionId === "early-renaissance" || piece?.sectionId === "michelangelo") return "Italy";
  if (piece?.sectionId === "bouchardon" || piece?.sectionId === "rodin") return "France";
  if (piece?.sectionId === "greek-classical" || piece?.sectionId === "hellenistic-world") return "Greek world";
  if (piece?.sectionId === "roman-world") return "Roman world";
  if (piece?.sectionId === "egypt-mesopotamia") {
    return "Egypt & Mesopotamia";
  }

  if (/egypt|giza|sphinx|assyrian|nimrud|nineveh|mesopotamia/.test(text)) return "Egypt & Mesopotamia";
  if (/roman|prima porta|germanicus|capitoline|belvedere torso|ludovisi/.test(text)) return "Roman world";
  if (/delphi|artemision|athena|discobolus|milo|laocoon|gaul|greek|hellenistic|apollo belvedere/.test(text)) {
    return "Greek world";
  }

  return "";
}

function getEraLabel(piece) {
  if (piece?.period) return piece.period;
  const year = parseApproxYear(piece);
  if (year == null) return "Date uncertain";
  if (year <= 500) return "Antiquity";
  if (year < 1400) return "Sacred and Court Traditions";
  if (year < 1500) return "Early Renaissance";
  if (year < 1600) return "High Renaissance";
  if (year < 1800) return "Enlightenment Sculpture";
  if (year < 1900) return "Nineteenth Century";
  return "Modern Sculpture";
}

function getArtistLabel(piece) {
  const maker = String(piece?.maker || "").trim();

  if (!maker) return "Unknown / workshop";
  if (/michelangelo/i.test(maker)) return "Michelangelo";
  if (/bouchardon/i.test(maker)) return "Bouchardon";
  if (/rodin/i.test(maker)) return "Rodin";
  if (/donatello/i.test(maker)) return "Donatello";
  if (/maiano/i.test(maker)) return "Benedetto da Maiano";
  if (/lorenzi/i.test(maker)) return "Battista Lorenzi";
  if (/pradier/i.test(maker)) return "James Pradier";
  if (/unknown|workshop|stonemasons|sculptor|artist|caster|worker|maker/i.test(maker)) return "Unknown / workshop";

  return maker;
}

function buildBrowseItems(field, order, items) {
  const counts = new Map();
  for (const item of items) {
    if (!item[field]) continue;
    counts.set(item[field], (counts.get(item[field]) || 0) + 1);
  }

  const seen = new Set();
  const orderedLabels = [];

  for (const label of order) {
    if (!counts.has(label)) continue;
    seen.add(label);
    orderedLabels.push(label);
  }

  const extras = [...counts.keys()]
    .filter((label) => !seen.has(label))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return [...orderedLabels, ...extras].map((label) => ({
    label,
    value: label,
    count: counts.get(label)
  }));
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const aOrder = a.piece?.sortOrder ?? 9999;
    const bOrder = b.piece?.sortOrder ?? 9999;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return (a.title || "").localeCompare(b.title || "", undefined, { numeric: true });
  });
}

function entryCreator(piece, titleParts) {
  const subtitle = cleanArtistLine(piece?.subtitle || "").split(";")[0].trim();
  if (piece?.lobbyArtistLine) return piece.lobbyArtistLine;
  if (/^artist:/i.test(piece?.subtitle || "")) return subtitle;
  if (titleParts.context) return titleParts.context;
  return subtitle;
}

function presentEntry(entry, section) {
  const piece = entry.piece;
  const titleParts = splitViewerTitle(piece?.lobbyTitle || piece?.viewerTitle || "");
  const creator = entryCreator(piece, titleParts);

  return {
    id: entry.pieceId,
    href: entry.href,
    piece,
    title: titleParts.title || piece?.viewerTitle || "",
    creator,
    date: piece?.lobbyDate || titleParts.date || formatApproxYear(parseApproxYear(piece)),
    linkLabel: piece?.lobbyLinkLabel || "",
    attribution: piece?.heroAttribution || creator,
    era: getEraLabel(piece),
    region: getRegionLabel(piece),
    artist: getArtistLabel(piece),
    gallery: section.title
  };
}

function buildSections(lobby, pieces) {
  return (lobby.sections || [])
    .map((section) => {
      const items = sortEntries(
        (section.items || [])
          .map((entry) => resolveLobbyEntry(entry, pieces))
          .filter((entry) => entry?.piece && !entry.piece.hiddenFromLobby)
      ).map((entry) => presentEntry(entry, section));

      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        region: section.regionLabel || "",
        spineId: section.spineId || "",
        spineTitle: section.spineTitle || "",
        dateRange: formatYearRange(items),
        workCount: items.length,
        items
      };
    })
    .filter((section) => section.items.length > 0);
}

function buildSectionGroups(lobby, sections) {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const rawGroups = Array.isArray(lobby.sectionGroups) ? lobby.sectionGroups : [];

  if (!rawGroups.length) {
    return [{
      id: "all-galleries",
      title: "Galleries",
      showHeading: false,
      workCount: sections.reduce((sum, section) => sum + section.workCount, 0),
      sections
    }];
  }

  return rawGroups
    .map((group) => {
      const groupedSections = (group.sectionIds || [])
        .map((sectionId) => sectionsById.get(sectionId))
        .filter(Boolean);
      if (!groupedSections.length) return null;
      const showHeading = groupedSections.length > 1 || groupedSections[0].title !== group.title;
      return {
        id: group.id,
        title: group.title,
        showHeading,
        workCount: groupedSections.reduce((sum, section) => sum + section.workCount, 0),
        galleryCount: groupedSections.length,
        sections: groupedSections
      };
    })
    .filter(Boolean);
}

function isPreviewableEntry(entry) {
  const href = entry?.href || "";
  const piece = entry?.piece;
  const primaryUrl = piece?.model?.primaryUrl || piece?.model?.url || "";

  if (!piece || !href || /^https?:\/\//.test(href) || piece.kind === "sketchfab") {
    return false;
  }

  if (piece.kind === "gltf") {
    return true;
  }

  if (piece.kind === "stl") {
    return /_small\.stl(?:$|\?)/i.test(primaryUrl);
  }

  return false;
}

function previewPriority(entry) {
  if (!entry?.piece) return 99;
  if (entry.piece.kind === "gltf") return 0;
  if (entry.piece.kind === "stl") return 1;
  return 2;
}

function buildRecentAdditions(pieces, sections, count = 5) {
  const visibleEntries = new Map(
    sections.flatMap((section) => section.items.map((item) => [item.id, item]))
  );

  const orderedEntries = Object.entries(pieces)
    .filter(([pieceId, piece]) => piece && !piece.hiddenFromLobby && visibleEntries.has(pieceId))
    .map(([pieceId]) => visibleEntries.get(pieceId));
  const previewableEntries = orderedEntries.filter(isPreviewableEntry);
  const candidatePool = previewableEntries.length >= count
    ? previewableEntries
    : [...previewableEntries, ...orderedEntries.filter((entry) => !previewableEntries.includes(entry))];

  return candidatePool.slice(-count).reverse();
}

function startOfUtcDay(date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate.getTime();
}

function resolveFeaturedPieceId(lobby) {
  const rotation = Array.isArray(lobby.featuredPieceIds) ? lobby.featuredPieceIds.filter(Boolean) : [];
  const fallbackId = lobby.featuredPieceId || rotation[0] || "dying-gaul";

  if (!rotation.length) {
    return fallbackId;
  }

  const anchorDate = lobby.featuredRotationStart ? new Date(`${lobby.featuredRotationStart}T00:00:00Z`) : new Date();
  const anchorDay = startOfUtcDay(anchorDate);
  const currentDay = startOfUtcDay(new Date());
  const elapsedDays = Math.max(0, Math.floor((currentDay - anchorDay) / (24 * 60 * 60 * 1000)));
  return rotation[elapsedDays % rotation.length] || fallbackId;
}

function pickFeaturedPiece(lobby, sections) {
  const allEntries = sections.flatMap((section) => section.items);
  const itemsById = new Map(allEntries.map((item) => [item.id, item]));
  const featuredId = resolveFeaturedPieceId(lobby);
  const preferredIds = [
    featuredId,
    ...((Array.isArray(lobby.featuredPieceIds) ? lobby.featuredPieceIds : []).filter(Boolean))
  ];

  for (const pieceId of preferredIds) {
    const directMatch = itemsById.get(pieceId);
    if (directMatch && isPreviewableEntry(directMatch)) {
      return directMatch;
    }
  }

  const previewable = allEntries
    .filter(isPreviewableEntry)
    .sort((a, b) => previewPriority(a) - previewPriority(b));

  if (previewable.length) {
    return previewable[0];
  }

  return allEntries[0] || null;
}

function heroPreviewHref(href) {
  if (!href || /^https?:\/\//.test(href)) return "";
  return href.includes("?") ? `${href}&embed=hero&preview=1` : `${href}?embed=hero&preview=1`;
}

function restoreHashPosition() {
  const hash = (window.location.hash || "").replace(/^#/, "");
  if (!hash) return;
  const target = document.getElementById(hash);
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start" });
  });
}

/* ---------------------------------------------------------------
   Rendering helpers
   --------------------------------------------------------------- */

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHeader(lobby) {
  return `
    <header class="fg-header">
      <a class="fg-brand" href="/museumv2/museum/" aria-label="Form Gallery">
        <span class="fg-brand-form">FORM</span>
        <span class="fg-brand-gallery">GALLERY</span>
      </a>
      <nav class="fg-nav" aria-label="Museum navigation">
        <a class="fg-nav-link" href="#fg-hero">Featured</a>
        <a class="fg-nav-link" href="#fg-collection">Collection</a>
        <a class="fg-nav-link" href="#fg-timeline">Timeline</a>
      </nav>
    </header>
  `;
}

function renderHero(lobby, featuredPiece) {
  if (!featuredPiece) return "";
  const heroFrame = heroPreviewHref(featuredPiece.href);
  const attribution = featuredPiece.attribution || "";
  const date = featuredPiece.date || "";

  return `
    <section class="fg-hero" id="fg-hero">
      <div class="fg-hero-stage">
        ${heroFrame ? `<iframe class="hero-frame" data-preview-src="${escapeAttr(heroFrame)}" tabindex="-1" loading="eager" title="${escapeAttr(featuredPiece.title)} preview"></iframe>` : ""}
      </div>
      <div class="fg-hero-scrim"></div>
      <div class="fg-hero-content">
        <p class="fg-hero-kicker">${lobby.featuredLabel || "Featured Sculpture"}</p>
        <h1 class="fg-hero-title">${featuredPiece.title}</h1>
        <p class="fg-hero-artist">${attribution}${attribution && date ? " \u00b7 " : ""}${date}</p>
        <a class="fg-btn fg-btn-primary fg-hero-cta" href="${escapeAttr(featuredPiece.href)}">${lobby.featuredCtaLabel || "Explore"}</a>
      </div>
    </section>
  `;
}

function renderRecentCard(entry) {
  const previewFrame = heroPreviewHref(entry.href);
  return `
    <a class="fg-recent-card" href="${escapeAttr(entry.href)}">
      <span class="fg-recent-thumb" data-medium="${escapeAttr(entry.piece?.medium || "")}">
        ${previewFrame ? `<iframe class="new-addition-frame" data-preview-src="${escapeAttr(previewFrame)}" tabindex="-1" loading="lazy" title="${escapeAttr(entry.title)} preview"></iframe>` : ""}
      </span>
      <span class="fg-recent-info">
        <span class="fg-recent-gallery">${entry.gallery}</span>
        <span class="fg-recent-title">${entry.title}</span>
        ${entry.creator ? `<span class="fg-recent-creator">${entry.creator}</span>` : ""}
        ${entry.date ? `<span class="fg-recent-date">${entry.date}</span>` : ""}
      </span>
    </a>
  `;
}

function renderRecentSection(recentAdditions) {
  if (!recentAdditions.length) return "";
  const cardsHtml = recentAdditions.map((entry) => renderRecentCard(entry)).join("");
  return `
    <section class="fg-recent" aria-labelledby="fg-recent-title">
      <div class="fg-section-head">
        <p class="fg-kicker">Recent Works</p>
        <h2 class="fg-section-title" id="fg-recent-title">New Additions</h2>
      </div>
      <div class="fg-recent-scroll">
        ${cardsHtml}
      </div>
    </section>
  `;
}

function renderFacetDropdown(group) {
  const optionsHtml = group.items.map((item) => `
    <button class="fg-facet-option" type="button" data-filter-group="${escapeAttr(group.id)}" data-filter-value="${escapeAttr(item.value)}">
      <span>${item.label}</span>
      <span class="fg-facet-count">${item.count}</span>
    </button>
  `).join("");

  return `
    <div class="fg-facet" data-facet="${escapeAttr(group.id)}">
      <button class="fg-facet-btn" type="button" aria-expanded="false" aria-controls="facet-${escapeAttr(group.id)}">${group.title}</button>
      <div class="fg-facet-dropdown" id="facet-${escapeAttr(group.id)}" hidden>
        ${optionsHtml}
      </div>
    </div>
  `;
}

function renderFilterSection(lobby, browseGroups) {
  const facetsHtml = browseGroups.map((group) => renderFacetDropdown(group)).join("");
  return `
    <section class="fg-filter-section" id="fg-collection">
      <div class="fg-section-head">
        <div>
          <p class="fg-kicker">Collection Guide</p>
          <h2 class="fg-section-title">${lobby.browseTitle || "Browse the Collection"}</h2>
        </div>
      </div>
      <div class="fg-filter-bar">
        <input class="fg-search-input" type="search" placeholder="Search works..." aria-label="Search the collection" data-filter-search />
        <div class="fg-facet-row">
          ${facetsHtml}
        </div>
        <div class="fg-active-filters" data-active-filters></div>
      </div>
      <p class="fg-filter-status" id="filterStatus" aria-live="polite">Viewing the full collection</p>
      <button class="fg-btn fg-btn-ghost fg-filter-reset" type="button" data-filter-reset hidden>${lobby.browseResetLabel || "Show all works"}</button>
    </section>
  `;
}

function renderTimeline(sectionGroups) {
  const erasHtml = sectionGroups.map((group) => `
    <a class="fg-timeline-era" href="#fg-chrono-${escapeAttr(group.id)}" style="--era-weight: ${group.workCount}">
      <span class="fg-timeline-era-title">${group.title}</span>
      <span class="fg-timeline-era-count">${group.workCount} works</span>
    </a>
  `).join("");

  return `
    <section class="fg-timeline-section" id="fg-timeline">
      <div class="fg-section-head">
        <p class="fg-kicker">Timeline</p>
        <h2 class="fg-section-title">Through the Ages</h2>
      </div>
      <div class="fg-timeline" role="navigation" aria-label="Historical timeline">
        ${erasHtml}
      </div>
    </section>
  `;
}

function renderPieceCard(entry) {
  const searchable = [
    entry.title,
    entry.creator,
    entry.date,
    entry.era,
    entry.region,
    entry.gallery,
    entry.piece?.medium || ""
  ].join(" ").toLowerCase();

  return `
    <a class="fg-piece-card" href="${escapeAttr(entry.href)}" id="fg-work-${escapeAttr(entry.id)}" data-era="${escapeAttr(entry.era)}" data-region="${escapeAttr(entry.region)}" data-artist="${escapeAttr(entry.artist)}" data-gallery="${escapeAttr(entry.gallery)}" data-searchable="${escapeAttr(searchable)}">
      <span class="fg-piece-thumb" data-medium="${escapeAttr(entry.piece?.medium || "")}"></span>
      <span class="fg-piece-info">
        <span class="fg-piece-title">${entry.title}</span>
        ${entry.creator ? `<span class="fg-piece-creator">${entry.creator}</span>` : ""}
        ${entry.date ? `<span class="fg-piece-date">${entry.date}</span>` : ""}
      </span>
    </a>
  `;
}

function renderGallery(section) {
  const piecesHtml = section.items.map((entry) => renderPieceCard(entry)).join("");
  return `
    <article class="fg-gallery" id="fg-gallery-${escapeAttr(section.id)}" data-work-count-label="${escapeAttr(formatWorkCount(section.workCount))}">
      <div class="fg-gallery-head">
        ${section.region ? `<p class="fg-gallery-region">${section.region}</p>` : ""}
        <h4 class="fg-gallery-title">${section.title}</h4>
        ${section.subtitle ? `<p class="fg-gallery-desc">${section.subtitle}</p>` : ""}
        <div class="fg-gallery-meta">
          ${section.dateRange ? `<span>${section.dateRange}</span>` : ""}
          <span class="fg-gallery-work-count" data-work-count>${formatWorkCount(section.workCount)}</span>
        </div>
      </div>
      <div class="fg-piece-grid">
        ${piecesHtml}
      </div>
    </article>
  `;
}

function renderChronoGroup(group) {
  const galleriesHtml = group.sections.map((section) => renderGallery(section)).join("");
  const galleryLabel = group.galleryCount === 1 ? "gallery" : "galleries";

  return `
    <div class="fg-chrono-group" id="fg-chrono-${escapeAttr(group.id)}">
      ${group.showHeading ? `
        <div class="fg-chrono-head">
          <p class="fg-kicker">Chronology</p>
          <h3 class="fg-chrono-title">${group.title}</h3>
          <p class="fg-chrono-meta">${group.workCount} works \u00b7 ${group.galleryCount} ${galleryLabel}</p>
        </div>
      ` : ""}
      <div class="fg-gallery-grid">
        ${galleriesHtml}
      </div>
    </div>
  `;
}

function renderCollection(sectionGroups) {
  const groupsHtml = sectionGroups.map((group) => renderChronoGroup(group)).join("");
  return `
    <section class="fg-collection" id="fg-rooms" aria-label="Collection galleries">
      ${groupsHtml}
    </section>
  `;
}

/* ---------------------------------------------------------------
   Filter binding
   --------------------------------------------------------------- */

function bindLobbyFilters() {
  const searchInput = document.querySelector("[data-filter-search]");
  const resetButton = document.querySelector("[data-filter-reset]");
  const activeFiltersContainer = document.querySelector("[data-active-filters]");
  const status = document.getElementById("filterStatus");
  const pieceCards = Array.from(document.querySelectorAll(".fg-piece-card"));
  const galleries = Array.from(document.querySelectorAll(".fg-gallery"));
  const chronoGroups = Array.from(document.querySelectorAll(".fg-chrono-group"));
  const facetBtns = Array.from(document.querySelectorAll(".fg-facet-btn"));
  const facetOptions = Array.from(document.querySelectorAll(".fg-facet-option"));

  const activeFilters = new Map();
  let searchQuery = "";
  let debounceTimer = null;

  function closeAllDropdowns() {
    for (const btn of facetBtns) {
      btn.setAttribute("aria-expanded", "false");
      const dropdown = document.getElementById(btn.getAttribute("aria-controls"));
      if (dropdown) dropdown.hidden = true;
    }
  }

  function renderActiveChips() {
    if (!activeFiltersContainer) return;
    const chips = [];
    for (const [group, value] of activeFilters) {
      chips.push(`
        <button class="fg-filter-chip" type="button" data-chip-group="${escapeAttr(group)}" data-chip-value="${escapeAttr(value)}">
          <span>${value}</span>
          <span class="fg-filter-chip-x" aria-hidden="true">\u00d7</span>
        </button>
      `);
    }
    activeFiltersContainer.innerHTML = chips.join("");

    const chipButtons = activeFiltersContainer.querySelectorAll(".fg-filter-chip");
    for (const chip of chipButtons) {
      chip.addEventListener("click", () => {
        const group = chip.dataset.chipGroup;
        activeFilters.delete(group);
        applyFilters();
      });
    }
  }

  function applyFilters() {
    const hasSearch = searchQuery.length > 0;
    const hasFacet = activeFilters.size > 0;
    const hasAnyFilter = hasSearch || hasFacet;

    if (resetButton) {
      resetButton.hidden = !hasAnyFilter;
    }

    renderActiveChips();

    for (const option of facetOptions) {
      const group = option.dataset.filterGroup;
      const value = option.dataset.filterValue;
      const isActive = activeFilters.get(group) === value;
      option.classList.toggle("is-active", isActive);
    }

    for (const card of pieceCards) {
      let visible = true;

      if (hasSearch) {
        const searchable = card.dataset.searchable || "";
        visible = searchable.includes(searchQuery);
      }

      if (visible && hasFacet) {
        for (const [group, value] of activeFilters) {
          if (card.dataset[group] !== value) {
            visible = false;
            break;
          }
        }
      }

      card.classList.toggle("fg-piece-card--hidden", !visible);
    }

    let totalVisible = 0;

    for (const gallery of galleries) {
      const cards = Array.from(gallery.querySelectorAll(".fg-piece-card"));
      const visibleCount = cards.filter((c) => !c.classList.contains("fg-piece-card--hidden")).length;
      gallery.hidden = visibleCount === 0;
      totalVisible += visibleCount;

      const countNode = gallery.querySelector("[data-work-count]");
      if (countNode) {
        countNode.textContent = hasAnyFilter
          ? formatWorkCount(visibleCount, true)
          : gallery.dataset.workCountLabel || "";
      }
    }

    for (const group of chronoGroups) {
      const visibleGalleries = Array.from(group.querySelectorAll(".fg-gallery")).filter((g) => !g.hidden);
      group.hidden = visibleGalleries.length === 0;
    }

    if (status) {
      if (!hasAnyFilter) {
        status.textContent = "Viewing the full collection";
      } else {
        const parts = [];
        if (hasSearch) parts.push(`"${searchQuery}"`);
        for (const [, value] of activeFilters) parts.push(value);
        status.textContent = `Showing ${totalVisible} ${totalVisible === 1 ? "work" : "works"} matching ${parts.join(" + ")}`;
      }
    }
  }

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = (searchInput.value || "").trim().toLowerCase();
        applyFilters();
      }, 200);
    });
  }

  // Facet button toggles
  for (const btn of facetBtns) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasExpanded = btn.getAttribute("aria-expanded") === "true";
      closeAllDropdowns();
      if (!wasExpanded) {
        btn.setAttribute("aria-expanded", "true");
        const dropdown = document.getElementById(btn.getAttribute("aria-controls"));
        if (dropdown) dropdown.hidden = false;
      }
    });
  }

  // Facet option clicks
  for (const option of facetOptions) {
    option.addEventListener("click", () => {
      const group = option.dataset.filterGroup;
      const value = option.dataset.filterValue;

      if (activeFilters.get(group) === value) {
        activeFilters.delete(group);
      } else {
        activeFilters.set(group, value);
      }

      closeAllDropdowns();
      applyFilters();
    });
  }

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".fg-facet")) {
      closeAllDropdowns();
    }
  });

  // Reset button
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      activeFilters.clear();
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      applyFilters();
    });
  }

  applyFilters();
}

/* ---------------------------------------------------------------
   Preview hydration (IntersectionObserver)
   --------------------------------------------------------------- */

function hydrateLobbyPreviews() {
  // Immediately load hero iframe
  const heroFrames = Array.from(document.querySelectorAll("iframe.hero-frame[data-preview-src]"));
  for (const frame of heroFrames) {
    const src = frame.dataset.previewSrc;
    if (src) {
      frame.src = src;
      delete frame.dataset.previewSrc;
    }
  }

  // Use IntersectionObserver for lazy-loaded iframes
  const lazyFrames = Array.from(document.querySelectorAll("iframe.new-addition-frame[data-preview-src]"));
  if (!lazyFrames.length) return;

  let loadIndex = 0;
  const STAGGER_DELAY = 200;

  function loadFrame(frame) {
    const src = frame.dataset.previewSrc;
    if (!src) return;

    const delay = loadIndex * STAGGER_DELAY;
    loadIndex++;

    if (delay === 0) {
      frame.src = src;
      delete frame.dataset.previewSrc;
    } else {
      setTimeout(() => {
        frame.src = src;
        delete frame.dataset.previewSrc;
      }, delay);
    }
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const ioEntry of entries) {
          if (ioEntry.isIntersecting) {
            observer.unobserve(ioEntry.target);
            loadFrame(ioEntry.target);
          }
        }
      },
      { rootMargin: "200px 0px" }
    );

    for (const frame of lazyFrames) {
      observer.observe(frame);
    }
  } else {
    // Fallback: load all with stagger
    for (const frame of lazyFrames) {
      loadFrame(frame);
    }
  }
}

/* ---------------------------------------------------------------
   Main export
   --------------------------------------------------------------- */

export function renderMuseumLobby(lobby, pieces) {
  const sections = buildSections(lobby, pieces);
  const sectionGroups = buildSectionGroups(lobby, sections);
  const entries = sections.flatMap((s) => s.items);
  const recentAdditions = buildRecentAdditions(pieces, sections);
  const featuredPiece = pickFeaturedPiece(lobby, sections);
  const browseGroups = [
    { id: "era", title: "Era", items: buildBrowseItems("era", ERA_ORDER, entries) },
    { id: "region", title: "Region", items: buildBrowseItems("region", REGION_ORDER, entries) },
    { id: "artist", title: "Maker", items: buildBrowseItems("artist", ARTIST_ORDER, entries) },
    {
      id: "gallery",
      title: "Gallery",
      items: sections.map((s) => ({ label: s.title, value: s.title, count: s.workCount }))
    }
  ];

  document.body.innerHTML = `
    <a class="skip-link" href="#fg-collection">Skip to collection</a>
    ${renderHeader(lobby)}
    <main class="fg-main">
      ${renderHero(lobby, featuredPiece)}
      ${renderRecentSection(recentAdditions)}
      ${renderFilterSection(lobby, browseGroups)}
      ${renderTimeline(sectionGroups)}
      ${renderCollection(sectionGroups)}
    </main>
  `;

  bindLobbyFilters();
  hydrateLobbyPreviews();
  restoreHashPosition();
}
