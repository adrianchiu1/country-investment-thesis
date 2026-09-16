/* Word round-trip tests. Runs the real editor in a headless browser, so the export
   and import under test are the ones the tool actually ships — there is no second
   copy to drift.  Run:  node docs/poc/word-round-trip-tests.mjs

   Each test edits the exported document.xml the way Word would, re-zips it, and feeds
   it back through DOCX.read + reviewWordFile.
   Needs playwright and chromium on the machine. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

/* playwright may be installed locally or globally */
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const EDITOR = 'file://' + join(root, 'EDITOR-country-investment-thesis.html');
const ZIP = readFileSync(join(here, 'src', 'zip.js'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto(EDITOR);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { try { endTour(); } catch (e) {} });
  await p.addScriptTag({ content: ZIP });   // standalone zip helpers, for building edited files in the test

  const out = await p.evaluate(async () => {
    const log = [], ok = (n, c, d) => log.push(`   ${c ? 'PASS' : 'FAIL'}  ${n}${c || !d ? '' : '\n         ' + d}`);
    const eco = S.data['united-states'];
    const bytes = await DOCX.write(eco);
    const files = await zipRead(bytes);
    const XML = files['word/document.xml'];
    const rezip = (xml) => zipWrite(Object.entries({ ...files, 'word/document.xml': xml }).map(([name, text]) => ({ name, text })));
    const edit = (fn) => { const d = new DOMParser().parseFromString(XML, 'application/xml'); fn(d, helpers(d)); return new XMLSerializer().serializeToString(d); };
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const helpers = (d) => {
      const txt = (el) => [...el.getElementsByTagName('w:t')].map(t => t.textContent).join('');
      const cards = [...d.getElementsByTagName('w:tbl')].filter(t => /ref\s+\S+\s*$/.test(txt(t)));
      const refOf = (t) => (txt(t).match(/ref\s+(\S+)\s*$/) || [])[1];
      const cardFor = (ref) => cards.find(t => refOf(t) === ref);
      const setText = (el, from, to) => { for (const t of el.getElementsByTagName('w:t')) if (t.textContent.includes(from)) { t.textContent = t.textContent.replace(from, to); return true; } return false; };
      /* the signpost CONTENT cell: the row after the one labelled "Signposts" */
      const signpostCell = (card, which) => {
        const rows = [...card.getElementsByTagName('w:tr')];
        const i = rows.findIndex(tr => { const tcs = [...tr.getElementsByTagName('w:tc')]; return tcs.length && txt(tcs[0]).trim().toLowerCase() === 'signposts'; });
        if (i < 0 || !rows[i + 1]) return null;
        return [...rows[i + 1].getElementsByTagName('w:tc')][['baseline', 'upside', 'downside'].indexOf(which) + 1];
      };
      const emptyCell = (tc) => { for (const pEl of [...tc.getElementsByTagName('w:p')]) pEl.parentNode.removeChild(pEl);
        const np = d.createElementNS(W, 'w:p'); tc.appendChild(np); };
      return { txt, cards, refOf, cardFor, setText, signpostCell, emptyCell, W, d };
    };
    const read = async (xml) => DOCX.read(await rezip(xml));
    const review = (parsed) => reviewWordFile(parsed, S.config.economies.find(e => e.id === 'united-states'), eco);

    // ---- 1. clean round-trip
    const clean = await DOCX.read(bytes);
    log.push('TEST 1  clean round-trip:');
    ok('document reference read', clean.meta && clean.meta.economy === 'united-states' && clean.meta.version === eco.version, JSON.stringify(clean.meta));
    ok('13 issue cards + 1 blank template found', clean.cards.length === 14, 'found ' + clean.cards.length);
    const r1 = review(clean);
    ok('the untouched document validates', !r1.problems, JSON.stringify((r1.problems || []).slice(0, 3)));
    ok('the blank template card is ignored, not imported', !r1.problems && !JSON.stringify(r1.imp).includes('Lorem ipsum'));
    ok('and it produces no changes at all', !r1.problems && (tidy(r1.imp), diff(eco, r1.imp).length === 0),
       r1.problems ? '' : JSON.stringify(diff(eco, r1.imp).slice(0, 3)));

    // ---- 2. ordinary editing
    const edited = edit((d, h) => {
      h.setText(h.cardFor('iss-us-tg2'), 'Immigration enforcement has cut labour-force growth to a trickle', 'Immigration enforcement has cut labour-force growth to ZERO');
      h.setText(h.cardFor('iss-us-ti1'), 'Oil shock on top of tariff pass-through', 'Oil shock, tariffs and the 2027 wage round');
    });
    const r2 = review(await read(edited));
    log.push('TEST 2  ordinary editing:');
    ok('no problems', !r2.problems, JSON.stringify(r2.problems || []));
    const ch2 = r2.problems ? [] : (tidy(r2.imp), diff(eco, r2.imp));
    ok('exactly the two edits, on the right issues', ch2.length === 2 && ch2.every(c => /iss-us-tg2\/text|iss-us-ti1\/title/.test(c.path)), JSON.stringify(ch2.map(c => c.path)));

    // ---- 3. delete a card = retire the issue
    const deleted = edit((d, h) => { const t = h.cardFor('iss-us-do2'); t.parentNode.removeChild(t); });
    const r3 = review(await read(deleted));
    log.push('TEST 3  deleting a card:');
    ok('no problems', !r3.problems, JSON.stringify(r3.problems || []));
    ok('reported as retired, by title', !r3.problems && r3.retired.length === 1 && /margins/i.test(r3.retired[0]), JSON.stringify(r3.retired || []));
    ok('the issue is gone from the candidate', !r3.problems && !JSON.stringify(r3.imp).includes('iss-us-do2'));

    // ---- 4. copy the blank card to add an issue
    const added = edit((d, h) => {
      const tpl = h.cardFor('NEW');
      const copy = tpl.cloneNode(true);
      h.setText(copy, 'Lorem ipsum dolor sit amet, consectetur adipiscing', 'Demographics are now a drag on potential');
      const home = h.cardFor('iss-us-tg2');
      home.parentNode.insertBefore(copy, home.nextSibling);
    });
    const r4 = review(await read(added));
    log.push('TEST 4  copying the blank card to add an issue:');
    ok('no problems', !r4.problems, JSON.stringify(r4.problems || []));
    const newIssue = r4.problems ? null : r4.imp.drivers[0].subsections[0].issues.find(i => i.title === 'Demographics are now a drag on potential');
    ok('the new issue lands in the right subsection', !!newIssue);
    ok('it gets a fresh id, not NEW', !!newIssue && /^iss-/.test(newIssue.id) && newIssue.id !== 'NEW', newIssue && newIssue.id);
    ok('and sits where it was pasted', !!newIssue && r4.imp.drivers[0].subsections[0].issues.indexOf(newIssue) === 2);

    // ---- 5. copying an EXISTING card duplicates its reference
    const dup = edit((d, h) => {
      const src = h.cardFor('iss-us-tg1'), copy = src.cloneNode(true);
      src.parentNode.insertBefore(copy, src.nextSibling);
    });
    const r5 = review(await read(dup));
    log.push('TEST 5  copying an existing card (the likely mistake):');
    ok('refused, naming the duplicate reference', !!r5.problems && r5.problems.some(x => /used by more than one card/.test(x)), JSON.stringify((r5.problems || []).slice(0, 2)));

    // ---- 6. half-filled signposts
    const half = edit((d, h) => {
      h.emptyCell(h.signpostCell(h.cardFor('iss-us-mo1'), 'upside'));
    });
    const r6 = review(await read(half));
    log.push('TEST 6  clearing one signpost cell of three:');
    ok('refused before validate() can reject the whole file', !!r6.problems && r6.problems.some(x => /half filled/.test(x)), JSON.stringify((r6.problems || []).slice(0, 2)));

    // ---- 7. the reference line deleted
    const noref = edit((d, h) => {
      const card = h.cardFor('iss-us-fi1');
      const rows = [...card.getElementsByTagName('w:tr')];
      rows[rows.length - 1].parentNode.removeChild(rows[rows.length - 1]);
    });
    const r7 = review(await read(noref));
    log.push('TEST 7  the reference line deleted:');
    ok('that card is simply not seen, and its issue reads as retired', !r7.problems && (r7.retired || []).length === 1, JSON.stringify(r7.problems || r7.retired));

    // ---- 8. wrong economy / stale version
    const wrong = edit((d, h) => { h.setText(d.documentElement, 'document: united-states v', 'document: japan v'); });
    const r8 = review(await read(wrong));
    const stale = edit((d, h) => { h.setText(d.documentElement, `document: united-states v${S.data['united-states'].version}`, 'document: united-states v99'); });
    const r9 = review(await read(stale));
    log.push('TEST 8  wrong file:');
    ok('a document for another economy is refused', !!r8.problems && r8.problems.some(x => /Japan/.test(x)), JSON.stringify((r8.problems || []).slice(0, 2)));
    ok('a stale document is refused, naming both versions', !!r9.problems && r9.problems.some(x => /v99/.test(x) && /now at v/.test(x)), JSON.stringify((r9.problems || []).slice(0, 2)));

    let notWord = 'accepted (BAD)';
    try { await DOCX.read(new Uint8Array([1, 2, 3, 4])); } catch (e) { notWord = 'refused — ' + e.message; }
    log.push('TEST 9  not a .docx at all: ' + notWord);
    return log.join('\n');
  });
  console.log(out);
  console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nno page errors');
  await b.close(); process.exit(0);
})();
