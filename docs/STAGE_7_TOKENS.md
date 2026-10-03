# Stage 7: tokens, conditions and shared resources

The dashboard now has six per-Argonaut token counters using the existing ATCC
symbols and the compact bordered Triskelion layout: icon/name above − value +.
Missing amounts display as zero. Counts autosave and survive profile switching,
local restart and JSON export/import. They never go negative. Counts can exceed
the gameplay limits because adjustments and resolution remain manual.

A campaign-wide cycle setting controls visibility, independently of the chosen
Titan's printed cycle. Choose it when creating a campaign; edit it under
**Campaigns & backups** and press **Save campaign cycle**. The dashboard shows
the current cycle without an editable selector. Gear browsing and every card
picker (Titans, memories, Patterns and conditions) include the selected cycle
and all earlier cycles. Cycle 3 therefore offers Cycles I, II and III. Tutorial
and Mnestis Theatre are non-numbered categories and remain available. A later
cycle card cannot be newly selected via the Gear manual-exception option or a
preselected equipment URL; existing assignments remain readable/removable.
This limits available choices; it does not certify acquisition or combat legality. Cycles 1–2 show Ambrosia and Despair; Cycle 3 adds Bleeding; Cycle 4 also shows
Midas and Pain; Cycle 5 adds Oxygen and Aether. Lowering the cycle hides later
types without removing their counts. The selector is shared by all four
Argonauts within one profile; amounts belong to each Argonaut. Other historical
token dictionary entries remain preserved and visible as text. Party resources
remain separate from these tokens.

The optional `campaignCycle` field is backward compatible with schema 2; absent
values mean Cycle 1. New campaigns default to 1, with the chosen cycle stored at creation. No existing token values or assignments
are migrated or discarded. Invalid cycle values and negative known token counts
are rejected at the save-validation boundary.

## Rules supplied by the user on 3 October 2026

These are implementation guidance supplied in conversation, not independently
verified rulebook claims. All gameplay automation below is deferred. Precision
is a combat modifier, separate from the six Argonaut skills. No token count
currently changes skills, Precision, action access or Titan life. Stage 8 uses
recorded counts to check printed ability gates without applying their effects.

| Token | Applicable cycles | Guidance for later implementation |
| --- | --- | --- |
| Despair | 1–5 | While holding Despair and not adjacent to another Titan: 1 token gives −1 Precision; 2 gives −3 Precision; 3 prevents combat actions; 4+ kills the Titan unless an effect changes its Despair limit. Dealing a wound to a Primordial discards 1 Despair token. |
| Ambrosia | 1–5 | 1–4 have no inherent effect. Cards/attacks can check the amount to scale damage or trigger effects. The base limit is 4; exceeding it (5+) immediately kills the Titan. |
| Bleeding | 3–5 | Added after the user’s gate clarification. The counter has the existing Bleeding symbol; printed Bleeding gates compare against this token count. Encounter effects and limits stay manual. |
| Midas | 4–5 | 1–3 are placed on individual Gear cards, disabling each affected card's special rules as it turns to gold. At 4+ the Titan turns completely to gold and dies. |
| Pain | 4–5 | Negative status track increments and encounter-specific injury triggers/thresholds; no universal flat stat penalty. |
| Oxygen | 5 | Counter and cycle availability only; detailed rules have not yet been supplied. |
| Aether | 5 | Counter and cycle availability only; detailed rules have not yet been supplied. |

Before automating Despair, model adjacency, limit modifiers, Despair Resilience
effects, combat-action access and wound events. Before automating Ambrosia,
model limit modifiers and the relevant card/attack interactions. Midas needs
token-to-Gear assignments and precise special-rule suppression; its current
per-Argonaut counter is a manual total and does not assign tokens to Gear. Pain
needs the applicable encounter rules. Do not infer Oxygen/Aether rules.

## Conditions

Select **Add condition** to search the 20 Condition definitions and four Trauma
definitions explicitly marked as conditions. Results and selected entries show
the complete printed rich text. Selecting a card hides the results; an eligible
reverse side can be chosen during selection. Assigned reversible cards have a
**Flip** action below the card, like Gear. Flip immediately
updates the existing record's face and name without opening a modal. Tapping the
card opens editing for selection and removal; there is no separate Edit button.
The editor omits source and duration entry fields, preserving historical notes
when saving changes. Custom named conditions retain a name field. Secret cards
respect spoiler controls. Expiry, effects and flips remain manual.

Gear, Mnemos and Condition controls share the compact outlined Gear button style
and short action labels: **Exhaust / Ready**, **Discard / Restore** and **Flip**
where supported. Editors use **Change card**; removal stays inside editing.
Screen-reader labels retain the card name, without exposing hidden titles.
The shared action row places Flip, Change card and Remove together directly
below the card (after memory nodes where applicable), with Remove last.
Gear and memory search views keep a recovery removal control for the assigned
card, including unavailable references. Every card/resource removal requires
an unchecked confirmation checkbox plus **Confirm removal**; Cancel, closing
the sheet or platform Back returns to the editor without changing saved data.
Pattern override removal via **Use Titan default** follows the same check.
Confirmation replaces an existing sheet rather than stacking native modals.

Each Argonaut may have several condition types, but only one of each type.
Both sides share a type (Fear/Dread, for example); alternate editions with the
same printed name also count as one type. Matching custom and legacy labels
cannot bypass this restriction. The picker disables already-held types and
the reducer blocks duplicate actions, including changing another entry into an
already-held type. Flip the existing record to change sides. Conditions never
stack: the stored amount is one and there is no amount counter. Different
Argonauts may independently hold the same condition.

The optional `conditions` array stores stable record IDs, card references,
names, sources, durations and amount one within party schema 2. Older
`localConditions` strings remain readable and are only converted individually
when explicitly edited. Unavailable references are retained with a notice on
local restore; portable imports reject them. Duplicate structured records are
rejected by validation; catalogue-aware duplicates are reported on local
restore and rejected on import rather than silently removed.

The Condition presentation follows the
[ATCC Condition catalogue](https://aedanthornton.github.io/ATCC/catalog?p=1&s=id%3Aasc&limit=30&cardType=Condition):
white background, ochre uppercase name and subtitle, ruled main effect, ochre
ability titles over grey effect panels, a separate end-of-battle section and
ochre printed-ID footer. All `side.abilities` titles/effects and `side.endOfBattle`
text are displayed, on both faces. Cards wrap into rows on the dashboard and
grow vertically for longer text instead of truncating it. Flagged Trauma cards
retain their existing reference presentation.

## Shared resources and Tides of Fate

**Manage shared resources** edits the party's single resource pool. Add a named
resource (starting at one), adjust its nonnegative amount or remove it. This
pool belongs to the campaign, independently of all four Argonaut token trackers.
No token or condition effects are applied automatically.

The last option in the top-right menu is **Tides of Fate**. Its confirmation
dialog names the campaign and lists the changes. The confirmation checkbox
starts unchecked; **Apply Tides of Fate** stays disabled until checked. Cancel,
outside dismissal and Close apply no changes; reopening requires confirmation
again. The reducer also requires explicit confirmation and the captured campaign
ID, preventing a stale dialog from resetting a different profile.

Apply performs one atomic edit across all four Argonauts: remove structured and
legacy conditions, zero all recorded token amounts (including hidden later-cycle
and historical types), clear exhaustion/discard on every Gear, memory and Titan
instance, and set Rage/Fate/Danger to zero. Unassigned cards are readied too.
Names, colours, skills, card selections/faces, equipment assignments, memory
nodes, Pattern overrides, campaign cycle/order and shared resource amounts are
preserved. The result autosaves and survives restart and JSON backups. This is
the cleanup requested by the user; no additional aftermath effects are inferred
from its name.

Undo controls and history have been removed at the user's request. Conditions
retain individual Remove actions inside the editor, with no separate clear-conditions button.
The existing local-token and shared-resource amount resets remain available;
they retain their dictionary names with zero values.

Stage 7 implementation is ready for review. Gameplay assistance remains Stage 8.

## Verification

The follow-up action-placement/removal-confirmation change passed clean lint,
typecheck, all 128 domain tests and web/iOS/Android exports at
`/private/tmp/ato-card-removal-export`. A read-only Chrome review showed Gear's
Change card/Remove row beneath the reviewed card. Concurrent user browser
activity interrupted the confirmation interaction check; checkbox toggling,
Cancel/reopening and native modal interaction remain runtime acceptance checks.
No card or resource was removed during review.

The subsequent card-action consistency update passed lint, typecheck, all 128
domain tests and web/iOS/Android exports at
`/private/tmp/ato-card-actions-export`. Read-only desktop Chrome inspection
confirmed the condition overlay has no source/duration fields and shows compact
Change card/Remove controls, with historical notes retained on the dashboard.
No campaign data was changed during this review. Native action interaction and
screen-reader review remain pending.

Domain coverage checks cycle availability, hidden count retention, owner
isolation, current-state increments, numeric bounds, malformed input, older
saves, unknown token retention, and restart/backup/import round trips. Browser
and native runtime acceptance are recorded after implementation checks.

On 3 October, all 128 domain tests passed after replacing obsolete undo coverage
with atomic four-Argonaut cleanup, explicit-confirmation/campaign guards and
restart/backup checks. Lint, typecheck and `git diff --check` also passed.
Web/iOS/Android exports passed at `/private/tmp/ato-tides-of-fate-export`.
Tests additionally
cover complete condition text, duplicate types and reverse-side/edition aliases,
legacy preservation, full named abilities/aftermath, direct flips and stale-action
rejection, owner isolation, malformed metadata, scoped resets,
shared resource bounds, and restart/backup/import round trips.
A read-only desktop Chrome review
showed the Cycle 1 selector and Ambrosia/Despair at zero, each with its existing
symbol and compact bordered controls. Later cycle/button interaction review was
interrupted by concurrent browser activity; no token amounts were edited. Cycle
filtering and retained amounts are covered by domain tests. A later read-only
review showed the full Fear reference text, Dread-side action and source/duration
fields. The later card-layout review reproduced the ATCC styling, verified
Fear → Dread directly on the dashboard and the former undo action → Fear,
leaving the original card selection and token amounts intact. A final screenshot
confirmed the named ability and correctly formatted end-of-battle section.
The later cleanup review confirmed that Undo/clear-condition buttons are absent
and the cleanup action is last in the menu. Concurrent user activity in Chrome
interrupted the renamed confirmation-dialog review; no cleanup was applied to
the user's campaign. Checkbox toggling, Cancel and reopening remain runtime
acceptance checks; reducer confirmation/campaign guards and full cleanup are
covered by domain tests.
Duplicate-picker interaction, full cleanup
interaction, narrow layouts, text scaling, screen-reader selection and native
runtime review remain pending. All-platform exports are build checks, not
device acceptance tests.

API references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and
[React Native 0.86 View](https://reactnative.dev/docs/0.86/view).

## Campaign cycle placement and cumulative card choices

The 3 October campaign-cycle refinement passes all 134 domain tests, clean
lint, typecheck and web/iOS/Android exports at
`/private/tmp/ato-campaign-cycle-export`. New coverage checks cumulative card
availability across every bundled family, name/ID/slot filtering, mixed-face
availability, non-numbered categories, chosen-cycle creation, profile isolation
and preservation of saved cards/counts when lowering the cycle. Existing tests
continue to cover local restart, backup and import of campaign cycles.

Chrome showed the updated dashboard with a read-only “Campaign cycle 2” in
Tokens and existing later-cycle assignments retained. Campaign creation/edit
interaction and native device acceptance remain pending; exports verify builds.
The first local preview refresh briefly returned a blank page before the live
preview became available again. No saved campaign data was changed during this
review. A separate isolated preview server could not bind a local port in the
sandbox, so automated mutation of the user's active campaign was avoided.
