import { museumLobby, museumPieces } from "./catalog.js";

function renderBootError(message, error) {
  console.error(error);
  document.body.innerHTML = `<p style="margin:16px;font-family:IBM Plex Sans, Avenir Next, sans-serif;color:#2f2a22;">${message}</p>`;
}

export async function initMuseumLobbyPage() {
  try {
    const { renderMuseumLobby } = await import("./lobby.js");
    renderMuseumLobby(museumLobby, museumPieces);
  } catch (error) {
    renderBootError("Failed to load the museum lobby.", error);
  }
}

export async function initMuseumPiecePage(pieceId) {
  const piece = museumPieces[pieceId];
  if (!piece) {
    renderBootError(`Unknown museum piece: ${pieceId}`, new Error(`Unknown museum piece: ${pieceId}`));
    return;
  }

  try {
    if (piece.kind === "stl") {
      const { initStlMuseumPage } = await import("./stl-viewer.js");
      await initStlMuseumPage(piece);
      return;
    }

    if (piece.kind === "sketchfab") {
      const { initSketchfabMuseumPage } = await import("./sketchfab-viewer.js");
      await initSketchfabMuseumPage(piece);
      return;
    }

    throw new Error(`Unsupported museum piece kind: ${piece.kind}`);
  } catch (error) {
    renderBootError(`Failed to initialize ${piece.viewerTitle}.`, error);
  }
}
