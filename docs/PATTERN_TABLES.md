# Pattern-style reference tables

The Titan Trauma and Kratos dialogs use `src/components/PatternTable.tsx`, based on the user's ATCC Pattern-card reference. The detailed extraction, original renderer/CSS and provenance are in [the Pattern design rules](../../ato_docs/card-design/patterns/README.md).

Trauma uses the original red gradient bands, literal ranges and four tier symbols. Kratos uses white diamonds, numbered black circles at both ends, separate black choices, white symbols, original coloured Power dice and `+` for combined effects. Both retain the papyrus frame, type-coloured title/medallion and bottom fade. Larger, wrapping rows and a legend/explanation improve app readability.

`src/domain/pattern-table.ts` preserves row → alternative → combined-effect nesting and supplies readable accessibility labels. Unknown symbols use text. `Pull` and `RedtoBlack` are known text fallbacks because the source icon set does not contain their SVGs.

The component is reusable for later Pattern card inspection and explicit table overrides. Current dialogs still show the selected Titan's data. This change does not introduce Pattern assignment or automatic gameplay effects.

Icons are generated with `python3 scripts/import-pattern-icons.py`. It embeds 38 existing SVGs from `../ato_docs/images`, preserves view boxes and visible paths, removes hidden tracing images/editor metadata, and applies ATCC's Kratos inversion convention. Originals are unchanged. The generated module is bundled, so the runtime app does not depend on the documentation folder or network access.

## Checks

On 2 October 2026, typecheck, uncached lint (`npm run lint -- --no-cache`), all 23 domain tests, `catalogue:check` and `expo export --platform web` passed. The table tests cover every bundled Titan/Pattern face, six through nine Kratos rows, repeated Trauma tiers, multi-effect alternatives, die mapping, implicit SVG-fill inversion and unknown-symbol fallback.

The deployed ATCC page and the app's isolated preview were inspected in desktop Chrome. Papyrus, medallions, gradients, Trauma tiers, Kratos diamonds/circles, coloured dice, combined effects and nine-row layout rendered. That review found an invisible Fire symbol: its source SVG relies on the implicit black fill, so the importer now explicitly inverts the default fill as well as specified paint. The regression check covers that case.

Open `/pattern-preview` during development to review Iapetan Strain, Mazewalker, Shade Training, Pandoran Strain and Dawnburner without changing party state. Production builds redirect this route to the dashboard. Optional `?width=320` and `?width=390` constrain the review container; `?width=264` gives the table 232 px, equivalent to the card width inside a 320 px reference dialog with its current margins. These are content-width fixtures, not device emulation.

Small-width fixtures and reference-dialog interaction review remain pending; browser input was unreliable while other Chrome windows were active. Native iOS/Android, large-text settings and actual screen readers remain untested.
