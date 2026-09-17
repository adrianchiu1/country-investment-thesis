# Editing the thesis in Word, and getting it back

**Both halves are built.** `Workflow → Get .docx` exports an economy;
`Workflow → Import .docx` reads an edited document back through the normal
review-and-apply path. This note says how it works and why it is shaped this
way.

## How it got here

The first design wrapped every issue in a Word **content control** carrying its
id in a hidden `w:tag`, locked so it could not be deleted. On paper it was
excellent: identity survived any edit, so the importer could never mis-attribute
a change.

In practice the first person to try it pressed Delete on an issue and Word
refused. The lock was doing exactly what it was told. The design was simply
wrong for humans — it asked people to *empty* a box rather than delete it, which
is not what anyone does.

So the controls are gone. There is no `w:sdt` and no `w:lock` anywhere in the
file. What replaced them is worth stating plainly, because it is a real trade:

| | Content controls | Cards (now) |
| --- | --- | --- |
| Identity | hidden `w:tag` | a visible reference on the card |
| Guarantee | "we can always work out what you meant" | "if we cannot, we refuse and name the card" |
| Failure | a silent mis-import | a message saying which card and why |
| Deleting an issue | Word refuses | delete the card |

Weaker on paper. Better in practice, because a refusal you can act on beats a
guarantee nobody can work with.

## The document

Six pages, each its own Word section: the instructions, then Economic Regime,
Policy, Imbalances, Politics, and the implications matrix.

Page one carries a locked **How to edit this document** panel, a **blank card**
filled with lorem ipsum to copy, and one machine-readable line —
`document: united-states v2` — which is the only thing the importer uses to tell
which economy and version the file came from.

Every issue is a **card**: a table with rows labelled Title, View and Signposts,
and a faint reference at its foot.

```
│ TITLE      │ AI capex is now the growth engine, and the…       │
│ VIEW       │ • Investment in data centres, power and chips…   │
│ SIGNPOSTS  │ BASELINE    │ UPSIDE      │ DOWNSIDE             │
│            │ • Data-cent…│ • Investme… │ • Returns dis…       │
│                                          ref iss-us-tg1       │
```

Tables are the most robust structure Word has, and the most obvious to a person.
Nothing is locked, so every ordinary gesture works:

| To… | Do |
| --- | --- |
| Change the wording | Type in any cell |
| Add an issue | Copy the blank card, paste it under a subsection heading, fill it in. Its reference already says `NEW` |
| Retire an issue | Delete the whole card |
| Reorder | Move the card |
| Add signposts | Fill the three cells |
| Drop signposts | Clear all three |

## Reading it back

The reader walks the document exactly as a person reads it: `CIT Heading 1` says
which group, `CIT Heading 3` says which subsection, each table is a card, and the
faint line at its foot is the reference. Rows are found by their **label**, not
their position, so a card survives a row being moved or an extra one added.

Tracked changes are read as accepted — insertions in, deletions out. Word's
autocorrect (curly quotes, non-breaking spaces, ellipses) is straightened so it
does not show up as diffs nobody made.

The blank card on page one sits before any group heading, so it is ignored. More
than one card there is reported, in case somebody pasted a new issue onto page
one by mistake.

## Validation: the import refuses rather than guesses

Nothing is half-applied. If any of these is true the import stops, lists every
problem with the card named, and changes nothing:

- no cards found, or the `document:` line is missing;
- the document is for a different economy;
- the document was exported from an older version than the thesis now holds —
  importing it would undo whatever was saved in between;
- a card has no reference line;
- a reference is not an issue in this economy;
- **a reference is used by more than one card** — copying an *existing* card is
  the natural way to add one, and it would otherwise overwrite the original;
- a card has no Title row, or an empty title;
- a card is not under a subsection heading the page recognises;
- signposts are filled in one or two cells instead of three.

Everything after that is the machinery that already existed: `tidy`, `validate`,
`diff`, the lock, the review screen, the on-disk conflict check, and one log
entry with `source: word-import`.

## How the candidate is built

Ada hands back a whole economy, so the YAML import can use the file as the new
state. A Word document is a **projection** — it carries no implications matrix
and no group order — so the Word path starts from a clone of what is on disk and
applies only what the document says:

```js
const imp = clone(cur);                    // anything not in the document survives
// each subsection's issues are rebuilt from the cards found under its heading,
// in document order; a card whose reference is NEW gets a freshly minted id
```

An issue whose card was deleted is retired, and the review screen says so by
name before anything is written.

## Tests

`node docs/poc/word-round-trip-tests.mjs` drives the **real editor** in a
headless browser, so the export and import under test are the ones the tool
ships — there is no second copy to drift. Each test edits the exported
`document.xml` the way Word would, re-zips it, and feeds it back.

Twenty-two checks cover: a clean round-trip producing no changes at all; ordinary
editing; deleting a card; copying the blank card to add an issue; copying an
*existing* card by mistake; clearing one signpost cell of three; deleting a
reference line; a document for the wrong economy; a stale document; **Word
rewriting every style id**; and a file that is not a `.docx`.

## One trap worth knowing about

**Word regenerates every style's `w:styleId` from its `w:name`, with the spaces stripped,
each time it saves.** A style named "CIT Heading 1" comes back with the id `CITHeading1`,
whatever id it was written with, and every `pStyle` reference in the document is rewritten
to match.

The first real import hit this. Three ids did not already have that form — `CITH1`,
`CITH3` and `CITBulletSm` — so after one save in Word the reader stopped recognising the
group and subsection headings. Every card then looked as if it sat on the first page, and
the import refused with a message describing the symptom rather than the cause. `CITRef`
happened to already match its name, which is why the `document:` line still read and the
failure looked so strange.

It is guarded two ways now:

- the writer derives each id from the name (`SID(name)`), so the two cannot drift apart
  and Word's rewrite is a no-op;
- the reader resolves ids through `styles.xml` and matches on the **name**, which Word
  preserves, so even a wholesale renaming leaves it working.

`TEST 10` renames every style to `Style20`, `Style21` … and checks the document still
imports with no changes.

## What is still unverified

The tests simulate Word's edits by manipulating the XML. **Word itself rewrites
`document.xml` wholesale when it saves** — splitting runs, adding revision ids
and proofing marks, renumbering lists. The reader walks by element name and
concatenates runs, so it should absorb all of that, but "should" is doing real
work in that sentence.

The one test that settles it takes a minute: export a document, open it in Word,
change nothing, save, and import it. It should report no changes. If Word's own
re-save produces spurious diffs, the reader needs work before anyone relies on
this.

Then the gestures, in one document: edit a bullet, delete a card, copy the blank
card and fill it in, move a card, clear three signpost cells. Import, and check
the review screen says exactly what you did.
