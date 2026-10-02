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
- Counters start in the 0–9 range. Increasing beyond 9 opens a manual-value confirmation. The reducer refuses unconfirmed increases beyond 9; lowering an accepted manual value remains possible. No death or campaign consequence is automated.
- The colour picker offers eight named colours and a validated custom hex input. A full-width, 4 px separator immediately above the card area shows the active colour. Names and page numbers remain visible. Tab number contrast adapts to the chosen colour.
- The Titan picker searches the catalogue and filters by cycle. Selecting a Titan enables its Trauma and Kratos reference tables.
- Both reference tables now use the extracted ATCC Pattern styling, preserving ranges, symbols and Kratos alternatives/combined effects. [Design and verification](PATTERN_TABLES.md)
- The layout includes two Weapon positions, Armor, two base Supports, three Attachments, two Mnemos and two Fated Mnemos areas, plus Tokens and Conditions reference areas.
- Support and other capacities are derived from active equipment effects. Grants cannot activate themselves from their own bonus position. Occupied positions that disappear remain visible under Needs reassignment.
- At an available dashboard width of 900 px or more, Equipment sits beside Triskelion and Memories. Below 900 px, the order is Triskelion, Equipment (including Support and Attachments), then Memories, Tokens and Conditions. Breakpoints use the measured dashboard width as well as the window width, so a constrained app area can stack within a wide browser. Vertical sections and stacked skills retain their content height. Small screens reflow skill controls and counters rather than shrink touch targets.

State is in memory in this stage. Colour is stored on the Argonaut's player-data record, but it does not survive app restarts until Stage 5 implements storage. General equipment selection, attachment-host rules and hand-span validation belong to Stage 4; the empty slot areas are noninteractive placeholders. Full Gear-card rendering belongs to Stage 3. Tokens and Conditions show current data without an editing flow.

## Modules

| Location | Responsibility |
| --- | --- |
| `src/app/_layout.tsx` | Safe-area, party-state and Router shell |
| `src/app/argonaut/[id].tsx` | Route ownership, bounded selection and development fixtures |
| `src/state/party-reducer.ts` | Isolated state changes and overflow guard |
| `src/state/PartyProvider.tsx` | Shared state across all four routes |
| `src/dashboard/Dashboard.tsx` | Responsive layout and editable dashboard |
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

Implementation references: [SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [Router installation](https://docs.expo.dev/router/installation/), [safe areas](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/), [SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/), [PanResponder](https://reactnative.dev/docs/panresponder).
