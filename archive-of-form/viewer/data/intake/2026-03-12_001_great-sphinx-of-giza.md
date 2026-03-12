# Sculpture Intake 001

- Project: The Archive of Form
- Subtitle: An Open Library of Sculptures from Antiquity to the Nineteenth Century
- Intake date: 2026-03-12
- Sculpture: Great Sphinx of Giza

## 1) Importance Eligibility

- Status: Eligible by importance
- Identity source: https://en.wikipedia.org/wiki/Great_Sphinx_of_Giza
- Structured entity source: https://www.wikidata.org/wiki/Q130958
- Verified period: Old Kingdom Egypt (c. 26th century BCE)
- Verified material: Limestone (stone-carved)

## 2) STL Data Availability Audit (No Ingest Yet)

Candidate A
- Source: https://sketchfab.com/3d-models/the-great-sphinx-of-giza-c126509af31142a9a0d116e264e7b629
- API record: https://api.sketchfab.com/v3/models/c126509af31142a9a0d116e264e7b629
- License: CC Attribution (CC BY 4.0)
- Downloadable flag: true
- Face count: 1,487,624
- Vertex count: 847,687
- Decision: Rejected (identity mismatch). The source description identifies this as a 1903 cast bronze model by Bert W. Longworth, not the ancient limestone monument itself.

Candidate B
- Source: https://sketchfab.com/3d-models/the-great-sphinx-of-giza-egypt-f169dbe7974648babe327179091e0ee3
- API record: https://api.sketchfab.com/v3/models/f169dbe7974648babe327179091e0ee3
- License: CC Attribution (CC BY 4.0)
- Downloadable flag: true
- Face count: 40,000
- Vertex count: 20,002
- Decision: Rejected (below density threshold). Fails project requirement for high-density ingest (preferred 300,000+ triangles).

Candidate C
- Source: https://sketchfab.com/3d-models/great-sphinx-of-giza-cairo-egypt-b2b6cd14feed451b9ca8a13ff1fe0ff6
- API record: https://api.sketchfab.com/v3/models/b2b6cd14feed451b9ca8a13ff1fe0ff6
- License: Standard (Sketchfab standard terms)
- Downloadable flag: false
- Face count: 379,092
- Vertex count: 202,266
- Decision: Rejected (license/access unusable). Density clears preferred threshold, but non-downloadable and non-open licensing makes ingest invalid for this project.

Query evidence
- Search endpoint used for candidate sweep: https://api.sketchfab.com/v3/search?type=models&q=Great%20Sphinx%20Giza&count=30

## 3) Ingest Decision

- Final STL availability status: Ineligible for ingest (current sources checked)
- Reason: No source currently satisfies all required conditions simultaneously:
  - Correct object identity (the ancient Great Sphinx itself)
  - Usable downloadable mesh for local pipeline
  - Usable license
  - High-density geometry threshold

## 4) Next Step

- Await user approval to proceed to Sculpture Intake 002 (Venus de Milo).
