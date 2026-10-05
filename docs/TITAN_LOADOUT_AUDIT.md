# Titan weapon and Support capacity audit

All **44 Titan faces** in the bundled catalogue were reviewed against their printed
ability tokens and `data/reference/titanAbilityData.json`: 24 Argo-bred Titans
and 20 Dreamwalker entries (four names, each with five cycle variants).

`weaponRules` on each generated Titan face records equipment capacity, permitted
weapon hand requirements, conversions, conditional Support penalties, alternative
loadout configurations and the ability names responsible. These describe usable
equipment slots rather than anatomical arms. The imported source data and all
definition/printed IDs are preserved.

| Titan | Weapon positions | Support positions | Weapon rule |
| --- | --- | --- | --- |
| Gamechanger | 2 | 2, or 1 while using Unknown Might | A three-handed Weapon may occupy two positions. |
| Earthshaker | 3, or 2 in Support configuration | 2, or 3 in Support configuration | Six-Armed gives a choice between three weapon positions and three Supports. A three-handed Weapon can use all three weapon positions. |
| Warkeeper | 2 | 2 | Cyclopean Might: three-handed Weapons may occupy two positions. |
| Dawnburner | 2 | 2 | Cyclopean Might. |
| Strider | 2 | 2 | Cyclopean Might; Dual-Wielding does not grant additional positions. |
| Helldiver | 2 | 2 | Cyclopean Might. |
| Executioner | 2 | 2 | Cyclopean Might. |
| Truthbearer | 2 | 2 | Elder Might: three-handed Weapons may occupy two positions. |
| Immortal Truthbearer | 2 | 2 | Elder Might. |
| Cloudsoarer | 2 | 2 | Lightweight Curse: three-handed Weapons may occupy two positions; cannot use one-handed Weapons. |
| Shadowdancer | 3 | 2 | Nimble Feet: cannot use three-handed Weapons. |
| Wishender | 4 | 2 | Four-Armed Centimanes: only one-handed Weapons. |
| Daredevil Wishender | 4 | 2 | Four-Armed Centimanes: only one-handed Weapons. |
| Firestarter | 2 | 3 | Stout grants three Support positions; no weapon-hand conversion. |

The remaining 30 faces use the ordinary two weapon / two Support baseline:
Mazerunner, Logicbreaker, Abysswatcher, Skyseer, Returner, Ascender, Talespinner,
Lunarlander, Trespasser and Feareater, plus Solon, Ulyssea, Herodotus and Philoctera
in Cycles I–V. Abysswatcher's Dual-Wielding changes attack keywords, not capacity.
The reference contains Nimble Hands, but none of these 44 Titan faces has that
ability, so it is not assigned to a Titan by inference.

## Support capacity follow-up

A second scan of all 44 Titan faces, the complete Titan keyword definitions and
the keyword reference/overrides found three abilities that change Support capacity:

| Ability | Titan | Support effect |
| --- | --- | --- |
| Stout | Firestarter | Three base Support slots instead of two. |
| Six-Armed | Earthshaker | Three base Support slots when its Support configuration is selected. |
| Unknown Might | Gamechanger | One fewer base Support slot while a three-handed Weapon uses two hand positions. |

These were already captured in the generated metadata and loadout logic. No other
Support capacity change was found in the current Titan data. Gear grants add to
these baselines: Firestarter or Earthshaker in Support configuration can equip
four Supports with Trireme Breastplate. Focused regression checks now equip every
one of these positions, verify save restoration, and check that losing the Titan
bonus or Armor grant preserves affected cards for reassignment. Restoring capacity
reactivates their saved placements.

All 241 regression tests, lint, typecheck and catalogue reproducibility checks
passed after this follow-up. The existing data and app logic required no further
changes; the new coverage verifies that the extra Support positions accept Gear.

## Behaviour

- Equipment selection and placement validation use the current Titan's rules.
  Printed restrictions can still be reviewed with the existing explicit manual
  exception mechanism.
- Earthshaker defaults to the three-weapon configuration. Its **Six-Armed** controls
  below the Titan abilities choose the alternative three-Support configuration.
  The choice is saved on that Titan instance as optional `loadoutMode`; older saves
  use the default. Changing Titans uses the new Titan's configuration.
- Unknown Might reduces Support only when an equipped, non-discarded Weapon whose
  printed slot is exactly `3 Hands` occupies two hand positions. Ordinary two-handed
  Weapons and variable/mixed requirements do not infer that trade-off. Removing,
  discarding or replacing the qualifying Weapon restores the Support position.
- Independent Gear grants add to the chosen baseline. Trireme Breastplate still
  grants its extra Support and Nosoi Backpack's optional extra hand still works.
- Gear in a position lost through a Titan change, configuration change or Unknown
  Might stays under **Needs reassignment**, with its face and readiness preserved.
  Restoring capacity revalidates that saved placement. Exhaustion does not change
  passive Titan capacity or free occupied weapon positions.
- A multi-hand Weapon renders once on the dashboard. Its additional occupied hand
  positions are omitted from layout and width calculations. The saved assignment
  continues to reserve all required positions. Removing or flipping it restores
  empty positions where appropriate; pending weapons do not hide usable slots.

Variable `* Hands` and grouped one-handed requirements such as `3 1 Hands` keep
their manual interpretation notice. Grouped single-handed Weapons are not treated
as a single three-handed Weapon. Mixed printed slot options keep their existing
choices. Elder Might's conditional Tireless, Stout's Evasion/Speed consequences and
Dual-Wielding's keyword transfer remain manual; this audit implements loadout rules.

## Reproduction and validation

`src/domain/titan-loadout-rules.ts` derives metadata from printed ability keywords
during `makeFace`. Run `npm run catalogue:import` to regenerate the runtime JSON and
readable family chunks; `npm run catalogue:check` verifies reproducibility. The
catalogue fingerprint includes `TITAN_LOADOUT_RULES_VERSION`; increment it when
changing these derivation rules. Validation rejects metadata that disagrees with
the source abilities; older catalogue snapshots without metadata derive the same
rules at runtime. No party schema migration or identity changes are required.

The regression suite verifies all 44 faces against the audited expectations,
converted and natural three-hand placement, restrictions, optional capacity,
Unknown Might's occupied-Support transitions, Earthshaker's saved mode, Titan
changes, discard/exhaustion, weapon flips, presentation de-duplication and owner
isolation. Browser and device interaction checks remain separate from automated
domain and bundle validation.

Validation on 5 October 2026: all 239 tests passed, lint and typecheck passed,
catalogue regeneration matched exactly, and web/iOS/Android exports passed at
`/private/tmp/ato-titan-hands-export`. Source pages, identity registry and source-map
were unchanged. Live browser and native device interactions remain pending.
