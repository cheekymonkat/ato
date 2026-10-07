# Gear image assets

The 31 supplied scans provide 557 Gear faces, split into individual rounded
PNGs. Filenames follow the Gear names, using lowercase and hyphens:
`puzzle-axe.png`, `temenos-scale-umbrella.png`, and so on.

`assets/gear-art/<batch>/` contains the artwork-only backgrounds. All printed
titles, stats, icons, rules, gates and footer text are masked to sampled paper;
the app renders them as live UI. `grayscale/` contains equivalent grayscale
images for exhausted/discarded cards. The original scan is unchanged, and
retained artwork pixels are copied without resampling.

## Data relationship and rendering

Every linked Gear face in the generated catalogue has an optional `artwork`
object containing `image`, `grayscaleImage`, pixel dimensions and `artBottom`.
Links use the stable definition ID and `front`/`back` face ID; names are used
for filenames, not for runtime guesses. For example, Temenos Xiphos and Temenos
Whip share a definition but have separate images. A face without supplied art
continues to use the existing card layout.

`GearCard` displays the appropriate background behind its existing live title,
stats and icons. It reserves room for the illustration and retains every rule,
gate and printed ID below it. The background keeps its original aspect ratio
as card width changes; long ability text can extend the card. Existing secret
visibility and keyword actions remain part of the live UI.

The static asset registry in `src/components/cards/gear-art-assets.ts` ensures
the images are bundled on web, iOS and Android. It is generated alongside the
ID/face links in `src/catalogue/gear-art.ts` and the image manifest. Generated
catalogue version 2 includes artwork links in its content digest and accepts
version 1 catalogues without artwork.

## Reproduce or extend

Requires Python 3 and `djpeg` from libjpeg, with no Python packages:

```sh
python3 scripts/extract-gear-art.py
npm run catalogue:import
npm run catalogue:check
```

Without arguments the extractor processes configurations whose original scans
are still present, then merges all completed batch manifests. Removed source
scans are not required to use or validate completed assets. Their recorded
hashes, masks, identities and PNG hashes remain in the conversion records;
restore the exact source JPEG if that batch needs regenerating. An explicitly
selected batch requires its source scan. To regenerate selected scans, repeat `--batch`:

```sh
python3 scripts/extract-gear-art.py --batch epson-210624 --batch epson-211018 --batch epson-211609
```

Both commands merge **all** batch manifests into the shared registries, retaining
existing face links. A changed configuration must be regenerated first; manifests
record its SHA-256 as well as the source image hash. Duplicate definition/face
links fail explicitly rather than silently replacing another batch.

The source SHA-256 and all source-pixel crop rectangles, artwork polygons and
erase rectangles are in `data/reference/gear-art-cycle2-a.json`. The extractor
checks the scan hash and catalogue mappings before processing, copies selected
source pixels, fills the remaining regions from a clean paper sample, and adds
antialiased rounded alpha corners. It generates ready/grayscale assets,
manifests and static registries. Future scans need their own reviewed coordinates
and mappings. The recorded title rectangles are reference coordinates only;
titles are not retained in final images.

## Current batches

| Batch | Source under `../ato_docs/` | Source size | Linked faces |
| --- | --- | --- | --- |
| `cycle2-a` | `cycle2_a.jpg` | 3,396 × 2,232 | 21 |
| `epson-210624` | `Epson_04102026210624.jpg` | 3,510 × 2,550 | 21 |
| `epson-211018` | `Epson_04102026211018.jpg` | 3,396 × 2,238 | 20 |
| `epson-211609` | `Epson_04102026211609.jpg` | 3,384 × 1,494 | 13 |
| `epson-105748` | `ato-gear/cycle 1/Epson_05102026105748.jpg` | 3,396 × 2,238 | 21 |
| `epson-110215` | `ato-gear/cycle 1/Epson_05102026110215.jpg` | 3,396 × 2,232 | 21 |
| `epson-110738` | `ato-gear/cycle 1/Epson_05102026110738.jpg` | 3,402 × 1,494 | 13 |
| `epson-185551` | `ato-gear/Epson_05102026185551.jpg` | 3,390 × 2,232 | 21 |
| `epson-185936` | `ato-gear/Epson_05102026185936.jpg` | 3,390 × 2,238 | 20 |
| `epson-212452` | `ato-gear/Epson_05102026212452.jpg` | 3,408 × 2,244 | 21 |
| `epson-213909` | `ato-gear/Epson_05102026213909.jpg` | 3,396 × 2,262 | 21 |
| `epson-214451` | `ato-gear/Epson_05102026214451.jpg` | 3,390 × 2,250 | 21 |
| `epson-215042` | `ato-gear/Epson_05102026215042.jpg` | 3,396 × 2,250 | 21 |
| `epson-215411` | `ato-gear/Epson_05102026215411.jpg` | 3,396 × 2,232 | 21 |
| `epson-215757` | `ato-gear/Epson_05102026215757.jpg` | 3,390 × 1,482 | 2 |
| `epson-06102026175715` | `ato-gear/gear/Epson_06102026175715.jpg` | 3,408 × 2,250 | 21 |
| `epson-06102026180828` | `ato-gear/gear/Epson_06102026180828.jpg` | 3,390 × 2,238 | 20 |
| `epson-06102026183814` | `ato-gear/gear/Epson_06102026183814.jpg` | 3,384 × 2,232 | 21 |
| `epson-06102026184207` | `ato-gear/gear/Epson_06102026184207.jpg` | 3,396 × 2,244 | 19 |
| `epson-06102026191222` | `ato-gear/gear/Epson_06102026191222.jpg` | 3,396 × 2,232 | 21 |
| `epson-06102026191619` | `ato-gear/gear/Epson_06102026191619.jpg` | 3,378 × 2,238 | 21 |
| `epson-06102026192724` | `ato-gear/gear/Epson_06102026192724.jpg` | 3,396 × 2,244 | 20 |
| `epson-06102026193136` | `ato-gear/gear/Epson_06102026193136.jpg` | 3,408 × 2,244 | 20 |
| `epson-06102026194506` | `ato-gear/gear/Epson_06102026194506.jpg` | 3,426 × 2,238 | 20 |
| `epson-06102026194705` | `ato-gear/gear/Epson_06102026194705.jpg` | 3,510 × 2,550 | 2 |
| `epson-07102026101950` | `ato-gear/gear/Epson_07102026101950.jpg` | 3,390 × 2,226 | 21 |
| `epson-07102026102316` | `ato-gear/gear/Epson_07102026102316.jpg` | 3,408 × 2,244 | 21 |
| `epson-07102026102736` | `ato-gear/gear/Epson_07102026102736.jpg` | 3,408 × 2,244 | 21 |
| `epson-07102026103125` | `ato-gear/gear/Epson_07102026103125.jpg` | 3,396 × 2,238 | 21 |
| `epson-07102026103350` | `ato-gear/gear/Epson_07102026103350.jpg` | 3,510 × 2,550 | 1 |
| `epson-07102026103838` | `ato-gear/gear/Epson_07102026103838.jpg` | 3,396 × 1,494 | 9 |

## Conversion record: Gear subfolder scans

Added on 7 October 2026 from the 16 JPEGs directly inside
`../ato_docs/ato-gear/gear/`. Their 282 photographed faces supply 279 new
artwork links and 558 ready/grayscale PNGs. Garden Activator is photographed
twice; its second copy is recorded without an extra link. The two Pantheon
continuation cards are preserved as rounded original crops, rather than being
invented as reverse sides of the catalogue's single-face definitions.

The conversion uses the same exact source-pixel workflow. Each scan has its
own SHA-256, native card crops, sampled paper, reviewed artwork bounds,
printed-content masks, rounded corners and output hashes. Observed footer IDs
are recorded where legible. These identify similarly named Cycle IV and Mnestis
Theatre variants independently, including Gaiaegis, Midashield, First Blade,
Blades of Rage and Slushbane. Generated variants use their canonical catalogue
names in filenames. No card identities, supply counts or rules are changed.

Phantom Spear/Strikeback, Lesser/Greater Saphos, Dahaka Blade/Blindspot/Cloud and
both Atlantean Gun/Lance variants retain independent front and flipped-side
backgrounds. Several Mnestis cards print rules over very faint illustrations.
Only exposed artwork is retained; covered artwork is not reconstructed. The
individual conversion notes describe these overlaps. Original JPEGs remain
unchanged, with original crops and review strips under
`../ato_docs/gear-art/<batch>/`.

Validation: all 365 domain tests, catalogue reproducibility, lint and type
checking passed. Expo exported web, iOS and Android bundles successfully. An
independent pixel check covered all 101,020,474 pixels across the 279 new faces:
each RGB pixel equals either the original scan pixel or the recorded paper
sample, and grayscale luminance/alpha match. All 278 previous artwork links
remain unchanged, as do the catalogue's 3,014 definitions and 3,217 faces.

Regenerate any listed batch by repeating `--batch <batch>` as above, then run:

```sh
npm run catalogue:import
npm run gear-art:report
```

## Missing-image report

[`docs/reports/missing-gear-art.csv`](reports/missing-gear-art.csv) contains one
row per missing Gear face. It includes the Gear name, cycle, recipe technology,
secret-card number, missing side and side name, available opposite side,
acquisition, printed IDs and persistent definition ID. A single-sided card
does not get an invented flipped-side entry. Technologies are joined by printed
recipe ID first; name matching is used only for a unique definition in the same
cycle. Unknown technologies and secret numbers are left empty.

The report checks that linked colour assets exist. Fists remains listed as
default unarmed gear without supplied artwork; Eschaton Stones is explicitly
marked as having no illustration in its supplied scan. Rows are ordered by
cycle descending, then name. The CSV is UTF-8 with a BOM and quoted fields for
Excel compatibility. Regenerate it
with `npm run gear-art:report`; an optional output path can be supplied after `--`.
The 7 October report has 56 missing sides across 55 definitions: 55 fronts and
one flipped side. A copy is also saved at
`../ato_docs/gear-art/missing-gear-art.csv` beside the conversion records.

## Conversion record: 4 October Epson scans

The three Epson scans were added on 4 October 2026 using the same deterministic
artwork-only extraction. Their 55 physical faces yield 54 new artwork links:
Muck Armor appears twice (BJ0919 and BJ0920), so the first crop supplies its
shared face and the second is recorded in `skippedCards`. The last scan has an
empty lower-left grid position. Neither blank space nor duplicate copies create
additional catalogue definitions or player instances.

Each batch has its own `data/reference/gear-art-<batch>.json`, asset directory
and manifest, and original/review directory under `../ato_docs/gear-art/`.
Observed footer IDs are recorded in `sourcePrintedIds` where visible. This
selects the Cycle II Chain Whip (BJ0874), independently of the other Chain Whip
definition (BR0729). Metasword/Metabow, Ladder Buckler/Ladder Mode and Boom
Spear/Boom Pole keep separate images on their existing front/back faces.

## Conversion record: Root-level Epson scans

Added on 6 October 2026 from the eight `Epson_*.jpg` files directly inside
`../ato_docs/ato-gear/`. Subfolders were excluded. Seven sheets contain 21
physical faces each; the final sheet contains 12 faces and two empty positions.
The 159 photographed faces supply 148 new artwork links (296 ready/grayscale
PNGs). The ten repeated faces on the last sheet retain the corresponding
`epson-212452` artwork. Eschaton Stones contains text/icons without an
illustration, so it retains its live card layout without a blank image asset.
All 159 cards, including skipped copies and the text-only face, have rounded
original crops under `../ato_docs/gear-art/<batch>/original/` for comparison.

Each configuration records the unchanged JPEG's SHA-256, native dimensions,
individual crop bounds, 30-pixel corner radius, clean paper sample, artwork
rectangles/polygons and printed-content erase rectangles. Tesseract assisted
some printed-word bounds during review; the final coordinates are explicit,
and regeneration still requires only Python 3 and `djpeg`. Artwork RGB pixels
are copied directly from the decoded source. Paper fills remove the scanned
title, statistics, icons, rules, gates and footer. No hidden illustration is
redrawn. The native scan resolution and card aspect ratio are retained.

The new links use the existing definition/face IDs. Reversible cards—including
Leg Khopesh/Leg Spear, Necrotic Virus/Necroxiphos, Fumeblade, Umbral Virus,
Spherecast/Searing Pillar, Descender/Devolver and the transforming Cycle III
weapons—have independent front/back backgrounds. No new card definitions,
printed-ID aliases or player instances are created. Existing catalogue naming
is used for filenames, including its spelling differences from some scanned
titles; those differences are recorded in individual `reviewNote` entries.

Two source footer discrepancies are recorded separately as `observedPrintedIds`:
Unsolved Enigma prints AJ0280 whereas its imported definition has AJ0274;
Manos Discus prints AJ0279 whereas its imported definition has AJ0280.
Both images match unambiguous titles. Their existing IDs and instance counts
are preserved; the discrepancies are not silently made into catalogue aliases.
`sourcePrintedIds` continues to identify verified aliases already in the data.

Some illustrations are substantially covered by printing. Sisyphus's Triumph
and Sisyphus's Burden retain only exposed parts of their hammer/rock artwork.
The title overlaps Lightsword's upper beam. Several stat panels cover armour
or faint Titan projections. These omissions and other relevant overlaps are
recorded in the configurations/manifests; no covered pixels are reconstructed.

Reproduce only these root-level batches, while retaining all prior batches:

```sh
python3 scripts/extract-gear-art.py --batch epson-185551 --batch epson-185936 --batch epson-212452 --batch epson-213909 --batch epson-214451 --batch epson-215042 --batch epson-215411 --batch epson-215757
npm run catalogue:import
```

Validation: all 249 domain tests, catalogue reproducibility, lint and type
checking passed. Expo exported web, iOS and Android bundles to
`/private/tmp/ato-epson-new-gear-export`. A comparison with the prior catalogue
confirmed that all 3,014 definitions, 3,217 faces and their rules/identities are
unchanged, all 130 prior artwork links are retained, and exactly 148 new face
links were added. Every extracted face was visually reviewed at native
resolution. The original scans remain unchanged.

## Conversion record: Cycle I scans

Added on 5 October 2026 using exact source-pixel extraction from the three
JPEGs under `../ato_docs/ato-gear/cycle 1/`. The 55 supplied faces all match
existing Cycle I Gear definitions by their observed AJ footer IDs. The empty
lower-left position in the final scan is recorded and skipped. No new card
definitions, instances or player-data identities are created.

Gigan and Gigas, and Ariadne's Hello and Ariadne's Goodbye, remain separate
definitions as recorded in the catalogue; similarly named cards are not assumed
to be reverse sides. Iapetus Lifeguard uses its AJ identifiers independently
of the Cycle II Iapetus Lifesaver. Apostrophes become hyphens in named files:
`ariadne-s-hello.png` and `ariadne-s-goodbye.png`.

Each batch uses its own reviewed crop boundaries, artwork masks, clean paper
sample and 30-pixel rounded corners. All scanned titles, statistics, icons,
rules and footers are removed. Thin handles, ropes, pale projections and
secondary illustrations are retained where exposed. Ready and grayscale PNGs
are linked to stable definition/face IDs through the existing renderer.

Reproduce these batches with:

```sh
python3 scripts/extract-gear-art.py --batch epson-105748 --batch epson-110215 --batch epson-110738
npm run catalogue:import
```

The existing Puzzle Axe `Auto-break 2 instead` and Voice of the People
`Inspire 2 instead` corrections were copied from the generated catalogue back
to their source records so reimporting preserves them. Their card identities
and all other rules data remain unchanged.

Validation on 5 October 2026: all 196 domain tests, catalogue reproducibility,
lint, typecheck and web/iOS/Android exports passed. All 55 cleaned faces were
reviewed at native resolution, including refined masks beside printed panels
and around ropes, blade tips and pale projections. The 3,014 definition IDs,
all pre-existing artwork links and all generated rules data were verified
unchanged. Interactive browser review was unavailable because the computer-use
service could not start; bundle export verifies asset packaging, not live UI.

## Conversion record: Cycle II A

Completed on 4 October 2026 using the user's chosen **exact extraction**
approach. The source is a 3,396 × 2,232 JPEG containing seven columns and three
rows (21 faces). The source SHA-256 is
`51b101d49166a33bca4f811eaa2b61d91ce7004020bfb2a9a5e566df9f4be3f6`.
The complete reproducible coordinates and card identities are retained in
[`gear-art-cycle2-a.json`](../data/reference/gear-art-cycle2-a.json), and the
implementation is [`extract-gear-art.py`](../scripts/extract-gear-art.py).

The conversion proceeds in this order:

1. Check the original JPEG's hash and dimensions, then decode it with `djpeg`
   to RGB pixels. “Exact” means copying these decoded source pixels without
   resizing, recolouring or redrawing the retained illustration.
2. Crop each card individually using reviewed boundaries. The photograph has
   small differences between rows, so an evenly divided grid would be inaccurate.
3. Check each crop against the catalogue's Gear name, persistent definition ID,
   face ID and printed IDs. Reversible cards get separate artwork for each face.
4. Keep the union of the recorded artwork rectangles and polygons, then subtract
   any erase rectangles. Everything outside that mask is replaced by repeated
   pixels from a clean 30 × 350 paper sample at source position `(242, 112)`.
   This removes the scanned title as well as stats, icons, rules and footer text.
5. Apply a 30-pixel outer corner radius. Only corner alpha is antialiased, using
   4 × 4 coverage samples per pixel; retained RGB artwork is unchanged.
6. Save a full-resolution RGBA PNG and a grayscale equivalent. Grayscale uses
   `round(0.2126 × R + 0.7152 × G + 0.0722 × B)` for each channel and keeps the
   same alpha values.
7. Write rounded originals, cleaned review strips, manifests, catalogue links
   and the static asset registry. Reimport the catalogue to include the links.

The resulting batch contains 21 ready images plus 21 grayscale images. The
manifest records each name, definition/face identity, printed IDs, crop,
dimensions, preserved-pixel count, PNG hash, artwork metadata and overlap notes.
Original crops retain the printed content for comparison; only cleaned assets
are referenced by the app.

## Workflow for the next scan

1. Keep the original image under `../ato_docs/`, unchanged while converting it. Record its filename,
   hash, native dimensions and a unique batch name such as `cycle2-b`.
2. Inspect the image at native resolution. Identify every card using its title
   and printed IDs, and resolve its existing definition and front/back face in
   the catalogue. Report missing or ambiguous identities before linking artwork.
3. Record each crop and artwork mask in a new batch configuration. Use rectangles
   for unobstructed artwork and polygons for narrow handles or irregular edges.
   Select a clean paper sample with a similar tone to the cards. Do not copy the
   current batch's coordinates or corner radius without checking the new scan.
4. Inspect where printed boxes overlap artwork. Mask the printed content and
   record the lost area in `reviewNote`; do not invent hidden artwork. Preserve
   faint illustrations and secondary views when they are part of the main image.
5. Generate named ready and grayscale PNGs, originals and review strips. Keep
   the current artwork-only convention: the app supplies all titles and symbols.
6. Review every result beside its original at full resolution. Refine masks
   where text or icons remain, or where artwork has been clipped. Review thin
   shafts, fingers, chains, faded projections and the edges beside stat boxes.
7. Add the new batch's links to the shared registries, reimport the catalogue,
   and verify the artwork in card browsing and assigned Gear at narrow and wide
   widths, including flipped, exhausted and discarded states.

Coordinate conventions in the configuration:

| Field | Meaning |
| --- | --- |
| `crop` | `[left, top, width, height]` in source-image pixels |
| `paperSample` | `[left, top, width, height]` in source-image pixels |
| `artRects`, `eraseRects` | `[left, top, right, bottom]` relative to the cropped card; right/bottom are excluded |
| `artPolygons` | Lists of `[x, y]` vertices relative to the crop; rasterized at pixel centres |
| `titleRect` | Historical reference coordinates only; does not preserve the title |
| `batch` | Unique scan/output directory name; use lowercase letters, numbers and hyphens |
| `definitionId`, `faceId` | Existing catalogue identity and `front` or `back` |
| `sourcePrintedIds` | IDs visibly printed on this photographed face, checked against its catalogue aliases |
| `observedPrintedIds` | Documented source/footer discrepancies; evidence only, never new aliases |
| `skippedCards` | Duplicate physical crops excluded from artwork links, with identity/location and reason |
| `filename` | Lowercase Gear-name slug with hyphens and `.png`; verify uniqueness within the batch |

The extractor discovers batch configurations and uses `batch` for output paths.
It writes one manifest per scan, then merges all manifests into the shared
TypeScript registries. It checks hashes, expected face mappings and duplicate
links before writing the registries. Add a new configuration and run its batch;
keep existing assets, IDs and face links intact. Treat replacing a face's image
as an explicit reviewed change rather than adding a conflicting link.

Validation commands after adding or changing a batch:

```sh
npm run catalogue:import
npm run catalogue:check
npm run test:domain
npm run lint
npm run typecheck
npx expo export --platform all --output-dir /private/tmp/ato-gear-art-export
```

[`gear-art.test.mjs`](../tests/gear-art.test.mjs) checks all fifteen batches'
278 mappings, filenames, retained-source/image hashes, dimensions, transparent corners, grayscale
channels/alpha, separate reverse-face artwork and invalid catalogue metadata.
It also verifies duplicate handling and the two Chain Whip definitions.
Extend its expected batches/counts when more images are added. Also confirm that
the source hash and all existing catalogue definition IDs remain unchanged.
The original batch passed these checks and all 186 domain tests, and exported
successfully for web, iOS and Android. Bundle export checks packaging; review
the actual UI separately after future visual changes.

Original rounded crops and full-resolution review strips are saved under
`../ato_docs/gear-art/<batch>/`. The earlier AI preview in
`../ato_docs/gear-art-preview/` is a discarded experiment and is not used by
the app.

## Source overlaps

Exact extraction cannot restore artwork that was covered by printing in the
scan. The original batch has four explicit review notes in its manifest:

- Temenos Scale Shield: the right statistic panel covers part of the shield.
- Amphoras Belt: the right statistic panel covers part of an amphora.
- Stonewall: rules cover the bottom of the faded projection.
- Conqueror Nail: rules cover the lower weapon shafts.

The Epson batches record six further overlaps: Collision Shield's right stat
panel; the printed regions over the faded figures on Siegetower Pauldron,
Watchtower Pauldron and Temple Camo; Spartan War Axe's lower shaft beneath the
left modifier panel; and the left printed edge beside Gastraphetes' bow arm.
Spartan War Axe's separate visible tip below the panel is retained.

The Cycle I batches record five further overlaps: Siren Shield's left panel;
Instinct Linothorax's right sleeve panel; rules over the lower sword blades of
Gigan and Gigas; and the Will line beside Morpheus Module's faint projection.

Those areas are blanked or omitted. No replacement artwork was generated.
Cleaner original illustrations would allow those gaps to be replaced later.
