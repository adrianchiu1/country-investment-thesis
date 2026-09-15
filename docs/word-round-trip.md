# Editing the thesis in Word, and getting it back

A design note. Nothing in the tool has changed yet — this sets out a method, says
which parts are proven and which are not, and gives a build order.

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
   field|title    -> one paragraph
   field|text     -> the bullets
```

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
| Baseline / upside / downside | a three-column table, one control per cell |
| Subsection, group | headings `CIT Heading 2` / `CIT Heading 3`, wrapped in a control |
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
| All seven economies, YAML → .docx → back | **every id, title, bullet and nesting level identical, and zero spurious changes** |
| `united-states.yaml` (13 issues, 5 signposts, 5.3k chars) | 8,776 bytes, ~12 ms to write, ~14 ms to read |
| Independent OOXML reader (`python-docx` / `lxml`) | opens it; 99 content controls, 6 tables, 145 paragraphs, real bullet numbering, all 12 styles resolve by name |

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

This is the tier the original question was really about, and it works. In the
prototype, with one issue's controls destroyed by a simulated paste and a second
issue typed by hand with no control at all:

```
PASS  surviving tagged issues still carry ids
PASS  orphaned issue recovered by title, id restored
PASS  its edited text came with it
PASS  hand-typed issue seen as an addition
PASS  nothing wrongly reported as retired
```

That last line is the important one. The failure that would actually hurt is not
"the import stops"; it is **an issue quietly reported as retired because its box
got mangled**, which through the normal save path would delete it. Tier B exists
to make that impossible.

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
the ones that change *which items exist and in what order*. All three are
proven in the prototype; the tests are `TEST 2`, `TEST 3` and `TEST 4`.

First, what the page itself allows, because Word must not offer more than the
tool can accept:

| | Add | Delete | Reorder | Rename |
| --- | --- | --- | --- | --- |
| Driver group (Regime, Policy, Imbalances, Geopolitics) | — | — | — | — |
| Subsection (Trend growth, Monetary …) | yes | only ones you added | yes | only ones you added |
| Issue | yes | yes | yes, within its subsection | yes |
| Scenario category | yes | only ones you added | *no UI* | only ones you added |
| Signpost | yes | yes | yes, within its category | yes |

The four driver groups are fixed. So in the Word file their headings are
`contentLocked` and **the reader ignores group order entirely** — otherwise a
researcher could reorder them, and the change would be silently lost, because
`flatten()` does not track group order and the log would never show it.

### Adding

A new issue is typed into an **"add here" slot**: an empty content control at the
end of every subsection, carrying Word placeholder text —
*"Click here and type a new issue: its title on the first line, then one bullet
per line."* Word's `<w:showingPlcHdr/>` flag tells us the slot is untouched, so
an unused slot can never become a phantom addition. There is a slot at the end of
each driver group for a **new subsection**, and one at the end of the scenarios
page for a **new category**.

The slot exists because of the failure it prevents. Without it, a researcher who
wants to add an issue puts the cursor at the end of the last bullet and presses
Enter — and they are now typing *inside the previous issue's text control*. Their
new issue silently becomes three more bullets on the issue above. A visibly
different, italic, empty box is the affordance that stops that.

Inside a slot, a paragraph in the `CIT Issue Title` style starts a new item, so
several can be added at once; if the researcher does not touch the styles, the
first line is the title and the rest are bullets. For a signpost the three lines
after the title become baseline, upside and downside. New items arrive with no
id and are minted permanent ids on apply — the same `new-1` treatment the Ada
import already uses.

Anything typed *outside* a slot is still caught by the orphan detector in §4 and
offered as an addition placed by the nearest heading. The slot is the happy path,
not the only path.

### Deleting

**This is where the first draft of this note contradicted itself.** It said
controls are locked so they cannot be deleted — which would make deleting an
issue impossible.

The resolution is that `sdtLocked` locks the *frame*, not the contents. So:

> **To retire an issue or signpost, select everything inside its boxes and delete
> it. The empty frame stays behind, and its tag tells us which item you emptied.**

That is the natural gesture — select, press Delete — and it is unambiguous,
because the surviving frame means we never have to guess *which* item was
removed. It works identically with Track Changes on, since the reader treats
`w:del` content as already accepted, so a struck-through issue reads as empty.

Three cases, deliberately treated differently:

| What the document shows | Read as |
| --- | --- |
| Title and body both empty, frame intact | **Retire.** Confident. |
| Frame gone entirely | **Retire, flagged "may be accidental."** |
| Title empty, body still has text | **Neither.** A question in the review: *restore the title, or clear the whole box to retire it.* |

That third row matters more than it looks. Without it, deleting a title by
accident would empty `title`, fail `validate()`'s "every issue needs a title"
check, and **refuse the entire import** — one slip costing the whole document.
The reader must therefore classify retirements *before* validation runs, not
after.

The worst outcome here is not a refused import; it is an issue quietly retired
because its box was mangled, which the normal save path would then delete. Hence
the middle row is labelled rather than trusted, and every retirement appears in
the review as a red card with the full old text, written only on Apply. The log
keeps the old text either way, so it is recoverable.

If retirement-by-emptying turns out to happen by accident in practice, the
hardening is a "Retire this item" dropdown control on each box — explicit intent,
impossible to trigger by a stray Delete. I would not build it until the need
shows up: it puts a widget on every item to guard against something that may
never occur.

### Reprioritising

Because the tag carries identity and the container carries placement, reordering
needs no machinery at all: **move the box, and the item moves.** The reader takes
document order, and `flatten()` already emits an `order` field per item, so the
existing diff and log record it exactly as they do for the page's own ↑/↓
buttons — the README already documents `.../order` changes.

This works for issues inside a subsection, signposts inside a category,
subsections inside a group, and scenario categories on the scenarios page. Note
the last one is a capability the page's own UI does not have: there is no "move
category" button, but the order *is* tracked in the file and the log. Word would
therefore let a researcher do something the page cannot. That is coherent and
useful, but worth deciding deliberately rather than discovering.

Two edges:

- **If Word drops the control during a drag** (it sometimes pastes as plain
  text), the item becomes an orphan — and the Tier B recovery in §4 re-attaches
  it by title *at its new position*, which is the outcome we wanted anyway. The
  fallback handles reordering correctly by accident of design.
- **Moving an issue to a different subsection** is read correctly and the id is
  preserved, but the underlying history model keys paths by subsection, so the
  log will show it as a retirement in the old place plus an addition in the new
  one. The id survives, so it is traceable; it is a limitation of the existing
  model, not of Word. The page cannot do this at all, so the same "more than the
  UI offers" question applies.

### What the tests show

```
TEST 2  Q1 — adding:
   PASS  new issue typed into the slot is an addition
   PASS  two new issues in one slot both seen
   PASS  new subsection captured with its name
   PASS  new signpost split into baseline/upside/downside
   PASS  additions did not disturb existing items
TEST 3  Q2 — deleting:
   PASS  emptied signpost reads as a retirement
   PASS  tracked-changes deletion also reads as a retirement
   PASS  a box deleted outright is flagged as possibly accidental
   PASS  losing only the title is a question, not a deletion
TEST 4  Q3 — reprioritising:
   PASS  swapped issues report an order change, ids intact
   PASS  a reorder is not mistaken for an edit
   PASS  issue dragged to another subsection is reported as moved
   PASS  driver group order ignored (page cannot reorder groups)
```

All seven economies round-trip with **zero spurious changes** — no phantom
additions from unused slots, no phantom retirements, no edits reported on text
nobody touched. That last property is what makes the review screen usable: if a
clean round-trip produced even a handful of false diffs, nobody would trust the
real ones.

---

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

## 8. How it fits the existing tool

The integration surface is small, which is the main argument for doing it this
way:

- **Export.** One new button beside *Export snapshot*. Writes
  `<economy>-v<version>.docx` into the folder, or downloads it in the fallback
  browsers.
- **Import.** The existing Import dialog already has a file picker. Add `.docx`
  to its `accept`, and branch on the extension: `.yaml` → today's path, `.docx` →
  the new reader. Both produce a candidate economy object.
- **Everything after that is unchanged** — `normalise`, id fixing, `tidy`,
  `validate`, `diff`, the review cards, `acquireLock`, the on-disk version check,
  `saveDraft`, and the log entry. Only the log's `source` gains a new value,
  `word-import`, next to the existing `import`.
- Roughly 600–700 lines added to the single HTML file (~30 KB): ZIP codec ~120,
  docx writer ~200, reader ~180, reconciliation ~120.

---

## 9. Build order

0. **Half an hour, before anything else.** Open
   `poc/sample-united-states-v2.docx` in Word and try the four gestures the
   design rests on: edit a bullet; type into an "add here" slot; empty a
   signpost's boxes; drag an issue above its neighbour. Save, re-open it in
   `poc/docx-round-trip.html`, and check the boxes and their tags survived. If
   Word mangles content controls, stop and reconsider — everything above depends
   on it. Worth repeating on Word Online and Word for Mac if the team uses
   them, and on the drag in particular, which is the gesture most likely to
   drop a control.
1. Decide (a) or (b) from §1.
2. Lift the ZIP codec and the docx writer from the prototype into the editor;
   ship **export only**, and let people live with it for a week. A read-only Word
   export is useful on its own and tells you whether Word round-tripping is
   really what anyone wants.
3. Add the Tier A reader, wired into the existing review screen. Ship behind the
   normal Import button.
4. Add Tier B recovery and the typographic noise suppression.
5. Add tracked changes and comments as review annotations.
6. Only if Tier C turns out to happen in practice: write the Ada Reconcile Mode
   prompt.

## 10. Risks worth naming

- **Word is the single point of failure.** Step 0 above.
- **"Save As → .doc"** or "Save As → PDF" by a helpful user produces a file the
  reader cannot use. Detect the extension and say so plainly.
- **Two people editing the same economy in Word** for a week each, then both
  importing. The lock does not span that; the version check catches the second
  one and forces a reload, but the second person's Word work is then stranded.
  This is the strongest argument for keeping Word sessions short and for the
  `meta|economy|version` stamp so the staleness warning is loud.
- **Scope creep in the document.** Once it is a Word file, people will want
  headers, logos, a contents page. That is all fine — it is cosmetic and lives in
  `styles.xml` — but each addition is a thing the reader must ignore rather than
  trip over.
- **Word offering more than the page does.** Reordering scenario categories and
  moving an issue between subsections both work through Word but have no button
  in the editor. Either add the buttons, or have the reader refuse those two
  changes, but do not leave it undecided — a change a researcher can make in
  Word and then cannot make or undo in the page is a support call.
- **Retirement by accident.** Emptying a box is a deliberate gesture but a
  cheap one. The review screen and the log make it recoverable; the "Retire"
  dropdown in §5 is the hardening if it proves necessary.
