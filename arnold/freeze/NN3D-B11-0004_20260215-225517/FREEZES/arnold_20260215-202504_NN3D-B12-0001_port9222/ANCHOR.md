# Arnold Anchor

Canonical folder:
- ~/dev/arnold

Canonical port (avoid drift with Metro):
- 9222

Two-tab discipline:
- SERVER tab: ./server_9222.sh
- WORK tab:   ./safari_9222.sh

Truth probes:
- Verify build marker in file:
  grep -n 'const BUILD' index.html | head -n 1

- Verify server is serving Arnold (not Metro):
  ./verify_9222.sh

Freeze log:
- FREEZES/LOG.md
- Each freeze also produces a tarball: FREEZES/<stamp>_<build>_port9222.tgz

Notes:
- If Terminal shows a '>' prompt, Ctrl+C to escape before running commands.
