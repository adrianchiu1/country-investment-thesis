# Editing the thesis in Word, and getting it back

A design note. **Export is now built** (step 2 below): the editor has a *Word
copy* button that saves the selected economy as a `.docx`. Reading an edited
document back is not built — everything from §8c onward is still a specification.
This note sets out the method, says which parts are proven and which are not, and
gives the build order.

Written against the schema now on `main`: **one hierarchy** (drivers →
subsections → issues) with a **signpost as three optional cells on an issue**,
and a **read-only folder connect** that asks for write access only on Edit or
Import. An earlier draft of this note targeted the old two-hierarchy layout with
a separate `scenarios:` section; that is gone, and the design got simpler for
it.

There is a working prototype next to this note: open `poc/docx-round-trip.html`
in Edge or Chrome and it runs its own tests, or open
`poc/sample-united-states-v2.docx` in Word to see the document it produces.

---

## 1. First decide which problem you are solving

Two different needs get called "export to Word", and they cost very different
amounts:

**(a) Circulate and mark up.** A PM or the CIO wants to read the thesis in Word,
turn on Track Changes, leave comments in the margin, and send it back. The
researcher then decides what to accept. *The document is a conversation, not a
data file.*

**(b) Bulk prose editing.** A researcher finds it faster to rewrite fifteen
bullets in Word than in a browser textarea, and wants the result to become the
new thesis.

For **(a)** you do not need a full round-trip at all. Export a good-looking
read-only Word file, and read back only the **comments and tracked changes** as a
list of suggestions the researcher applies in the page. That halves the work and
removes almost all of the risk, because nothing a reviewer types can silently
become house view.

For **(b)** you need the real round-trip described below.

The design that follows does (b), because (a) falls out of it for free — the same
export, and the same reader, just ignoring the body text and keeping the
annotations. But if (a) is the actual need, say so and the build shrinks to about
a third.

---

## 2. Is a rule writable? Yes — because you control the document

The worry in the original question is the right one: *parsing an arbitrary Word
document into a strict schema is not reliably possible.* Word documents are a
soup of runs and properties, humans paste from anywhere, and there is no way to
know which paragraph was meant to be which issue.

But that is not the problem here. **We hand out the document.** So we can build
it out of Word's own structural features rather than out of text conventions, and
then reading it back is a lookup rather than an inference.

The key feature is the **content control** (`w:sdt`, what Word calls a Rich Text
Content Control). It wraps a region of the document, it can carry an arbitrary
machine-readable string in its `w:tag`, and it can be marked
`<w:lock w:val="sdtLocked"/>` so the box cannot be deleted while its contents
stay freely editable. The user sees a labelled box; we see:

```
issue|iss-us-tg1
   field|title      -> one paragraph
   field|text       -> the view bullets
   field|baseline   -> a table cell
   field|upside     -> a table cell
   field|downside   -> a table cell
```

Since `main` collapsed the two hierarchies into one, there is exactly **one kind
of editable box in the document: the issue.** Everything a researcher can change
is a field inside one of those, or the order they sit in.

The tag carries **identity only — never placement.** Where an item sits comes
from the container it is inside and from document order. That split is what lets
a researcher drag a box somewhere else and have the move mean something (§5); if
the tag also named the subsection, a moved box would carry a stale place that
contradicted where it now sat.

That tag is the same stable `iss-xxxxxx` id the log and the history already turn
on. So an issue's identity survives being retitled, rewritten, or moved — which
is precisely what the YAML import path already has to reconstruct by matching
titles. In Word we do not have to guess: the document says so.

Everything else follows the same principle:

| Thesis structure | Word structure |
| --- | --- |
| Issue / signpost identity | content control, `w:tag` carrying the id |
| Where an item sits, and in what order | the enclosing container control, plus document order |
| Somewhere to add a new one | an empty placeholder control at the end of each container |
| Which field (title, text, baseline…) | nested content control, `field\|…` |
| Bullet, nested bullet | paragraph styles `CIT Bullet` / `CIT Bullet 2` + real list numbering |
| `**bold**` | a bold run |
| Baseline / upside / downside | a three-column table on the issue, one control per cell |
| An issue with no signposts | the same three cells, left showing their italic hint |
| Subsection, group | headings, wrapped in a control (the group's is read-only) |
| Implications matrix | a table inside a `contentLocked` control — read-only |

Named styles matter as much as the controls: they are the **second** anchor. If a
control is destroyed, a paragraph still styled `CIT Issue Title` tells us a new
issue starts there. Two independent anchors is what makes the degradation ladder
in §4 work.

---

## 3. Writing and reading .docx with no libraries

A `.docx` is a ZIP of XML parts. The tool is a single HTML file opened from a
synced folder with no build step and no npm, so the question is whether a browser
can do ZIP unaided. It can:

- `CompressionStream('deflate-raw')` and `DecompressionStream('deflate-raw')` are
  native in Chrome and Edge, which the tool already requires for the File System
  Access API. No library, no polyfill.
- The rest of ZIP — local headers, central directory, CRC32 — is about 60 lines.

The prototype writes six parts (`[Content_Types].xml`, two `.rels`,
`document.xml`, `styles.xml`, `numbering.xml`). A whole economy comes out at
6–8 KB.

**Measured, in the prototype:**

| | |
| --- | --- |
| All seven economies (78 issues), YAML → .docx → back | **every id, title, bullet, cell and nesting level identical, and zero spurious changes** |
| `united-states.yaml` (13 issues, 5 of them with signposts) | ~8.9 KB, ~12 ms to write, ~14 ms to read |
| Independent OOXML reader (`python-docx` / `lxml`) | opens it; 106 content controls, 14 tables, 181 paragraphs, real bullet numbering, all 12 styles resolve by name |

### What is *not* proven

There is no copy of Microsoft Word in the environment these tests ran in. So:

1. **That Word opens the file without a "repair" prompt.** The XML is well-formed
   and an independent OOXML reader is happy with it, which is good evidence, but
   Word is the authority.
2. **That Word preserves the `w:tag` values when the user saves.** This is
   standard content-control behaviour and the whole design rests on it.
3. **That `sdtLocked` stops a determined user deleting the box.**

All three are one manual test, and that test is step 0 of the build. Open
`poc/sample-united-states-v2.docx`, edit it, save it, and re-open it in the
prototype page.

---

## 4. Reading back a document a human has edited

The import never writes to `data/`. It produces a candidate economy object and
hands it to **the review screen that already exists** — the same diff cards, the
same lock, the same "refuse if the version on disk moved" check, the same log
entry. That is the real safety net, and it is already built and in use: a human
editing mistake shows up as a visible diff line before anything is written.

The reader degrades in three tiers.

**Tier A — the controls are intact.** Normal editing: typing, deleting,
reordering bullets, bolding, tracked changes, comments. Walk the control tree,
read the text inside each tagged region. Deterministic and exact.

Specifically handled:
- **Tracked changes** are read *as if accepted*: runs inside `w:ins` are
  included, everything inside `w:del` is dropped. The review screen says so, so
  the researcher knows they are approving the accepted version.
- **Comments** are not data. They are lifted out and shown beside the review as
  the reviewer's notes, and carried into the log's change note. A comment can
  never change a bullet.
- **Word's autocorrect** turns `"` into curly quotes and inserts non-breaking
  spaces, which would otherwise show up as dozens of spurious diff lines. Two
  defences: normalise the obvious ones on import, and then — because the page
  still holds the pre-export YAML — **if a bullet differs from the stored bullet
  only by typography, keep the stored one.** Noise disappears entirely.

**Tier B — a control was destroyed.** Someone pasted over a box, or used "Keep
Source Formatting". The id is gone but the text is still there. Fall back to the
style anchor: walk the document by paragraph style, rebuild the structure from
`CIT Heading 3` / `CIT Issue Title`, then re-attach ids by matching subsection +
title against the current YAML — the same title-matching the YAML import already
does. Anything that still cannot be placed is offered as an *addition*, never
silently merged.

This is the tier the original question was really about, and it works. Each
field falls back independently, because a box can lose one control and keep the
others. In the prototype, with one issue's inner controls destroyed and a second
issue's box unwrapped entirely:

```
TEST 5  Tier B — content controls destroyed:
   PASS  parser did not crash
   PASS  box intact but inner controls gone: still read by style anchor
   PASS  whole box unwrapped: recovered by title, id restored
   PASS  its text came with it
   PASS  nothing wrongly reported as retired
   PASS  nothing wrongly reported as added
```

Those last two lines are the important ones. The failure that would actually
hurt is not "the import stops"; it is **an issue quietly reported as retired
because its box got mangled**, which through the normal save path would delete
it — or the mirror image, the same issue coming back as a duplicate addition.
Tier B exists to make both impossible.

**Tier C — the structure is gone.** The document is unreadable, is for a
different economy, or has lost so much that headings no longer make sense. Refuse
with a specific reason, exactly as the YAML import already refuses a malformed
file — and offer the Ada hand-off below.

One extra guard, cheaply: stamp the export with a control tagged
`meta|<economy>|<version>`. Then the import knows which economy and which version
the document left from, warns on a stale document the way the YAML path does, and
can tell a *deliberate* retirement from a *mangled* one by comparing the ids that
went out with the ids that came back.

---

## 5. Structural edits: adding, deleting, reprioritising

Text editing is the easy half. The operations that break naive round-trips are
the ones that change *which items exist, in what order, and with what attached*.
All are proven in the prototype.

First, what the page itself allows, because Word must not offer more than the
tool can accept:

| | Add | Delete | Reorder | Rename |
| --- | --- | --- | --- | --- |
| Driver group (Regime, Policy, Imbalances, Geopolitics) | — | — | — | — |
| Subsection (Trend growth, Monetary …) | yes | only ones you added | yes | only ones you added |
| Issue | yes | yes | yes, within its subsection | yes |
| Signposts on an issue | fill the three cells | clear all three | n/a — they belong to the issue | n/a |

The four driver groups are fixed, so their headings are `contentLocked` and **the
reader ignores group order entirely** — otherwise a researcher could reorder them
and the change would vanish, because `flatten()` does not track group order and
the log could not represent it.

Note what the new schema removed: there are no scenario categories to add,
delete or reorder any more, and a signpost is no longer an item with an identity
of its own. The Signposts lens in the page is explicit that "issues are added,
renamed and removed on the Drivers page; here you fill in what we track for
each." The Word document mirrors exactly that.

### Adding

A new issue is typed into an **"add here" slot**: an empty content control at the
end of every subsection carrying Word placeholder text. Word's
`<w:showingPlcHdr/>` flag tells us the slot is untouched, so an unused slot can
never become a phantom addition. There is one slot per subsection for a new
issue, and one at the end of each driver group for a new subsection.

The slot exists because of the failure it prevents. Without it, a researcher who
wants to add an issue puts the cursor at the end of the last bullet and presses
Enter — and is now typing *inside the previous issue's text control*, so the new
issue silently becomes three more bullets on the issue above. A visibly
different, italic, empty box is the affordance that stops that.

Inside a slot, the first line is the title and the rest are bullets; a paragraph
in the `CIT Issue Title` style starts another issue, so several can be added at
once. Lines beginning `Baseline:`, `Upside:` and `Downside:` become the new
issue's signpost cells, so an issue can arrive complete in one pass.

**Adding signposts to an issue that has none** is the case the new schema
creates, and it needs no new machinery. Every issue carries all three cells,
whether or not it uses them; an unused cell shows an italic hint
(*"Baseline — what we expect. Leave all three empty if this issue has no
signposts."*) and is marked as a placeholder. Type over the hint and the signpost
exists. This matches the page, which also shows three empty boxes per issue in
edit mode. The reader treats a still-hinted cell as empty, so the 51 of 78 issues
that currently have no signposts round-trip with nothing added.

### Deleting

**This is where the first draft of this note contradicted itself.** It said
controls are locked so they cannot be deleted — which would make deleting an
issue impossible.

The resolution is that `sdtLocked` locks the *frame*, not the contents. So:

> **To retire an issue, select everything inside its boxes and delete it. The
> empty frame stays behind, and its tag says which item you emptied.**

That is the natural gesture, and unambiguous, because the surviving frame means
we never have to guess *which* item went. It works identically with Track Changes
on, since the reader treats `w:del` content as already accepted.

The new schema adds a second, weaker deletion: **clearing just the three cells
drops the signposts and keeps the issue.** `flatten()` only emits a cell path
when the cell is non-empty, so that reads as three removals and the log records
it properly.

| What the document shows | Read as |
| --- | --- |
| Title, view and all three cells empty | **Retire the issue.** Confident. |
| Only the three cells empty | **Drop the signposts, keep the issue.** |
| Frame gone entirely | **Retire, flagged "may be accidental."** |
| Title empty, content still there | **Neither.** A question in the review. |
| One or two cells of three filled | **Neither.** A question in the review. |

The last two rows are the ones that earn their keep, because `validate()` refuses
the **entire import** if any problem is found, and it now has two rules that a
careless Word edit will trip:

- every issue needs a title; and
- *"once any cell is filled all three are required"* — so deleting one cell of a
  signpost, which is a single stray keystroke, would otherwise cost the whole
  document.

The reader therefore classifies these **before** validation runs and surfaces
them as a question against that one issue — *"signposts are half filled: upside
is empty. Fill it in, or clear all three to drop the signposts."* — rather than
letting a one-cell slip refuse a fifty-change import.

The worst outcome is not a refused import; it is an issue quietly retired because
its box was mangled, which the normal save path would then delete. Hence the
"frame gone" row is labelled rather than trusted, every retirement appears in the
review as a red card with the full old text, and nothing is written until Apply.
The log keeps the old text, so it is recoverable either way.

If retirement-by-emptying proves accident-prone, the hardening is a "Retire this
issue" dropdown on each box. I would not build it until the need shows up.

### Reprioritising

Because the tag carries identity and the container carries placement, reordering
needs no machinery: **move the box, and the item moves.** The reader takes
document order, and `flatten()` already emits an `order` field, so the existing
diff and log record it exactly as they do for the page's own ↑/↓ buttons.

This covers issues within a subsection and subsections within a group — which is
the whole of what the page can reorder. Signposts have no order of their own any
more; they move with their issue, which is one fewer thing to get wrong than in
the old layout.

Two edges:

- **If Word drops the control during a drag** (it sometimes pastes as plain
  text), the item becomes an orphan — and the Tier B recovery in §4 re-attaches
  it by title *at its new position*, which is the outcome we wanted anyway.
- **Moving an issue to a different subsection** is read correctly and the id is
  preserved, but the history model keys paths by subsection, so the log shows it
  as a retirement in the old place plus an addition in the new one. The id
  survives, so it is traceable. The page cannot do this at all — see §10.

### What the tests show

```
TEST 1  clean round-trip (new one-hierarchy schema):
   PASS  united-states    13 issues  identical, zero spurious changes
   PASS  china            12 issues  identical, zero spurious changes
   …all seven economies, 78 issues
   PASS  issues with no signposts stay empty (hints are not content)
   PASS  issues that have signposts keep all three cells
TEST 2  Q1 — adding:
   PASS  new issue typed into the slot is an addition
   PASS  its signposts were parsed from the Baseline:/Upside:/Downside: lines
   PASS  new subsection captured with its first issue
   PASS  signposts added to an existing issue read as an edit, not an addition
TEST 3  Q2 — deleting:
   PASS  emptying every box retires the issue
   PASS  clearing only the three cells keeps the issue
   PASS  half-cleared signposts are caught before validate() can refuse the import
   PASS  a box deleted outright is flagged as possibly accidental
TEST 4  Q3 — reprioritising:
   PASS  swapped issues report an order change, ids intact
   PASS  a reorder is not mistaken for an edit
   PASS  issue dragged to another subsection is reported as moved
   PASS  subsection order read from the document
   PASS  driver group order ignored (the page cannot reorder groups)
```

All seven economies round-trip with **zero spurious changes** — no phantom
additions from unused slots or unused signpost cells, no phantom retirements, no
edits reported on text nobody touched. That property is what makes the review
screen usable: if a clean round-trip produced even a handful of false diffs,
nobody would trust the real ones.

## 6. Where Ada fits

Ada should **not** be the parser for the normal path, for three reasons:

1. **It is not reproducible.** The same document could import two different ways
   on two different days. Everything else in this tool is deterministic and
   logged; the file-writing path should stay that way.
2. **Ada cannot see the anchors.** Chat portals extract plain text from a
   `.docx`. The content-control tags — the entire basis of the mapping — are
   stripped before Ada ever sees the document. Ada would be guessing from prose,
   which is the hard problem we just avoided.
3. **It would bypass the guarantees.** The lock, the version check and the review
   diff all hang off the import path.

Ada has two genuinely good jobs here instead.

**Ada as the repair shop (Tier C).** When the deterministic reader gives up, the
page exports what it *could* read as ordinary YAML-with-gaps, plus a note on what
was lost. The researcher takes that, and the current `data/<economy>.yaml`, to Ada
in a new **Reconcile Mode**: *"here is the thesis as it stands, here is a
damaged Word document someone edited — work out what they changed, confirm each
change with me, and hand back the file."* Ada is excellent at this, and it keeps
Ada working in YAML, which the existing prompt already does well. The output is a
normal Ada file and goes through the existing Ada import path, review screen and
all. Deterministic first, Ada as the fallback.

**Ada as the style check (optional).** Word editing tends to drift from house
style. Ada already knows the style rules from §3 of its prompt and could be asked
to tidy an imported batch before it is applied.

---

## 7. The implications matrix stays read-only

The existing invariant is that arrows are only ever set by clicking in the page,
and Ada never edits them. Word should not break that. Export the matrix as a
table inside a `contentLocked` control, ignore it entirely on import, and if it
was changed anyway, surface the difference as a *suggestion* in the review screen
— the same treatment the YAML import gives it today.

---

## 8. How it is provisioned in the editor, and what the researcher does

### 8a. What gets added to the HTML file

One new module, `const DOCX = (() => { … })()`, sitting next to `YAML` (which is
at `EDITOR-country-investment-thesis.html:438`). It exposes exactly two calls:

```js
DOCX.write(eco)            -> Uint8Array    // an economy object -> .docx bytes
DOCX.read(arrayBuffer)     -> { meta, manifest, places, newSubs }
```

About 600 lines, ~30 KB: ZIP codec ~120, document builder ~200, reader ~180,
reconciliation ~120. Nothing else in the page needs to know how a `.docx` works,
in the same way nothing needs to know how YAML is dumped.

Then five small edits to existing code:

| Where | Change |
| --- | --- |
| `download()` (`:989`) | takes `text` and hardcodes `type: 'text/yaml'`. Generalise to accept bytes and a MIME type. One line. |
| `renderToolbar()` (`:1104`) | add a **Word copy** button to the `actions` row, beside *Ada prompt* |
| `startImport()` (`:1436`) | accept `.docx` in the file input and branch on the extension |
| `renderReview()` (`:1487`) | render the reader's `problems` and `untouched` lists as cards |
| `saveDraft()` (`:1593`) | `entry.source = S.review.source \|\| 'import'`, so the log says `word-import` |

### 8b. Getting the Word document out

**Word copy** goes in the per-economy toolbar, not in the header next to *Export
snapshot*: a snapshot is the whole folder, a Word copy is the selected economy.

It is deliberately gated differently from everything else on that row:

- **No write permission.** `exportSnapshot()` calls `Store.ensureWrite()`
  (`:911`) because it writes a file into the folder. A Word copy does not: it
  builds the bytes in memory and hands them to `download()`, so the browser saves
  it to Downloads. Since `main` now connects the folder **read-only** and only
  asks for write access on Edit or Import, this matters — the people most likely
  to want a Word copy are reviewers who will never edit, and they can now get one
  without ever granting write access.
- **No `editors:` check.** `canEditHere()` gates Edit and Import. Reading is not
  editing, so the button is live for everyone, including in a snapshot
  (`SNAPSHOT_AT`) copy.
- **Works in the fallback browsers.** It is just a Blob, so Word export works in
  Safari and Firefox, where the File System Access API path does not.

Downloading rather than writing into the synced folder is the deliberate choice.
A `.docx` written into `data/` would sync to everyone, go stale the moment the
economy is saved, and invite a second person to pick up the stale copy. The file
name carries the version — `united-states-v2.docx` — which is the staleness cue.

So the researcher's path out is: pick the economy → **Word copy** → the file is
in Downloads → email it, or open it.

### 8c. Loading it back

The **Import** button, unchanged in position. The dialog copy widens from "Paste
the YAML that Ada handed back" to also offer a Word document, and the file input
becomes `accept=".yaml,.yml,.txt,.docx"`.

One detail that will bite if missed: the current change handler does
`$('imp-text').value = await f.text()` (`:1441`). Running that on a `.docx`
fills the textarea with binary garbage. The handler has to branch on the
extension, read a `.docx` with `arrayBuffer()`, keep the parsed result in a
variable, and show a one-line confirmation — *"Read united-states-v2.docx: 13
issues, exported from v2"* — instead of dumping text.

From **Review changes** onward, the two paths converge and everything downstream
is untouched: id fixing, `tidy()`, `validate()`, `diff()`, `acquireLock()`, the
review screen, the on-disk conflict check in `saveDraft()`, and the log entry.

**But the two paths build their candidate differently, and this is the
important part.** Ada hands back the *whole* economy, so the YAML path can use
the file as the new state. A Word document is a **projection** — it deliberately
omits the implications matrix and driver-group order, and it can go stale. So the
Word path starts from a clone of what is on disk *now* and applies only what the
document says changed:

```js
const imp = clone(cur);                 // everything not in the document survives
for (const place of parsed.places)      // rebuild each subsection's issue list
  … in document order, applying edits, retirements and additions
imp.implications = clone(cur.implications);   // never touched by Word
```

That is not just tidiness. It is what makes a stale Word document **safer** than
a stale Ada file: the YAML path replaces everything, so it silently undoes
whatever changed in between (which is exactly what its existing warning says).
The Word path applies per-issue deltas, so an issue nobody touched in Word keeps
whatever it now says on disk.

### 8d. The manifest, and the failure it prevents

A Word copy is detached. It may be out for days, and no lock is held while it is.
So an issue a colleague adds in the meantime is simply **absent from the
document** — and absence is how a retirement is expressed. Without a guard,
importing a week-old Word file would quietly delete their work.

The export therefore carries a **manifest**: a hidden (`w:vanish`), read-only
control listing the issue ids that existed when the file was written. At import:

| Id | In the manifest? | Read as |
| --- | --- | --- |
| Absent from the document | yes | **retired** (the box was deleted) |
| Absent from the document | no | **added since export — left exactly as it is on disk** |

Tested both ways:

```
TEST 6  a Word copy that went stale while it was out:
   PASS  an issue added on disk since export is NOT retired
   PASS  it is reported as left alone
   PASS  a genuinely deleted box is still retired
```

The `meta|<economy>|<version>` control gives the other two checks for free: the
wrong economy is refused outright, and a version older than the one on disk
raises the same loud warning the YAML path already shows.

### 8e. Problems need somewhere to live

The reader emits *problems* — a half-filled signpost, an issue that lost its
title — that today have nowhere to go: `validate()` either passes or refuses the
whole import with a dialog.

For a first version, reuse that: refuse, but with the specific message
(*"Trend inflation › Oil shock…: signposts are half filled, upside is empty.
Fill it in, or clear all three"*), so the researcher fixes one cell in the same
document and imports again. It matches existing behaviour and is barely any code.

The better version, once the pattern proves itself, is amber cards at the top of
the review screen with Apply disabled until each is resolved or that issue's
changes are dropped. Worth doing if half-filled signposts turn out to be common,
which the Word cell layout makes plausible.

### 8f. End to end

1. Researcher picks the economy, clicks **Word copy**, gets
   `united-states-v2.docx`. No permissions, no lock, nobody is blocked.
2. They — or a PM who has never opened the tool — edit it in Word, with Track
   Changes and comments if they like.
3. Back in the page: **Import** → choose the `.docx` → *Review changes*.
4. The page acquires write access and the lock, checks the economy and version,
   builds the candidate from disk + the document's deltas, and shows the usual
   review: edited, added, retired, reordered, moved — plus anything it could not
   place, and anything it deliberately left alone.
5. **Apply import** goes through the normal save path: version + 1, the on-disk
   conflict check, `data/<economy>.yaml` rewritten, one log entry appended with
   `source: word-import`, lock released.

## 9. Build order

0. **Half an hour, before anything else.** Open
   `poc/sample-united-states-v2.docx` in Word and try the five gestures the
   design rests on: edit a bullet; type into an "add here" slot; type over the
   italic hints in an issue's three signpost cells; clear an issue's boxes; drag
   an issue above its neighbour. Save, re-open it in `poc/docx-round-trip.html`,
   and check the boxes and their tags survived. If Word mangles content controls,
   stop and reconsider — everything above depends on it. Worth repeating on Word
   Online and Word for Mac if the team uses them, and on the drag in particular,
   which is the gesture most likely to drop a control.
1. Decide (a) or (b) from §1.
2. **Done.** The `DOCX` module (write only) sits beside `YAML` in the editor,
   `download()` takes bytes and a MIME type, and **Word copy** is in the
   per-economy toolbar. Driven from the real page it produces a valid 8.9 KB
   file — 107 content controls, 14 tables, all 6 parts deflated, opened by an
   independent OOXML reader — which the prototype importer reads back with zero
   spurious changes. Let people live with it for a week before going further.
3. Add the Tier A reader and the manifest check, wired into the existing review
   screen behind the normal Import button (§8c, §8d). Refuse on problems for now
   (§8e).
4. Add Tier B recovery and the typographic noise suppression.
5. Add tracked changes and comments as review annotations.
6. Only if Tier C turns out to happen in practice: write the Ada Reconcile Mode
   prompt.

## 10. Risks worth naming

- **Word is the single point of failure.** Step 0 above.
- **"Save As → .doc"** or "Save As → PDF" by a helpful user produces a file the
  reader cannot use. Detect the extension and say so plainly.
- **Two people editing the same economy in Word** for a week each, then both
  importing. No lock spans that. The manifest and the per-issue deltas (§8c, §8d)
  mean the second import no longer silently undoes the first, but where both
  edited the *same* issue the second still wins, and the version check plus the
  on-disk conflict check are what force a reload. Keep Word sessions short.
- **Scope creep in the document.** Once it is a Word file, people will want
  headers, logos, a contents page. That is all fine — it is cosmetic and lives in
  `styles.xml` — but each addition is a thing the reader must ignore rather than
  trip over.
- **Word offering more than the page does.** Moving an issue between
  subsections works through Word but has no button in the editor. Either add the
  button or have the reader refuse the move, but do not leave it undecided — a
  change a researcher can make in Word and then cannot undo in the page is a
  support call. (An earlier version of this risk also covered reordering scenario
  categories; the one-hierarchy schema removed that case.)
- **The schema is still moving.** This design has been retargeted once already,
  when `main` merged the scenarios section into the drivers tree. The mapping is
  about thirty lines of `buildDocument`, so retargeting is cheap — but do not
  build the Word path into the editor while the shape of the file is in flux.
- **Retirement by accident.** Emptying a box is a deliberate gesture but a
  cheap one. The review screen and the log make it recoverable; the "Retire"
  dropdown in §5 is the hardening if it proves necessary.
