# Stage 9 — campaign navigation and inventory

The first Stage 9 milestone provides shared campaign inventory, Titan availability
and campaign notes. The six approved header destinations are **Argo, Map, Cargo,
Technology, Argonauts and Timeline**. They stay visible while page content scrolls.
On narrow screens the icon row moves below the brand; there is no navigation drawer.
The active destination uses gold icons/text and an underline. Argonauts returns to
the last selected Argonaut. An active section can also be pressed to return from
its editor or catalogue. The secondary menu retains Browse Gear, Campaigns &
backups and confirmed Tides of Fate.

## Using the campaign pages

- **Cargo:** add acquired Gear through the existing full-card catalogue grid,
  search acquired Gear, and adjust acquired quantities. Each entry shows allocated
  and available copies, distinct printed supply and which Argonauts hold copies.
  Both **Add acquired Gear** and **Browse catalogue** open Cargo's acquisition
  dialog. Search, select a result, then use **Add one acquired copy** above the
  preview; the count updates and a message confirms the addition. Secret cards
  must be revealed first, and the action disables when all printed copies are recorded.
  Acquired cards remain readable even when secret-card filtering is on. The final
  copy requires checked removal confirmation and cannot be removed while allocated.
- **Argo:** compact ship/cycle counters and milestone progress above ten campaign
  reference shortcuts; shared resources and notes stay at the bottom. See
  [Argo overview](ARGO.md). The **Titans** shortcut opens the
  [individual roster](TITAN_ROSTER.md), including counted Alive/Crippled/Dead tabs,
  technology capacity, scarce Pattern assignments and confirmed deletion.
  Selecting a Titan on an Argonaut now uses an unassigned Alive roster entry.
- **Use campaign inventory for equipment and Titan selection:** optional campaign
  setting in **Campaigns & backups**, alongside the name and cycle in **Current
  campaign configuration** and **New campaign**. New campaigns default to off;
  enabling it at creation starts with an empty acquired inventory. Existing
  campaigns save changes automatically and retain acquired records and loadouts.
  Argo and Cargo manage the contents rather than the tracking preference. Equipment
  selection then offers only available copies (plus the edited copy); unavailable
  direct selections cannot save. Manual slot exceptions cannot bypass inventory.
  Titan roster availability applies independently of optional Gear inventory tracking.
  Turning tracking off retains the acquired records. Known printed Gear copy
  limits remain enforced across all four Argonauts whether tracking is on or off.
- **Technology:** Project List, researched Abilities and cumulative Technologies
  catalogue, with prerequisite checks and automatic cumulative Core cards, inherited prior-cycle technologies and cycle-only retirement rules. See
  [Technology behavior and verification](TECHNOLOGY.md).
- **Map and Timeline:** explicit planned-feature pages. Their campaign
  mechanics have not been implemented. Their navigation is available now for later
  features, rather than inventing counters, timelines or map data.

Campaign name and cycle still belong to Campaigns & backups. Existing per-Argonaut
notes, equipment, memories, conditions, tokens, stats, colours and rules assistance
remain in place.

## Ownership and compatibility

`Party.inventory` is optional, versioned independently and contains `gear` quantities,
`titans` definition IDs and an `enforce` preference. `Party.campaignNotes` is optional.
The party save schema remains 2; absent inventory fields allow selections without
recording acquired copies, subject to known printed Gear limits. No
storage engine, database or new package is required.

Inventory is seeded from current Gear instances and selected Titans at the first
inventory edit or when tracking is enabled. This includes copies awaiting slot
reassignment. A two-hand assignment counts once. Mnemos uniqueness remains separate
from Gear inventory; acquiring Gear never allocates memories. Acquired Gear persists
independently of card instances. Replacement/removal frees an allocated copy;
exhaustion, reversible discard, flipping and Tides of Fate keep ownership and
allocation. New allocations are checked against the latest party in the reducer,
not only against a UI snapshot. Retaining or repairing historical overages remains
possible. Unknown catalogue records remain recoverable locally and are reported by
saved-card notices; unresolved inventory references block portable import just as
unresolved assigned-card references do.

Physical Gear supply is the number of distinct, nonblank printed IDs on its
canonical definition, deduplicating front/back IDs. IDs reused by multiple Gear
definitions in the same game make the limit ambiguous. Ambiguous or missing IDs
require manual verification rather than an invented supply. New Gear allocations
cannot exceed a known printed limit even when acquired-inventory tracking is off;
manual slot exceptions cannot create extra copies. The equipment review shows
the shared printed supply and disables saving with an explanation when exhausted.
New acquisitions cannot exceed a known limit or acquire a future-cycle card. Historical quantities above
printed supply are retained with review notices and backup-import warnings. Counts
cannot decrease below allocated copies. Acquisition/removal and campaign-note edits
are guarded by campaign ID. Campaign views remount on profile changes, preventing
old confirmation dialogs from applying to a newly selected campaign.

Muck Virus (`BJ0943`) has one printed copy; Muck Armor (`BJ0919`, `BJ0920`) has
two. Existing duplicate allocations are retained and flagged in Cargo's inventory
review. They can be removed or reassigned without adding more copies. A replacement
in the same occupied slot reuses the supply. Exhausted, discarded, reverse-face
and pending Gear continue to count toward the shared physical limit.

Inventory does not automate story unlocks, crafting, consumed physical cards, Titan
production costs or encounter aftermath. The individual Titan roster now tracks
health, headcount and Pattern allocation; the Argo-bred warning remains advisory and flags only duplicate types,
not different Argo-bred Titans. One of each type can coexist; Dreamwalker
variants can repeat across distinct Alive individuals. Each Argonaut selects one
Titan at a time. Technology production/timing, voyage maps and timelines remain
later Stage 9 increments.

## Verification

- 230 tests pass, including 14 inventory/navigation scenarios and React DOM
  regressions for navigation icons and selectable cards with nested controls.
- Scenarios cover safe seeding, independent Argonaut allocation, replacement,
  manual exceptions, two-hand Gear, reverse faces, exhaustion/discard, Tides of Fate,
  lost bonus Support and reassignment, printed-ID ceilings/ambiguity, preserved
  legacy overages, confirmed removal, stale callbacks, cycle gating, Titan unlocks,
  Dreamwalkers, campaign notes, workspace restart and independent backup import.
- The web renderer rejects native-only `accessible={false}` on SVG elements.
  Navigation icons now use `aria-hidden`; all six render with selected/unselected
  colours without React errors. This regression uses the actual web SVG components.
- Memory, equipment and catalogue selection use a shared card target. On web,
  the keyboard selection button is a sibling of the interactive content group,
  so Exhaust buttons and keyword links are never inside a selection button.
  Pointer selection remains on the card face, and focused keyboard selection has
  a visible outline. The DOM regression reproduces the former nested-button
  markup and checks the corrected structure and selection callbacks.
- Passive overlays now use `style.pointerEvents` instead of the deprecated prop.
- Lint, typecheck and catalogue consistency checks pass.
- Web, iOS and Android production bundle exports pass, including the card-target
  follow-up at `/private/tmp/ato-card-selection-export`. These validate bundling,
  not native device interaction.
- Desktop/tablet/phone visual acceptance and native touch/restart/file checks remain
  pending. Browser inventory returned no browsers with a native-pipe startup error.

Manual review: check the six header targets at 320/375 px and landscape notches;
verify title/icon wrapping and persistent header scrolling; navigate out of an
editor using its active section; change profiles; acquire/equip/remove copies
across all four Argonauts; exercise restricted/extra Support positions; lower the
campaign cycle; import an overage backup; use keyword help within the acquisition
sheet; inspect keyboard growth and perform physical-device restart/backup flows.
