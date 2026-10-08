# Adventure reference data

`cycle-1.json` … `cycle-5.json` contain all named entries in the supplied tracking PDFs: 36 hubs / 255 hub stories, 50 R&R entries, 30 Pharos entries and the extra event/code tracks. Titles and long Pharos identifiers are extracted as strings; leading zeros and printed spelling are preserved. Parenthesized table header numbers are Storybook pages, not four-digit secret codes.

Hub definitions link to `../cycle-sheets` using `trackId`. Campaign progress boxes and replay Fated Boxes are different tracks: there may be seven story choices but only four visits in one campaign. Cycles IV/V have side-specific Story selection columns. Tutorial, Ten Thousand Nights and Days, and Sermons on the Shoals still await story lists; their sheet-defined progress boxes are retained.

Run `/path/to/python-with-pymupdf scripts/extract-adventures.py --check` to verify against `../ato_docs/adventures`. Source hashes and page rectangles are recorded for each definition. `scripts/extract-cycle-sheets.py` reads these files to enrich its story references, so regenerating sheets retains the new links. Rendered PDFs were reviewed alongside extracted rows and checkboxes.

`rules.json` captures the user guide, confirmed rulebook rules, scope of the implemented tracker and deferred narrative automation. It explicitly preserves prior app decisions where the pasted guide conflicts. No complete story text, branches, adventure traits or test outcomes are invented.
