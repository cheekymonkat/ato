# Argo overview

The Argo page follows the paper, serif headings and dark section headers of the
campaign and Technology screens. It replaces the standalone Titan list and
navigation buttons with three compact sections. Shared resources and Campaign
notes remain at the bottom.

## Ship and voyage tracks

Hull, Crew, Argo Fate and Argo Knowledge have inline minus/plus controls. Select
a total to enter an exact value. Fate has a fixed limit of 9; Knowledge has a
cycle-defined limit of 20 per cycle. These limits are read-only in the editor,
and old saved manual overrides are ignored. Hull and Crew limits remain editable
for extensions and campaign effects.

New campaigns start Argo Knowledge at the previous cycle's maximum: 0, 20, 40,
60 or 80 for Cycles I–V. Advancing initializes it to that same starting value for
the new cycle, consolidating old Knowledge aliases while retaining other resources.
Loading or importing an existing campaign preserves its recorded current value.

**Titans** displays occupied roster places (Alive + Crippled) against the highest
active technology capacity. Select the total to open Manage Titans; the small
technology link opens the capacity source. There is no manual total or limit editor.
Old saved Titan totals and capacity overrides do not control the roster. See
[Campaign Titan roster](TITAN_ROSTER.md) for starting groups and cycle advancement.
Limits can reflect extensions and campaign effects. Plus is disabled at the limit,
and both direct edits and reducer actions reject values above it. Saving a lower
limit requires the value to fit within that limit. Zero limits are enforced too;
tracks without a limit remain unbounded. Fate and Knowledge obey the same limits
when edited through resource actions, including alternate spellings of their names.
Legacy over-limit saves remain readable; plus is blocked, and minus brings the
total back within its limit. Limits do not automatically resolve a game consequence. The Argo Ability
limit comes from active technology; select it to open Technology.

Default Hull, Crew and Titan capacities take the highest printed limit across
applicable Core, automatically inherited and researched technologies. Cycle-only
cards stop contributing after retirement. Earlier upgrades cannot be reduced by
a lower limit on a later Core card. Editable capacity overrides remain per-cycle.
The reference-sheet baselines are Hull 5, Crew 6, Fate 9,
Knowledge 20 per cycle and Titans 10. Hull and Crew have editable starting capacities,
not totals copied from a saved-game screenshot. Unrecorded totals start at zero.

Only the current cycle's voyage tracks appear:

| Cycle | Tracks |
| --- | --- |
| 1 | Strangers |
| 2 | Refugees, Captives, Humanity, Defectors |
| 3 | Paradox, Frozen Time, Time Silo, Loop Length |
| 4 | Babelian Debt, Reap Marks, Sow Marks |
| 5 | Paranoia, Argo Oxygen, Titan X Track |

Humanity accepts negative totals. Other tracks use nonnegative whole numbers.
These are manual campaign trackers; the app does not invent automatic narrative,
time-loop, debt or oxygen consequences.

## Progress and references

Story and Doom select the current cycle's numbered card and side in printed order:
`1A → 1B → 2A → 2B …`. Previous/next controls and a card picker change the selection.
Each tile shows that side's title; selecting the title opens inspection on that
exact side, including its narrative and printed rules.

The catalogue stores audited `milestoneRules` for all 36 numbered Story/Doom
cards, with token requirements for each of their 72 sides. The source card text
is preserved. Policy lives in `src/domain/milestone-rules.ts` and is included in
the import digest; run `npm run catalogue:import` after changing it. A new numbered
card must have an audited policy before import succeeds.

Only token types with a target on the selected side have a counter. Targets and
checkpoints come from the card data and cannot be edited. Cycle IV Doom cards have
independent Doom and Progress counters; Cycle V Story 5 uses Doom. Cycle V Story
1A/1B start at 4/3 Progress and count down to zero. Sides without token targets
show their selector and title without a counter.

Story and Doom counters cannot exceed their effective limits. A printed storage
maximum takes precedence; otherwise a counter stops at its target. Story I 2A
shows a counter limit of 9 with its requirement of 2 underneath. Both direct edits
and plus controls enforce the same cap. Story sides with an **at least** token
requirement use an app counter limit of **50**, stored as `counterMaximum` separately
from the printed target. Black Nadir and Stand Together show `count / 50` with
their minimum of 10 underneath; Black Nadir also shows its 10/15/20 checkpoints.
Unrelated minimum requirements for Defectors or Identity cards do not create
Progress counters.

Selecting the immediately following side retains Story tokens or excess Doom
when the printed policy specifies it. Doomed Investment Progress resets when a
Doom card flips. Carried tokens respect any destination counter cap. Other
selections reset to the destination's starting counts.
Reaching a target does not automatically advance or resolve narrative effects;
resolve the printed instructions before selecting the next side.

Card-library links open searchable references, grouped by cycle descending and
alphabetically within each cycle.

### Inward Odyssey

Inward Odyssey keeps a cycle-specific Progress counter with a fixed target of 2.
Reaching 2 through plus or an exact-value edit atomically resets Progress to 0
and adds 1 to the shared Argo Knowledge total. This obeys the current cycle's
Knowledge limit: at the limit, Progress still resets and Knowledge stays capped.
Manual decreases do not undo Knowledge already gained. Legacy target overrides
are ignored, and simply viewing an old save does not grant Knowledge.

Below the counter's line, the tile links to the current cycle's full Inward
Odyssey card and shows the adventure number and title matching the current Argo
Knowledge value. It links to the face containing that entry; values without a
matching adventure show a short empty state. No duplicate Knowledge label is
shown. Resolve the adventure during the Story Step after all other Story events;
the app displays the reference without resolving narrative consequences.

All five cards have structured `inwardOdysseyRules` in generated JSON: the 2-to-1
conversion and both faces' numbered adventures. `src/domain/inward-odyssey.ts`
extracts these from the printed rich text during import. Original rules remain
intact, including Cycle V's extra entry 101. Older catalogue snapshots can derive
the same rules without stored metadata.

The ten icon shortcuts match the supplied Scribe reference: Adventures, Titans,
Glyphs, Evolution, Diplomacy, Choice Matrix, Fated Events, Godforms & Summons,
Decks and Mnestis Theater. Titans opens the individual roster's counted health tabs,
Pattern editing and confirmed deletion. Other shortcuts open independent, autosaved reference notebooks.
Adventures additionally offers Exploration cards, Godforms & Summons offers
Godform/Nymph cards, and Decks offers Story, Doom, Exploration, Clue, Trauma and
Kratos cards. Libraries respect cycle availability and existing spoiler settings.
These notebooks prepare the navigation for later dedicated subsystem screens;
they do not implement the full rules engines for those systems.

## Persistence

`Party.argo` is optional and versioned, keeping older schema-2 saves valid:

```ts
{
  version: 1,
  tracks: { hull: { value: 4 } },
  limits: { '2:hull': 7 },
  milestones: {
    '2:story': { definitionId: '<Story definition ID>', faceId: 'back', tokens: { Progress: 23 } },
    '2:doom': { definitionId: '<Doom definition ID>', faceId: 'front', tokens: { Doom: 3 } }
  },
  records: { diplomacy: 'Delphins +1' }
}
```

Ship totals carry forward. Capacity overrides, voyage tracks and milestone
progress have cycle-specific keys. Advancing retains historical entries and
notebooks while exposing the next cycle's fields and capacities. Existing checked
cycle advancement still lives in Campaigns & backups; this page adds no alternate
way to change cycle.

Legacy Story/Doom free-text references such as `4b` resolve to their corresponding
side and retain the saved token count. Old manually entered targets are ignored
in favor of the catalogue rules. The optional `milestones` map stores subsequent
edits without invalidating older saves. Story and Doom counts remain independent.

Fate and Knowledge read the existing resource totals used for technology
requirements. Editing either from Argo consolidates legacy spelling variants into
`Argo Fate` / `Argo Knowledge`. Knowledge appears only in its Argo counter; Shared
Resources hides it and its aliases, prevents adding them, and preserves Knowledge
when resetting resource amounts. The tracks never maintain an independent
authoritative copy of those totals.

Track actions capture the campaign ID, owner and expected cycle. Stale callbacks,
unavailable tracks, invalid values and unsafe integers are rejected. State and
notebooks are validated on restore and included in existing snapshots/backups.
Milestone actions additionally capture the expected card and side; an editor
opened before a selection changes cannot write tokens to the new card. Backup
validation checks milestone references and counter caps.

## Verification

Campaign reference buttons use intrinsic height with a minimum of 110 pixels;
avoid percentage heights inside their auto-height wrapping grid. The campaign
scroll viewport is bounded, while its content does not shrink. Safari layout
checks at 768×1024 and 1024×768 confirm Shared Resources and Campaign notes remain
visible below the references. These checks use the web components, not a physical
iPad or a native iOS build.

`tests/argo.test.mjs` covers capacities from actual Core data, signed Humanity,
resource/research synchronization, advancement, stale edits and backup validation.
`tests/argo-web.test.mjs` exercises overview controls, exact-value editing, shortcut
navigation, notebook persistence and cycle-filtered/spoiler-aware card searching.
It also exercises ordered milestone selectors, exact-side inspection, hidden
counters, the 50-token minimum counter, dual token pools and countdown controls.
`tests/milestones.test.mjs` checks all sides' JSON targets, carry rules, migration,
stale edits and backup validation.
`tests/inward-odyssey.test.mjs` covers all five cards' adventures and side matching,
atomic conversions, shared-resource aliases, fixed limits, stale actions, cycle
advancement, backups and old-catalogue compatibility. The web tests exercise the
conversion, matching reference, correct-side link and fixed-target editor.
