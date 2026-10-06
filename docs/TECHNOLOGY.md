# Campaign technologies

Technology is a Stage 9 campaign increment. The header destination opens three
tabs using the same outlined selection treatment as the Argonaut selectors.

## Pages and cards

- **Project List** has Structural and Combat tabs. Combat includes Argo Abilities
  and Production Facilities, with **All Combat / Argo Abilities / Production
  Facilities** filters to find either subtype directly. It shows only unresearched cards from the campaign
  cycle whose supported requirements are met; applicable earlier-cycle cards are inherited automatically. Core never appears here.
  **Research project** adds the researched technology to campaign Abilities and
  recalculates project availability immediately.
- **Abilities** shows researched current-cycle and automatically inherited earlier-cycle technologies under Structural, Argo Ability,
  Production Facility and Core tabs. Core shows all Core cards through the
  selected campaign cycle automatically, with no acquisition or removal
  controls. Inherited technologies also cannot be removed. Advancing the cycle updates these sets immediately. The Argo Ability tab
  reports the maximum printed AA limit among automatic and recorded Propylons.
  All printed abilities, timings,
  charges, facility names, recipes and ingredients are visible. Removal requires
  the shared checked confirmation; removing a prerequisite retains already
  researched successors but updates availability of future projects.
- **Technologies** is the cumulative cycle catalogue, with search by either name
  or printed ID and an optional type filter. Unavailable projects remain inspectable
  here with their unmet supported requirements. Its type filters and results
  exclude Core; all applicable Core cards are automatically available in
  Abilities instead.

Each card has **View project / View technology** controls even if the source
catalogue describes it as a single face. Source/front data contains both research
fields and researched benefits; a renamed back face supplies only its new title.
Project cards use pale paper with Requirements and Leads To boxes. Researched
cards use the ATCC dark teal design with bordered ability headings, recipe bands
and circular charge/Trireme markers. Content grows vertically without cropping.
Core cards use the reference's wide Tarot Technology format on screens at least
820px wide: 620.16 × 359.04 minimum landscape dimensions, with centered headings,
full-width stacked ability panels and pale flavor dividers. On narrower screens
they fit a portrait column up to 326.4px wide. Both logical sides use this sizing,
including in card inspection. Cycle IV Core icons use the reference's gold tint.
References and keyword definitions are clickable without wrapping child actions
inside another button. The same design is used in card inspection.

Production Facility Gear recipe names show an anchored card preview on mouse hover,
including both faces and keyword links. Moving from the link into the preview keeps
it open; leaving both dismisses it after a short grace period. Tap or keyboard
activation opens a preview with close/outside/Escape controls on web and a sheet
on iOS/Android. Spoiler visibility is respected. Titan recipes, ingredients and
unresolved references keep their existing reference behaviour. Previews do not
craft Gear or change inventory.

All three pages group results under cycle-title dividers, ordered from the highest
cycle to the lowest. Within each cycle, cards are alphabetical by project name
on Project List and researched name on Abilities/Technologies. Sorting applies
before pagination; a cycle continuing onto another page receives its divider again. In
Abilities → Structural, Production Facility and Core, older-cycle headings are
collapsible and start closed; the current cycle stays open. Each heading shows
its card count. Expanded groups paginate independently, so hidden inherited cards
do not fill pages or hide other cycle headings. Search automatically opens matching
older groups; clearing search restores the collapsed defaults. Expansion is local
view state, separate for each ability type and campaign cycle. Argo Abilities,
Project List and Technologies retain their existing open groups and pagination.

On project sides, each prerequisite has the same compact circular status treatment
as Gear gates: a green tick for met requirements, red cross for unmet requirements,
and amber question mark for unsupported checks that must be verified in the game.
AND/OR groups retain their logic and mark each constituent requirement individually.
Shared resource changes and researched cards update these marks immediately. The
status is also shown in card inspection; the duplicate checklist beneath catalogue
cards is removed. Leads To entries list future technologies, so they do not
receive requirement-status markers.

Source design: [ATCC Technology cards](https://aedanthornton.github.io/ATCC/catalog?cardType=Argo+Ability%2CCore%2CProduction+Facility%2CStructural)
and its [renderer source](https://github.com/aedanthornton/ATCC/tree/main/src/components/rendertypes/TechnologyCards).
The one generic Combat definition, Nietzschean Sighting, has abilities rather
than recipes and is grouped under Argo Ability; the original catalogue is retained.

## Requirement checks

The engine resolves project and researched technology names within the same game.
Different cycle editions with the same prerequisite name are alternatives. An
explicit `Project / Technology` name pair resolves by its project name. All
requirement rows are ANDed, with printed AND/EITHER/OR alternatives parsed within
a row. Research remains unavailable until every supported requirement is met;
Leads To links never bypass another printed prerequisite. Resolving a predecessor
naturally exposes its successors when their remaining requirements are satisfied.

Argo Knowledge and Argo Fate minimums use the existing shared resource counters on
**Argo**. Names such as `Argo Knowledge`, `ArgoKnowledge` and `@ArgoKnowledge` are
accepted case-insensitively. An absent counter counts as zero. These checks do not
spend resources or infer them from Argonaut Triskelions.

Primordial encounters/levels, explored tiles, story events, diplomacy, alliances,
Paradox and other unsupported requirements remain printed and are listed as
an amber **?** with a manual-check explanation. They do not block research. For mixed OR
expressions, unsupported alternatives are omitted from automatic logic; a manual
alternative cannot automatically bypass a supported technology requirement. If all
alternatives are unsupported, that expression does not block research. This is a
deliberate interpretation of checking only requirements the app can track.

Known source-name typos are resolved through explicit aliases in
`src/domain/technologies.ts`, including Theseus Methods, Grassroots Projects,
Sanstorm Sailling and Forved Kratos Reaction. Printed wording and source records
are preserved. Unknown requirements stay manual rather than receiving guessed
matches.

## State and compatibility

`Party.technologies = { version: 1, researched: string[] }` stores explicit
researched definition IDs campaign-wide. All applicable earlier-cycle technologies,
including Core, are granted automatically in later cycles, even for a campaign
created directly in that cycle. Current-cycle Core cards are automatic too.
Current-cycle non-Core projects still require research. Automatic cards are
derived, deduplicated and cannot be removed; no inherited IDs need to be written
into the save. Existing explicit records remain intact.

Retired cycle-only technologies are excluded from Project List, Abilities and
Technologies. Their old records remain in saves and backups; historical research
still satisfies technology prerequisites. Earlier-cycle prerequisites count as
completed even when their benefits have retired. Imported future-cycle IDs remain
recorded but grant no benefits or prerequisite credit until their cycle is reached.
Advancement proceeds one cycle at a time after confirmation.

Older schema-2 saves without the optional field gain the same automatic Core and
inherited technologies immediately. No save or catalogue schema bump is needed.
Autosave, independent campaign profiles and portable backups preserve the record.
Malformed/duplicate technology lists are rejected; missing catalogue references
appear in saved-card notices and block backup import. Unavailable local records
can be removed with confirmation. Reducer actions check campaign and Argonaut IDs,
eligibility, catalogue availability and removal confirmation against current state.

## Catalogue cycle and limit rules

Every generated Technology definition has an optional `technologyRules` block:

```json
{
  "version": 1,
  "availableCycles": [3, 4, 5],
  "limits": { "crew": 10, "hull": 7, "timeSilo": 6 }
}
```

This is derived metadata alongside the unchanged source faces. Authored retirement
rules live in `src/domain/technology-rules.ts`, keyed by printed ID to distinguish
cards with repeated names. `npm run catalogue:import` applies them reproducibly to
the runtime catalogue and its split review files. The policy and rule version are
included in the catalogue digest. Older catalogues without metadata use the same
policy at runtime. Invalid/inconsistent metadata is rejected during validation.

- Cycle I only: Advanced Crew Expansion, Advanced Trading Solutions, Superior
  Trading Solutions, Peace, Shallows Navigation, Diplomatic Relations, Deeply
  Embedded Spies, Rhetoric, Minoan Investigations, Intelligence Gathering (AA0031),
  Crew Expansion.
- Cycle II only: Spartan Investigations, Theseus Method, War Recruitment, Refugee
  Integration, Recruitment Programs, Up-stream Navigation, Argo Security,
  Counterintelligence, Political Protection, Refugee Relief Effort, Grassroot
  Support, Mobile Trade Fleet Dock, Sluice Gate System Integration, Ambrosia Spill
  Solution, Argo Maintenance.
- Cycle III Structural cards retire after III, except Titan Care, Extinction
  Protocols, Awakening Studies, Advanced Titan Breeding and Quantum Propylon.
- Cycle IV Structural cards retire after IV, except Salvage Operations, Superior
  Titan Breeding and Argo Cloud Operations.
- Combat cards and Core cards are cumulative unless specifically restricted.
  All Cycle V technologies apply in V.

Absolute printed limits are extracted for Hull, Crew, Titans, Argo Abilities
(including `AA Limit`), Argo Oxygen, Summons and Time Silo. Active upgrades combine
by taking the maximum, not adding values or replacing them with a lower later
edition. Argo capacities and the AA display use this same calculation. Explicit
manual capacity edits remain per-cycle overrides for campaign effects. Immediate
resource gains and other effects are still resolved in the game, not replayed
when inheritance is calculated.

## Later rules automation

Research is a manual campaign action performed at the appropriate breakthrough
in the game. This increment does not enforce Timeline advancement days, execute
Immediate effects, spend crafting resources, add crafted Gear, breed/fuse Titans,
schedule cooldowns, select battle-ready Argo Abilities, spend charges or manage
round exhaustion. The complete printed text is shown as reference for these
actions. Those engines can be added without changing the researched deck model.

## Verification

- Real-data research chain: Propylon → Trireme Weapons and Armor → Ranged Weapons
  → Arrow Barrage → Crisis Protocol / Basic Support Equipment.
- `technology-inheritance.test.mjs` checks every retirement entry and Structural
  exception, automatic inheritance, highest limits, historical prerequisites,
  future-record filtering, old catalogues and backup preservation.
- Automatic Core availability in every cycle, cumulative Core and automatic prior-cycle inheritance, unremovable
  Core cards, preserved legacy records, renamed prerequisites, AND/OR branches, resource
  thresholds, typo aliases, duplicate prevention, cycle limits, stale actions,
  confirmed removal, retained successors, AA limit and backup compatibility.
- React DOM renders both logical sides of every one of the 319 technologies
  using actual web SVG and rich-text components without React rendering errors.
- Screen callback regression uses real search and the campaign reducer to exercise
  automatic Core availability and cycle switching, research, side changes, all tabs
  and confirmed removal of researched technologies.
- Live `/technology` returns HTTP 200. Automated visual browser interaction was
  unavailable (browser inventory is empty); mobile/device visual acceptance remains
  pending. Automated rendering checks do not substitute for device testing.
