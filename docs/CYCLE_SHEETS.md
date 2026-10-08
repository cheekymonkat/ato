# Cycle sheets: extracted data and future page design

The ten `ATO_C#_ArgoSheet_FRONT/BACK.pdf` files in `../ato_docs/sheets` are the
primary sources. The extraction covers Adventure Tracks, Cargo/Hidden Hold,
Voyage Timeline, Choice Matrix and the additional back-sheet tracks. Existing
Argo, Diplomacy, Titan and Evolution features keep their own definitions.

The [data index](../data/reference/cycle-sheets/manifest.json) links five readable
cycle files and a shared [resource registry](../data/reference/cycle-sheets/resources.json).
There are 39 adventure tracks with 184 boxes, 65 resource SVGs including the
generic Cores icon, and 437 timeline rows. Data and artwork are prepared for later
implementation; this extraction introduces no screen or saved-state changes.

## Sources and evidence

Every cycle file records the source filename, SHA-256, page number and rotation.
Coordinates use upright landscape PDF points, origin top-left, with rectangles
`[x0, y0, x1, y1]`. Fronts rotate 270° and backs rotate 90°; both become
841.890 × 595.276 pt. These coordinates are evidence and layout references,
not device pixels. Do not stretch an entire sheet into a phone screen.

The [supplied rulebook](https://drive.google.com/file/d/1vPofVQlG_j_nA3v63YWnU9WsMovJ-uxb/view)
clarifies timing on printed pp. 14–15, resource categories on p. 19, and
Choice Matrix/adventure hubs on pp. 25–26. The sheet is authoritative for the
cycle's labels, counts and day schedule. Detailed cycle-specific track rules
will come from the relevant storybook or later user instructions.

| Cycle | Printed sheet title | Adventure tracks / boxes | Timeline rows | Choice Matrix |
| --- | --- | --- | --- | --- |
| I | Truth of the Labyrinth | 8 / 36 | 87: T0–T5, T6/00, 01–80 | A–Z, Aa–Bb; 336 cells |
| II | Abysswatchers | 8 / 32 | 81: 00–80 | A–Z, Aa–Bb; 336 cells |
| III | Pitiless of the Sun | 7 / 32 | 91: 00–90 | A–Z, Aa–Bb; 336 cells |
| IV | Gardens of Infinite Growth | 8 / 43 | 97: 00–96 | A–Z, Aa–Ff; 384 cells |
| V | Truthsayer | 8 / 41 | 81: 00–80 | A–Z, Aa–Ff; 384 cells |

The PDF text layer sometimes breaks a word across lines. Resource names join
those fragments (Hydradynamic, Photophobic, Burned-out), and matching tolerates
typographic apostrophes. Cycle IV's **Promised Future's Carcass** and Cycle V's
**Promised Futures Carcass** share a registry identity and icon; each cycle retains
its printed label, and the alternate spelling is an alias. This mapping follows
the matching resource artwork and names on the sheets.

## Shared visual language

Use the app's existing theme: `paper` #FAF9F6 for cards, `canvas` #F3F2EF,
`panel` #E6E3DB for inset areas, `ink` #292723, `line` #D1CDC3 and the existing
serif headings. Use the established tab/button components and spacing so these
pages sit naturally beside Technology and Argo.

Keep printed icon silhouettes and ordered tracks. Surround them with normal app
controls and accessible hit areas. Suggested control size is at least 44 × 44
logical pixels, even when the visible square or resource icon is smaller. Selection
should include a check/X or filled square as well as colour. Use consistent focus
rings and readable contrast.

On a phone, use a single column of panels. Wider screens may add columns based on
the available panel width. A ten-box adventure track may span two panels' worth
of width. Keep each ordered track together; scroll its row horizontally if needed.

## Adventure Tracks

`adventureTracks[]` contains stable cycle-local IDs, titles, `progressBoxCount`,
source order, intended row/column placement, title coordinates and every box's
coordinates/label. The supplied adventure trackers now enrich `storyReferences`
for all 36 ordinary hubs; each named story links to its entry and Storybook page
in `data/reference/adventures`. Tutorial and the two ten-box special tracks remain
`awaiting-user-list`. The Adventures page is implemented; see [ADVENTURES.md](ADVENTURES.md).

The first **α** and last **Ω** squares are included in the count. Ordinary tracks
have blank intermediate squares. **Ten Thousand Nights and Days** (IV) and
**Sermons on the Shoals** (V) each have ten labelled squares:

`α β γ δ ε λ ο σ ψ Ω`

The sixth is lambda and the seventh is omicron; this is the printed sequence,
not an inferred run through the Greek alphabet.

Printed squares use an irregular ink outline with heavier/tapered corners,
approximately 13.1 pt across and 1.8 pt gaps. Titles are centered directly above
the row. The [ProgressBox SVG](../assets/cycle-sheet-icons/ProgressBox.svg)
preserves a real blank outline from Cycle I. Greek glyphs can be text inside it;
use a font with complete Greek support. Use the per-box coordinates if an exact
printed arrangement is required.

Future behaviour: display title, progress row and `marked / total`. Reading a
story marks the next square. Completed hubs stay visible with all squares marked;
they cannot advance past the last square. Provide an explicit correction action
to undo the last mark without accidentally opening/reading another story. Attach
paragraphs later by stable track ID and box position, preserving existing marks.

## Cargo: Resources and Gear

The Cargo page needs two top-level tabs, **Resources** and **Gear**, using the same
tab design as the other pages. Gear retains the existing armory/inventory workflow.
Resources contains the current cycle's Main Cargo and Hidden Hold on the same
page, with distinct headings. Hidden Hold is a named storage section and should
remain readily accessible.

`cargo.groups[]` identifies category, hold and ordered resource references:

| Category | Representation | Location |
| --- | --- | --- |
| Mortal | Named nonnegative integer quantities; three resources per cycle | Main |
| Primordial | Named nonnegative integer quantities, including that cycle's Ambrosia variant | Main |
| Cores | Editable **name + quantity** entries; a Primordial subtype | Main |
| Divine | Named nonnegative integer quantities | Hidden |
| Rare Resources | Editable **name + quantity** entries | Hidden in I–II; Main in III–V |

The Cores icon is generic; do not collapse every named Core into one total.
Likewise Rare Resources is an expandable list rather than a single counter.
Named counters have no printed maximum. Reject negatives, allow larger whole
numbers, and disable minus at zero. A compact row can use `icon / name / − value +`;
on wider screens resource rows can form a grid grouped by category. Use a numeric
entry operation for larger adjustments. Custom list entries need their own stable
IDs, names and quantities; blank input must not create a resource.

Treat **Raw, Violent, Frozen, Mutable and Oxidized Ambrosia** as distinct cargo
resources. **Liquid Aether** is also a cargo resource. These are separate from
Argonaut combat token counters; editing cargo must not modify token counts.
Resources with identical registry IDs in multiple cycles share the same identity.
Their quantity/carry-over policy should be set when implementing cycle transitions;
this reference extraction does not introduce automatic grants, conversions or loss.

### Resource SVGs

[Preview all 65 icons](resource-icons-preview.svg). Individual files live under
`assets/resource-icons`, named from their resources in the same PascalCase style
as the existing SVG assets. The resource registry gives `iconKey`, `iconPath`,
categories, cycles, aliases and exact icon/label source coordinates.

These are original PDF Bézier paths, extracted without tracing a screenshot.
Labels, quantity boxes and ruled lines are excluded. Visible ink is normalized
to `#000000` with a small transparent padding and a scalable `viewBox`. The two
icons whose PDFs paint white details use SVG masks to make those details
transparent. Mask colours are named `black`/`white`; recolour only `#000000`
so the cutouts remain intact. Prefix mask IDs if mounting repeated inline SVG
instances in one DOM. SVGs contain no external fonts, embedded raster images or
links. Keep aspect ratio and use a consistent 24–32 px displayed size; do not
distort taller or wider silhouettes.

## Hidden resource tracks and tally notes

`cargo.hiddenTracks[]` preserves the back-sheet tracks, their box layout and the
resource icon printed in each reward square. These belong in Hidden Hold below
the Divine quantities. Their progress is distinct from the number of resource
items owned; the printed icons identify reward positions, not the current stock.

| Cycle | Track | Arrangement | Printed resource-icon positions |
| --- | --- | --- | --- |
| II | Pygmalion Track | 5 rows × 6 = 30 boxes | 3, 6, 9, 12, 15, 18, 21, 24, 27, 30 |
| III | Pygmalion Track | 1 × 6 | 3, 6 |
| IV–V | Pygmalion Track | 1 × 6 | 3, 6 |
| IV–V | Echo of Recollection Track | 1 × 6 | 3, 6 |

Reward squares are larger and have a heavier/doubled outline. Preserve that
distinction and their resource icon when marked. Source coordinates record their
actual size. The PDF paints some enlarged outlines twice; those duplicate paints
are counted as one physical box. Number multi-row progress in reading order.
Do not automatically add/spend Pygmalion Stones or Echoes until the reward rules
are provided; `automaticRewardRules` is deliberately null.

Cycles IV and V also have **Tally Marks**, captured as `cargo.hiddenNotes[]`
with six and seven printed lines respectively. Offer expanding free text in
Hidden Hold; the printed line count is a visual reference, not a character limit.
It does not define a new currency or an automatic resource quantity.

## Voyage Timeline

`timeline.days[]` records **every** printed day in order, including blank days.
Each entry has a stable ID, printed label, numeric day where applicable, tutorial
flag, markers, event/acclimation text and source coordinates. `T6/00` is one row,
not separate T6 and day 00. `printedColumnBreakBefore` preserves the sheet's
two-column reading order, useful for a faithful wider layout.

| Marker | Printed symbol / asset | Resolution step |
| --- | --- | --- |
| `battle` | Crossed swords / [TimelineBattle.svg](../assets/cycle-sheet-icons/TimelineBattle.svg) | Encounter |
| `structuralResearch` | Argo/temple / [StructuralBreakthrough.svg](../assets/cycle-sheet-icons/StructuralBreakthrough.svg) | Advancement |
| `battleResearch` | Cog / [BattleBreakthrough.svg](../assets/cycle-sheet-icons/BattleBreakthrough.svg) | Advancement |
| `specialEvent` | Printed event text | Story |
| `acclimation` | Number and printed card-change text | Exploration |

Multiple markers on one day are preserved; do not replace them with a single
day type. Acclimation card-number lists remain reference text, as requested.
Cycle IV's first Acclimation also records its printed lock icon, without inventing
an unlock test. Day 36 in IV includes a conditional Barren Aeons event and
Acclimation together. Day 92 in IV is blank; the later battles are on 91 and
93–96. The printed final day fades toward the bottom; `printedMuted` is visual
metadata and does not disable the day. V's end-of-timeline instruction points to
story **3749** and is stored separately from the day list.

Suggested row: square / day label / printed icons and text / optional expanding
notes. Display research marker meanings on selection, or with concise labels.
Use full-width taller rows for Acclimation/event text, so long text remains
readable without crossing adjacent days. Keep printed events distinct from editable
player notes. Blank notes start at one line and grow; opening the editor should
keep the currently selected day in view.

Future progression marks the next empty day, following the rulebook's sequence.
Allow an explicit correction operation for past day marks. Reaching the final
day must not silently wrap or fabricate an extra day. Cycle V uses its specific
end instruction; other cycles require their rulebook/storybook resolution.
Checking a day records progress and presents its reminders. It must not quietly
research technologies, change exploration decks, resolve a battle or apply story
outcomes; those need their own workflows later.

## Choice Matrix

Preserve the printed layout: twelve columns, in four triplets, and A–Z rows with
a visible gap before the supplemental Aa–Bb or Aa–Ff block. IDs are case-sensitive:
`A1` and `Aa1` are different cells. Each row/column's printed label centre is saved
so a future grid can reproduce the layout. Cell labels remain visible when marked.

Wide screens show the full matrix. On a phone, keep twelve columns and scroll
horizontally rather than wrapping cells into a different matrix. Suggested cells
are at least 44 px wide/high, with modest extra spacing between the triplets.
Keep row headings available while scrolling and provide a **Find node** shortcut
for references such as Bb12, highlighting and scrolling to the exact cell.

The user's requested gesture is **long press to toggle**, for both mark and clear.
A suggested threshold is 600 ms. Show a press-progress/focus indicator; cancel
when the pointer leaves, the user drags to scroll, or releases before the threshold.
Fire once per hold. Ordinary taps/clicks do not change state. Provide a screen-reader
action and a keyboard hold/explicit-confirmation alternative with the same guard
against accidental changes. Announce the cell ID and current marked state.

The rulebook says the Matrix persists through **all cycles**. Store selections
once per campaign keyed by exact cell ID. A new cycle exposes its available rows
but retains every previous selection. Explicit instruction to mark an already
marked node is idempotent; use separate `mark`, `clear` and UI `toggle` operations
so repeat story instructions cannot accidentally erase a choice. Advanced reversal
rules can add a third state later if required.

## Suggested future saved data

Keep static references bundled separately from campaign state. The following is
a proposed extension, not a migration implemented by this extraction:

```json
{
  "sheetProgress": {
    "cycles": {
      "1": {
        "adventures": { "c1-fated-conundrum": { "marked": 2 } },
        "timeline": { "c1-day-01": { "marked": true, "notes": "Player-added reminder" } },
        "hiddenTracks": {},
        "hiddenNotes": {}
      }
    },
    "choiceMatrix": { "A1": true, "Aa12": true }
  },
  "cargoResources": {
    "quantities": { "trireme": 2, "muscle-cluster": 4 },
    "cores": [{ "id": "owned-core-1", "name": "Named Primordial Core", "quantity": 1 }],
    "rare": [{ "id": "owned-rare-1", "name": "Named rare resource", "quantity": 1 }]
  }
}
```

Use default zero/empty state for missing optional fields. Save whole-number
quantities and progress bounds, reject stale-campaign/cycle edits, include the new
state in backups, and preserve earlier cycles when advancing. Reconcile the
existing shared-resource store during implementation so each resource has one
authoritative quantity; avoid maintaining two independent counters for crafting
and Cargo. Choice Matrix remains campaign-wide.

## Reproduction and checks

`scripts/extract-cycle-sheets.py` uses `PyMuPDF==1.28.2`. The reviewed
`extraction-spec.json` holds labels, expected box counts and event text; PDF
geometry supplies actual boxes, matrix IDs, day labels, timeline symbol paths and
resource glyphs. Icon detection uses reviewed path signatures with positional
constraints. If a new/revised PDF changes those signatures, inspect it visually
and update the extractor/spec instead of accepting an empty schedule.

```sh
python scripts/extract-cycle-sheets.py
python scripts/extract-cycle-sheets.py --check
node --test tests/cycle-sheets.test.mjs
```

Generation is deterministic. `--check` recomputes and verifies every generated
JSON/SVG file without modifying it. A custom source location is supported with
`--source-dir /path/to/sheets`. The source PDFs remain unchanged.

The icon contact sheet was rendered with `rsvg-convert` and visually compared with
the originals, including transparent cutouts. Programmatic checks cover source
hashes, exact adventure/hidden-track box counts, uninterrupted timeline labels,
printed milestones, per-cycle resource references and all Choice Matrix IDs.
Story paragraph lists, track reward rules and automatic event execution remain
explicit future inputs; none are inferred from artwork.
