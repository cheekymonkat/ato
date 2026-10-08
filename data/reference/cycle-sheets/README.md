# Cycle sheet reference data

These are static definitions extracted from the ten official front/back PDFs in
`ato_docs/sheets`. Cargo, Timeline and Choice Matrix definitions are ready for later
page implementation. Hub definitions now link to the supplied story trackers in
`../adventures`; the app uses those definitions on its Adventures page.

- [manifest.json](manifest.json): file index, counts, source coordinate convention and rulebook references.
- `cycle-1.json` through `cycle-5.json`: adventure tracks, cargo groups, hidden tracks, every timeline day, and matrix layout.
- [resources.json](resources.json): resource identities, categories, SVG paths, aliases and per-cycle source locations.
- [extraction-spec.json](extraction-spec.json): reviewed labels, counts and event text used by the repeatable extractor.
- [Design and implementation guide](../../../docs/CYCLE_SHEETS.md).
- [Resource icon preview](../../../docs/resource-icons-preview.svg).

Files use their own `schemaVersion: 1`. This is a reference-data schema, separate
from the app's catalogue and campaign schemas. Do not pass these files to the card
catalogue importer or alter catalogue versions to accommodate them.

Regenerate using Python with `PyMuPDF==1.28.2` installed:

```sh
python scripts/extract-cycle-sheets.py
python scripts/extract-cycle-sheets.py --check
```

Run those commands from the app root. `--source-dir` can point at another copy of
the sheet folder. The extractor verifies PDF box counts, every printed day label,
matrix cell identities and source hashes; `--check` also compares all generated
JSON/SVG files without writing them. Regenerate `scripts/extract-adventures.py`
first, then regenerate these sheets to retain the supplied story-reference links.
Tutorial and the ten-box special tracks still await story lists.
