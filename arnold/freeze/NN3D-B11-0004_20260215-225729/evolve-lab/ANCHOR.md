# EVOLVE-LAB — Anchor (truth + how to run)

This file exists to collapse ambiguity fast: what is running, where it is running from, and what URLs are real.

## Ground truth (canonical)
- Repo root (server root): `~/dev/nn3d`
- Project dir: `~/dev/nn3d/evolve-lab`
- Port: `8733`
- Server start (preferred): run from repo root:
  - `cd ~/dev/nn3d && ./server_8733.sh`
- Server fallback (also run from repo root):
  - `cd ~/dev/nn3d && python3 -m http.server 8733`

Truth signal: server tab shows GET logs when Safari loads a page.

## Canonical URLs (always use a cache-buster)
2D baseline (BUILD0001):
- `http://localhost:8733/evolve-lab/?v=BUILD0001&t=<unix>`

3D baseline (BUILD0002_SHIFT):
- `http://localhost:8733/evolve-lab/three/?v=BUILD0002_SHIFT&t=<unix>`

## Controls (current, intentionally explicit)
2D (BUILD0001):
- WASD / Arrows = move
- Click / Tap = spawn food
- Sprint = mouse-hold  (NOTE: control mismatch vs 3D; candidate for unification)

3D (BUILD0002_SHIFT):
- WASD / Arrows = move on plane
- Click / Tap = spawn food (3D ring)
- Shift = sprint
- R = reset

## Local vendor deps (pinned)
- Three.js module is served locally (no CDN dependency):
  - `evolve-lab/vendor/three.module.js` (three@0.160.0)

## Milestones (verified in-browser)
- BUILD0001 verified (2D): 2026-02-13 ~11:14
- BUILD0002_SHIFT verified (3D): 2026-02-13 ~12:23

## Freezes (restore points)
Stored in: `evolve-lab/_freezes/`

Restore rule:
- Restore/unzip into `~/dev/nn3d/` so paths match:
  - `~/dev/nn3d/evolve-lab/...`

## Milestone
- BUILD0012_MATES (verified): 3 mate archetypes with visible trait offers (color + badge), rare Prime mate with calm-court aura fill, C accept / X reject shame zigzag.
  URL: http://127.0.0.1:1083/evolve-lab/three12/?v=BUILD0012_MATES&t=<unix>
