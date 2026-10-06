# Stage 5: local saves and portable backups

The Triskelion layout checkpoint is committed as `2385c3c`. Stage 5 adds local
autosave, named four-Argonaut parties and portable JSON backups. The implementation
is committed as `67f8b1b`; the runtime checks listed below still need completion.
Stage 6 subsequently adds memory editing and Pattern overrides; see
[Stage 6 notes](STAGE_6_REFERENCES.md) for the current party schema and migration.
Stage 7 adds optional campaign cycle and structured condition fields within
schema 2, retaining older condition labels. Counts, card references, sources
and duration notes persist. Tides of Fate cleanup autosaves as one complete party
change, with no tracker undo history. See
[Stage 7 notes](STAGE_7_TOKENS.md) for scopes and validation.

## Using saves

The dashboard displays **Campaign: &lt;save name&gt;**. The profiles and backups
screen displays **Saving…**, **Saved locally** or **Save failed**. Changes save
after a short 250 ms pause, with a flush when the
app goes into the background. Wait for **Saved locally** before closing or
refreshing. A storage error leaves the visible party intact and offers retry
and backup actions.

Open the top-right menu and choose **Campaigns & backups** to:

- Create, name and switch between campaigns, each containing four Argonauts and a chosen Cycle 1–5 (default 1).
- Rename the current party or use **Advance cycle** to move to the next cycle. A warning and checked acknowledgement are required; campaigns cannot go backwards or skip cycles. Cycle 5 is final. Advancement updates card pickers, Core technologies and token visibility while preserving existing cards, inventory, stats and token amounts. New campaigns can start at any Cycle 1–5.
- Export the complete current party as JSON. Web downloads a file; iOS and
  Android open the device share sheet so the player can choose its destination.
- Import a JSON file, or paste JSON, validate it and review the four Argonauts
  before choosing **Import as new profile**. Imports keep the existing party.
- Review and explicitly restore the previous local snapshot. This restores
  the entire workspace, including its profiles and active selection.
- Under **Catalogue notices**, choose **Acknowledge catalogue update** to clear
  a version-only notice. This checks saved card references, updates the current
  campaign's saved catalogue version and saves it immediately. Cards, stats and
  progress are retained; other campaigns keep their own versions. Resolve any
  listed card issues first. Later catalogue updates show a new notice.

Names, colours, skills, Titans, independent card instances, faces, exhaustion,
equipment assignments, optional/confirmed effects, recorded placement exceptions,
memory references, counters, conditions, tokens, party resources, ordering and
the active Argonaut are preserved. Capacity is derived again from saved inputs;
there is no saved slot-count cache. Cards in Needs reassignment retain their
assignments and instance state.

Development `?fixture=...` loadouts are temporary previews. Their edits do not
autosave. **Leave preview** restores the saved party and removes the fixture URL.
Creating, importing or opening a party also leaves preview mode.

## Storage and compatibility

`src/storage/adapter.ts` wraps AsyncStorage for native targets; the web adapter
uses the same library and adds an exclusive Web Lock when available. The static
catalogue remains bundled and immutable. Local state stays on the device; this
step does not add cloud accounts or synchronisation.

The local envelope is `ato-workspace`, schema version 1. Profiles have stable
IDs, names and parties with a separate catalogue version. Stage 5 introduced
party schema 1; Stage 6 explicitly migrates it to party schema 2. The backup
envelope is `ato-party-backup`, backup version 1, with an export time and one
complete profile. Imports assign a new profile/party identity while retaining
the Argonaut and card-instance IDs within that independent party.

Standalone schema-1 party JSON is explicitly migrated into a profile on local
load and is accepted for import. Future envelope or party versions fail
validation until a migration is implemented. New save changes should add an
explicit migration at the party/envelope validation boundary, with a historical
fixture and tests.

Missing card definitions, faces, Argonaut definitions and optional/confirmed
effects are reported. Imports with unresolved references are rejected. Local
restore retains unresolved records and exposes a notice on the dashboard and
details on the profile screen; it never drops them. Catalogue-version differences
produce a review notice without silently changing the saved version.

Backups are limited to 5 MB of UTF-8 JSON and validated before being offered for
import. Malformed JSON, incomplete parties, invalid colours, duplicate identities,
dangling assignments and unsupported schemas cannot replace the current party.

## Write ordering and recovery

`SnapshotStore` captures each requested snapshot before awaiting storage and
serialises writes. It writes the last successfully committed snapshot to
`@ato/workspace/previous` before replacing `@ato/workspace/v1`. A failure while
writing the previous snapshot prevents replacing the primary. Failed primary
writes leave the previous snapshot available; an acknowledgement failure can
be retried safely if the requested snapshot was actually written.

The provider waits for hydration before rendering editable screens, which
prevents initial defaults from overwriting an existing save. Stale completions
cannot mark newer edits as saved or leave an old error after a newer successful
save. A corrupt or unsupported primary, missing primary with an existing previous
snapshot, unreadable previous snapshot or storage read failure opens a recovery
screen instead of silently starting fresh. Recovery requires an explicit restore
or new-party choice. Stored data is not changed merely by encountering an error.

Before writing, the store verifies that the primary still matches the snapshot
it read or last committed. A different session's changes cause a visible conflict;
export the visible party and reload to use the latest stored workspace. Secure
web contexts with Web Locks serialise this check and write across tabs. In older
or insecure contexts without Web Locks, the comparison remains but is not an
atomic cross-tab transaction: use one editing tab. Native writes are serialised
within the single application provider.

Restoring a valid previous snapshot first saves it successfully before replacing
visible state; the current valid snapshot becomes the previous one. The UI blocks
interaction during this operation. Only one previous snapshot is kept, so portable
JSON files are the longer-term backup mechanism. Browser storage is scoped to the
site address and may be cleared by the browser. An interrupted process can lose
an edit that has not yet reached **Saved locally**.

## Verification on 2 October 2026

The following checks passed during implementation:

```sh
npm run test:domain
npm run typecheck
npm run lint -- --no-cache
npx expo install --check
npx expo export --platform all --output-dir /private/tmp/ato-stage5-final-export
git diff --check
```

The suite has 63 passing tests, including 16 storage/backup scenarios: complete
four-Argonaut round-trip with distinct colours, Titans, attachment instances,
reversible/exhausted Gear, optional grants, restricted slots, exceptions,
resources, order, active member and pending reassignment; independent imports;
standalone-party migration; malformed/oversized saves; missing-reference reports;
catalogue mismatch; delayed ordered writes; interrupted primary/previous writes;
explicit corrupt-save recovery; unavailable storage; lost write acknowledgement;
competing sessions; multiple-profile restart/idempotent writes; torn primary
writes; and local migration with unsupported-primary recovery. The complete
party fixture also includes memory references/node counters and confirmed effects.

Chrome review used `127.0.0.1:8081`, isolated from the user's `localhost:8081`
storage. The profile screen rendered correctly, a named test party was created,
the dashboard reported Saved locally, and name, Courage and colour edits worked.
Selecting an empty Armor slot opened the existing Gear picker. Browser access
then failed with `cgWindowNotFound`, so refresh, downloaded-file import/export,
invalid-file UI and restore UI have not yet been verified end to end.

Web, iOS and Android exports compile. They do not establish device persistence.
`xcrun simctl list devices booted` could not find `simctl` in the active developer
toolchain; explicitly selecting the installed Xcode for that command reached
`simctl` but failed with an invalid CoreSimulatorService connection. `adb` is
unavailable. Native restart, file picker, share sheet and
background flushing need real-device or emulator review. `expo-doctor` could not
run because its registry fetch failed with `ENOTFOUND`; the SDK's local
compatibility map reports dependencies up to date, while warning that online
validation was unavailable.

Before marking Stage 5 acceptance complete, verify:

1. Edit all four Argonauts, equip slot-granting Armor, an attachment and reversible
   Gear, create pending reassignment, then wait for Saved locally and restart.
   Check colours, active profile/member, face, exhaustion and recalculated capacity.
2. Export that party and import the downloaded file as a new profile. Check the
   original is retained and the imported data is complete.
3. Reject malformed, future-version and missing-reference backups through the UI;
   confirm current profiles remain intact. Cancel the file picker and review.
4. Restore a reviewed previous snapshot; then repeat with a corrupt primary and
   a readable previous snapshot in an isolated test environment.
5. Repeat the save/restart and file flows on iOS and Android, plus narrow-screen,
   keyboard and screen-reader review. Preserve the Stage 2–4 runtime backlog.

Offline catalogue use after startup already works with bundled data. An actual
offline web launch requires a separate deployment/startup caching task; this
stage does not add a service worker or claim offline web startup.

Implementation references: [SDK 57 AsyncStorage](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/),
[DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/),
[FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/),
[Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/),
[React Native 0.86 AppState](https://reactnative.dev/docs/0.86/appstate),
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request).
