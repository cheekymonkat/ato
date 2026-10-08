# Adventures

Open **Argo → Adventures** (`/adventures`). This replaces the old Exploration card notebook. Card browsing is not part of this page.

Tabs separate Hub visits, R&R, Pharos (Cycles I–III) and Story/Event records. Hub headers show the visit count, current Story's selection range and next Battle terrain. Expanding a hub reveals named stories, printed roll ranges and replay boxes. R&R and Pharos use full-width panels with natural height and wrapping titles; they do not inherit the hub grid's width-based flex sizing.

**Select Story** highlights an eligible hub and story without recording it as read. Selection uses the printed d10 probabilities, excluding unavailable/completed hubs and played entries as if invalid rolls were re-rolled. It respects current Story side, opening/middle/ending progress and the next available Fated Box. A choice becomes stale if the Story card, cycle, hub progress or its replay boxes change.

Opening and ending stories retain a direct **Begin** button. Normal stories use their checkboxes: marking the next enabled box records the story/alternate passage and advances a hub visit atomically. Middle-story boxes remain disabled until the opening is begun and become disabled when the ending is due. Second variants unlock after the first. There is no story detail popup or Party Leader section. The app does not resolve narrative outcomes or change Argonaut stats automatically; full story text is read in the physical Storybook.

Hub visit history, event marks and secret codes live in optional `party.argo.adventures` (version 1). Fated table history lives in optional `workspace.adventureReplay` (version 1), shared across campaigns/playthroughs on the device. Starting/advancing a campaign keeps replay history; cycle-prefixed visit and event IDs preserve earlier cycle records. Missing fields on existing saves mean empty tracks. Legacy Party Leader fields remain readable but are not used by the UI or written by new story selections. Tides of Fate does not reset adventure history.

Every table resets immediately when its final Fated Box is marked. The latest-adventure banner preserves the selected variant and explains a reset. Played entries are disabled until the table resets. Unmarking the most recent variant asks for confirmation; later variants must be unmarked first. Unmarking the latest hub story also removes that visit. Correcting an older story changes replay history without deleting a different latest visit. The separate Undo hub progress action leaves replay history untouched.

Inward Odyssey is tracked through Knowledge on the Argo page, with no duplicate Adventures tab. Existing Inward replay fields remain valid in older saves/backups. Story/Doom card selectors and Progress/Knowledge conversion also stay on Argo. The event tab includes printed special tracks, main-story passage checkboxes and a once-per-campaign four-digit code register; single-box printed codes and that register stay synchronized. Multi-box printed paragraph tracks retain their explicit count.

Backup exports include shared replay history. Imports union the two histories and apply the normal reset to completed tables. Snapshot recovery restores both in one snapshot. Edits opened for a previous campaign/cycle, stale hub count, changed Story card or changed Fated Boxes are ignored. Temporary development previews cannot edit saved adventure state.

Source definitions and narrative guidance are in `data/reference/adventures`. PDFs provide references and checkboxes, not full paragraph content. Tutorial and the ten-box special hubs for Cycles IV/V have no story list in these PDFs; their boxes are available pending that information.
