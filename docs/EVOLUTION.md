# Primordial evolution

Open **Evolution** from the Argo homepage. The view follows the supplied connected
diamond diagrams using the app's cream panels, serif headings and teal accents.
Regular tracks and battle counts are saved with the campaign and included in
backups. Existing free-text Evolution records remain in Evolution notes.

## Tracks

- Each left/right diamond belongs to one regular Primordial. A centre diamond is
  one shared physical box; marking or clearing it changes both paths. This was
  explicitly confirmed by the user.
- Start at a top diamond. Only diamonds immediately connected below a selected
  diamond can be marked; later diamonds are faded and disabled. A shared diamond
  requires either incoming branch. Repeated level numerals are separate encounters.
- Tap a marked diamond to clear it. Later selections without a remaining path
  to either starting diamond are also cleared. An alternate selected branch
  preserves shared progress. The regular section is titled **Primordials** and
  has no −/+ controls.
- Earlier saves with disconnected selections remain readable. Those selections
  cannot unlock further diamonds without a connected starting path; clearing a
  box removes disconnected selections. No missing ancestors are automatically filled.
- The last marked box determines the campaign level. Before any boxes are
  marked, the first printed level is previewed: Hekaton starts at 0, other
  regular Primordials at I.
- Boss and adversary Battle Tracks count encounters, independently of level.
  Their campaign setup defaults to Level I. Encounter count is never converted
  automatically into a higher level or invented Scenario modifiers. Counters
  start at 0 and have no printed-track maximum; they accept nonnegative whole
  numbers and display the count without a limit.
- Selecting a different adversary clears its battle count. Existing progress
  requires a confirmation checkbox. A compatible surviving adversary retains
  its count when advancing to a cycle that offers that adversary.
- Regular evolution and boss counts start afresh on a new cycle. Saved prior
  cycle tracks remain in the backup data. Edits from another campaign or an old
  cycle are rejected.

The base campaign monsters are:

| Cycle | Regular Primordials | Boss | Adversary |
| --- | --- | --- | --- |
| I | Hekaton, Labyrinthauros | Alpha Temenos | Hermesian Pursuer |
| II | Cyclonus, Chimera Metastasios | The Nietzschean | Hermesian Pursuer / The Burden |
| III | Hypertime Oracle, Icarian Harpy | Sun Descendant | Hermesian Pursuer / The Burden |
| IV | Midascore, Demidjinn | Babelian Lunacy | Dahaka |
| V | Dragon of Phobos, Meduketos | Ur-Fleece | Titan X |

## Battle setup reference

Select a name or **Setup** to see its current level block, To Hit, Speed, Wounds,
AT bonus, Danger bonus, Evasion dice bonus and starting escalations. Danger/Fate
modifiers are shown separately where printed. Special Speed values (`Inf`, `-`,
`6*`, etc.) are preserved; infinite speed displays as ∞.

Level bonuses are absolute values from the selected block, not totals summed
from previous levels. The catalogue's `traitsFullList` supplies the cumulative
active traits, including removals. If that list is absent, the resolver applies
the ordered `traitsChanges` as a fallback. Traits with bundled keyword
definitions expand inline. Trait cards also supply descriptions, using the
Primordial's name to match monster-specific rules, and generic cards where
appropriate. VP Modification reads the modified VP section of the monster's sheet.

The preparation panel lists AI I/BP I as the initial decks and the printed
pre-battle escalation count. Boss/adversary encounter-specific changes still
come from their printed Battle Track/Scenario; those instructions are not
encoded in the catalogue's level blocks and are not fabricated here.

The level dropdown offers the current **Campaign** level and **Mnestis** levels
strictly above that monster's campaign maximum. Cyclonus offers Mnestis V–IX;
the Cycle III regular tracks offer VI–IX; the Cycle IV regular tracks offer
VII–IX. Bosses and adversaries offer II–IX because their campaign setup is I.
There are no separately selectable campaign levels. Selecting Mnestis does not
save a level override or mark boxes. Mnestis uses its own Routine and does not
advance campaign tracks. This feature does not implement the Theatre's complete
battle/reward procedure.

## Trait controls and source audit

The circle icon beside each trait toggles its campaign override. Active traits
show a teal check; disabled traits show a red slash, crossed-out title and a
Disabled label. Their descriptions stay accessible and the same icon restores
them. Overrides are saved per Primordial, persist across battles and compatible
later cycles, and apply to Mnestis setups too. Removing a trait through printed
level progression still applies independently; restoring an override does not
add a trait absent from the selected level.

`BattleSetup.activeTraits` excludes manually disabled and automatically
suppressed traits. `stats.activeTraits` preserves the printed list so disabled
traits can still be inspected/restored. Hermesian Pursuer's Toying automatically
suppresses **End of Hope** while active. Its row shows **Disabled by Toying**;
the restore icon is unavailable until Toying is disabled. Disabling Toying, or
selecting a level that removes it, restores End of Hope unless a separate story
override disables it. Automatic suppression is derived from `traitDisables`
metadata and is never written into the saved story overrides. Unrelated story
overrides are preserved across toggles, level changes and reloads.
Printed stat values and bonuses remain unchanged; applying a trait's effects
to those values is manual.

The full source audit checks 299 monster/trait combinations across all supported
campaign and Mnestis levels. 271 have descriptions; 28 lack text in both the
catalogue and keyword dictionaries. These are three Hermesian Pursuer traits
(Winged Doom, Killjoy, Flares), nine Ur-Fleece traits, and sixteen Titan X traits.
Their details explicitly state that source text is missing, rather than opening
an empty description. The [trait audit](reports/primordial-traits.json) records
every resolution and gap. Regenerate it with `npm run primordial-traits:report`.

The supplied [ATCC Primordial renderer](https://github.com/aedanthornton/ATCC/blob/main/src/components/rendertypes/PrimordialCard/PrimordialCard.jsx)
links Hermesian Pursuer's Toying to EX3219, whose wording names Titan X.
On 7 October 2026 the user confirmed Toying applies to Hermesian Pursuer and
authorised a separate entry. `data/reference/primordial-trait-overrides.json`
now supplies Hermesian-specific wording: −1 d10 and −1 Danger per hit (minimum
1), with **End of Hope** disabled while Toying is active. It records EX3219 as
the source for adaptation. The original Titan X card keeps its **Death of Hope**
wording and physical identity. Overrides are scoped by both monster ID and name,
take precedence over ordinary trait lookup, and are included in the source audit.
They do not create new physical cards or change quantity limits. The old shared
reference warning is removed for this confirmed entry.

## Data and sources

`src/domain/evolution-rules.ts` is the audited per-cycle track metadata. Nodes
have stable cycle-local IDs, row, lane and numeric level. `src/domain/evolution.ts`
resolves state and reads the existing Primordial `levels` JSON without rewriting
card identities. It matches both printed ID and exact name: the source shares
DU2394 between Midascore and Nosoi Dragon.

Optional saved data is stored in `party.argo.evolution`:

```json
{
  "version": 1,
  "cycles": {
    "1": {
      "marked": ["0-left", "1-left", "2-shared"],
      "bossBattles": 0,
      "adversaryId": "AU0622",
      "adversaryBattles": 1
    }
  }
}
```

Story-disabled traits are stored in the optional campaign-wide
`disabledTraits` map alongside `cycles`, keyed by Primordial printed ID, for
example `"disabledTraits": { "AU0622": ["Toying"] }`.

Older saves require no migration. Backup validation checks cycle IDs, unique
valid node IDs, nonnegative whole-number battle counts, available
adversaries, zero battles when no adversary is selected, and valid per-monster
disabled-trait lists. Edits validate trait names against that monster's level data.

Primary references are the user-supplied `../ato_docs/evolution/cycle*.PNG`,
the [publisher's resource page](https://intotheunknownstudio.com/resources),
its printable Argo front sheets for all five cycles, and the core rulebook's
Standard Preparations/Primordial Evolution sections (pp. 34–35). The printable
Cycle IV sheet supplies the two final shared VI boxes cropped by the screenshot.

One source difference is deliberate: the supplied Cycle III screenshot has
three split IV rows before the shared V box; the printable sheet has two.
This implementation follows the user's screenshot, retaining all three.
The generic rules prompt's IV maximum and 1–5 battle examples do not override
the actual Cycle IV VI boxes or the printed encounter limits above.

Adversary spawning, Cackle and map movement are excluded as requested.

## Verification

`tests/evolution.test.mjs` checks all cycle tracks against the real catalogue,
shared state, repeated levels, bounds, counter/level separation, confirmation,
cycle inheritance, trait removals, unusual values, save compatibility and
malformed backups, connected progression, branch rollback, Mnestis boundaries
and persistent trait overrides. `tests/primordial-traits.test.mjs` checks all
sourced traits, ownership, missing information and VP details.
`tests/argo-web.test.mjs` exercises the actual Evolution components, Mnestis
isolation, controls, inline trait help, icon toggles and responsive layout.

The first implementation passed 398 tests, catalogue reproducibility, lint and
type checking, with successful web/iOS/Android exports. Browser review covered
wide and 320-pixel layouts and confirmed that marked shared diamonds survive
reload. The revised controls have additional domain and rendered component tests.
The updated 407-test suite, lint and type checking passed, with successful web,
iOS and Android exports.
