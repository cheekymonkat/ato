# Catalogue and party data

Stage 1 provides shared TypeScript domain modules and bundled JSON for web, iOS and Android. It adds no database, network dependency or native package. Dashboard screens, colour selection, swiping and storage adapters belong to later stages.

## Files and commands

- `data/source/`: seven ATCC exports with the reviewed corrections listed below.
- `data/identity-registry.json`: persistent definition identities; commit this with generated data.
- `data/generated/catalogue.json`: formatted app data, faces, structured effects, indexes and provenance; exactly one catalogue object.
- `data/generated/by-family/`: smaller, formatted copies grouped by card type, with a manifest of file paths, counts and hashes.
- `data/generated/quality-report.json`: reference resolutions and import diagnostics.
- `data/generated/source-map.json`: each definition's exact original file and JSON pointer.
- `src/catalogue/index.ts`: lazy singleton access to the bundled catalogue.
- `src/domain/party.ts`: party, Argonaut and card-instance models and runtime validation.
- `src/domain/slots.ts`: baseline and effect-derived capacity, restrictions and reassignment detection.
- Gear image relationships and reproducible extraction are described in
  [Gear art](GEAR_ART.md). Faces can carry an optional `artwork` link; the original
  source card payload remains unchanged by image metadata.

With Node 22.18 or newer:

```sh
npm run catalogue:import
npm run catalogue:check
npm run test:domain
npm run typecheck
npm run lint
```

`catalogue:check` reads all inputs and compares the generated files without writing. The importer validates every record and the complete paging set before writing. It uses deterministic JSON, omits generation timestamps and records source SHA-256 digests. Bump the importer version in both importer and validator when changing the normalization contract; catalogue versions incorporate that version, source digests, identity registry and artwork links.

### Readable catalogue and smaller files

`catalogue.json` uses two-space indentation and retains a single schema-1
catalogue object. Do not wrap successive versions in an array or append an old
catalogue: the app expects one object, and `catalogue:check` catches differences
from the source-derived result. On 5 October 2026 the file was regenerated after
an array containing the old and current catalogue caused the startup error
“Unsupported catalogue schema”. Regeneration retains the current content
version, all definition IDs and artwork links; saved parties are unchanged.

For manageable reading and diffs, the importer also writes the same definitions
under `data/generated/by-family/`, such as `gear/001.json`, `mnemos/001.json` and
`condition/001.json`. Files hold at most 100 definitions and 512 KiB, with cards
in stable ID order. Each complete definition keeps its front/back faces together.
`manifest.json` records the catalogue version, families, part numbers, definition
counts, byte sizes and SHA-256 hashes. These copies are generated from the
validated catalogue, so no card text, artwork link or metadata is lost.

The app imports `catalogue.json`; the smaller files are for browsing and review
and are not included through app imports. Formatting changes source readability,
not gameplay or catalogue identities. Splitting alone would not save parsing
work if every file were immediately loaded and assembled. Loading only selected
types or cycles could save work later but needs changes to cross-family search
and reference resolution; this change keeps the existing loading behavior.

Make corrections in `data/source/` or the relevant artwork configuration, then
run `npm run catalogue:import`. Direct edits to generated files are overwritten.
`npm run catalogue:check` verifies both the main catalogue and every generated
readable part. The readable-parts test checks file sizes, formatting, hashes,
unique IDs and exact preservation of all 3,014 definitions and 3,217 faces.

### Reviewed source corrections

- 4 October 2026: Yarn Talisman (`AJ0281`, page 1, `/cards/326/slot`)
  changed from `Support` to `Attachment`, as requested by the user and consistent
  with its “Titan Attachment” ability. The original acquisition export remains
  in `../ato_docs/atcc-cards-page-0001.json`. Regeneration updates the slot index
  and catalogue version while preserving the definition ID and all other fields.

## Querying definitions

```ts
import { getCatalogue } from '../catalogue/index';

const catalogue = getCatalogue();
const matches = catalogue.search({ query: 'hammer', family: 'Gear' });
const armour = catalogue.byPrintedId('AJ0266');
const reference = catalogue.resolveReference('AR0483');
// reference.status is 'resolved', 'ambiguous' or 'missing'.
```

Search matches all face names and current printed aliases, case-insensitively. Family, cycle and slot filters must match the same face. Exact `byName` also finds reverse titles, including Hidden Xiphos. A reference can return several cards: do not choose the first silently. Definitions are frozen at repository creation; mutable exhaustion, face choices and counters live on independent instances.

## Identity and preservation

The initial internal ID is derived from game, render family and the full printed-alias set, then pinned in the registry. Later imports match overlapping aliases in the same game/family and retain the ID when wording, page order or aliases change. Historical registry aliases are retained for identity matching; the runtime lookup uses current export aliases. Never rebuild or discard the registry during ordinary updates.

The one record without a printed ID, Hyperborean Ruins in the Terrain family, uses a pinned unprinted key consisting of game/family/cycle. A second unprinted card in that group or indistinguishable records with shared aliases must fail import rather than merge. Those cases need an explicit identity design before adding them. If all printed aliases change with no overlap, migrate the registry entry explicitly before importing; the importer cannot infer that identity from prose.

All 3,014 records and all 28 render families are retained. Gear, Titan, Mnemos and Fated Mnemos have typed payloads; other families keep their render-family label and complete JSON payload under the `other` discriminant. Unexpected new families are retained and reported.

Only a nonblank `name2` denotes a reverse face. Numbered fields on single-face cards, such as Exploration's `effects2`, stay in the front payload. Reversible source fields move into front/back payloads with suffixes removed on the back. Some exports omit shared back metadata; the six allowed common metadata fields are inherited explicitly in `inheritedFields`. The test suite reconstructs every original source record exactly from these payloads. Original files and all rich tokens, gates, dice and family-specific fields remain available. Game expressions such as `+0` and `8+` remain strings.

## Slot capacity

The importer recognizes narrow text-and-icon patterns in actual Gear abilities and gated abilities. It does not interpret flavour text or FAQ entries as active rules. The seven current sources produce six Support effects and one optional hand effect. Horseskull Pauldron carries its Paradox eligibility restriction. Nosoi Backpack requires a saved choice; its Ambrosia consequence stays as text for later manual or explicitly supported resolution.

Each effect retains definition, face, exact original source pointer and original tokens. Effect identity reflects the mechanic rather than its ability-array index, so inserting unrelated text does not break saved optional choices or bonus position IDs. Unrecognized wording, absent required icons and action-cost patterns produce diagnostics without granting unrestricted capacity. Duplicate indistinguishable effects fail validation and need explicit mapping.

Pass equipped active sources to `deriveCapacity`; it recomputes from a configurable baseline every time. The dashboard baseline is two hands, one Armor, two Supports, three Attachments, two Mnemos and two Fated Mnemos, matching the layout reference. Attachment-host relationships and multi-hand equipment validation remain Stage 4 work; these position counts do not assert universal gameplay rules. The capacity function allows multiple effect sources without a fixed third-Support limit. Actual legal equipment combinations remain the loadout layer's responsibility.

Optional capacity is active only when the instance's `enabledEffectIds` contains the grant ID. Gated grants require an explicit `gateSatisfied` result; unknown gates do not apply automatically. Exhaustion alone does not disable passive rules. Never save an incremented slot count. Recompute after equip/remove/replace, face or condition changes and save restoration.

Bonus positions use the granting instance and effect ID. `findAssignmentsNeedingReassignment` returns equipment assigned to positions that have disappeared. It preserves those assignments for a visible Needs reassignment area; it does not delete items. `meetsSlotRestriction` checks added eligibility restrictions only, leaving slot kind, hand span and attachment-host validation to Stage 4.

## Party state

```ts
import { createParty, parseParty } from '../domain/party';

const party = createParty('party-id', ['arg-1', 'arg-2', 'arg-3', 'arg-4'], getCatalogue().version);
const restored = parseParty(JSON.parse(savedJson));
```

The calling state/storage layer supplies stable party and instance IDs; the domain has no platform API. Each of four Argonauts owns a name, validated `#RRGGBB` colour, six skills, Titan instance, loadout, memories, counters, conditions and tokens. Party order, active Argonaut ID and shared resources are separate. Creation allocates independent objects and arrays for every Argonaut. Catalogue and save-schema versions are distinct.

Stage 7 adds optional structured condition records alongside legacy labels.
One of each condition type is allowed per Argonaut, including both sides of a
reversible card; effects and expiry remain manual. Campaign cycle controls token
visibility and cumulative card-picker availability without erasing amounts or assignments. The setting is chosen at campaign creation and edited on the campaign page. Shared resources remain a separate party
pool. See [Stage 7 notes](STAGE_7_TOKENS.md).

Save validation rejects malformed colours, repeated IDs/order, overlapping assignments and dangling instance references. It does not clamp counters or perform death/campaign automation. Resolving missing catalogue definitions and migrations is a later storage/recovery concern. Stage 2 binds colours to a proposed 4 px separator and adds bounded left/right navigation with accessible alternatives.

## Initial review findings

- 3,014 definitions and 3,217 faces; no record deduplication.
- Five printed aliases have multiple legitimate definitions; one record repeats an alias within itself.
- One Terrain record has no printed ID.
- 86 backs explicitly inherit common metadata.
- Four nonblank references do not resolve: AQ0629, CX1697, CJ2360 and DZ2584.
- Two occurrences of CX1679 resolve ambiguously.
- 23 reference fields are blank or malformed.
- Seven slot effects are recognized; no current capacity candidate remains unmapped.

Do not repair the original exports by guessing missing references. The report gives file and JSON pointer for review. Fifteen domain/import tests cover preservation, IDs, aliases, faces, supported/unsupported effects, runtime validation, independent Argonauts, dynamic capacity and occupied-slot recovery.

## Physical-copy interpretation for future supply tracking

On 2 October 2026 the user confirmed printed card IDs as the physical-copy
identifiers for quantity limits. Count distinct nonblank IDs per definition, not
app instance IDs and not front/back faces. The installed Mnemos/Fated definitions
all have one ID each. Hammer-Sword and Hidden Xiphos share CJ1472/CJ1473, so a
face change does not create another copy. Five IDs are reused across different
families (BR0800, AR0483, AR0601, CX1679, DV2539), one record repeats an alias,
and Hyperborean Ruins has no printed ID. Those exceptions prevent treating IDs
as globally unique. Preserve registry identities and explicitly review missing
quantity cases. General supply tracking is planned; the current implementation
enforces unique Mnemos/Fated assignments per party.
