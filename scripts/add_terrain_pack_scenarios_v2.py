#!/usr/bin/env python3
import re
import sys
import shutil
from datetime import datetime

SNIPPET = r"""
// === Terrain Pack (Berserker) ===
// Adds terrain-focused variants of the existing Grand scenarios.
// Safe: if a base scenario is missing, we skip that entry.
(function addTerrainPack(){
  const add = (name, baseName, terrainMaker) => {
    const base = SCENARIOS[baseName];
    if (!base) {
      console.warn('[TerrainPack] Missing base scenario:', baseName);
      return;
    }
    if (SCENARIOS[name]) return;
    SCENARIOS[name] = {
      terrain: terrainMaker(),
      units: base.units || [],
    };
  };

  // A: central ridge with two passes
  add('Terrain A — Ridge Line (30v30, mirrored)', 'Grand A — Even Lines (30v30, mirrored)', () => {
    const t = [];
    for (let q=-30; q<=30; q++) {
      if (q === -2 || q === 2) continue; // passes
      t.push({q, r:0, terrain:'hills'});
      if (q % 3 === 0) t.push({q, r:-1, terrain:'hills'});
      if (q % 3 === 0) t.push({q, r:1, terrain:'hills'});
    }
    return t;
  });

  // B: wide woods belt with a clear road
  add('Terrain B — Woods Belt (28v28, mirrored)', 'Grand B — Center Push (28v28, mirrored)', () => {
    const t = [];
    for (let q=-30; q<=30; q++) {
      for (let r=-1; r<=1; r++) {
        if (q === 0) continue; // road
        t.push({q, r, terrain:'woods'});
      }
    }
    for (let q=-12; q<=-6; q++) t.push({q, r:-3, terrain:'woods'});
    for (let q=6; q<=12; q++) t.push({q, r:3, terrain:'woods'});
    return t;
  });

  // C: rough patches that punish cavalry lanes
  add('Terrain C — Broken Ground (30v30, mirrored)', 'Grand C — Double Envelopment (30v30, mirrored)', () => {
    const t = [];
    for (let q=-30; q<=30; q++) {
      if (Math.abs(q) < 3) continue;
      if (q % 2 === 0) {
        t.push({q, r:-2, terrain:'rough'});
        t.push({q, r:2, terrain:'rough'});
      }
    }
    for (let q=-10; q<=10; q++) {
      if (q % 3 === 0) t.push({q, r:0, terrain:'rough'});
    }
    return t;
  });

  // D: marshy edge (water) that anchors flanks
  add('Terrain D — Marsh Edge (26v26, mirrored)', 'Grand D — Massive Screen (26v26, mirrored)', () => {
    const t = [];
    for (let q=-30; q<=30; q++) {
      if (q % 5 === 0) continue;
      t.push({q, r:-4, terrain:'water'});
      t.push({q, r:4, terrain:'water'});
    }
    for (let q=-30; q<=30; q++) {
      if (q % 2 === 0) {
        t.push({q, r:-3, terrain:'rough'});
        t.push({q, r:3, terrain:'rough'});
      }
    }
    return t;
  });

  // E: mirrored river with three fords
  add('Terrain E — River Fords (24v24, mirrored)', 'Grand E — River Fords (24v24, mirrored)', () => {
    const t = [];
    const fords = new Set([-6, 0, 6]);
    for (let q=-30; q<=30; q++) {
      if (fords.has(q)) continue;
      t.push({q, r:0, terrain:'water'});
    }
    for (let q=-30; q<=30; q++) {
      if (q % 3 === 0) {
        t.push({q, r:-1, terrain:'rough'});
        t.push({q, r:1, terrain:'rough'});
      }
    }
    return t;
  });

  // F: a corridor of clear with rough walls
  add('Terrain F — Corridor Pass (22v22, mirrored)', 'Grand F — Corridor Pass (22v22, mirrored)', () => {
    const t = [];
    for (let r=-30; r<=30; r++) {
      for (let q=-30; q<=30; q++) {
        const inCorridor = (q >= -1 && q <= 1);
        if (!inCorridor && Math.abs(q) <= 8 && Math.abs(r) <= 4) {
          if ((q + r) % 2 === 0) t.push({q, r, terrain:'rough'});
        }
      }
    }
    for (let q=-4; q<=4; q+=2) {
      t.push({q, r:-2, terrain:'hills'});
      t.push({q, r:2, terrain:'hills'});
    }
    return t;
  });
})();
"""

def find_scenarios_object_range(js: str):
    m = re.search(r"\b(?:const|let|var)\s+SCENARIOS\s*=\s*\{", js)
    if not m:
        return None
    start_brace = m.end() - 1  # position of '{'
    i = start_brace
    depth = 0
    in_str = None
    in_comment = None
    esc = False

    while i < len(js):
        ch = js[i]
        nxt = js[i+1] if i+1 < len(js) else ""

        if in_comment == "line":
            if ch == "\n":
                in_comment = None
            i += 1
            continue

        if in_comment == "block":
            if ch == "*" and nxt == "/":
                in_comment = None
                i += 2
                continue
            i += 1
            continue

        if in_str:
            if esc:
                esc = False
            else:
                if ch == "\\":
                    esc = True
                elif ch == in_str:
                    in_str = None
            i += 1
            continue

        # not in string/comment
        if ch == "/" and nxt == "/":
            in_comment = "line"
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_comment = "block"
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end_brace = i
                return (start_brace, end_brace)
        i += 1

    return None

def main():
    if len(sys.argv) != 2:
        print("Usage: add_terrain_pack_scenarios_v2.py path/to/main.js", file=sys.stderr)
        return 2

    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        js = f.read()

    if "// === Terrain Pack (Berserker) ===" in js:
        print("Terrain Pack already present; no changes made.")
        return 0

    rng = find_scenarios_object_range(js)
    if not rng:
        print("ERROR: Could not find SCENARIOS = { ... } in file.", file=sys.stderr)
        return 1

    _, end_brace = rng

    # Find the semicolon after the closing brace
    j = end_brace + 1
    while j < len(js) and js[j] in " \t\r\n":
        j += 1
    if j < len(js) and js[j] == ";":
        insert_at = j + 1
    else:
        # fallback: insert right after the brace
        insert_at = end_brace + 1

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = f"{path}.bak_{ts}"
    shutil.copy2(path, bak)

    out = js[:insert_at] + "\n" + SNIPPET + "\n" + js[insert_at:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)

    print(f"✅ Patched: {path}")
    print(f"🧷 Backup:  {bak}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
