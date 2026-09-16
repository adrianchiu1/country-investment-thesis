# Before building the .docx import: what to test, and why

The export is built and a document has been opened in Word. Everything tested so
far, though, used **synthetic** edits — the XML was manipulated directly to
simulate what Word would do. Word rewrites `document.xml` wholesale when it
saves: it splits runs, adds revision ids and proofing marks, renumbers lists and
applies autocorrect. None of that has been through the reader.

So the remaining tests need real Word-saved files. They take about twenty
minutes of clicking.

## The tool

Open `docs/poc/word-round-trip.html` in Edge or Chrome and drop a `.docx` onto
it. It reports what Word did to the file — how many content controls survived,
whether the tags and named styles are intact, whether the version stamp and
manifest are still there, how many runs Word split the text into — and then shows
what the editor would import from it.

Both prototype pages are generated: `node docs/poc/build.mjs` rebuilds them from
`docs/poc/src/` and the repo's own `data/*.yaml`, using the editor's YAML parser,
so they cannot drift from the thesis they claim to round-trip.

## Where format-compliance actually matters

Worth being clear about the exposure before testing it, because it is narrower
than it feels.

| Operation | Depends on anyone following a format? |
| --- | --- |
| Editing a bullet, bolding, tracked changes, comments | **No.** The content control holds the identity. |
| Dragging a box to reorder | **No.** Order is read from document position. |
| Emptying a box to retire an issue | **No.** |
| Clearing the three cells to drop signposts | **No.** |
| Filling three empty cells to add signposts | **No.** |
| **Typing a new issue into a slot** | **Yes** — first line is the title, the rest are bullets. |
| **Signposts on a new issue** | **Yes** — the `Baseline:` / `Upside:` / `Downside:` line prefixes. |

Only additions depend on a convention, and additions are the rarest operation.

The risk that matters is not a misread — it is a **plausible-looking** misread
that someone clicks Apply on. An addition that arrives as an edit to the issue
above it looks reasonable in a review screen. That is why the tests below care as
much about *what the review screen says* as about whether the parse succeeded.

## The tests

One document, several saved copies. Start from a fresh **Workflow → Get .docx**
each time unless a test says otherwise.

**1. The null test.** Open it, change nothing, save, close. Drop it in.
*Expected: no changes at all.* This is the most valuable thirty seconds in the
list — if Word's own re-save produces spurious diffs, every other result is
noise, and the design needs rethinking before anything is built.

**2. Ordinary editing.** Change a few bullets. Add one. Delete one. Bold a
phrase. Retitle an issue.
*Expected: exactly those changes, on exactly those issues, with ids intact.*

**3. Autocorrect.** Type a bullet containing straight quotes, a `--`, an ellipsis
and a fraction, and let Word "fix" them.
*Expected: no diff noise from typography alone.*

**4. The destructive paste.** Copy a paragraph from another Word document or a
web page and paste it over a bullet with the default paste (Keep Source
Formatting). This is the most likely real-world control-killer.
*Expected: either the control survives, or the issue is recovered by title and
reported — never reported as retired.*

**5. The structural four.** In one document: type a new issue into a slot;
empty another issue's boxes; drag an issue above its neighbour; clear one
issue's three signpost cells.
*Expected: one addition, one retirement, one reorder, one signposts-dropped —
and nothing else.*

**6. The badly-formed addition.** Deliberately get the slot convention wrong:
put bullets before the title, or omit the `Baseline:` prefixes.
*Expected: whatever comes out, the review screen makes it obvious something is
off.* This is the test that decides how much the convention needs defending —
with a clearer hint in the document, a stricter parse, or a warning.

**7. Tracked changes and comments.** Turn on Track Changes, make edits, add a
margin comment, save **without** accepting.
*Expected: insertions read as accepted, deletions dropped, the comment reported
separately and never treated as content.*

**8. Deleting a whole box.** Select an entire issue box, including its frame, and
press Delete. Does Word allow it despite `sdtLocked`?
*Expected: either Word refuses, or the id goes missing and is reported as
"possibly accidental" — never silently.*

**9. The hostile test.** Select all, copy, paste into a blank document, save as
`.docx`.
*Expected: a clean refusal with a reason, not a garbage import.*

**10. Other Words.** If anyone uses Word Online, Word for Mac or LibreOffice,
repeat tests 1 and 5 there. Different save paths, different results.

## What the results decide

- **Test 1 fails** → stop. The anchoring scheme needs rethinking, not the reader.
- **Tests 2, 3, 7 fail** → the reader needs work, but the design holds.
- **Test 4 or 8 fails badly** → strengthen the review screen's retirement card
  before anything else; a wrongly-retired issue is the one failure that destroys
  data.
- **Test 6 is ugly** → defend the convention: a clearer in-document hint, or
  refuse an addition that does not parse cleanly rather than guessing.
- **Test 9 fails** → the refusal path needs tightening; cheap to fix.

## What testing cannot settle

You cannot test your way to knowing how people will behave. What these tests buy
is: the common cases measured against real Word output, the uncommon cases made
loud rather than silent, and a known list of what breaks.

The rest is handled by shipping the import to two or three people first, and by
the fact that nothing is written until someone clicks **Apply import** on a
review screen that lists every change.
