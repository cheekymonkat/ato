# Stage 6: memories, Titans and Pattern references

Stage 5 is committed as `67f8b1b` (`feat: persist campaign profiles and add
portable party backups`), including the **Campaign: <save name>** dashboard label.
Stage 6 adds editable Mnemos and Fated Mnemos positions, full Titan presentations
and independent Trauma/Kratos Pattern overrides. Implementation is ready for
review; browser and device interaction checks remain pending.

## Using the new areas

Argonaut tab headings show Least Likely (blue) and Most Likely (gold) badges.
Compare the number of assigned standard Mnemos first, then their total marked
nodes. Fated Mnemos, Trauma and unassigned instances are excluded. Exhausted or
discarded memories still count while assigned; unset node progress counts as zero.
Every exact tie is marked “tied”, allowing a random choice when the story needs it.
These are read-only indicators and update with memory assignments or node edits.
They remain visible in compact numbered tabs, with space reserved below the
heading so switching Argonauts does not move the board.

Select a memory card or empty position on the main board. The memory editor
opens for that Argonaut and position. **Choose card** / **Change card** opens
a searchable catalogue with complete card details, limited to the campaign cycle and earlier cycles. Choose a starting cycle at campaign creation; advance one cycle at a time on the campaign page after confirmation. Select a
card to hide results and review it, then choose **Use this Mnemos** or **Use this
Fated Mnemos**. Secret cards require explicit reveal. Removal stays inside the
editor; exhaustion controls appear below cards on the main board.

Memories flow as two family groups: Mnemos first, then Fated Mnemos. At 836 px
of available memory-area width, the baseline four cards fit in one row. Each
slot grows from 200 to 262 px, with 12 px gaps; below 836 px the Fated pair
wraps together beneath the Mnemos pair. Below 412 px, each family also wraps
its cards individually. Each family measures its own space so card details,
trackers and actions remain inside their borders.

Each assigned card has a tracker immediately below it, on both the board and
editor: ten ordinary dots for Mnemos, three for Fated Mnemos. **−** and **+** save
changes immediately and stop at the applicable bounds. Standard tracks add red
filled gateway dots between ordinary nodes 3–4 and 7–8. These markers are not
extra nodes. Gateways are interpreted as reached when the preceding three/seven
nodes are filled. The first ability is available immediately; the second/third
become available automatically at three/seven nodes. Fated cards automatically
flip to Growth at three nodes: the header becomes blue, its title is `growthName`,
and only `growthAbility` replaces the original hindrance. Reducing Fated nodes
below three restores the black original-name front. Reducing standard nodes below a gateway makes its ability
unavailable again. The editor has no separate Memory progress box or resolution
confirmation controls: the card and tracker handle progress, with Ready/Exhaust
and compatible Flip actions directly below. Assigned standard Mnemos omit locked
ability panels entirely. Ability two appears at three nodes and ability three
at seven; reducing nodes below the respective gateway hides that panel again.
New-card Fated previews show the unresolved front; review of an already-selected
Fated card follows its saved nodes. Standard previews retain all ability panels
without player availability labels. Node counts do not automatically confirm
Story Step resolutions or execute ability text. They do remove a Fated stat
penalty on resolution. Changing to another
memory creates a new instance with zero nodes and locked growth;
reselecting the same memory keeps its existing state. Removing the first card
leaves the second in its own position, with its progress intact.

Each Mnemos and Fated Mnemos definition is unique across all four Argonauts,
including both positions on the same Argonaut and any future reverse face.
The picker shows already-assigned cards as unavailable and names their owner;
reselecting the card in its current position remains allowed. Assignment is also
checked against the latest reducer state, so a stale picker cannot add a copy.
Remove the existing assignment before using that card elsewhere. Uniqueness is
per campaign, so separate saved campaigns can use the same catalogue card.
Earlier saves containing duplicates remain readable with explicit notices;
their progress is retained so players can choose which copy to remove. Such
duplicates block portable import (including direct profile import). Export can
still retain a historical backup without silently deleting conflicting records.

## Argonaut stats

Each listed `stats` entry on an equipped standard Mnemos contributes +1 to the
matching Courage/Cunning/Endurance/Fury/Will/Wisdom value. An unresolved Fated
Mnemos instead contributes -1 to its listed stats, including at zero or unrecorded
nodes. At three nodes its penalty disappears; lowering nodes reinstates it.
Removing or replacing a memory immediately removes its contribution. Exhaustion
does not change these modifiers. Fated front badges show -1; its Growth side
has no original stat badges. Distinct cards' contributions stack or cancel.

Displayed totals and +/- edits use the inclusive range -9 to 9; an empty party
starts at zero. Stored `skills` remain the manual contribution, with modifiers
derived from currently assigned cards and their progress. This avoids duplicate
increments on refresh, import or reselection. +/- operates on the displayed total
and adjusts the manual contribution accordingly. That stored contribution may
fall outside the displayed bounds when needed to offset a memory modifier.
Totals clamp at either bound without deleting the saved contribution. Historical
manual values are preserved rather than rewritten. Missing/unassigned cards do
not contribute; legacy duplicate physical definitions contribute once. No schema
change is needed for this derived behavior. Other ability text remains manual.

Select the Titan button or Titan card to search and review Titans. Its name is
top left, immediately followed by power dice, the movement icon and speed value
on the same line, without visible Power or Speed captions. Type/cycle stays top
right and any subtitle sits beneath the name. Below the header, each ability has
its own row: bold headline, original costs and gates, then its bundled explanation.
The shared keyword resolver prefers a matching subname and shows only that
subdefinition, such as Advanced Reflex. When no subname matches or its definition
is missing, it falls back to the original keyword and its labelled subsections.
Auto- timing guidance is included where applicable. This presentation is shared
by the board, selection results and review. At narrow widths, header items can wrap
and the card grows to retain all text. Nested keyword text stays readable; ability
effects remain player-resolved. Of 84 distinct direct Titan ability keywords,
83 have upstream bundled definitions. `Despair Resilience 1` retains its complete
original name and now has the user's clarified explanation, "Reduce the effect
of Despair by 1", in `data/reference/keyword-overrides.json`. It is not parsed
as a Despair cost plus a separate Resilience ability. Upstream JSON remains
unchanged; local keyword additions record their provenance.
The source tooltip utility and keyword JSON are already captured locally in
`ato_docs/card-design/reference-source/tooltipsUtil.jsx` and `data/reference/`.
The selection view also
shows the supplied Trauma and Kratos tables. Face controls appear only when the
chosen definition actually provides another compatible face.

Exhaust is offered only when the current card's abilities contain an explicit
`costs` entry of `Exhaust`. Other resource costs (Despair, Ambrosia, Midas, etc.),
an Exhaust icon inside effect text, and prose mentions do not qualify. Standard
memory checks include their printed ability panels; Fated eligibility follows
the currently visible front/Growth side. Gear checks include ordinary, gated and
asterisk abilities, while Titans check their abilities. FAQ/errata and unrelated
reference tables do not grant an Exhaust action. Locked Mnemos ability text still
determines whether the card has that printed cost; using the ability itself remains
player-resolved. The reducer enforces eligibility against the latest state.
Eligible Titans now have a separate Exhaust/Ready action below the board card,
using the same grayscale presentation. Earlier exhausted saves remain readable
and preserve that state; Ready is available to clear it even if the current face
has no Exhaust cost. Newly exhausting such a card is rejected. No save migration
or automatic resource spending is introduced.

Discard uses the same explicit-cost checks for Gear, memories and Titans. Its
button appears on the existing action row when the current face has a Discard
cost. Selecting it records `discarded: true`, clears exhaustion, greys out the
full face, labels it Discarded and hides Exhaust/Ready until restored. Restore
clears discard and returns the card to Ready; it does not reapply old exhaustion.
The card remains in its position with nodes, face and other state retained.
Discard currently records reversible card state; it does not automatically
remove slot grants, memory stat modifiers or execute ability consequences.
Restore remains available if the definition is missing, concealed, or the
current face no longer has a Discard cost. Reducers reject invalid, stale and
cross-owner discard actions and prevent exhausting a discarded card.

The optional per-instance `discarded` boolean is included in local saves and
portable backups without changing schema 2. Older saves that omit it mean
not discarded. Validation rejects nonboolean values and simultaneous discarded
and exhausted states. Card definitions are never modified to store this state.

Open either **Trauma table** or **Kratos table** in the Titan abilities section to see its
current reference. By default this comes from the selected Titan. **Choose
Pattern override** offers only Patterns with a nonempty table of that kind.
Trauma and Kratos overrides are separate, work without a Titan, and remain in
place when the Titan changes. **Use Titan default** clears only that override
and resolves the current Titan. Pattern traits, flavour, abilities and table are
shown together. Both references reuse the existing ATCC Pattern design renderer,
including gradients, range bands, medallions, choice boxes, combined effects and
symbols. Missing references remain recorded and are explicitly reported.

## Catalogue evidence and limits

The bundled catalogue contains 46 Mnemos, 46 Fated Mnemos, 44 Titans and 40
Patterns. Each definition currently supplies one catalogue face payload. A Fated
card's physical Growth side is embedded in `growthName` and `growthAbility` within
that payload; nodes select the visible side without inventing a catalogue face ID
or another physical copy. Tests use an explicitly constructed reversible memory fixture
to verify forward compatibility without altering the catalogue.

Mnemos use the ATCC grey card frame, uppercase title and traits, a separate grey
panel for each outer ability group, coloured inline gates and black skill badges.
Sentence gates, costs and tokens are retained. Fated Mnemos use a black title
band and grey hindrance panel until resolved. Its resolved side uses a blue
`#066097` header containing `growthName`, a grey panel for `growthAbility` and
the same printed ID footer. Original name, traits, flavour, hindrance and stat
badges are absent on that side. Both effects are never shown together in the app.
Cards can grow vertically to retain readable text. The extracted
[memory design rules](../../ato_docs/card-design/memories/README.md) record the
source components, colours and measurements. All current Titans supply nonempty Trauma and Kratos tables. Patterns
supply one applicable table and an empty array for the other.

The supplied [Mnemos/Fated node guide](../../ato_docs/mnemos-fated-nodes-spec.pdf)
describes Story Step resolution separately from node accumulation. The user's
subsequent correction takes precedence over its thresholds: Fated cards use three
nodes, and standard red gateways follow nodes 3 and 7. The implementation
interprets each standard gateway as reached at its preceding node count.
Printed Danger gates are not interpreted as node thresholds. The user's later
request removes the separate progress box; availability now follows node counts
directly, without a separate Story Step confirmation in this UI. The guide's shared
Vault, trait-based adventure awards, permanent Growth history and death routing
remain future campaign features. Pattern abilities are displayed for players to
resolve and are not applied as automatic combat effects.

## Save schema and migration

Party saves now use `saveSchemaVersion: 2`. The workspace and portable-backup
envelopes remain at version 1. Storage keys are unchanged so existing saves can
be found. Version-1 parties migrate explicitly in `parseParty`, whether standalone
or nested in a profile/backup. Migration pads dense memory lists with empty
positions, initializes separate null Pattern overrides, and initializes progress
for existing memories. A valid nonnegative integer `counters.node` becomes the
recorded node; its original counter is also retained. Growth starts locked when
no explicit progress was previously supplied.

Other identities, colours, ordering, active selection, equipment, attachments,
Titan state, optional/confirmed effects, placement exceptions, tokens and
conditions are preserved. Migration does not mutate its input. The first migrated
write preserves the original raw save in the previous snapshot. The older Stage
5 application does not understand schema 2; retain an exported older backup if
running an older checkout is necessary.

Memory instances store `{ node: number | null, growthUnlocked: boolean,
breakthroughs?: [boolean, boolean] }` in
`memoryProgress`; new assignments start at zero. Existing null progress remains
unrecorded until the first increment. New node edits accept only integers from 0
through 10 for Mnemos or 3 for Fated. Older saved counts above the applicable
limit remain readable and preserved; the tracker offers an explicit correction
instead of silently truncating them. Historical Growth/Breakthrough flags remain
validated and preserved for backup compatibility, but do not gate the displayed
abilities. Node-based availability is derived on both new and existing saves. Other
edits leave that historical count intact. This changes no save field or envelope
version. Memory position arrays retain null holes so card removal cannot
renumber other progress. Each Argonaut stores `{ trauma, kratos }` in
`tableOverrides`, with stable definition/face references or null. These references
and all independent instance state survive save, export and import. Invalid
progress, duplicate assignments and malformed references fail validation. Local
restore retains unavailable references with a notice; portable import reports
unresolved references and leaves existing profiles intact.

Exhausted and discarded memory cards use the shared greyscale renderer for
coloured icons, gates and the Fated Growth header. Since standard Mnemos already
have a neutral printed palette, an explicit darker grey background/panel and
softer ink distinguish their inactive state, including cards at zero nodes.
Ready/Restore returns the original palette. The board and memory editor share
this presentation and show the corresponding Exhausted/Discarded status.

## Verification through 3 October 2026

The following passed:

```sh
npm run test:domain
npm run typecheck
npm run lint
npx expo export --platform all --output-dir /private/tmp/ato-memory-visibility-export
git diff --check
```

There are 109 passing tests. New coverage exercises memory position holes,
independent cards/families/Argonauts, exhaustion, node zero versus unrecorded,
growth, replacement versus reuse, malformed edits and cross-owner instance reuse,
compatible face changes and complete backup/import round trips. Node tests cover
both bounds, successive updates against current state, legacy null/overflow
progress, independent cards and Growth becoming available at three nodes.
Gateway tests exercise every increment/decrement across thresholds, automatic
availability, legacy flags being ignored for availability and backup retention.
Uniqueness tests reject duplicate definitions in different slots and on every
other Argonaut, preserve same-position progress, release removed/replaced cards,
reject stale selection, cover reverse faces and retain/report historical copies
while blocking their import. Independent campaign profiles remain allowed.
Panel tests preserve every bundled Mnemos ability group. Reference tests
cover Titan changes, separate Pattern overrides, default resets, Patterns without
Titans, wrong-table rejection, missing references without silent fallback, and
rich-text preservation across every bundled reference-family card. Storage tests
now use actual version-1 fixtures, including nested envelopes and preservation of
the original raw recovery snapshot. The complete party fixture includes modern
memory progress and both Pattern overrides as well as existing equipment state.
Additional coverage checks all 46 Fated front/Growth mappings, threshold flips
and backup restoration on the same unique instance. All 92 memories' printed
stats are checked against the matching Argonaut fields. Tests cover stacking,
cancellation, resolution/decrement penalties, exhaustion, reselection, replacement,
removal, signed limits with positive/negative modifiers and backup retention.
Titan presentation tests preserve every headline and its associated definitions,
matching subdefinitions or original keyword fallbacks, costs, gates and icons
across all 44 Titans. Tests cover case, whitespace, hyphens, parameters, Auto-
timing, primary-name collisions and unavailable subdefinitions. A
Gamechanger regression verifies all four explanations and Advanced Reflex's
Fate/Exhaust costs while displaying only its matching subdefinition. The local Despair Resilience explanation retains the whole
ability name without adding an artificial cost. Exhaust tests distinguish real
costs from resource costs, effect icons and FAQ text, enforce Gear/memory/Titan
transitions, reject stale edits, follow Fated side thresholds and recover
historical exhaustion. Older fixture saves explicitly model historical exhaustion
where a card no longer qualifies for the action.
Discard coverage checks actual costs versus prose/icons/FAQ, clearing exhaustion,
Restore, copy and owner isolation, retained placements/nodes, Fated-side thresholds,
stale actions and invalid save state. A storage regression preserves discarded
Gear, memory and Titan instances through local restart, backup and import.
Visibility tests cover all 46 standard Mnemos across unrecorded/zero nodes and
both gateways in each direction, preserving original ability indices and source
groups. Catalogue previews still show all printed panels. Palette tests check
neutral inactive colours, Growth/gate greyscale conversion and readable contrast.

All three platform bundles compile. The live ATCC Mnemos catalogue was visually
inspected. A desktop Chrome review verified the local Mnemos editor's full text,
available first ability, dimmed/labelled later abilities, gateway markers in both
gaps (subsequently recoloured red) and the then-present Breakthrough confirmation
controls (subsequently removed). The board's
accessibility tree also reported the three-node Fated track. Player state was
not changed during this review. Further navigation lost the Chrome window
connection (`cgWindowNotFound`), so browser transition/narrow-screen and native
runtime acceptance remain pending.
The later uniqueness review opened the empty second Fated position and verified
that Bloodthirsty, already held in position one, had an owner notice and a
disabled selection button. The picker was closed and the board restored without
changing player data. Reducer tests cover conflicts on all four Argonauts;
broader picker interaction and native reviews remain pending.
The later stat review read the live board and confirmed calculated values and
enabled decrement controls at zero. The user was actively changing their board,
so no player cards or nodes were edited for verification. Interactive Growth-face
visual acceptance remains pending; transitions and stat effects pass domain tests.
The later Titan review visually inspected Gamechanger on the wide desktop board:
left name and dice/speed, right type/cycle and individual expanded abilities were
all visible, with Advanced Reflex's costs and its source variant subsections.
No player state was changed. Narrow-screen/native Titan review remains pending.
The compact-header review subsequently verified Gamechanger's name, power die,
movement icon and value on one line, with type/cycle at the top right. Advanced
Reflex retained its costs and displayed only its matching "2 spaces instead."
explanation. This read-only Chrome review did not change player state.
The flexible-group review showed all four memories together on the wide board,
and the Mnemos pair on the first row at a narrower desktop width. Gear groups
also moved across or wrapped as space allowed. Lint, typecheck and all-platform
exports passed after these layout changes; phone/native review remains pending.
The subsequent discard change passes 107 tests, lint, typecheck and all-platform
export. Live button/greyscale review remains pending: the computer-use tool could
not locate the Chrome window (`cgWindowNotFound`) during this check.
The later exhaustion review read the live board without changing player state.
It verified Exhaust on the selected eligible Titan, Abyss Mirrors, Achillean
Hectors and Argocryptex Alpha, and its absence on Abyss Linothorax, Agathos
Agitator, A Broken Promise and the two Fated memories. Reducer tests verify
the transitions; native interaction review remains pending.
The 3 October memory review verified A Dream You Hold at zero nodes in Chrome:
only its first ability panel appeared, with no locked ability text. Clicking
Exhaust visibly changed the card background, panels, ink and stat badges to the
inactive grey palette and displayed Exhausted/Ready. Clicking Ready restored
the original appearance. The card was left Ready with its original zero nodes.
The live board also showed Exhaust and Discard together on Argocryptex Alpha;
the Discard/Restore click transition and native memory review remain pending.
These builds and pure-state tests do not establish complete visual or device runtime
acceptance. Preserve the Stage 2–5 review backlog, including native restart and
platform file handoff checks.

Before marking Stage 6 acceptance complete:

1. On narrow and wide screens, choose two memories of each family, read every
   ability/gate/cost, edit independent nodes and Fated growth, exhaust one card,
   remove the first, and confirm the second keeps its position and progress.
2. Select a Titan, read its abilities and each table, set independent Pattern
   overrides, change Titan, and reset one override. Confirm the other stays put.
   Repeat choosing a Pattern without a Titan and clearing that Pattern.
3. Refresh/restart after saving, then export/import the party as a new profile.
   Check all four Argonauts, overrides, node values, growth and exhaustion.
4. Verify reveal controls, hidden card names, selection/result switching, keyboard
   focus, screen-reader labels, touch targets and vertical scrolling on web,
   iOS and Android. Confirm memory interactions do not trigger Argonaut swipes.

Implementation API references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo Router parameters](https://docs.expo.dev/router/reference/url-parameters/),
[React Native 0.86 Pressable](https://reactnative.dev/docs/0.86/pressable),
[Expo SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/).

## Titan artwork and ability exhaustion

The approved Titan layout places the selected Titan's illustration behind the
Titan and Memories column. The Titan name opens a compact title/cycle picker;
Titan selection is no longer part of Argonaut Options. Every Dreamwalker uses
Solon's illustration. The picker lists Dreamwalker, Spartan Dreamwalker,
Delphian Dreamwalker, Persian Dreamwalker and Cycladean Dreamwalker separately,
including only types from the current campaign cycle and earlier. Named copies
within the same subtype remain one choice, retaining a selected copy's ID.
Movement appears before the power die. Standalone
Auto-black, Auto-break and Power Re-roll modifiers appear beside that die,
while limit abilities appear as clickable icon/value chips below the heading.
Other abilities keep their full supplied explanations, with cost icons directly
after the title. The Truth adds Auto-hope 1 to the dice row at Rage 7 or higher.

Titan, Mnemos and Fated Mnemos exhaustion belongs to individual printed
abilities. An optional `CardInstance.exhaustedAbilityIds` list records face/path
IDs, such as `front:abilities:1:0`; two identical abilities remain independent.
Only an unlocked ability with an explicit Exhaust cost has a tappable printed
Exhaust cost icon. There is no separate action button beneath the ability.
The icon turns red when exhausted; tapping it again readies the ability. Exhaust
dims that ability, while leaving the name, stats,
passives, other abilities and node tracker active. Neither action spends other
costs automatically. Discard retains its existing whole-card behaviour.

Older saves remain schema version 2. A legacy whole-card Exhaust flag is shown
on currently unlocked Exhaust-cost abilities only. The first individual edit
converts that marker to the list without losing other abilities' state. Missing
references retain saved IDs. Refresh Gear and Tides of Fate clear both forms of
exhaustion; backups persist the per-ability list. Memory nodes and Fated-side
changes keep each ability's readiness, including temporarily hidden panels.

Artwork is reproducible using `python3 scripts/extract-titan-art.py`.
`data/reference/titan-art-originals.json` records source hashes and exact
full-resolution crop rectangles. Lossless PNG crops are archived under
`../ato_docs/titan-art`; the app bundles smaller full-resolution JPEGs in
`assets/titan-art`, registered by `src/theme/titan-art.ts`. Printing is excluded
by cropping; obscured illustration pixels are not invented or reconstructed.
The same record documents the original Skyseer scan's movement 7 and
Auto-break 1 correction to source card CK1282, followed by catalogue import.

Manual acceptance: on web, iOS and Android, choose different Titans and
Dreamwalkers, tap modifier/limit details, exhaust one of two unlocked Mnemos
abilities, adjust nodes across both gateways and the Fated resolution point,
then refresh, restart, and export/import. Check that only the selected ability
changes and that tapping its control never opens the memory editor or swipes
to another Argonaut.

The dashboard, Titan picker and Argo page warn only when the same Argo-bred
(non-Dreamwalker) Titan type is selected by multiple Argonauts. Different
Argo-bred types can coexist across all four Argonauts. Full printed type names
are grouped, so copies of the same named type share the limit while distinct
names remain separate. The warning lists each duplicate type and its owners,
and disappears when duplicates are removed or replaced. Every named Dreamwalker
and cycle subtype may repeat, including four copies of the same variant.
Exhausted/discarded Titans still count as selected; unresolved references are not
assumed to be Argo-bred. This remains an advisory warning and never erases or
blocks restored campaign data. Each Argonaut has one selected Titan reference;
choosing another replaces it.

## Memory layout rounding correction

Memory family groups now receive explicit widths from the measured Memories
container before card sizing, replacing their separate child-driven flex growth
and layout measurements. Card widths round down with spare space for fractional
browser/native layout rounding, keeping a family's last card from unexpectedly
wrapping and leaving a large gap. All four baseline memories share a row when
the container is at least 838 px wide. At narrower widths the Fated pair moves
below the Mnemos pair; each pair keeps two columns when it fits, then one on
phones. Cards retain the existing 262 px maximum outer width and full contents.
Saved slots beyond current capacity remain visible in the same family.

Layout regression scenarios sweep fractional widths through 5000 px, both
baseline pairs, phone widths, wrapping boundaries and expanded saved-slot counts.
Interactive visual verification remains pending: computer use reported no
available browsers/apps and a native pipe startup failure during this review.
