#!/usr/bin/env python3
"""Apply Warfare unit icon glyphs (arrow/sword/sling/horse) to main.js.

- Copies icons into ./assets/
- Patches main.js to load and render icons for arc/inf/skr/cav.
- Keeps GEN as the star glyph.
- Falls back to the existing text symbols if icons fail to load.

Run from inside your published folder (bannerfall/ or polemos/):
  python3 apply_unit_icons_patch.py
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / 'main.js'
ASSET_SRC = ROOT / '_icon_patch_assets'
ASSET_DST = ROOT / 'assets'

if not MAIN.exists():
    raise SystemExit('ERROR: main.js not found in this folder. Run this inside bannerfall/ (or polemos/).')

if not ASSET_SRC.exists():
    raise SystemExit('ERROR: _icon_patch_assets folder missing (zip extraction incomplete).')

# --- Copy icon assets
ASSET_DST.mkdir(exist_ok=True)
for name in ['icon_arc.png', 'icon_inf.png', 'icon_skr.png', 'icon_cav.png']:
    src = ASSET_SRC / name
    if not src.exists():
        raise SystemExit(f'ERROR: Missing {name} in _icon_patch_assets/')
    shutil.copy2(src, ASSET_DST / name)

print('✅ Copied icons into ./assets/')

# --- Patch main.js
text = MAIN.read_text(encoding='utf-8')

# Insert/replace the icon-loader block.
ICON_START = '  // === UNIT ICONS (Berserker) ==='
ICON_END = '  // === END UNIT ICONS ==='

ICON_BLOCK = f"""
{ICON_START}
  // White-on-transparent PNGs rendered over blue/red token fills.
  // Cache-busted with BUILD_ID so Safari/GitHub Pages doesn’t haunt you.
  const UNIT_ICON_SOURCES = {{
    arc: 'assets/icon_arc.png', // Archer  -> arrow
    inf: 'assets/icon_inf.png', // Infantry -> sword
    skr: 'assets/icon_skr.png', // Skirmisher -> sling
    cav: 'assets/icon_cav.png', // Cavalry -> horse
  }};

  const UNIT_ICONS = {{}};
  let UNIT_ICONS_READY = false;

  function loadUnitIcons() {{
    const entries = Object.entries(UNIT_ICON_SOURCES);
    let remaining = entries.length;
    UNIT_ICONS_READY = false;

    for (const [type, src] of entries) {{
      const img = new Image();
      img.onload = () => {{
        remaining -= 1;
        if (remaining <= 0) {{
          UNIT_ICONS_READY = true;
          // Force a redraw once icons are in memory.
          try {{ draw(); }} catch (_) {{}}
        }}
      }};
      img.onerror = () => {{
        remaining -= 1;
        if (remaining <= 0) {{
          // Even if some fail, we can still draw (fallback to text).
          try {{ draw(); }} catch (_) {{}}
        }}
      }};
      img.src = `${{src}}?v=${{encodeURIComponent(BUILD_ID)}}`;
      UNIT_ICONS[type] = img;
    }}
  }}

  function unitIconReady(type) {{
    const img = UNIT_ICONS[type];
    return !!(img && img.complete && img.naturalWidth > 0);
  }}

  // Per-type tuning so icons feel proportional inside the token disc.
  const UNIT_ICON_TUNE = {{
    arc: {{ scale: 1.12, y: -0.08 }}, // a touch bigger + slightly up
    inf: {{ scale: 0.95, y:  0.00 }},
    skr: {{ scale: 0.95, y:  0.00 }},
    cav: {{ scale: 0.95, y:  0.00 }},
  }};

  loadUnitIcons();
{ICON_END}
""".strip('\n')

if ICON_START in text and ICON_END in text:
    # Replace existing block
    pat = re.compile(re.escape(ICON_START) + r'.*?' + re.escape(ICON_END), re.S)
    text = pat.sub(ICON_BLOCK, text)
else:
    # Insert after UNIT_BY_ID map declaration (most stable anchor)
    anchor = re.search(r"const\s+UNIT_BY_ID\s*=\s*new\s+Map\([^;]+;", text)
    if not anchor:
        raise SystemExit('ERROR: Could not find UNIT_BY_ID anchor to insert icons block.')
    insert_at = anchor.end()
    text = text[:insert_at] + "\n\n" + ICON_BLOCK + "\n" + text[insert_at:]

# Patch the draw() unit text block to use icons.
# We replace the section starting at "// Text (BIG)" up to the fillText(def.symbol...) line.

marker = "      // Text (BIG)"
idx = text.find(marker)
if idx == -1:
    raise SystemExit('ERROR: Could not find the "// Text (BIG)" marker in draw(). The code layout is different.')

# Find end of the existing fillText line
m_end = re.search(r"\n\s*ctx\.fillText\(def\.symbol,[^\n]*\);", text[idx:])
if not m_end:
    raise SystemExit('ERROR: Could not locate ctx.fillText(def.symbol, ...) line after the marker.')

block_end = idx + m_end.end()

NEW_DRAW_BLOCK = r"""
      // Unit mark (ICON preferred, text fallback)
      const def = UNIT_BY_ID.get(u.type);

      const img = UNIT_ICONS && UNIT_ICONS[u.type];
      const canIcon = (u.type !== 'gen') && unitIconReady && unitIconReady(u.type);

      if (canIcon) {
        const base = R * 0.95;
        const tune = (UNIT_ICON_TUNE && UNIT_ICON_TUNE[u.type]) ? UNIT_ICON_TUNE[u.type] : { scale: 0.95, y: 0 };
        const s = Math.floor(base * (tune.scale || 0.95));
        const yOff = Math.floor(R * (tune.y || 0));

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, Math.floor(h.cx - s / 2), Math.floor(h.cy - s / 2 + yOff), s, s);
      } else {
        // Original text symbols (kept as a fallback)
        const textScale = (u.type === 'inf' || u.type === 'cav' || u.type === 'skr') ? 0.83 : 1.0;
        const fontPx = Math.floor(R * 0.55 * textScale);
        ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = c.text;
        ctx.fillText(def.symbol, h.cx, h.cy + 1);
      }
""".strip('\n')

text = text[:idx] + NEW_DRAW_BLOCK + text[block_end:]

# Write backup + new file
bak = MAIN.with_suffix(f".js.bak_{datetime.now().strftime('%Y%m%d-%H%M%S')}")
shutil.copy2(MAIN, bak)
MAIN.write_text(text, encoding='utf-8')

print(f"✅ Patched main.js (backup: {bak.name})")
print("Done.")
