# Campaign technologies

Technology is a Stage 9 campaign increment. The header destination opens three
tabs using the same outlined selection treatment as the Argonaut selectors.

## Pages and cards

- **Project List** has Structural and Combat tabs. Combat includes Argo Abilities
  and Production Facilities, with **All Combat / Argo Abilities / Production
  Facilities** filters to find either subtype directly. It shows only unresearched cards from the campaign
  cycle and earlier whose supported requirements are met. Core never appears here.
  **Research project** adds the researched technology to campaign Abilities and
  recalculates project availability immediately.
- **Abilities** shows recorded technologies under Structural, Argo Ability,
  Production Facility and Core tabs. Core always shows the five Core cards for
  the selected campaign cycle automatically, with no acquisition or removal
  controls. Advancing the cycle updates this set immediately. The Argo Ability tab
  reports the maximum printed AA limit among automatic and recorded Propylons.
  All printed abilities, timings,
  charges, facility names, recipes and ingredients are visible. Removal requires
  the shared checked confirmation; removing a prerequisite retains already
  researched successors but updates availability of future projects.
- **Technologies** is the cumulative cycle catalogue, with search by either name
  or printed ID and an optional type filter. Unavailable projects remain inspectable
  here with their unmet supported requirements. Its type filters and results
  exclude Core; the current cycle's Core cards are automatically available in
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
before pagination; a cycle continuing onto another page receives its divider again.

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

`Party.technologies = { version: 1, researched: string[] }` stores canonical
researched definition IDs campaign-wide. The current cycle's Core cards are
derived from the catalogue rather than added to this list; they satisfy technology
prerequisites and contribute their printed AA limit automatically. No per-Argonaut
technology copies are created. Legacy explicitly recorded Core IDs remain intact
for compatibility and historical prerequisites, but the Core tab displays only
the selected cycle's Core set, deduplicated. Core cards cannot be manually removed.
Available projects are derived, so researching or removing a card, editing the
campaign cycle or changing shared resources recomputes availability. Repeated
research/acquisition cannot duplicate IDs. Campaign advancement proceeds one
cycle at a time after confirmation. Legacy imported saves containing later-cycle
technologies retain those records for recovery while restricting new additions
to the selected cycle.

Older schema-2 saves without the optional field have no researched projects;
their current cycle's Core cards are available immediately.
Autosave, independent campaign profiles and portable backups preserve the record.
Malformed/duplicate technology lists are rejected; missing catalogue references
appear in saved-card notices and block backup import. Unavailable local records
can be removed with confirmation. Reducer actions check campaign and Argonaut IDs,
eligibility, catalogue availability and removal confirmation against current state.

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
- Automatic Core availability in every cycle, exact-cycle switching, unremovable
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
