function resolveLobbyEntry(entry, pieces) {
  if (typeof entry === "string") {
    const piece = pieces[entry];
    return {
      href: piece.path,
      title: piece.lobbyTitle,
      meta: piece.lobbyMeta,
      linkLabel: "Open viewer",
      note: piece.lobbyNote
    };
  }

  if (entry.pieceId) {
    const piece = pieces[entry.pieceId];
    return {
      href: entry.href || piece.path,
      title: entry.title || piece.lobbyTitle,
      meta: entry.meta || piece.lobbyMeta,
      linkLabel: entry.linkLabel || "Open viewer",
      note: entry.note || piece.lobbyNote
    };
  }

  return {
    href: entry.href,
    title: entry.title,
    meta: entry.meta,
    linkLabel: entry.linkLabel || "Open viewer",
    note: entry.note
  };
}

function renderEntry(entry) {
  return `
    <li>
      <a class="piece" href="${entry.href}">
        <h3 class="piece-title">${entry.title}</h3>
        <p class="piece-meta">${entry.meta}</p>
        <p class="piece-link">${entry.linkLabel}</p>
        ${entry.note ? `<p class="note">${entry.note}</p>` : ""}
      </a>
    </li>
  `;
}

export function renderMuseumLobby(lobby, pieces) {
  document.title = lobby.pageTitle || document.title;

  const sectionsHtml = lobby.sections
    .map((section) => {
      const itemsHtml = section.items.map((entry) => renderEntry(resolveLobbyEntry(entry, pieces))).join("");
      return `
        <section>
          <h2 class="section-title">${section.title}</h2>
          <p class="section-sub">${section.subtitle}</p>
          <ul class="list">${itemsHtml}</ul>
        </section>
      `;
    })
    .join("");

  document.body.innerHTML = `
    <div class="app lobby-app">
      <section class="panel">
        <h1 class="title">${lobby.title}</h1>
        <p class="sub">${lobby.subtitle}</p>
      </section>

      <section class="stage">${sectionsHtml}</section>
    </div>
  `;
}
