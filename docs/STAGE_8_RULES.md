# Stage 8: Optional rules assistance

The preceding Stages 6–7 and user refinements were committed first as
`6338488 feat: add campaign-aware memories, tokens, conditions and Argonaut identities`.
Stage 8 adds a bounded assistance layer. It is ready for review; further browser
interaction and native device acceptance remain pending.

## Using it

Open the dashboard menu and choose **Rules assistance**. Tides of Fate remains
the last menu option. The sheet shows the selected Argonaut’s skill contributions,
loadout capacity, placement exceptions and distinct printed requirements on Gear,
Titans and unlocked memory panels.

**Highlight card gates** is off by default. Enabling it applies across the current
campaign; each Argonaut’s assigned cards use that owner’s Triskelion, tokens and
equipped Gear traits. The main dashboard and assigned memory editor share the checks.
The preference survives JSON backup, import and local restart. Catalogue previews
and equipment search remain neutral, because those cards are not yet assigned.

Indicators supplement the existing gate badge without hiding card text:

- ✓ Threshold met.
- − Threshold unmet.
- ? Manual check: the data or the required game state is outside the supported subset.

A met threshold does not assert that an ability can be used: costs, timing,
readiness and card-specific exceptions still matter. Exhausted/discarded Gear
keeps its grayscale palette, including the indicator. The sheet also labels
exhausted/discarded cards. Secret cards do not disclose their names, rules or
gate lists through the review sheet.

## Rule register

| Rule | Source | Implementation and assumptions | Exceptions / unresolved cases |
| --- | --- | --- | --- |
| Explicit Rage/Fate/Danger `N+` gates | Bundled Gear, Titan and memory data; Core Rulebook 1.1, printed p. 46, Gated Abilities and Effects | Pure comparison of the current recorded counter against the printed minimum. Example: Danger 6 leaves `7+` unmet; 7 or 8 meets it; lowering the counter immediately reverses the check. | Bare numbers, malformed counts and unsupported named requirements require review. No prose-derived thresholds. Overflow consequences remain manual. |
| Explicit AND/OR combinations | Bundled `comboGate`, `gate2` and `value2` fields | AND requires both; OR requires either. A known met branch suffices for OR, and a known unmet branch suffices to fail AND, even when another branch needs review. | An absent second threshold is not inferred from the first. Shared-value combinations and unrecognized operators require manual review. |
| Token `N+` gates | User clarification; bundled named gates and saved token types | Ambrosia, Despair, Bleeding, Midas, Pain, Oxygen and Aether use the selected Argonaut’s token count, defaulting to zero. Token types take precedence over traits with the same name. Example: two Ambrosia-trait cards do not satisfy Ambrosia `2+`; two Ambrosia tokens do. | Bleeding is selectable in Cycles 3–5. Threshold checks do not apply token penalties, deaths or encounter effects. Card-local Energy remains a manual check. |
| Printed Gear trait `N+` gates | User’s Labyrinth clarification; bundled Gear trait lists; Core Rulebook 1.1, p. 46, Gear traits | Labyrinth and other exact printed traits, including Paradox in combined gates, count valid equipped Gear instances with that trait. Each card counts once, even if it occupies two hands; the gated card itself contributes if it has the trait. Exhausted Gear retains traits. | Discarded, unassigned and pending-reassignment Gear do not count. Flipping uses the current face. No trait aliases or temporary traits from prose are inferred. Unknown gate types require review. |
| Titan and memory inline gates | Bundled Titan/Mnemos ability data; existing node and Growth presentation rules | The same threshold indicators apply to inline Titan and memory abilities. The review sheet lists only currently visible memory panels and the visible Fated side. Example: Dogma’s first panel needs Danger `2+`; node 3 reveals its second panel, which separately needs Danger `5+`. | Node unlocks do not satisfy combat thresholds. Decreasing nodes hides future panels and their gate checks again. Costs, timing and readiness remain manual. |
| Skill contributions | Existing portrait/memory domain rules, bundled stat fields, user’s corrections | Manual contribution + portrait + memories; displayed total remains −9..9. Standard Mnemos add +1 per listed skill; unresolved Fated subtract 1 until all three nodes are filled. Example: manual 0 + portrait 1 + Mnemos 1 − Fated 1 = 1. | Does not add combat Precision or other unrelated Gear statistics. Exhausted memories retain their existing modifier behavior. Rules assistance does not change this behavior. |
| Base and granted slot capacity | Existing verified slot effects and Gear source tokens; Core Rulebook 1.1, printed pp. 34 and 45 | Shows occupied positions, baseline and each active grant, including restricted bonus Support slots. Trireme Breastplate gives a third Support slot. Nosoi Backpack’s saved optional choice gives a third hand. | No additional battle-start tokens are applied. Capacity reports recorded placements, including discarded cards; it does not resolve discard effects or erase occupied grants. |
| Cyclopean Might / Elder Might / Lightweight Curse hand conversion | Bundled `data/reference/titanAbilityData.json` keyword definitions; printed keywords on current Titan face | A Weapon whose printed slot is exactly `3 Hands` gains a `2 Hands (Titan ability)` choice. Ordinary `3 Hands` remains selectable. The conversion applies while the relevant Titan face is assigned and not discarded. Lightweight Curse also prohibits one-handed Weapons. | Variable `* Hands` / `3 1 Hands` requirements keep manual interpretation. Exhaustion does not disable these passive rules. Elder Might’s conditional Tireless effect is not automated. |
| Loss of a Titan hand conversion | Existing placement validation plus the verified hand conversion above | Changing/removing/discarding that Titan retains a two-hand assigned three-handed Weapon and flags it for reassignment, unless an existing manual placement exception covers it. Restoring a qualifying Titan revalidates the placement. | No automatic card removal, rearrangement or overwriting of manual exceptions. |
| One copy of the same Support per Titan | Core Rulebook 1.1, printed p. 34, Battle Setup | Read-only notice when multiple assigned active Support instances share the same catalogue definition. Example: two copies in Support 1 and 2 prompt review. | Explicit exceptions are left to the player. This is not a campaign-wide physical card inventory check; distinct catalogue definitions are not guessed to be equivalent. |
| Unknown Might | Bundled Titan keyword definition, Gamechanger AK0298 | A three-handed Weapon can use two hands, automatically reducing the Support baseline by one while used. Occupied lost Support positions retain their Gear for reassignment. Removal or discard restores the position. | Variable and mixed printed hand requirements do not infer this trade-off. It is not a two-hand-to-one-hand conversion. |
| Titan capacity and weapon restrictions | Audited printed abilities on all 44 Titan faces and bundled Titan keyword definitions | Six-Armed selects three weapons or three Supports; Four-Armed Centimanes gives four one-handed-only positions; Nimble Feet gives three positions and prohibits three-handed Weapons; Stout gives three Supports. Derived `weaponRules` metadata is stored per Titan face. | Non-loadout consequences remain manual. See [the full audit](TITAN_LOADOUT_AUDIT.md). |
| Selected Pattern effects | Printed abilities on all 40 bundled Pattern faces | Support Specialization adds Support; Djinnian Strain adds a position that cannot support three-handed Weapons; Chronian Strain adds Speed at Rage 7+. Grants stack with Titan/Gear capacity and retain lost placements for reassignment. | Triggered abilities, costs, empty-slot bonuses, penalty choices and limit consequences remain manual. See [the Pattern audit](PATTERN_EFFECTS_AUDIT.md). |

Rulebook material was checked against the publisher’s Core Rulebook 1.1,
available from the [publisher’s resource page](https://intotheunknownstudio.com/resources)
and its [Core Rulebook PDF mirror](https://gamers-hq.de/media/pdf/7b/1c/7f/ATO_CORE_Rulebook_v1-1.pdf).
The local technical guide remains guidance; card data and explicit user corrections
take precedence over uncertain examples in it.

## Boundaries and correction

### Precision and Speed follow-up

The main Argonaut page now displays assigned secret Gear, memories, conditions,
Titans and Pattern overrides without concealment. This is scoped to the selected
Argonaut’s owned definitions; it does not reveal unassigned cards in the catalogue
or selection lists, or change the global spoiler preference.

Precision and Speed modifier-token counters appear between Titan selection and
Refresh Gear when space permits. Narrow screens put the counters on the
next row, with 44px touch targets. Each Argonaut saves optional
`combatModifiers: { precision, speed }` in schema 2; missing fields in older saves
mean zero. Both totals accept signed safe integers. These are independent of
Argonaut skills and the Ambrosia/Despair/etc. token pool. Backup and restart retain
them; Tides of Fate and confirmed Argonaut replacement reset them to zero.

Core Rulebook 1.1, printed p. 58, confirms Precision and Speed tokens adjust their
attributes by ±1. The same page also lists Evasion (Titans), AT (Primordials),
Evasion die (Primordials), Danger (Primordials), and To Hit (Primordials). These
other types are recorded here for later work, without adding incorrect Titan
counters based on the supplied AI conversation. Temporary token expiry and
lasting token cleanup remain player controlled, with Tides of Fate clearing the
recorded totals.

The modifier controls show the Precision/Speed icons instead of visible words;
their counter values and decrease/increase buttons retain named accessibility labels.

Assigned cards derive their displayed values from printed data + modifier tokens
+ direct passive Gear effects. The printed catalogue is never overwritten.
Changed values are red (grey while exhausted/discarded), and accessibility labels
and the rules sheet explain their sources. Integer values are calculated;
symbolic/conditional values such as `+X` and `+2*` keep their exact printed form
with a separate signed adjustment.

The supported passive grammar is a complete, cost-free statement such as
`+1 Precision`, `Precision +2`, or `Gain +1 Speed`, containing only plain text,
whitespace and the relevant stat icon. Explicit supported `N+` gates must be met.
Weapon Precision effects apply to their source Weapon; Precision effects on
non-weapon Gear with no printed offensive Precision apply to each equipped Weapon.
Speed effects from all valid equipped Gear and supported selected Patterns adjust the selected Titan. Each instance
counts once, including multi-hand Gear; exhausted Gear retains passives. Discarded,
unassigned and pending-reassignment cards do not contribute. Calculations update
after removal, flip, token/counter changes, discard and restoration, independently
of optional gate highlighting.

Verified examples in the bundled dataset:

- Puzzle Axe: printed Precision +1; Labyrinth `3+` supplies another +1 to the Axe.
- Muckbane / Muck Bludgeon: Ambrosia `1+` supplies +1 to the source Weapon.
- Argocryptex Alpha: passive +1 Precision to equipped Weapons.
- Spherical Armor: passive +1 Speed, with another +1 at Danger `6+`.
- Subreme Harpoon: passive +1 Speed, counted once despite occupying two hands.

Action costs, timing tokens, choices, conditional prose, grants of modifier tokens,
and numerical effects in Titan/memory abilities remain manual. Chronian Strain's
explicit gated Pattern bonus is applied as documented above. No claim about an
unverified Bleeding/Midas gear set is implemented from the pasted AI response.
Players record triggered modifier-token gains with the new counters. Broader typed
effect rules can extend this bounded parser when their scope and timing are verified.

Equipment and attachment groups allocate explicit widths from their measured
container before sizing cards. This removes nested intrinsic-width feedback and
leaves rounding space at browser/native breakpoints. Complete groups share a row
when they fit; individual cards wrap only when their group genuinely lacks room.

The assistance sheet derives its results from the current save and creates no
gameplay transactions. Corrections use existing counters, card selectors,
placement exceptions and memory node controls. Derived results cannot accumulate
on refresh or restore. A campaign boolean is optional in schema 2, preserving
older saves without rewriting their gameplay state.

Dice generation, guided action resolution and an action history are deferred until
a specific action sequence is defined. There are no generated rolls or automated
effects to undo in this subset. Despair adjacency/limits, Midas assignments,
Pain/Oxygen/Aether effects, attack totals across weapons, AI movement, line of
sight, deaths and campaign-loss automation remain outside it. Existing manual
controls continue to handle those states.

## Verification

- Domain suite: 171 tests pass, including eleven new combat-modifier and responsive-layout scenarios.
- Boundary tests cover all three counters, decrease/relock, AND/OR uncertainty,
  malformed thresholds, nested gates and unsupported data.
- Trait/token scenarios cover two-hand de-duplication, the source card’s own trait,
  exhaustion, discard/restore, face changes, removal, lost occupied grants,
  Ambrosia token-versus-trait precedence, mixed gates and Argonaut isolation.
- Bleeding availability and save validation are covered by the token suite; all
  seven token types round-trip through backups and local restart.
- Titan/Mnemos cases cover node unlock/relock and separate combat thresholds;
  Fated gate collection follows the front/Growth side without exposing the other.
- Preference validation rejects stale campaigns and invalid values; backup and
  local restart restore the preference without applying any gate effects.
- Modifier checks cover portrait bonuses, memory removal, Fated resolution and
  lower/upper display bounds.
- Loadout checks cover bonus sources, duplicate Support, lost occupied grants,
  both verified Titan conversions, Titan changes, discard and passive exhaustion.
- Uncached lint and typecheck pass.
- The initial Stage 8 web, iOS and Android exports passed at `/private/tmp/ato-stage-8-export`.
- Updated trait/token and Titan/memory gate exports pass on web, iOS and Android
  at `/private/tmp/ato-trait-token-gates-export`.
- Safari loaded an isolated temporary dashboard with Hammer-Sword and Trireme
  Breastplate, Danger 7 and highlighting enabled. The preview was not persisted.
  The temporary route was removed and its tab closed after review.
- Further menu/sheet, switch, gate-marker and narrow-screen interaction checks are
  pending: Safari’s accessibility click did not open the menu and subsequent
  screenshot/coordinate operations returned `noWindowsAvailable`.
- iOS/Android device interactions and restart checks remain pending; successful
  native bundle exports are not device acceptance.
- Modifier scenarios cover signed owner-qualified edits, malformed-save rejection,
  old-save compatibility, backup/local restart, Puzzle Axe gate relocking, personal
  Ambrosia gates, attachment contributions, multi-hand Speed de-duplication,
  discard/restore, exclusion of active/conditional statements, and cleanup resets.
- Equipment allocation checks sweep fractional widths from 700–5000px with normal
  and expanded slot counts, plus phone widths and group-sharing boundaries.
- Follow-up browser verification could not proceed: both Safari and Chrome app
  selection returned `cgWindowNotFound`, and browser inventory exposed no tabs.
- Precision/Speed follow-up lint and typecheck pass, and web/iOS/Android exports
  pass at `/private/tmp/ato-modifiers-export`.
