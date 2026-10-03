# Four-Argonaut dashboard

Stage 2 adds the Expo Router application shell and dashboard components. The source follows `../ato_docs/layout.pdf` and the proposed neutral parchment, charcoal and gold palette in the development plan. It uses the existing SVG game symbols, with editor metadata removed from the embedded copies for native rendering. Their originals remain unchanged in `ato_docs/images`.

## Status

Implementation and dependencies are in place. Typecheck, uncached lint, 23 domain tests, the deterministic catalogue check and the production web export pass. Desktop Chrome renders the dashboard and the isolated Pattern-table preview. Safari responsive previews at 320, 390 and 800 px show Triskelion above Equipment without overlap; at 1000 px they remain side by side. The full interaction and native checklist below remains pending. The earlier dependency-installation blocker is resolved.

The dependencies were selected through `expo install` using this app's SDK 57 dependency map. For a fresh checkout:

```sh
cd /Volumes/Code/boards/ato
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-svg
npm run typecheck
npm run lint
npm run test:domain
npm run catalogue:check
npm run web -- --clear
```

The app entry point is now `expo-router/entry`. Routes live under `src/app`; other modules remain outside that directory. A copy of the user's original tap-test screen is retained in `docs/starter-App.tsx.txt`; `App.tsx` itself is preserved. The app now permits landscape orientation and uses Metro for web. No native project directories are created manually.

## Behaviour

- Four stable Argonaut IDs have individual routes at `/argonaut/arg-1` through `/argonaut/arg-4`.
- The root route opens the active Argonaut. Direct links and navigation update that active ID.
- Left swipes move forward and right swipes move back, bounded at the first and last pages. Tabs and labelled previous/next buttons provide touch, mouse and keyboard alternatives.
- Vertical gestures stay with scrolling. Gestures starting on buttons or text inputs are guarded so they cannot change the Argonaut.
- The shared party provider keeps edits when moving between routes. Every edit explicitly names its owner; a dialog or callback cannot write into another Argonaut accidentally.
- Names, all six skills, validated colours and Rage/Fate/Danger counters are editable.
- All six Argonaut skills use two rows of three bordered stat cards, in the existing order: Courage, Cunning, Endurance / Fury, Will, Wisdom. Each title sits above a single decrease–value–increase row. Cards retain 44 px action targets and a minimum width of 110 px; the smallest phones wrap to two columns rather than squeeze the controls.
- Browse Gear is available through the hamburger menu at the top right of the masthead. The menu closes on selection, its close button, an outside press or the platform's modal-dismiss action. Previous/next Argonaut buttons and the current position now sit at the right of the Titan row; on small screens they sit below it, aligned right. The swipe instruction text is removed; swipe navigation and all four direct tabs remain available. Chrome checks confirm menu navigation to the catalogue and back, and next/previous navigation between the first two Argonauts with the first-page boundary disabled.
- Triskelion sits beside the Argonaut skills in the identity area, following `../ato_docs/trisk.png`: Rage and Fate across the top, Danger centred underneath. Each counter keeps its icon/title immediately above the decrease–value–increase controls, enclosed by a subtle 1 px rounded border with 4 px padding. Current Cycle remains beside the heading. Below 780 px dashboard width, Triskelion stacks beneath the skills. Values above nine retain their manual-value indicator and overflow confirmation.
- Trauma and Kratos table links are in the Titan abilities section. With a visible Titan, they sit after the name, power dice and speed, wrapping within the header when necessary. They are separate from the Titan edit press targets. The links remain available without a Titan or with a concealed Titan, allowing Pattern overrides to be accessed.
- Counters start in the 0–9 range. Increasing beyond 9 opens a manual-value confirmation. The reducer refuses unconfirmed increases beyond 9; lowering an accepted manual value remains possible. No death or campaign consequence is automated.
- The colour picker offers eight named colours and a validated custom hex input. A full-width, 4 px separator immediately above the card area shows the active colour. Names and page numbers remain visible. Tab number contrast adapts to the chosen colour.
- The Titan picker searches the catalogue within the campaign cycle and earlier cycles. Choose or edit the campaign cycle on the campaign page. Selecting a Titan enables its Trauma and Kratos reference tables.
- Both reference tables now use the extracted ATCC Pattern styling, preserving ranges, symbols and Kratos alternatives/combined effects. [Design and verification](PATTERN_TABLES.md)
- The layout includes two Weapon positions, Armor, two base Supports, three Attachments, two Mnemos and two Fated Mnemos areas, plus Tokens and Conditions reference areas.
- Support and other capacities are derived from active equipment effects. Grants cannot activate themselves from their own bonus position. Occupied positions that disappear remain visible under Needs reassignment.
- The dashboard uses the full available width without a page-width cap, with aligned 32 px side padding (16 px on small screens) across its header, identity, board and footer. Skills and Triskelion sit after the identity name at 1040 px or wider; below that, the name sits above them. At 1150 px or more, Equipment sits beside Titan abilities and Memories. Below 1150 px, Equipment (including Support and Attachments) precedes Titan abilities, Memories, Tokens and Conditions. Breakpoints use the measured dashboard width as well as the window width, so a constrained app area can stack within a wide browser. Vertical sections and stacked skills retain their content height. Small screens reflow controls rather than shrink touch targets.

State is in memory in this stage. Colour is stored on the Argonaut's player-data record, but it does not survive app restarts until Stage 5 implements storage. General equipment selection, attachment-host rules and hand-span validation belong to Stage 4; the empty slot areas are noninteractive placeholders. Full Gear-card rendering belongs to Stage 3. Tokens and Conditions show current data without an editing flow.

## Modules

| Location | Responsibility |
| --- | --- |
| `src/app/_layout.tsx` | Safe-area, party-state and Router shell |
| `src/app/argonaut/[id].tsx` | Route ownership, bounded selection and development fixtures |
| `src/state/party-reducer.ts` | Isolated state changes and overflow guard |
| `src/state/PartyProvider.tsx` | Shared state across all four routes |
| `src/dashboard/Dashboard.tsx` | Responsive layout and editable dashboard |
| `src/dashboard/DashboardMenu.tsx` | Top-right menu and catalogue navigation |
| `src/dashboard/model.ts` | Derived positions and swipe classification |
| `src/components/SwipeSurface.tsx` | Gesture capture and interactive guards |
| `src/dashboard/*Picker.tsx` | Colour and Titan selection |
| `src/dashboard/*Dialog.tsx` | Overflow and Titan reference tables |
| `src/theme/` | Shared palette, type styles and existing game symbols |

## Development fixtures and verification

In development only, these explicit URLs apply a fixture to the selected Argonaut:

- `/argonaut/arg-1?fixture=baseline`: empty loadout, two Supports.
- `/argonaut/arg-1?fixture=trireme`: Trireme Breastplate, three Supports.
- `/argonaut/arg-1?fixture=paradox`: Horseskull Pauldron, a third Support restricted to Paradox Gear.

Fixtures are ignored in production. They are not exposed as production controls. They replace that Argonaut's preview loadout, so use them only in disposable development sessions. Navigating to other Argonauts leaves their data independent.

Remaining runtime review:

1. Extend the recorded 320, 390, 800 and 1000 px browser layout review to populated equipment, text scaling and native devices. The empty-loadout preview confirms Triskelion ordering and section spacing; the smallest view wraps battle counters and equipment cards.
2. Edit each Argonaut, move through all four, return and confirm each edit remains isolated.
3. Check name edits, palette/custom colours and full-width separator changes.
4. Select Titans and inspect both reference tables.
5. Increase a counter through 9, cancel overflow, confirm a manual value, then decrement it.
6. Swipe at both boundaries; drag on counters and inputs; scroll vertically without changing Argonaut.
7. Inspect all three fixture URLs, including restricted bonus labels and independent capacity on the other Argonauts.
8. Check keyboard access, dialog dismissal, text scaling, small-phone readability and touch-target size.

Native iOS/Android and landscape-device interactions remain untested until recorded here. Shared TypeScript and web checks alone do not establish native runtime behaviour.

### Compact stats and Triskelion review

The revised layout was reviewed in Safari at desktop width and in responsive
previews at 320, 375, 390 and 1040 px. The 375/390 px previews show two rows of
three skills; 320 px uses three rows of two. A temporary, read-only Gamechanger
preview confirmed the Titan header links fit beside dice/speed when wide and
wrap beneath them on the smallest screen. Trauma and Kratos each opened their
own reference dialog, without opening the Titan selector. The 375 px preview
also checked -9 and +9 skill values: both retain a single control row. The
temporary preview route was removed; no campaign edits were dispatched.

Implementation references: [SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [Router installation](https://docs.expo.dev/router/installation/), [safe areas](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/), [SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/), [PanResponder](https://reactnative.dev/docs/panresponder).


## Named Argonaut suggestions

The name field uses the 23 bundled Argonaut definitions. Nineteen have a named
portrait and one printed skill; four generic “Argonaut” records say “Choose”
and are omitted from predetermined-name suggestions. Custom names and their
manual stats remain supported. Partial matching ignores case and accents,
prioritises prefixes, and follows the active campaign's cumulative cycle limit.
Oleander is a Cycle IV portrait whose printed skill is Wisdom. Up to five
suggestions show at once; additional results prompt more typing.

Typing edits a local draft, without changing the saved name, portrait, skills or
memories. Selecting a named suggestion, **Use this custom name**, or Return for a
changed custom name opens **Change Argonaut**. The confirmation explicitly lists
the six-stat reset, removal of all Mnemos and Fated Mnemos with their nodes,
clearing all conditions and tokens, and the new portrait's +1 bonus (or zero stats for a custom name). Its checkbox must
be accepted before **Confirm Argonaut change** is enabled. Cancel, ×, backdrop,
hardware Back and **Cancel name edit** discard the draft and retain saved data.
Selecting the same name and portrait, or pressing Return on an unchanged name,
does not reset progress or request a replacement.

The single owner-bound `argonaut-change` action requires explicit confirmation,
the captured campaign ID and the previous name/portrait identity. Stale dialogs
cannot reset another campaign or a newer Argonaut. Candidate validity and cycle
availability are checked before removing anything. A confirmed replacement
resets all six manual skills to zero and removes standard/Fated memory instances,
including unassigned catalogue-recognised memory instances, clears their slot IDs
and drops their nodes/state. Legacy host links to removed memories are cleared.
The new stable `argonautDefinitionId` and name are applied in that same save;
its +1 printed skill bonus is then derived. Both legacy and structured condition
records are cleared. The token dictionary is emptied, including hidden
later-cycle and custom tokens; displayed counters default to zero. Gear, Titan,
colour, Triskelion, Pattern overrides and shared resources are retained.
Other Argonauts are unaffected. New memories can subsequently apply their normal
bonuses; manual +/− controls remain available for the new Argonaut.

Suggestion buttons remain available after the field loses focus so tapping
with a mobile keyboard or using Tab to reach a result cannot lose the choice.

Portrait bonuses use the Core Rulebook's +1 portrait skill rule (Argonaut
Retirement / Argonaut Skills). The publisher's
[resources page](https://intotheunknownstudio.com/resources) links to
[Core Rulebook v1.1](https://drive.google.com/file/d/1vPofVQlG_j_nA3v63YWnU9WsMovJ-uxb/view).
The rulebook text is also indexed in the
[rulebook copy](https://gamers-hq.de/media/pdf/7b/1c/7f/ATO_CORE_Rulebook_v1-1.pdf).
The selected skill comes from each portrait's local `stat` field. No numeric
stat array is supplied in these records. The source catalogue is unchanged.

The existing save-schema field stores identity without a schema migration.
Backups/restarts retain it, and lowering the campaign cycle does not remove an
already selected portrait or its bonus. Manual +/− controls still change the
displayed stat by one, within −9 to 9, including with portrait and memory bonuses.

Validation: all 140 domain tests, lint and typecheck pass. Web/iOS/Android
exports completed at `/private/tmp/ato-argonaut-name-export`. Six new tests
cover partial/accent matching, cycle limits, all named portrait mappings,
owner isolation, non-stacking selection, custom names, manual adjustments,
memory stacking, both stat bounds, backup/restart and retained lower-cycle
portraits. Live Chrome showed Leocules with “Portrait bonus: +1 Will” and the
campaign cycle display. No saved data was changed by the browser review.
Native keyboard, screen-reader and suggestion-selection interaction checks
remain pending; exports are build checks.

The replacement refinement passes all 143 domain tests, lint and typecheck.
Web/iOS/Android export validation is recorded at
`/private/tmp/ato-argonaut-replacement-export`. New coverage verifies removal of
all four assigned memories and an unassigned memory, zeroed manual skills,
new portrait bonuses, custom replacements, preserved Gear/other owners,
legacy host cleanup, no-op reselects, mandatory confirmation, stale
campaign/identity rejection, invalid-cycle rejection and full backup/restart.
The name input is blurred before opening the confirmation to dismiss the mobile
keyboard. Browser review was read-only and retained the saved Leocules; no
Argonaut was replaced during that review. Confirmation interaction and native
device checks remain pending; export validation is a build check.
