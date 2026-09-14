# Country Investment Thesis

A single-file HTML front-end plus YAML files, kept in a SharePoint document library that team members sync to their PC with OneDrive. No server, no IT setup.

## Folder layout

```
economy-views/
  country-investment-thesis.html      the tool (open with Edge or Chrome)
  config.yaml             list of economies, lock timeout, title
  prompts/
    ada-update-economy.md  prompt for updating an economy with Ada (see below)
  data/
    united-states.yaml    current state of one economy (one file each)
    eurozone.yaml
    ...
  log/
    united-states.log.yaml   append-only change log, one entry per save (created on first save)
    ...
  locks/
    united-states.lock.yaml  present only while someone is editing that economy
```

## Setup (once per team)

1. Put this whole folder in the team's SharePoint library. Everyone syncs the library with OneDrive ("Add shortcut to OneDrive" or "Sync").
2. Each person opens `country-investment-thesis.html` from the synced folder in File Explorer (double-click; it opens in the default browser — make that Edge or Chrome). Bookmark the resulting `file:///...` address, or right-click the file and "Pin to Quick access".
3. First time: click **Connect folder** and choose this folder. The browser asks for permission once per session (one click on **Reconnect folder** on later visits). This is how a local page is allowed to read and write files; it cannot be skipped.
4. Click **Set your name** so saves are attributed in the log.

## How a save works

1. **Edit** — the page reads `locks/<economy>.lock.yaml`. If another person holds an unexpired lock you are told who and since when, and can cancel or take over. It then writes a lock with your name, an expiry (`lock_minutes` in `config.yaml`, default 30) and renews it every 5 minutes while the page stays open.
2. You edit text, add/remove/reorder issues, add subsections or scenario categories, and click cells in the implications matrix. All three sections can be edited in one session.
3. **Save changes** — the page validates (every issue needs a title; every signpost needs baseline, upside and downside), then re-reads `data/<economy>.yaml` from disk. If its `version` no longer matches the one you started from, the save is refused and you are asked to reload — this is the last line of defence when two people edit the same economy despite the lock.
4. If clear, it writes the new state to `data/<economy>.yaml` with `version + 1`, `updated_at` and `updated_by`, appends one entry to `log/<economy>.log.yaml`, and deletes the lock.

A log entry lists every changed field as a path with old and new value, so the history of any issue or arrow can be traced:

```yaml
---
at: "2026-09-14T09:41:12+08:00"
by: AC
economy: united-states
version: 2
from_version: 1
change_count: 2
changes:
  - path: drivers/policy/monetary/iss-us-mo1/text
    old: |-
      - Committee has been cutting gradually ...
    new: |-
      - Committee has been cutting gradually ...
      - Balance-sheet runoff paused in ...
  - path: implications/drivers/policy/monetary/valuation
    old: up
    new: down
```

Paths use stable ids (`iss-xxxxxx`) so renaming an issue does not break its history. Reordering shows up as `.../order` changes; deletions show `new: null`.

## Updating an economy with Ada

`prompts/ada-update-economy.md` is a prompt for the firm's internal chatbot, Ada. A researcher pastes it into a new Ada conversation with the current `data/<economy>.yaml` attached. Ada reviews the file, suggests three things worth working on, researches each chosen topic (web for what has changed, internal documents for how the house has framed it), and agrees the exact wording of every change with the researcher before recording it. It then hands back the whole file with a `change_note` at the top.

The researcher saves that file anywhere (not into `data/`), opens the page, selects the economy and clicks **Import**. The page:

1. reads the file (paste or choose), checks it is for the selected economy, and refuses it if it is malformed or incomplete, with the reason;
2. keeps every existing id, mints ids for new items (`new-1` placeholders), and ignores the `implications` section — arrows are only ever set by clicking in the page;
3. shows a review screen: every edited, added or retired issue and signpost, bullet by bullet, plus Ada's change note and a warning if the file was derived from an older version than the one on disk;
4. on **Apply import**, writes the file with `version + 1` through the normal save path, so the lock and the on-disk conflict check apply, and appends a log entry marked `source: import` carrying the change note.

If the change note lists matrix suggestions, click **Edit** afterwards and set the arrows on the Investment implications page.

## SharePoint / OneDrive behaviour to know about

- **Sync is not instant.** Another person's save, or their lock, typically appears on your PC within seconds but can take a minute or two. The lock is therefore a courtesy signal; the version check on save is what actually prevents overwrites.
- **Per-economy files** mean two people editing different economies never touch the same file, so OneDrive never has to merge anything.
- **If OneDrive does detect a conflict** (two machines writing the same file before syncing), it keeps both copies and names one `united-states-<ComputerName>.yaml`. The page only reads the canonical name; look for such files if a save seems to have vanished, and merge by hand.
- **The log file is append-only** from the page's point of view; OneDrive still uploads the whole file each time, which is fine at this size.
- **Reading YAML on the web.** The `data/` files are plain text, so anyone can read (or, in an emergency, edit) an economy's views from the SharePoint web UI without the HTML. Hand edits are not logged and do not bump `version`, but they are safe: a save from the page is refused whenever the file on disk differs from what that page loaded, whoever changed it, and the person saving is asked to Reload first. If a hand edit leaves the file in a form the page cannot read, that economy shows the parse error instead of its content and cannot be edited until the file is fixed (or restored from SharePoint version history); the page never writes over a file it could not read.
- The `.html` file itself cannot be opened from the SharePoint web UI (SharePoint serves it as a download). Use the synced folder.

## Adding an economy

Add an entry to `config.yaml` and create `data/<id>.yaml` (empty is fine — the page scaffolds the structure and writes it on first save).

## Browser support

Edge and Chrome (File System Access API). In other browsers the page opens in a read-only fallback: **Open YAML files** loads files you pick, and **Save changes** downloads the updated data file and log entry for you to copy into place.
