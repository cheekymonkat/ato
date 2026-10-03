# ato

An Aeon Trespass: Odyssey Argonaut dashboard built with Expo and TypeScript for
web, iOS and Android. It contains a bundled catalogue and independent player
state for four Argonauts. Open the top-right menu and select **Browse Gear** to
search cards, inspect abilities and flip reversible Gear. Select a dashboard
card or empty slot to construct or edit a loadout. Secret cards start hidden.
Memory slots now support ATCC-style cards, saved −/+ node trackers (ten nodes for
Mnemos, three for Fated Mnemos) and red gateways. Assigned Mnemos hide locked
abilities until their three/seven-node gateways are reached.
Fated cards automatically show their blue Growth side at three nodes. Standard
Mnemos add +1 to listed Argonaut stats; unresolved Fated cards apply -1 until
resolved. Stat totals and controls allow -9 through 9, starting at zero.
Select a Titan to view its abilities, and open either reference table in the Titan abilities section
to choose a Pattern override or return to the Titan default.
Titan abilities include their keyword explanations directly alongside headings
and costs. The name, power die, movement icon and value share one line, with
type/cycle at the top right. Keyword explanations prefer the matching subname,
falling back to the original keyword when no subname matches.
Equipment, Support and Attachments share rows when space permits. Memories
also fit four across, with the Fated pair wrapping below at narrower widths.
Exhaust appears only on cards with an explicit Exhaust cost. Eligible Titans
also have an Exhaust/Ready action. Older exhaustion can always be cleared.
Exhausted memories use a distinct grey palette; Ready restores their appearance.
Discard appears for explicit Discard costs on the same action row. It clears
exhaustion, greys out the card and replaces the action with Restore. This state
is saved independently for each card instance.
Gear, Mnemos and Condition card actions share compact outlined controls and
consistent Flip, Exhaust/Ready and Discard/Restore labels where applicable.
Editor actions sit together below the card, with Remove last. Removing a card
or shared resource requires checking a confirmation box and confirming removal;
Cancel or closing the confirmation keeps the saved entry.
Keywords with bundled definitions have a dotted underline. Tap or click a
keyword to read its definition without selecting the card; tap elsewhere on the
card to edit it. Close with × or the backdrop. The same help works in card
pickers, with touch-friendly targets and no hover requirement.
Type in the Argonaut name field to see matching named portraits from the
campaign cycle and earlier. Select a suggestion to apply its printed +1 skill
bonus (Oleander: Wisdom, available from Cycle IV). Custom names remain manual.
Changing to another named or custom Argonaut requires a confirmation checkbox.
The confirmed change resets all six stats to 0, removes every Mnemos and Fated
Mnemos card and its nodes, clears all conditions and tokens, then applies the
new portrait bonus. Typing is a draft;
Cancel keeps the saved Argonaut intact. Selecting the same Argonaut keeps progress.
Choose the campaign cycle when creating a campaign, or edit it under
**Campaigns & backups** in the top-right menu. Save the change to apply it to
all four Argonauts. Gear browsing and all card pickers offer cards from the
selected cycle and earlier (Cycle 3 includes Cycles 1–3). Non-numbered cards
remain available. Lowering the cycle retains existing assignments and counts.
The Tokens section has saved per-Argonaut counters with ATCC symbols. The
campaign setting shows Ambrosia/Despair in all cycles, adds Bleeding from Cycle 3, Midas/Pain
from Cycle 4 and Oxygen/Aether in Cycle 5. Token gameplay effects remain manual;
[Stage 7 notes](docs/STAGE_7_TOKENS.md) record the rules for later automation.
Conditions use white ATCC-style cards with ochre headings/footers, grey ability
panels and full end-of-battle text. Use **Flip** below reversible cards to change
sides directly; tap the card to change its selection or remove it. The source
and duration entry fields are omitted; existing saved notes remain intact. Custom
entries are supported. Each Argonaut can hold one of each type; reverse sides such
as Fear/Dread share the same type. Shared resources use a separate campaign pool.
The menu's last option, **Tides of Fate**, asks for a checked confirmation before
clearing all four Argonauts' conditions and tokens, readying exhausted/discarded
cards and setting their Triskelions to zero. Equipment, memory nodes, stats and
shared resources are preserved. Undo and clear-condition buttons are removed.
Condition effects, flips and duration expiry remain manual.
[Stage 6 reference notes](docs/STAGE_6_REFERENCES.md) explain memory progress,
Pattern selection and the migration of older saves.
Parties now autosave locally. Use **Party profiles & backups** in the menu to
create or switch named parties and export/import complete JSON backups.
[Stage 5 save notes](docs/STAGE_5_SAVES.md) describe recovery, compatibility and
the remaining browser/native restart checks.
[Stage 4 status and verification](docs/STAGE_4_LOADOUT.md) records equipment
editing, full dashboard cards, bonus capacity, direct attachment placement and pending runtime review.
[Gear rendering notes](docs/STAGE_3_GEAR.md) describe the card design. The earlier
[dashboard notes](docs/STAGE_2_DASHBOARD.md) cover Argonaut controls and layout.

Stage 8 adds **Rules assistance** to the dashboard menu. It explains skill
contributions, slot capacity and gates on Gear, Titans and unlocked memory panels.
Turn on **Highlight card gates** to check each Argonaut’s Triskelion, token counts
and equipped Gear traits (such as Labyrinth); the preference is saved with the
campaign. Each equipped Gear instance contributes once; exhausted Gear retains
traits, while discarded or pending Gear does not. Cyclopean Might and Elder
Might offer verified two-hand placement for three-handed Weapons. Unknown
Might’s Support trade-off and other unresolved effects remain manual.
The Titan selector row has signed **Precision** and **Speed** modifier counters,
saved per Argonaut. Assigned Weapon Precision and Titan movement show adjusted
values in red, including direct passive Gear effects and met numerical gates
(for example, Puzzle Axe at three Labyrinth cards). The rules sheet explains
each contribution. Tides of Fate and confirmed Argonaut replacement clear the
modifier-token totals. Triggered effects and token expiry remain manual.
Assigned secret cards always show their details on the main Argonaut page;
unassigned secret cards retain the catalogue’s spoiler protection. Equipment
groups use measured widths so complete rows remain together as the page widens.
[Stage 8 rule sources and review notes](docs/STAGE_8_RULES.md) define the supported subset.

## Start

From this directory:

```sh
npm install
npm start
```

In the Expo terminal, press `i` for the iOS Simulator or `a` for an Android
emulator. You can also scan the QR code with Expo Go on a physical device.
Keep your phone and computer on the same network.

### iOS Simulator

Install full Xcode, open it once to complete setup, and install an iOS Simulator
runtime in Xcode Settings. Select Xcode as the active developer tools if needed:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
npm run ios
```

### Android emulator

Install Android Studio and its Android SDK. Create and start a virtual device
using Device Manager. On macOS with the default SDK location, configure:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
npm run android
```

### Browser

```sh
npm run web
```

## Edit and check

Routes live in `src/app/`; the dashboard lives in `src/dashboard/`. The shared
party reducer and context are in `src/state/`. Edit and save to test Fast Refresh.
The original tap-test screen remains in `App.tsx` and is no longer the entry point.

```sh
npm run typecheck
npm run lint
npm run test:domain
npm run catalogue:check
```

For native tooling later, `npx expo run:ios` or `npx expo run:android` generates
the native project and builds a local app; this requires the platform toolchain.
The starter can run in Expo Go without generating native projects.

See [Expo's development guide](https://docs.expo.dev/get-started/start-developing/).
