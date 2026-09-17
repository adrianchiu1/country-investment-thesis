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
3. First time: click **Connect folder** and choose this folder. The browser asks for permission to *view* the folder once per session (one click on **Reconnect folder** on later visits). Write access is requested separately, and only when someone clicks **Edit** or **Import** (or exports a snapshot). Readers never grant it.
4. Click **Set your name** (top right) so saves are attributed in the log. Once set it shows your initials.

On the first visit the page runs a short walkthrough that dims the page and points out these steps, then Edit, the **Workflow** menu (Ada and .docx) and the **⋯** menu. Click **Guide** (in **⋯**, top right) to replay it any time.

The top of the page carries three controls on the right: the **folder chip** (which is also
the control — click it to connect, reconnect or reload), your **initials** (click to change
the name saved to the log), and **⋯** for *Export snapshot* and *Guide*. Economies sit on
their own row below, and scroll sideways if there are more than fit.

## How a save works

1. **Edit** — the page reads `locks/<economy>.lock.yaml`. If another person holds an unexpired lock you are told who and since when, and can cancel or take over. It then writes a lock with your name, an expiry (`lock_minutes` in `config.yaml`, default 30) and renews it every 5 minutes while the page stays open.
2. You edit text, add/remove/reorder issues and signposts, add subsections, and click cells in the implications matrix. All three sections can be edited in one session.
3. **Save changes** — the page validates (every issue needs a title; an issue's baseline, upside and downside are filled together or not at all), then re-reads `data/<economy>.yaml` from disk. If its `version` no longer matches the one you started from, the save is refused and you are asked to reload — this is the last line of defence when two people edit the same economy despite the lock.
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

`prompts/Ada prompt - update an economy.txt` is a prompt for the firm's internal chatbot, Ada; `prompts/READ ME FIRST.txt` walks a researcher through the steps in plain language, and the **Ada prompt** button in the page (next to Import) shows the same steps with three copy buttons: **Copy prompt + file** puts the prompt and the economy's current YAML on the clipboard together, so one paste into a new Ada conversation starts the session and nobody has to open the `data/` folder; **Copy prompt** and **Copy file** copy them separately. (Ada asks for the file, and where to find it, if it is missing.) Ada then asks the researcher to choose a mode. **Review Mode**: Ada reviews the thesis with the researcher three items at a time, page by page (Drivers, Signposts, Implications), asking whether each item still holds given the latest evidence and the researcher's latest judgement, and researches only what the researcher picks. **Discuss Mode**: the researcher sets the topic and Ada discusses it with them as a friendly junior macro strategist, framing the issue, bringing numbers and a view of its own, floating decisions, and refining wording only when the discussion converges. **Incorporate Mode**: the researcher provides a document (their own note, meeting notes, a report); Ada extracts numbered key points and incorporates them into the thesis, grounded in the document alone, with the supporting passage quoted against each one. In every mode Ada agrees the exact wording of every change before recording it, and matrix changes are never written to the file; they go into the change note as suggestions. At the end Ada hands back the whole file with a `change_note` at the top: as a downloadable `<economy>.yaml` where the portal lets Ada attach files, and always as a code block.

The researcher opens the page, selects the economy, clicks **Import**, and either chooses the downloaded file or pastes the code block (never saving it into `data/` by hand). The page:

1. reads the file (paste or choose), checks it is for the selected economy, and refuses it if it is malformed or incomplete, with the reason;
2. keeps every existing id, mints ids for new items (`new-1` placeholders), and ignores the `implications` section — arrows are only ever set by clicking in the page;
3. shows a review screen: every edited, added or retired issue and signpost, bullet by bullet, plus Ada's change note and a warning if the file was derived from an older version than the one on disk;
4. on **Apply import**, writes the file with `version + 1` through the normal save path, so the lock and the on-disk conflict check apply, and appends a log entry marked `source: import` carrying the change note.

If the change note lists matrix suggestions, click **Edit** afterwards and set the arrows on the Investment implications page.

## Cloning the thesis into Word

**Workflow → Get .docx** saves the selected economy as a Word document —
`united-states-v2.docx` — to your downloads. It is a read-only operation: unlike *Export
snapshot* it needs no write access to the folder and no entry in `editors:`, so anyone
who can open the page can take a copy away to read, circulate or mark up, including from
a snapshot.

The document opens with a **How to edit this document** panel and a blank card to copy.
Each driver group then starts on its own page, and every issue is a **card**: a small
table with its title, its view bullets, and its three signpost cells, with a faint
reference at the foot.

Nothing in the file is locked or hidden, so the ordinary Word gestures all work:

- **Change the wording** — type in any cell.
- **Add an issue** — copy the blank card from the first page, paste it where you want
  it, fill it in, and leave its reference as `NEW`.
- **Remove an issue** — delete the whole card.
- **Reorder** — move the whole card.

The reference at the foot of each card is what ties an edit back to the thesis, which is
why the panel asks people to leave it alone. Rather than stopping anyone from breaking
it, the import checks the document when it comes back and **refuses, naming the card, if
anything does not add up** — a missing or duplicated reference, a card with no title,
signposts filled in one or two cells instead of three.

**Workflow → Import .docx** reads an edited document back. It goes through the same
review screen as an Ada import: every change is listed, nothing is written until you
click **Apply import**, and the log records it with `source: word-import`. If anything
does not add up — a missing or duplicated reference, a card with no title, signposts
filled in one or two cells instead of three — the import stops, names the card and
changes nothing.

`docs/word-round-trip.md` explains the design and what is still unverified;
`node docs/poc/word-round-trip-tests.mjs` runs the round-trip tests against the page
itself.

## Who can write to the data folder

The page itself is only ever one layer. Three layers together keep `data/` safe:

1. **The page connects read-only.** Opening the folder asks the browser for view access only. Write access is a second, explicit prompt that appears when someone clicks Edit or Import, so a reader who never edits never has write permission, and the page cannot write by accident.
2. **An `editors:` list in `config.yaml`** (optional). If present, only people whose name (as set with "Set your name") is on the list get working Edit and Import buttons; everyone else sees them disabled with the list in the tooltip. This is a guard rail against accidental edits, not security: anyone with write access to the library could still edit the files by hand.
3. **SharePoint permissions are the real control.** Give the library (or the `data/` and `log/` folders) *Contribute* to the editors and *Read* to everyone else. A reader who somehow edits through the page would then hit an upload error in OneDrive and their copy would diverge; layers 1 and 2 stop that before it happens. People who only need to read are best served by an exported snapshot in a read-only location, which needs no folder connection at all.

Never edit or move the files in `data/` by hand; hand edits are not logged and a stale page can refuse to save over them.

## SharePoint / OneDrive behaviour to know about

- **Sync is not instant.** Another person's save, or their lock, typically appears on your PC within seconds but can take a minute or two. The lock is therefore a courtesy signal; the version check on save is what actually prevents overwrites.
- **Per-economy files** mean two people editing different economies never touch the same file, so OneDrive never has to merge anything.
- **If OneDrive does detect a conflict** (two machines writing the same file before syncing), it keeps both copies and names one `united-states-<ComputerName>.yaml`. The page only reads the canonical name; look for such files if a save seems to have vanished, and merge by hand.
- **The log file is append-only** from the page's point of view; OneDrive still uploads the whole file each time, which is fine at this size.
- **Reading YAML on the web.** The `data/` files are plain text, so anyone can read (or, in an emergency, edit) an economy's views from the SharePoint web UI without the HTML. Hand edits are not logged and do not bump `version`, but they are safe: a save from the page is refused whenever the file on disk differs from what that page loaded, whoever changed it, and the person saving is asked to Reload first. If a hand edit leaves the file in a form the page cannot read, that economy shows the parse error instead of its content and cannot be edited until the file is fixed (or restored from SharePoint version history); the page never writes over a file it could not read.
- The `.html` file itself cannot be opened from the SharePoint web UI (SharePoint serves it as a download). Use the synced folder.

## How an economy is structured

One hierarchy runs through all three pages. Four **drivers** — Economic Regime (Growth, Inflation), Policy (Monetary, Fiscal, Reforms), Imbalances (Domestic, External, Financial) and Politics (Domestic, Geopolitics) — each hold those **subsections**, and each subsection holds **issues**. Each driver shows the question it exists to answer beside its name. The ids in the YAML are frozen so history survives a rename, so they do not always match the names: Politics is `geopolitics`, its Geopolitics subsection is `international`, and Financial is `credit`. Every issue has two sides. The **Drivers** page shows its view: the title and bullets. The **Scenarios & signposts** page shows the same issues, one row each with the title verbatim, and the three cells we track for it: baseline, upside and downside. The structure (subsections, issues) is defined on the Drivers page; the signposts page only fills in the cells. The **Investment implications** matrix has one row per subsection. The sidebar is the same tree on all three pages, and every driver card carries a Views | Signposts toggle that switches page keeping the driver and tab in view.

In the YAML an issue is `{id, title, text, baseline, upside, downside}`; the three cells are omitted while an issue has no signposts, and once any is filled all three are required. There is no separate `scenarios` section. Files from before September 2026 that still carry one are folded in on load (each old signpost becomes an issue with cells and an empty view, under Trend growth / Trend inflation / Monetary or Fiscal by category) and the layout is kept on the next save; `tools/migrate-signposts.mjs` did the committed files properly, attaching each old signpost to the issue it tracks per `tools/signpost-migration.json`.

## Adding an economy

Add an entry to `config.yaml` and create `data/<id>.yaml` (empty is fine — the page scaffolds the structure and writes it on first save).

## Browser support

Edge and Chrome (File System Access API). In other browsers the page opens in a read-only fallback: **Open YAML files** loads files you pick, and **Save changes** downloads the updated data file and log entry for you to copy into place.
