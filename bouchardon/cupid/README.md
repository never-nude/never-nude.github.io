# Bouchardon Cupid - 3D Viewer

Standalone browser viewer for Edme Bouchardon's *Cupid cutting his bow from the club of Hercules*.

## Build mesh dataset

```bash
cd "/Users/michael/Documents/New project/BouchardonCupid"
python3 build_cupid_mesh.py
```

Optional quality controls:

```bash
CUPID_TRIANGLE_STRIDE=6 CUPID_GRID_RESOLUTION=280 CUPID_MAX_FACES=42000 python3 build_cupid_mesh.py
```

## Run locally

```bash
cd "/Users/michael/Documents/New project/BouchardonCupid"
python3 -m http.server 8040
```

Open: [http://localhost:8040](http://localhost:8040)
