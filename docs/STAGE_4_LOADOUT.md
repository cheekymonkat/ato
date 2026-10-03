# Equipment selection and loadout editing

Stage 4 makes Weapon, Armor, Support and Attachment positions editable. It uses the shared Gear presentations and the catalogue's existing capacity effects. Titan selection, skills and battle counters continue to use typed party actions. The implementation is ready for runtime review; browser/native interaction checks remain outstanding for the reasons recorded below.

## Try it

1. On an Argonaut, select the empty **Armor** slot, search `Trireme Breastplate`, select its card preview and choose **Equip card**. Selecting the preview hides the search panel; **Change card** restores it with the previous search and filters. Support capacity becomes three.
2. Equip a Support in the bonus position. Edit the Armor and remove it or select a replacement. The bonus position disappears and its card stays under **Needs reassignment**. Select that card, choose a destination and save.
3. Equip `Horseskull Pauldron`. Its bonus picker shows Paradox Support Gear. To review an exceptional placement, choose **Show all Gear for manual exceptions**; compatibility warnings require **Use a manual override** and a nonblank reason before saving.
4. Equip `Hammer-Sword` in a Weapon position. It occupies two positions with one instance. Select **Flip** below the card; Hidden Xiphos uses one position. In Review selection, **Flip to back/front** changes only the candidate preview until **Save placement**. Single-sided cards have no face control.
5. Equip two copies of a one-hand face in separate positions. Exhaust or flip one and navigate between Argonauts; their state remains independent.
6. Equip `Nosoi Backpack` in Armor. Enable its additional hand using the controls below the card. The choice is explicit and its printed Ambrosia consequence remains a manual reminder. Disabling it moves equipment in the lost hand position into Needs reassignment.
7. Equip `Atlantean Oscillator` or `Hermes Gear Mk. I` directly in an Attachment position. No host choice or selected Titan is required. Removing/replacing unrelated Gear or changing/removing the Titan leaves attachments in their positions with their state intact. `Telemachus Fist` reserves two Attachment positions.

Search supports names and printed IDs, limited to the campaign cycle and earlier cycles. The campaign page owns the cycle setting; manual Gear exceptions cannot bypass this limit. Choose equipment and Browse Gear share the `GearResults` card grid with 12-card pages, showing stats, dice, abilities, gates and IDs, plus cycle/slot/traits below each revealed preview. Previews retain the source dimensions and scroll internally for longer content. Slot compatibility still filters picker candidates. Selecting a candidate hides the search/results panel and scrolls to the focused review; the review shows the full selected face without an Inspect button. In Browse Gear, selecting a card opens the Stage 3 full-card route. Secret definitions remain concealed until revealed, including in picker results and dashboard cards. The editor initially reviews an existing equipped card with results hidden. **Change card** reopens search; **Back to selection** cancels browsing without changing the current selection. Search text, page and matching/all-Gear choice survive this toggle. All edits name the owning Argonaut explicitly.

## Placement and capacity

`src/domain/loadout.ts` provides pure slot parsing, placement planning, derived active equipment and removal/face transitions. `src/state/party-reducer.ts` applies those transitions using the same repository supplied by `PartyProvider`. The UI displays the planner's result before dispatch; the reducer validates again against its current owner state.

- Simple printed slots map to Weapon/Armor/Support/Attachment positions. A two- or three-hand selection reserves that many available positions for one instance. Multiple printed alternatives require a selected interpretation; `* Hands` and `2 1 Hands`/`3 1 Hands` retain visible manual-review guidance. DoubleAttachment uses two Attachment positions.
- Extra positions are derived from active sources after every transition. No slot totals are incremented or saved. Resolution starts with the baseline and follows valid placements and capacity grants, so a source cannot activate itself from its own bonus slot or through a circular dependency.
- A replacement removes only the instance occupying the chosen target. Other occupied positions are not silently overwritten to make room for a large weapon. Insufficient capacity is a compatibility warning; an explicit override can reserve the available positions and record the hand-capacity exception.
- The Paradox bonus restriction is checked in both candidate filtering and placement validation. Manual overrides store the specific compatibility codes and the player's reason on the assignment. They cannot create nonexistent positions, duplicate instance identities or circular capacity dependencies.
- Ordinary passive capacity stays active while a card is exhausted. Optional grants require saved `enabledEffectIds`. Conditional grants require saved `satisfiedEffectIds`, set only through an explicit player confirmation. The current catalogue has seven capacity sources; conditional-grant reducer testing uses a synthetic future case. No current gated grant is invented from unrelated ability text.
- Losing a bonus position retains its assignment/instance and independent face, exhaustion and counters. It is excluded from active capacity and presented under Needs reassignment. An unchanged optional source can restore the same stable bonus position; reassignment instead moves the existing instance without resetting its state.

Placement warnings cover printed slot/span and bonus traits. Acquisition, Unique/Restricted scope, Argonaut Possession mechanics, skills, combat consequences and other ability-specific rules remain manual. This follows the techspec's role as guidance; it is not a complete game legality engine. The UI asks players to check special ability requirements before equipping.

## Dashboard card details

Equipped Weapon, Armor, Support and Attachment cards now use the same `GearCard` renderer as full inspection. They show all offensive/defensive stats, dice, complete ability text, gated abilities, asterisk effects and printed IDs, plus cycle, face, slot and traits. Needs reassignment also renders the complete face. Selecting an equipped card, a Needs reassignment card or an empty equipment slot opens the owner-bound editor. Separate Inspect/Edit/Equip buttons have been removed. Secret cards open the editor with a spoiler warning and reveal control. Browse Gear cards open the full reference and keyword view by selecting the card itself.

Dashboard cards use intrinsic height rather than a truncated summary or fixed-height preview. Width follows the measured space, capped at 240 px. Equipment slots are capped at 262 px including padding/borders. Equipment (Weapons and Armor), Support and Attachments are independently headed groups that flow left to right and wrap when necessary. Groups size from their actual slot counts, including additional granted positions. Cards share available width between 200 and 262 px where possible; within a narrower group, three columns fit at 624 px, two at 412 px, and one below that. The baseline Equipment and Support groups can share a row at 1060 px of equipment-column width; all three baseline groups fit at 1708 px. Group gaps are 24 px and card gaps are 12 px. Below these widths, later groups drop to the next row. The dashboard stacks Triskelion above Equipment below 1150 px of available page width. Text keeps the full renderer's minimum readable sizes; longer content remains available by page scrolling. Secret faces remain concealed until revealed.

The later flexible-group change passes lint, typecheck and web/iOS/Android export to `/private/tmp/ato-responsive-groups-export`. Read-only Chrome review showed all three gear groups in one row on the wide board, then Attachments below Equipment/Support at a narrower desktop width. Phone/native layout review remains pending.

Exhaust/Ready and Flip sit directly below each equipped card, as separate tap targets outside its selection surface. Flip appears only for revealed reversible cards and updates the saved instance through the existing reducer. Optional capacity controls, condition confirmations and consequence reminders also sit below their card. Remove remains in the editor. Review selection shows one **Flip to back/front** control only when another face exists; it changes the draft until saved. The selection surface uses the existing swipe guard so editing taps and drags do not change Argonauts.

All Gear cards offer manual Exhaust/Ready and Discard/Restore on that row,
including Gear without those printed costs. These player-directed controls apply
to the selected instance only; memories and Titans retain cost-based eligibility.
Discard clears exhaustion,
hides Exhaust/Ready and shows the retained card in grayscale with a Discarded
status and Restore action. Restore returns it to Ready. Per-instance discard
state survives editor review, face changes, local restart and portable backups;
it does not delete the card, its placement or its recorded choices.

Active condition names also appear beside the Titan selector, after its cycle
text, in yellow boxes with black borders and black text. The labels derive from
the selected Argonaut’s conditions, including legacy labels, and update on
addition, removal, card flip and Tides of Fate. They wrap when space is limited;
the complete condition cards and controls remain in the Conditions section.

Refresh Gear replaces the previous/number/next controls beside Titan selection.
It clears exhaustion on the selected Argonaut’s card instances, including both
memory types and the Titan. Discards, assignments, nodes, tokens, conditions,
skills and counters remain intact. The action is owner-qualified and saved through
the existing persistence path; tabs and swipe navigation remain available.

The Argonaut-name dialog offers Update name only, which changes just the display
name while retaining the current portrait definition/bonus and every other field.
Replace Argonaut and reset keeps the confirmed replacement flow. Both edits check
the captured campaign and identity so a stale dialog cannot change another state.
The combined follow-up passes 178 domain tests, lint and typecheck; the scenarios
cover per-card isolation, reversible discard, Refresh Gear and name-only preservation.

Exhausted equipped and Needs reassignment faces display in grayscale, including papyrus, cycle colours, shadows, stat cells, dice, symbols and gate gradients. The same appearance applies when reviewing that instance in the editor; new replacement candidates and Browse Gear definitions remain coloured. Ready restores the original presentation. Desaturation changes each colour using luminance weights rather than dimming or flattening the card to one gray, preserving relative brightness and alpha. SVG recolouring only touches paint attributes, preserving paths, IDs and gradient references. This uses the shared renderer's palette on all platforms, without relying on platform-specific filter support. State labels and Ready/Flip controls remain readable and usable.

## Attachments, faces and independent instances

Attachments use the same placement flow as other Gear: select a card and equip it in its printed Attachment position(s). The picker has no host selection, and activation depends on its slot placement. Ability text remains visible for the player's guidance; host phrases or traits in that text do not impose additional placement requirements.

The existing `attachmentHostId` field remains readable for backward compatibility. New assignments save it as null. Removing/replacing a legacy Gear or Titan host clears obsolete references without moving attachments or resetting their faces, exhaustion, counters or effects. Bonus-capacity loss still follows the normal reassignment rules for any card, including an attachment.

Changing an equipped face replans its position span. Compatible changes preserve the instance, exhaustion, counters and effect selections. An incompatible change preserves the newly selected face but moves it into reassignment; cards losing positions granted by that face also need reassignment rather than activating invalid effects. Ordinary Stage 3 inspection remains a separate view and cannot change an equipped instance.

Removing a card explicitly from the loadout removes that card's instance/assignment from the owner. Dependent cards are retained. There is no separate inventory screen in this stage. Mnemos/Fated Mnemos editing belongs to Stage 6. Drag-and-drop is deferred; card/slot selection and explicit state controls provide the intended interaction path.

## State and modules

The existing save schema remains version 1 with backward-compatible optional fields: instance `satisfiedEffectIds` and assignment `override: { reason, codes }`. Runtime validation accepts absent fields in older party data and validates them when supplied. Legacy host-reference validation recognizes the owning Argonaut and selected Titan as well as owned Gear; these references do not determine attachment activation. Instance IDs remain separate from immutable definition IDs, and party actions reject identity reuse across Argonauts.

| Location | Responsibility |
| --- | --- |
| `src/app/loadout/[id].tsx` | Owner-bound editing route |
| `src/loadout/EquipmentEditor.tsx` | Picker, full candidate review, placement, exceptions and removal |
| `src/domain/loadout.ts` | Pure planning, active-capacity graph and equipment transitions |
| `src/domain/party.ts` | Independent instances, legacy host references and optional confirmation/override validation |
| `src/state/party-reducer.ts` | Typed equip/remove/face/exhaustion/effect actions and legacy host cleanup |
| `src/dashboard/EquipmentArea.tsx` | Slot actions, full equipped cards and actionable reassignment cards |
| `src/components/cards/EquippedGear.tsx` | Smaller full Gear face, cycle/face/slot/traits metadata and spoiler guard |
| `src/components/cards/GearResults.tsx` | Shared selectable previews and metadata for Browse Gear and equipment search |
| `src/components/cards/CardColours.tsx`, `src/domain/card-colour.ts` | Card-local grayscale palette and SVG paint conversion |
| `src/components/cards/EquipmentActions.tsx` | Immediate exhaustion, face and optional/conditional capacity controls below each card |
| `src/dashboard/model.ts` | Dashboard capacity delegates to the shared loadout derivation |

At the Stage 4 checkpoint (`75446b2`), player state lived in memory. [Stage 5](STAGE_5_SAVES.md) now adds autosave, named profiles and portable backups; its notes distinguish storage tests from the remaining browser/native restart checks.

## Verification and remaining review

### Bonus-slot navigation fix

Bonus position IDs contain escaped instance/effect components. Expo Router 57
parses the URL query and then decodes local parameters again; the editor previously
compared that decoded value directly with the saved position ID. As a result, the
bonus slot was not recognised and the Equip button stayed disabled.

Dashboard navigation and the editor’s destination buttons now protect the position
ID with an extra encoding layer. The editor also resolves existing decoded bonus
links against currently available positions. Saved assignments and capacity rules
are unchanged; removed slots stay unavailable and trait restrictions remain enforced.
Four regression scenarios cover actual Expo href generation, Trireme bonus-slot
placement, selection/destination updates, old links, stale grants, restricted slots,
and percent-encoded identifiers. The full domain suite has 175 passing tests.

On 2 October 2026, these checks pass:

```sh
npm run typecheck
npm run lint -- --no-cache
npm run test:domain
npx expo export --platform all --output-dir /private/tmp/ato-stage4-rows-export
git diff --check
```

The suite now has 47 passing tests. Thirteen loadout tests cover Armor equip/replace/remove and owner isolation; occupied bonus loss/reassignment; Paradox eligibility and recorded overrides; hand-span conflicts; independent copies and face changes; optional grant repeat/restore; direct attachment placement through Gear/Titan changes and legacy host cleanup; malformed/stale/cross-owner requests; confirmed future conditional effects; transitive grant loss; and ordinary attachment replacement, slot validation and double-slot occupancy. Tests also check valid party serialization and preservation of the frozen catalogue. Three additional colour tests cover standard luminance samples, alpha, SVG identity/reference preservation and desaturation of every bundled Gear symbol without changing geometry.

Web, iOS and Android exports compile. Chrome access became available during this follow-up: a separate Trireme fixture tab showed smaller cards with full text/stats/footer, selectable card and empty-slot surfaces, no Inspect/Edit buttons, and Exhaust below the card. Exhaust/Ready updated directly without opening the editor, retaining all three Support positions. Selecting an empty Weapon position opened its owner-bound picker. Access then became intermittent (`cgWindowNotFound`), so reversible-card, narrow-screen and remaining interaction checks are still pending.

Desktop browser review confirms Weapon 1, Weapon 2 and Trireme Breastplate share the first row, followed by three Support positions and three Attachment positions in separate rows. The Armor retains complete text, stats and footer. A subsequent widescreen review confirms the dashboard header, navigation, skills, board and footer use the available width beyond the former 1240 px cap, while Gear faces retain their smaller size. Chrome access returned `cgWindowNotFound` during the editor review, so the simplified face control still needs interaction review. Check selection hiding/reopening, preserved search/cycle/page, secret review/reveal and Exhaust/Ready desaturation on a coloured dice/gate card at desktop and phone widths.

Native iOS runtime review remains blocked by the previously recorded CoreSimulatorService/device-service connection failures. Android runtime was not tested. Exports are compilation checks, not device tests.

Before marking Stage 4 acceptance complete, exercise the seven flows above in a browser and on a native target. Include 320 px layout, screen-reader/keyboard navigation, keyboard dismissal, long searches, spoiler-safe labels, placement cancellation and all four Argonauts. In particular, check candidate scrolling, card/empty-slot selection, separate Exhaust/Flip/effect taps, direct attachment placement, full dashboard card wrapping and the exception reason field. Preserve the earlier Stage 2/3 runtime backlog.

Implementation references: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Router parameters](https://docs.expo.dev/router/reference/url-parameters/), [ScrollView](https://reactnative.dev/docs/scrollview), [View layout events](https://reactnative.dev/docs/view#onlayout), [layout properties](https://reactnative.dev/docs/layout-props), [Pressable](https://reactnative.dev/docs/pressable).
