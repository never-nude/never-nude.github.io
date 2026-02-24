#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re, shutil, sys

MAIN = Path("main.js")
if not MAIN.exists():
    print("ERROR: main.js not found. Run inside bannerfall/ or polemos/ folder.")
    sys.exit(1)

text = MAIN.read_text(encoding="utf-8")

ts = datetime.now().strftime("%Y%m%d-%H%M%S")
bak = MAIN.with_suffix(f".js.bak_{ts}")
shutil.copy2(MAIN, bak)

# 1) Ensure UNIT_ICON_TUNE.inf has a rot value (radians).
# Canvas positive = clockwise (because y is down). We want counterclockwise ~35.3° => -0.616 rad.
ROT_VAL = "-0.616"

m = re.search(r"(const\s+UNIT_ICON_TUNE\s*=\s*\{)(.*?)(\}\s*;)", text, re.S)
if not m:
    print("ERROR: Couldn't find `const UNIT_ICON_TUNE = { ... };` block.")
    sys.exit(1)

head, body, tail = m.group(1), m.group(2), m.group(3)

def patch_inf(match: re.Match) -> str:
    inner = match.group(2)
    if "rot" in inner:
        inner2 = re.sub(r"rot\s*:\s*[-0-9.]+", f"rot: {ROT_VAL}", inner)
    else:
        inner2 = inner.rstrip()
        if inner2.strip() and not inner2.strip().endswith(","):
            inner2 += ","
        inner2 += f" rot: {ROT_VAL} "
    return match.group(1) + inner2 + match.group(3)

new_body, n = re.subn(r"(inf\s*:\s*\{)([^}]*)(\})", patch_inf, body, count=1, flags=re.S)
if n != 1:
    print("ERROR: Couldn't patch the `inf: { ... }` entry inside UNIT_ICON_TUNE.")
    sys.exit(1)

text = text[:m.start()] + head + new_body + tail + text[m.end():]

# 2) Replace the icon draw snippet with a rotation-aware version (once).
if "ctx.rotate(rot)" not in text:
    pat = re.compile(
        r"(?P<indent>[ \t]*)ctx\.imageSmoothingEnabled\s*=\s*true;\s*\n"
        r"[ \t]*ctx\.drawImage\(\s*img\s*,\s*Math\.floor\(h\.cx\s*-\s*s\s*/\s*2\)\s*,\s*"
        r"Math\.floor\(h\.cy\s*-\s*s\s*/\s*2\s*\+\s*yOff\)\s*,\s*s\s*,\s*s\s*\);\s*",
        re.M
    )
    mm = pat.search(text)
    if not mm:
        print("ERROR: Couldn't find the icon ctx.drawImage(...) snippet to patch.")
        sys.exit(1)

    indent = mm.group("indent")
    repl = (
        f"{indent}const rot = (typeof tune.rot === 'number') ? tune.rot : 0;\n\n"
        f"{indent}ctx.imageSmoothingEnabled = true;\n"
        f"{indent}if (rot) {{\n"
        f"{indent}  ctx.save();\n"
        f"{indent}  ctx.translate(Math.floor(h.cx), Math.floor(h.cy + yOff));\n"
        f"{indent}  ctx.rotate(rot);\n"
        f"{indent}  ctx.drawImage(img, Math.floor(-s / 2), Math.floor(-s / 2), s, s);\n"
        f"{indent}  ctx.restore();\n"
        f"{indent}}} else {{\n"
        f"{indent}  ctx.drawImage(img, Math.floor(h.cx - s / 2), Math.floor(h.cy - s / 2 + yOff), s, s);\n"
        f"{indent}}}\n"
    )

    text = pat.sub(repl, text, count=1)

MAIN.write_text(text, encoding="utf-8")

print("✅ Patched main.js for vertical infantry sword.")
print(f"Backup: {bak.name}")
