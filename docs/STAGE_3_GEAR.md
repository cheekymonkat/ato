# Gear rendering and inspection

Stage 3 adds a searchable Gear catalogue, shared card-face components and full-card inspection. It uses the existing frozen definitions and adds no database, runtime network requests or package dependencies. Equipment selection and saved instance faces remain Stage 4 work.

## Try it

1. Start `npm run web`, open an Argonaut, open the top-right menu and select **Browse Gear**.
2. Search `hammer`. Inspect Rebound Hammer, Cyclopean Forge Hammer, Relief Hammer and Hammer-Sword. Select the secret result, then reveal it in the full view to read Hammer Origin.
3. On Hammer-Sword, select **Flip to back** to see Hidden Xiphos. Select a keyword inline or from the separate Keywords buttons to read its definition.
4. In Relief Hammer, select **Column** inline or under Referenced cards. Back returns through inspection to the same catalogue search and page, within the campaign cycle.
5. Search and select `Trireme Breastplate` for Armor dice, or reveal `Umbral Virus` to inspect the compound Fate/Ambrosia OR gate. **Hide this card** conceals a revealed secret again.

In development, `/argonaut/arg-1?fixture=trireme` loads the existing disposable fixture: a Trireme Breastplate card (now rendered in full on the dashboard), its editing tap target and three derived Support positions. The fixture replaces that Argonaut's preview loadout and is ignored in production. Stage 4 adds selection and editing to equipment positions.

## Presentation rules

The source specification is `../../ato_docs/card-design/README.md`, with machine-readable tokens, archived source and sample records alongside it. The app ports its rules to React Native rather than importing the browser DOM implementation.

- Catalogue faces use the 270 × 414 reference size, papyrus `#DFDBCD`, 10 px corners, cycle-coloured medallions/title/footer and the empty central area used by the source. Previews scroll if their content exceeds the reference height.
- Header medallions have a 42 px outer diameter and 5 px margin. Title size follows `min(19, 300 / (1.2 × name.length))` in previews. Offensive/spacer/defensive columns use the source 25:80:25 proportions and nested stat padding.
- Number-like values remain strings, including `+0` and `8+`. Specific coloured/reversed dice SVGs retain the source stacking order, offsets and sizes. Defensive dice and resistance cells use their separate treatment.
- Structured paragraphs preserve timing, cost icons, bold/italic runs, whitespace, explicit newlines, references and keyword tokens. Ordinary sentences flow together; later timing/cost/gate sentences begin new blocks. Reaction uses its symbol; asterisk effects keep their inline prefix.
- Gates use arrow polygons, split compartments, type colours and gradients. OR gates preserve both thresholds; AND gates preserve both symbols. The source's single-group token heuristic chooses row or column orientation.
- Native SVG uses an explicit padded viewBox in place of browser `getBBox()`. Condition badge width uses a character-based approximation in place of canvas text measurement. Font metrics, condition badge widths and inline wrapping are therefore not pixel-identical across platforms.

Inspection intentionally uses intrinsic height, a maximum width of 450 px and minimum title/ability/footer sizes of 16/14/11 px. Long content stays reachable by page scrolling. It does not apply the source's narrow-screen 0.85 transform or desktop focus transform. Word wrapping uses View/Text/SVG groups that work without SVG children inside native Text. Following Stage 4 feedback, dashboard equipment now shares this full renderer with intrinsic height and responsive wrapping; dashboard cards now open editing by selection, and Browse Gear cards open the full reference and keyword view by selection. Dashboard face width is capped at 240 px; full inspection retains the 450 px maximum. Exhaust/Ready/Flip sit below dashboard cards; inspection retains explicit keyword/reference buttons as alternatives to inline links.

## Navigation, references and spoilers

Recognised rich-text keyword tokens are dotted-underlined links on the
dashboard, catalogue results, editors and reference cards. Tap/click opens the
full bundled definition immediately; hit slop adds a small touch margin.
Keyword presses stop propagation so the surrounding card stays unselected.
Ordinary card taps continue to select/edit it. Unknown keyword tokens stay plain.
The shared popup scrolls long definitions and includes matching subnames,
parameters, Auto timing and subdefinitions. Close with ×, the backdrop or
platform Back/Escape. Keywords within a definition replace the current help.
Existing selection sheets host help inside their own modal, keeping the draft
selection mounted and avoiding stacked native modals. Help changes no player data.

The 3 October keyword-help update passed clean lint, typecheck, all 128 domain
tests and web/iOS/Android exports at `/private/tmp/ato-keyword-help-export`.
Chrome interaction confirmed that Tumble on an assigned Gear card opens its
definition while the dashboard URL remains unchanged. Visual review confirmed
the compact popup, dotted underlines and a further Crash definition link. A
normal card press selected the editor route; after a development-server reload
the full editor rendered with its keyword links. Concurrent browser activity
limited further dismissal/picker interaction checks. Native touch, hardware
Back and screen-reader acceptance remain pending; exports are build checks.

`/gear` keeps search and page in route parameters. Cycle availability comes from the active campaign; old per-view cycle parameters are ignored. `/cards/[id]?face=front|back` uses the stable definition ID. Inspection flipping changes only the route's displayed face; it does not mutate a definition or an equipped instance.

Printed references resolve through the existing repository. Unique references navigate directly; ambiguous references offer choices; missing references display an explanation. A uniquely identified reverse alias selects that face, while a shared printed ID defaults to the front. Missing card routes show a recoverable Card unavailable screen.

Non-Gear references have a basic reading view for names, traits, keywords, tile sizes, abilities/effects and IDs, plus Titan speed/power where applicable. They do not yet have every family's complete renderer. Trauma/Kratos arrays reuse the existing `PatternTable`, preserving the Stage 2 Pattern design.

Secret Deck, Envelope and Ultra-secret metadata on either face hides the whole definition by default. An unrevealed card renders its spoiler/source label and reveal action instead of mounting its actual face, title, keyword buttons or references. Equipment and Needs reassignment labels follow the same visibility state. Per-card reveals and the catalogue's reveal-all switch apply across screens for the current session. Reloading restores the safe default; persistence belongs to Stage 5.

## Offline definitions and icons

`data/reference/` contains unchanged standard, Titan and Primordial keyword dictionaries from ATCC revision `62eaeb673da4438c69f6902c1932d0832cc636a3`. `source-manifest.json` records each pinned URL and SHA-256. Definitions are explanatory text, not automated gameplay rules. Lookup supports source aliases, numeric parameters, hyphen variants and Auto- prefixes. Unknown keywords remain readable text without an invented explanation.

`scripts/import-gear-icons.py` embeds 66 cleaned SVGs from the documented reference assets and original `ato_docs/images` files. It removes editor metadata and hidden raster layers while retaining visible paths, colours and identifiers. `gear-asset-manifest.json` records source paths, hashes and unresolved semantic names. `CardIcon` applies hand/slot/dice aliases, monochrome inversion and unique SVG IDs for repeated symbols on web.

Regenerate from the app directory when the sibling source assets are available:

```sh
python3 scripts/import-gear-icons.py
```

The generated icons and dictionaries are bundled app inputs; a normal checkout does not need the sibling documentation to run. Some manifest names resolve through contextual aliases, such as Red power dice and Laser Armor resistance. Actual unknown symbols remain visible by name. Unknown paragraph tokens/shapes retain readable text or JSON and produce development diagnostics. The original catalogue quality report still lists unresolved and ambiguous printed references; this stage does not guess repairs.

## Modules

| Location | Responsibility |
| --- | --- |
| `src/cards/GearLibrary.tsx` | Search, campaign cycle limit, 12-card pages and inspection entry |
| `src/cards/CardInspection.tsx` | Face display, flip, references and keyword sheets |
| `src/components/cards/` | Full Gear, equipped grayscale, shared search grid, rich paragraphs, dice, gates and spoiler presentation |
| `src/domain/card-presentation.ts` | Pure formatting, gate/dice rules, links, secret detection and face selection |
| `src/domain/keywords.ts`, `src/catalogue/keywords.ts` | Pure resolver and bundled dictionary access |
| `src/state/SpoilerProvider.tsx` | Session visibility shared across screens |
| `src/theme/gear-tokens.ts`, `src/theme/gear-icons.ts` | Source palette/dimensions and generated SVGs |

## Verification and remaining review

On 2 October 2026, these pass:

```sh
npm run typecheck
npm run lint -- --no-cache
npm run test:domain
npm run catalogue:check
npx expo export --platform all --output-dir /private/tmp/ato-stage3-final-export
git diff --check
```

The suite has 31 tests, including eight new presentation tests covering the five hammer records, formatting breaks/costs, unknown-token preservation, compound thresholds, face selection, secret detection, parameterised keyword lookup and all 613 Gear face ability/gate shapes. Catalogue validation remains deterministic across all 3,014 definitions. The Node test runner emits the existing module-type advisory; there are no failed tests.

Safari browser review covered the five hammer search results, Hammer-Sword → Hidden Xiphos, long Hammer Origin inspection, reveal/hide, the Power Re-roll definition and Relief Hammer → Column → back with restored search. Inspection and keyword-sheet readability were reviewed at 320 px; wider views were also reviewed. The populated Trireme fixture opens full inspection and shows its two Armor dice and three Support slots. Umbral Virus displays both OR thresholds. A defensive-card empty-text warning found during review was fixed and its inspection reloaded cleanly.

Web, iOS and Android exports compile. Native runtime review remains outstanding: the selected command-line tools lack `simctl`; using the installed full Xcode binary also fails because CoreSimulatorService/device services are inaccessible in this environment. No iOS device/simulator or Android runtime was verified. Exports do not establish native runtime behavior.

Before declaring all Stage 3 acceptance checks complete, review the five samples, flipping, nested links/sheets, defensive dice and compound/Condition gates on a native target. Also review increased system text size, screen-reader/keyboard use and the remaining families' basic reference views. Stage 4 can build the equipment picker on these shared presentations while retaining that validation backlog.
