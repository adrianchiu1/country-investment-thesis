# Country Investment Thesis

A single-file HTML front-end plus YAML files, kept in a SharePoint document library that team members sync to their PC with OneDrive. No server, no IT setup.

## Folder layout

```
economy-views/
  EDITOR-country-investment-thesis.html      the tool (open with Edge or Chrome); snapshots exported from it drop the EDITOR- prefix
  config.yaml             list of economies, lock timeout, title
  prompts/
    READ ME FIRST.txt                   how to update an economy with Ada, step by step
    Ada prompt - update an economy.txt  the prompt to paste into Ada
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
2. Each person opens `EDITOR-country-investment-thesis.html` from the synced folder in File Explorer (double-click; it opens in the default browser — make that Edge or Chrome). Bookmark the resulting `file:///...` address, or right-click the file and "Pin to Quick access".
3. First time: click **Connect folder** and choose this folder. The browser asks for permission once per session (one click on **Reconnect folder** on later visits). This is how a local page is allowed to read and write files; it cannot be skipped.
4. Click **Set your name** so saves are attributed in the log.

On the first visit the page runs a short walkthrough that dims the page and points out these steps, then Edit, the Ada prompt, Import and Export snapshot. Click **Guide** (top right) to replay it any time.

## How a save works

1. **Edit** — the page reads `locks/<economy>.lock.yaml`. If another person holds an unexpired lock you are told who and since when, and can cancel or take over. It then writes a lock with your name, an expiry (`lock_minutes` in `config.yaml`, default 30) and renews it every 5 minutes while the page stays open.
2. You edit text, add/remove/reorder issues and signposts, add subsections, and click cells in the implications matrix. All three sections can be edited in one session.
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

`prompts/Ada prompt - update an economy.txt` is a prompt for the firm's internal chatbot, Ada; `prompts/READ ME FIRST.txt` walks a researcher through the steps in plain language, and the **Ada prompt** button in the page (next to Import) shows the same steps and copies the prompt to the clipboard. The researcher pastes the prompt into a new Ada conversation with the current `data/<economy>.yaml` attached (Ada asks for the file, and where to find it, if it is missing). Ada then asks the researcher to choose a mode. **Review Mode**: Ada reviews the thesis with the researcher three items at a time, page by page (Drivers, Signposts, Implications), asking whether each item still holds given the latest evidence and the researcher's latest judgement, and researches only what the researcher picks. **Discuss Mode**: the researcher sets the topic and Ada discusses it with them as a friendly junior macro strategist, framing the issue, bringing numbers and a view of its own, floating decisions, and refining wording only when the discussion converges. **Incorporate Mode**: the researcher provides a document (their own note, meeting notes, a report); Ada extracts numbered key points and incorporates them into the thesis, grounded in the document alone, with the supporting passage quoted against each one. In every mode Ada agrees the exact wording of every change before recording it, and matrix changes are never written to the file; they go into the change note as suggestions. At the end Ada hands back the whole file with a `change_note` at the top: as a downloadable `<economy>.yaml` where the portal lets Ada attach files, and always as a code block.

The researcher opens the page, selects the economy, clicks **Import**, and either chooses the downloaded file or pastes the code block (never saving it into `data/` by hand). The page:

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

## How an economy is structured

One hierarchy runs through all three pages. Four **drivers** (Regime, Policy, Imbalances, Geopolitics) each hold **subsections** (Trend growth, Trend inflation, Monetary, Fiscal, Domestic, External, Credit, International). The structure is defined on the **Drivers** page, where each subsection holds **issues**: the house view as a title and bullets. The **Scenarios & signposts** page shows the same drivers and subsections, and under each lists the **signposts** we track for it: a title with baseline, upside and downside. The **Investment implications** matrix has one row per subsection. The sidebar is the same tree on all three pages, and every driver card carries a Views | Signposts toggle plus a footer line naming what the other page holds for that subsection.

In the YAML this is `drivers[].subsections[]` with `issues[]` and `signposts[]` side by side; there is no separate `scenarios` section. Files from before September 2026 that still carry one are folded into the drivers on load (Growth → Trend growth, Inflation → Trend inflation, Policy → Monetary, or Fiscal when the title says so) and the layout is kept on the next save; `tools/migrate-signposts.mjs` did this once for the committed files.

## Adding an economy

Add an entry to `config.yaml` and create `data/<id>.yaml` (empty is fine — the page scaffolds the structure and writes it on first save).

## Browser support

Edge and Chrome (File System Access API). In other browsers the page opens in a read-only fallback: **Open YAML files** loads files you pick, and **Save changes** downloads the updated data file and log entry for you to copy into place.
