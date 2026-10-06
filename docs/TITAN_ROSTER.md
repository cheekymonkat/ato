# Campaign Titan roster

Manage Titans opens from the Argo Titan total or the Titans campaign reference.
It presents individual cards in an adaptive grid, with artwork, assigned Argonaut,
Trauma/Kratos reference links, Pattern editing and health actions. Argo-bred types
appear first alphabetically, followed by Dreamwalkers. Counted tabs are Alive and
Dead in Cycle I; Crippled is also available from Cycle II. Deleting a Titan requires
the shared removal confirmation.

The status badge at the top right of each card opens an anchored dropdown with
the other valid health states. Crippled is only offered from Cycle II, and a full
roster disables restoring a Dead Titan. Delete appears last in red and opens the
removal confirmation. Choosing an action or tapping outside closes the menu.
Marking a Titan Crippled or Dead opens a confirmation sheet in both the roster
and Argonaut selector. A checkbox must be accepted before Confirm is enabled.
Cancelling or dismissing changes nothing; restoring Alive remains a direct action.

Adding a Titan uses compact name-only dropdowns for its type and Trauma/Kratos
Patterns, rather than opening full-card selection overlays. Pattern editing uses
the same dropdowns. Browser selects use the native dropdown; iOS/Android show a
short scrollable inline list. Choices follow the campaign cycle, unavailable
Pattern copies are disabled, and “Titan default” restores the printed table when
the editor is saved.

## State and capacity

`Party.titanRoster` is an optional version-1 record containing individual
`TitanRecord`s. Each has a stable ID, catalogue definition/face, status and optional
Trauma/Kratos Pattern references. The catalogue's named Dreamwalker copies define
the shared cycle subtype; they do not restrict Titan headcount.

Alive + Crippled count against the highest active technology's Titan capacity.
Dead Titans are excluded from that total, but retain Patterns until changed,
deleted or removed on cycle advancement. Additions and revival from Dead are
validated in the reducer, as well as disabled in the interface. Capacity changes
never silently delete existing Titans; an over-capacity roster blocks additions
and revivals until corrected.

Argonaut Titan instances use `rosterId` to identify the selected individual. Only
Alive, unassigned individuals can be selected. Existing Argo-bred duplicate-type
warnings still apply across Argonauts. Removing a Titan from an Argonaut releases
it, with its Patterns, back to the roster. Marking it Crippled/Dead or deleting it
unassigns it and clears that Argonaut's table overrides, retaining other equipment,
memories, stats and tokens.

The Argonaut Titan selection menu offers Mark Titan Crippled (Cycle II+) and
Mark Titan Dead above Remove Titan. After confirmation, both update the same
roster record used by Manage Titans, close the selector and clear its loadout
assignment. The Argo occupied total and health tab counts then update; Patterns
stay with the Titan. Older saves are converted when a health change is confirmed.

Patterns belong to Titans, and roster edits synchronize the selected Argonaut's
`tableOverrides`, so existing table rendering and Pattern slot bonuses still work.
Dashboard table edits also write back to the roster. Default tables come from the
Titan card and consume no Pattern card. Separate Pattern allocations across all
statuses cannot exceed the number of distinct printed IDs. One individual using
the same physical card for both supported tables consumes one copy. Invalid,
missing or over-allocated references are reported during backup validation.

## New campaigns

Campaign creation supplies the installed catalogue to `newProfile` and seeds:

| Cycle | Dreamwalkers | Argo-bred Titans | Total |
| --- | --- | --- | --- |
| I | 10 Dreamwalkers | None | 10 |
| II | 7 Spartan Dreamwalkers | Mazerunner, Earthshaker, Logicbreaker | 10 |
| III | 4 Delphian Dreamwalkers | Abysswatcher, Earthshaker, Firestarter, Mazerunner, Warkeeper | 9 |
| IV | 1 Persian Dreamwalker | Warkeeper, Returner, Mazerunner, Logicbreaker, Firestarter, Earthshaker, Dawnburner, Ascender, Abysswatcher | 10 |
| V | None | Abysswatcher, Ascender, Cloudsoarer, Dawnburner, Earthshaker, Firestarter, Logicbreaker, Lunarlander, Mazerunner, Returner, Warkeeper, Wishender | 12 |

All start Alive with printed Titan tables, independently of optional Gear inventory
tracking. Cycle II's Mazerunner and Cycle V's final two types were confirmed by the
user. Cycle III intentionally totals nine from the specified list.

## Cycle advancement and older saves

Advancement removes Dead and Crippled records. Living Argo-bred Titans retain IDs
and Patterns. Living Dreamwalkers become the next cycle's subtype and reset to its
printed tables. Add or remove Dreamwalkers to make ten occupied places, preserving
assigned individuals first when reducing their number. If there are more than ten
living Argo-bred Titans, retain them all and add no Dreamwalkers. This exception
prioritizes the instruction to retain every living Argo-bred Titan.

Older saves remain readable without a roster. Opening Manage Titans converts known
acquired and selected Titans into individual records and keeps selected Patterns;
it does not invent unrecorded stock. An old campaign that advances also converts
its known Titans and follows replenishment rules. Legacy Gear inventory remains
unchanged. Old acquired Titan flags no longer control selection after conversion.

Roster actions capture campaign/cycle identity and the expected Titan record, so
late edits cannot overwrite a changed record. The existing snapshot and portable
backup paths preserve roster state and individual assignments.

## Verification

`tests/titan-roster.test.mjs` covers all starts, technology caps, health transitions,
selection exclusivity, Pattern supply, synchronization, advancement, legacy
conversion, stale callbacks and backup validation. `tests/titan-roster-web.test.mjs`
checks tab counts, type ordering, status flows, confirmation, editor selection and
scarce Pattern handling. Safari previews of the web components were inspected at
390×844 and 768×1024; this is not a physical-device/native iOS test.
