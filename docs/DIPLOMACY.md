# Diplomacy

Open **Argo → Diplomacy** for the current campaign's three factions. Each panel
uses the supplied faction symbol, minus/plus controls, a tappable total for direct
entry, and a highlighted relationship range. Relationship ranges form a vertical
list of full-width rows, with the name on the left and values on the right.
The current relationship and its
printed modifier appear prominently above the range key. Allied story references
are shown where present on the reference sheet. Diplomacy notes remain below the
panels.

The panels wrap from three columns to two, then one on narrow screens. They follow
the app's cream paper, serif headings and dark teal section headers. Values and
relationships are also exposed through accessible labels; colour is accompanied
by a checkmark and relationship name.

## Factions and limits

| Cycle | Factions | Counter range |
| --- | --- | --- |
| I | Minoans, Labyrinthians, Hornsworn | −20 to 20 |
| II | Helots, Cyclopes, Symmachy | 0 to 20 |
| III | Sunheirs, Delphians, Twilight Watch | −20 to 20 |
| IV | Aristotelians, Wasters, Cloud Thieves | −20 to 20 |
| V | Outcast Vanguard, Followers of Arete, Cycladean Protectorate | −20 to 20 |

All counters start at zero. The supplied screenshots are reference examples,
not starting campaign values. Both increment controls and direct edits enforce
whole numbers and the cycle's bounds. Controls are disabled at either limit.

Cycles I, III, IV and V use these inclusive bands:

| Relationship | Diplomacy | Modifier |
| --- | --- | --- |
| At War | −20 to −10 | −3 |
| Denounced | −9 to −5 | −2 |
| Unfriendly | −4 to −1 | −1 |
| Neutral | 0 to 3 | 0 |
| Friendly | 4 to 7 | +1 |
| Allied | 8 to 20 | +2 |

Cycle II uses:

| Relationship | Diplomacy | Modifier |
| --- | --- | --- |
| Hidden | 0 to 2 | −1 |
| Distrustful | 3 to 6 | 0 |
| Friendly | 7 to 11 | +1 |
| Allied | 12 to 20 | +2 |

The modifier is a reference for resolving Diplomacy rules. It does not change
Argonaut stats or automatically resolve an adventure or technology requirement.

## Persistence and cycle advancement

The optional `Party.argo.diplomacy` field stores the current cycle and faction
totals. It fits the existing version-1 Argo state without a save-schema change:

```ts
{
  cycle: 2,
  values: { helots: 7, cyclopes: 0, symmachy: 3 }
}
```

Older saves without the field remain valid and display zero totals. Existing
free-text diplomacy notes remain readable; they are not parsed into counters.
Edits autosave with the campaign and are included in JSON backups. Restore rejects
out-of-range counts, foreign faction IDs and a diplomacy cycle that differs from
the campaign cycle.

Advancing a cycle removes both structured diplomacy and diplomacy notes. The next
cycle starts with its own three factions at zero. Other Argo records and campaign
state follow their existing advancement rules. The advance confirmation explains
the diplomacy reset. Counter edits and notes capture the campaign and cycle so
callbacks from the previous cycle cannot recreate cleared diplomacy.

## Sources and regeneration

Faction names, relationship bands, modifiers and Allied story references were
checked against `../ato_docs/diplomacy/cycle1.PNG` through `cycle5.PNG`.
The matching vector symbols already exist under `../ato_docs/images`.

```sh
python3 scripts/import-diplomacy-icons.py
```

This preserves the source SVGs and generates `src/theme/diplomacy-icons.ts` for
web, iOS and Android. It removes editor metadata and hidden tracing images while
keeping vector paths, paint and transforms. Visible raster content is rejected.
Faction metadata and relationship rules live in `src/domain/diplomacy.ts`.

## Verification

`tests/diplomacy.test.mjs` checks all faction groups, every relationship boundary,
counter bounds, owner/cycle guards, persistence, backup validation and advancement.
The diplomacy cases in `tests/argo-web.test.mjs` exercise the rendered panels,
icons, current-band highlighting, direct editing, notes and responsive widths.
Live Chrome checks cover the desktop three-column layout, a 320-pixel single-column
layout, relationship changes and direct entry at the upper limit.
