# Trauma and Kratos Pattern effects

All **40 Pattern faces** in the bundled catalogue were reviewed. Selected Pattern
overrides now contribute their supported effects to their Argonaut's loadout and
combat statistics, as well as replacing the printed Trauma or Kratos table.
Trauma draw cards were also scanned; no additional slot grant was found there.
Triggered Trauma draw consequences remain player controlled.

## Automated effects

| Pattern | Printed ID | Type | Behaviour |
| --- | --- | --- | --- |
| Support Specialization | BW0980 | Trauma | Adds one Support slot. Stacks with Titan capacity and Gear grants. Firestarter + this Pattern + Trireme Breastplate gives five Supports. |
| Djinnian Strain | DW2037 | Trauma | Adds one weapon position. A three-handed Weapon cannot use this position, including one that a Titan lets occupy two hands. The ordinary positions retain the Titan's normal rules. |
| Chronian Strain | CW1551 | Kratos | Adds +1 to Titan movement at Rage 7 or higher. Lowering Rage or removing the Pattern removes the bonus. Stacks with modifier tokens and supported passive Gear Speed effects. |

Pattern capacity uses the existing typed `slotEffects` metadata, preserving the
printed tokens and their source pointer. Djinnian Strain records
`eligibility.forbiddenWeaponHands: [3]`. Required Gear traits continue to work
alongside the new restriction. Variable and grouped single-handed requirements
retain their manual interpretation notices.

Only the assigned, valid override for the matching table contributes. An unavailable
or wrong-table reference stays saved for review and grants no capacity. Unselected
catalogue cards do not contribute. These effects do not depend on enabling optional
gate highlighting, and changing the Titan retains the selected Pattern overrides.

Pattern sources have stable, owner-specific derived identities; no additional Gear
instance is saved or counted against acquired inventory. Their slot IDs include the
definition, face and table kind. Selecting the same reference repeatedly, restoring
a backup or restarting cannot accumulate grants. Removing/changing a Pattern keeps
Gear in lost positions under **Needs reassignment**; restoring that Pattern
reactivates the saved placement. The dashboard and rules sheet name the Pattern
that granted the position and display its restriction.

## Remaining printed effects

These remain visible on their Pattern cards. They require battle context, a choice,
a triggered event, or a rule outside the current automated subset; selection does
not spend costs, change counters, enforce deaths or resolve attacks.

| Pattern | Effect kept for manual use |
| --- | --- |
| Aegisbred | Armor Re-roll 1. |
| Atropos Strain | Second Chance when about to resolve a Minor/Major Trauma; Fate and Exhaust costs. |
| Blasphemous | Conditional +1 Power against the printed GT target. |
| Canalrunner | Jump with a Fate cost. |
| Fearless | Fearless keyword. |
| Harsh Conditioning | Lose Fate after surviving specified Trauma draws. |
| Heat Conditioning | Microwave Resistance 1. |
| Heavy-Gear Training | Ignore up to one point of a Speed penalty from one Gear card. |
| Hyperborean Strain | Ignore the Bleeding Condition at exactly one Bleeding token. |
| Hypertime Conditioning | Reestablish Time Anchor with Fate and timing choices. |
| Iapetan Strain | Reaction Reflex with Fate and Exhaust costs. |
| Mazewalker | Temporary Speed bonus while moving through a Labyrinth tile. |
| Midas Immunization | Discard Midas after surviving Grave Trauma or Obol. |
| Monsteneer | Climb bonus based on half of Rage, rounded up. |
| Pain Conditioning | Pain Resilience 1. |
| Pandoran Strain | Reaction Hermes Reflex with Fate and Exhaust costs. |
| Pioneer | Cryptex Loathing; once-per-Battle Combat Action choice and Fatigue consequence. |
| Polemarchos | Speed bonus based on empty Gear slots, up to three. Empty-slot interpretation is not inferred. |
| Promethean Strain | Danger reduction with an Exhaust cost. |
| Scorch Conditioning | Reduce Danger from Laser/Sun hits, to a minimum of one. |
| Shade Training | Shaded with Danger costs. |
| Silver Strain | Additional Oxygen token at the start of Battle. |
| Siren Strain | Spiral 1. |
| Sisyphean Strain | Rage reduction on a Crit Miss. |
| Skyscraper | Ascent Check bonus. |
| Tactical Training | Strikeback 1. |
| Umbral Strain | Ambrosia Limit 5; limit consequences remain manual. |
| Wish Immunization | Wish Armor with Fate and Exhaust costs. |
| Zen Training | Superior Stanch using Rage with an Exhaust cost. |
| Cycladean, Delphian and Persian Dreamwalker | Printed Reaction Reflex abilities and their Fate/Exhaust costs. |

Curser, Dreamwalker II, Dreamwalker III, Spartan Dreamwalker and Zero Strain have
no additional printed abilities in the current data; their selected tables still apply.

## Reproduction and checks

`npm run catalogue:import` regenerates nine capacity effects: seven on Gear and two
on Patterns. The catalogue fingerprint includes `SLOT_EFFECTS_VERSION`; increment
it when extending the extraction grammar. Source records, definition identities,
printed IDs and party schema remain unchanged.

Regression coverage checks stacking and actual equipment placement, occupied grant
loss/restoration, owner isolation, repeat selection, backup and local restart,
bonus-slot URL decoding, incompatible references, fixed/mixed/grouped weapon
restrictions, malformed eligibility, and Chronian Strain's gate and stat contribution.

Validation on 5 October 2026: all 249 tests, lint, typecheck and catalogue
reproducibility checks passed. Web, iOS and Android exports passed at
`/private/tmp/ato-pattern-effects-export`. Live browser and device interaction
checks remain pending.
