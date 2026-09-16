/* ===================== TESTS (v3) ===================== */
const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const rezip = (files) => zipWrite(Object.entries(files).map(([name, text]) => ({ name, text })));
function editXml(xml, fn) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const byTag = (t) => [...doc.getElementsByTagName('w:sdt')].find(s => { const g = s.getElementsByTagName('w:tag')[0]; return g && g.getAttribute('w:val') === t; });
  const inside = (box, t) => [...box.getElementsByTagName('w:sdt')].find(s => { const g = s.getElementsByTagName('w:tag')[0]; return g && g.getAttribute('w:val') === t; });
  const mkP = (style, text) => { const p = doc.createElementNS(WNS, 'w:p'), pPr = doc.createElementNS(WNS, 'w:pPr'), st = doc.createElementNS(WNS, 'w:pStyle');
    st.setAttribute('w:val', style); pPr.appendChild(st); p.appendChild(pPr);
    const r = doc.createElementNS(WNS, 'w:r'), t = doc.createElementNS(WNS, 'w:t'); t.setAttribute('xml:space', 'preserve'); t.textContent = text; r.appendChild(t); p.appendChild(r); return p; };
  const fill = (ctl, lines) => { const ph = ctl.getElementsByTagName('w:showingPlcHdr')[0]; if (ph) ph.remove();
    const c = ctl.getElementsByTagName('w:sdtContent')[0]; while (c.firstChild) c.removeChild(c.firstChild);
    lines.forEach(([style, text]) => c.appendChild(mkP(style, text))); };
  const empty = (ctl) => fill(ctl, [['CITBody', '']]);
  const setText = (el, from, to) => { for (const t of el.getElementsByTagName('w:t')) if (t.textContent === from) { t.textContent = to; return true; } return false; };
  fn(doc, { byTag, inside, mkP, fill, empty, setText });
  return new XMLSerializer().serializeToString(doc);
}
function currentOf(eco) {
  const places = [];
  for (const d of eco.drivers) for (const s of d.subsections)
    places.push({ key: `drivers/${d.id}/${s.id}`, items: s.issues.map(i => ({ id: i.id, title: i.title, text: i.text, baseline: i.baseline || '', upside: i.upside || '', downside: i.downside || '' })) });
  return { places };
}
(async () => {
  const log = []; const say = (s) => log.push(s);
  const check = (n, ok, d) => say('   ' + (ok ? 'PASS' : 'FAIL') + '  ' + n + (ok || !d ? '' : '\n         ' + d));
  try {
    const eco = REAL, cur = currentOf(eco);
    const bytes = await docxWrite(eco);
    const XML = (await zipRead(bytes))['word/document.xml'];
    window.__DOCX = Array.from(bytes);

    /* ---------- clean round-trip, every economy ---------- */
    say('TEST 1  clean round-trip (new one-hierarchy schema):');
    for (const [id, e] of Object.entries(ALL)) {
      const bb = await docxWrite(e), got = await docxRead(bb), c = currentOf(e);
      let n = 0, bad = 0;
      for (const p of got.places) for (const it of p.items) { n++;
        const was = (c.places.find(q => q.key === p.key) || { items: [] }).items.find(x => x.id === it.id);
        if (!was || ['title', 'text', ...CELLS_R].some(k => (was[k] || '') !== (it[k] || ''))) bad++; }
      const rec = reconcile(got, c);
      const noise = rec.added.length + rec.edited.length + rec.retired.length + rec.reordered.length + rec.moved.length + rec.problems.length + rec.signpostsCleared.length;
      check(`${id.padEnd(15)} ${String(n).padStart(3)} issues  ${bad ? bad + ' mismatch' : 'identical'}, ${noise ? noise + ' spurious' : 'zero spurious changes'}`, !bad && !noise);
    }
    const clean = docxParse(XML);
    check('meta stamp read back', clean.meta && clean.meta.economy === eco.id && clean.meta.version === eco.version);
    check('issues with no signposts stay empty (hints are not content)',
      clean.places.flatMap(p => p.items).filter(i => CELLS_R.some(k => /Leave all three empty|what would make it/.test(i[k] || ''))).length === 0);
    check('issues that have signposts keep all three cells',
      clean.places.flatMap(p => p.items).filter(i => CELLS_R.some(k => (i[k] || '').trim())).every(i => CELLS_R.every(k => (i[k] || '').trim())));

    /* ---------- Q1 ADD ---------- */
    const added = editXml(XML, (d, h) => {
      const sub = h.byTag('sub|drivers/regime/trend-growth');
      h.fill(h.inside(sub, 'slot|issue'), [
        ['CITIssueTitle', 'Demographics are now a drag on potential'],
        ['CITBullet', 'Net migration has turned negative for the first time since 2020'],
        ['CITBody', 'Baseline: working-age population flat through 2027'],
        ['CITBody', 'Upside: participation recovers among over-55s'],
        ['CITBody', 'Downside: enforcement tightens further and the labour force shrinks']]);
      h.fill(h.byTag('slot|sub|regime'), [['CITH3', 'Technology diffusion'],
        ['CITIssueTitle', 'Adoption is lagging installation'], ['CITBullet', 'Measured productivity has not moved despite the capex']]);
      // add signposts to an existing issue that had none, by typing into its hint cells
      const box = h.byTag('issue|iss-us-tg2');
      h.fill(h.inside(box, 'field|baseline'), [['CITBullet', 'Payrolls average 75k, unemployment drifts to 4.3%']]);
      h.fill(h.inside(box, 'field|upside'), [['CITBullet', 'Participation recovers and break-even payrolls rise']]);
      h.fill(h.inside(box, 'field|downside'), [['CITBullet', 'Hours fall first; unemployment jumps past 5%']]);
    });
    const rAdd = reconcile(docxParse(added), cur);
    say('TEST 2  Q1 — adding:');
    check('new issue typed into the slot is an addition', rAdd.added.some(a => a.title === 'Demographics are now a drag on potential' && a.place === 'drivers/regime/trend-growth'));
    check('its signposts were parsed from the Baseline:/Upside:/Downside: lines', (() => { const a = rAdd.added.find(x => x.title.startsWith('Demographics')); return a && /working-age population flat/.test(a.item.baseline) && /enforcement tightens/.test(a.item.downside); })());
    check('new subsection captured with its first issue', rAdd.newSubs.length === 1 && rAdd.newSubs[0].name === 'Technology diffusion' && rAdd.newSubs[0].items[0].title === 'Adoption is lagging installation');
    check('signposts added to an existing issue read as an edit, not an addition', rAdd.edited.some(e => e.id === 'iss-us-tg2' && e.fields.join() === 'baseline,upside,downside'));
    check('no spurious retirements or problems', rAdd.retired.length === 0 && rAdd.problems.length === 0, JSON.stringify(rAdd.problems));

    /* ---------- Q2 DELETE ---------- */
    const withSp = eco.drivers.flatMap(d => d.subsections.flatMap(s => s.issues)).find(i => (i.baseline || '').trim());
    const deleted = editXml(XML, (d, h) => {
      // (a) retire a whole issue: empty every box in it
      const box = h.byTag('issue|iss-us-ti1');
      for (const f of ['title', 'text', 'baseline', 'upside', 'downside']) h.empty(h.inside(box, 'field|' + f));
      // (b) drop only the signposts, keep the issue
      const keep = h.byTag('issue|' + withSp.id);
      for (const f of CELLS_R) h.empty(h.inside(keep, 'field|' + f));
      // (c) clear just one cell of three -> would break validate() on import
      const partial = h.byTag('issue|iss-us-mo1');
      h.empty(h.inside(partial, 'field|upside'));
      // (d) an issue whose whole box was deleted
      const gone = h.byTag('issue|iss-us-fi1'); gone.parentNode.removeChild(gone);
    });
    const rDel = reconcile(docxParse(deleted), cur);
    say('TEST 3  Q2 — deleting:');
    check('emptying every box retires the issue', rDel.retired.some(x => x.id === 'iss-us-ti1' && x.how === 'box emptied'));
    check('clearing only the three cells keeps the issue', rDel.signpostsCleared.some(x => x.id === withSp.id) && !rDel.retired.some(x => x.id === withSp.id));
    check('half-cleared signposts are caught before validate() can refuse the import', rDel.problems.some(p => p.id === 'iss-us-mo1' && /half filled/.test(p.why)), JSON.stringify(rDel.problems));
    check('a box deleted outright is flagged as possibly accidental', rDel.retired.some(x => x.id === 'iss-us-fi1' && /accidental/.test(x.how)));
    check('nothing else disturbed', rDel.added.length === 0);

    /* ---------- Q3 REORDER ---------- */
    const place = 'drivers/regime/trend-growth';
    const reordered = editXml(XML, (d, h) => {
      const a = h.byTag('issue|iss-us-tg1'), b = h.byTag('issue|iss-us-tg2');
      b.parentNode.insertBefore(b, a);
      const mv = h.byTag('issue|iss-us-ti1');
      h.byTag('sub|drivers/policy/monetary').getElementsByTagName('w:sdtContent')[0].appendChild(mv);
      const subs = [...d.getElementsByTagName('w:sdt')].filter(s => { const g = s.getElementsByTagName('w:tag')[0]; return g && /^sub\|drivers\/imbalances\//.test(g.getAttribute('w:val')); });
      subs[1].parentNode.insertBefore(subs[1], subs[0]);        // reorder subsection tabs
    });
    const pr = docxParse(reordered), rOrd = reconcile(pr, cur);
    say('TEST 4  Q3 — reprioritising:');
    check('swapped issues report an order change, ids intact', rOrd.reordered.length === 2 && rOrd.reordered.every(x => x.place === place));
    check('order comes from document position', (() => { const p = pr.places.find(x => x.key === place); return p.items[0].id === 'iss-us-tg2'; })());
    check('a reorder is not mistaken for an edit', !rOrd.edited.some(e => ['iss-us-tg1', 'iss-us-tg2'].includes(e.id)));
    check('issue dragged to another subsection is reported as moved', rOrd.moved.length === 1 && rOrd.moved[0].to === 'drivers/policy/monetary');
    check('subsection order read from the document', pr.places.findIndex(p => p.key === 'drivers/imbalances/external') < pr.places.findIndex(p => p.key === 'drivers/imbalances/domestic'));
    check('driver group order ignored (the page cannot reorder groups)', !JSON.stringify(rOrd).includes('"group"'));

    /* ---------- Tier B: the control itself destroyed ---------- */
    const mangled = editXml(XML, (d, h) => {
      // (a) inner field controls gone, text left behind (paste-over inside the box)
      const a1 = h.byTag('issue|iss-us-tg1');
      const inner = [...a1.getElementsByTagName('w:sdt')].filter(x => { const g = x.getElementsByTagName('w:tag')[0]; return g && /^field\|(title|text)$/.test(g.getAttribute('w:val')); });
      for (const f of inner) { const frag = d.createDocumentFragment();
        for (const p of [...f.getElementsByTagName('w:sdtContent')[0].childNodes]) frag.appendChild(p.cloneNode(true));
        f.parentNode.replaceChild(frag, f); }
      // (b) the whole issue box unwrapped: paragraphs remain, tag gone
      const a2 = h.byTag('issue|iss-us-tg2');
      const frag2 = d.createDocumentFragment();
      for (const n of [...a2.getElementsByTagName('w:sdtContent')[0].childNodes]) {
        if (n.localName === 'sdt') { for (const p of [...n.getElementsByTagName('w:sdtContent')[0].childNodes]) frag2.appendChild(p.cloneNode(true)); }
        else frag2.appendChild(n.cloneNode(true));
      }
      a2.parentNode.replaceChild(frag2, a2);
    });
    const pm = docxParse(mangled), rM = reconcile(pm, cur);
    say('TEST 5  Tier B — content controls destroyed:');
    check('parser did not crash', true);
    check('box intact but inner controls gone: still read by style anchor', (() => { const i = pm.places.find(p => p.key === place).items.find(x => x.id === 'iss-us-tg1'); return i && /AI capex/.test(i.title) && /data centres/.test(i.text); })());
    check('whole box unwrapped: recovered by title, id restored', rM.recovered.some(x => x.id === 'iss-us-tg2'));
    check('its text came with it', /low-churn/.test((rM.recovered.find(x => x.id === 'iss-us-tg2') || {}).item?.text || ''));
    check('nothing wrongly reported as retired', rM.retired.length === 0, JSON.stringify(rM.retired));
    check('nothing wrongly reported as added', rM.added.length === 0, JSON.stringify(rM.added.map(a => a.title)));

    /* ---------- a stale document: someone else added an issue meanwhile ---------- */
    const laterCur = currentOf(JSON.parse(JSON.stringify(eco)));
    laterCur.places.find(p => p.key === place).items.push({ id: 'iss-us-NEW', title: 'Tariff refunds are a 2027 fiscal cliff', text: '- Added by a colleague while the Word copy was out', baseline: '', upside: '', downside: '' });
    const rStale = reconcile(docxParse(XML), laterCur);
    say('TEST 6  a Word copy that went stale while it was out:');
    check('an issue added on disk since export is NOT retired', !rStale.retired.some(x => x.id === 'iss-us-NEW'));
    check('it is reported as left alone', rStale.untouched.some(x => x.id === 'iss-us-NEW'));
    check('a genuinely deleted box is still retired', (() => {
      const gone = editXml(XML, (d, h) => { const g = h.byTag('issue|iss-us-fi1'); g.parentNode.removeChild(g); });
      return reconcile(docxParse(gone), laterCur).retired.some(x => x.id === 'iss-us-fi1'); })());
    check('manifest read back', docxParse(XML).manifest && docxParse(XML).manifest.includes('iss-us-tg1'));

    /* ---------- editing + tracked changes ---------- */
    const ed = editXml(XML, (d, h) => {
      const box = h.byTag('issue|iss-us-tg2');
      h.setText(box, 'Immigration enforcement has cut labour-force growth to a trickle; payrolls in the 50-150k range are now consistent with a flat unemployment rate (4.1% in August)', 'Immigration enforcement has cut labour-force growth to ZERO');
      const t = [...box.getElementsByTagName('w:t')].find(x => /low-churn/.test(x.textContent));
      const p = t.parentNode.parentNode;
      const mk = (kind, tn, text) => { const e = d.createElementNS(WNS, 'w:' + kind); e.setAttribute('w:id', '900'); e.setAttribute('w:author', 'AC'); e.setAttribute('w:date', '2026-09-15T09:00:00Z');
        const r = d.createElementNS(WNS, 'w:r'), tt = d.createElementNS(WNS, 'w:' + tn); tt.setAttribute('xml:space', 'preserve'); tt.textContent = text; r.appendChild(tt); e.appendChild(r); return e; };
      p.appendChild(mk('ins', 't', ', and long-term unemployment is rising'));
      p.appendChild(mk('del', 'delText', ' DELETE ME'));
    });
    const rEd = reconcile(docxParse(ed), cur);
    say('TEST 7  ordinary editing:');
    check('edit reported on the right issue only', rEd.edited.length === 1 && rEd.edited[0].id === 'iss-us-tg2');
    check('tracked insertion accepted, deletion dropped', (() => { const i = docxParse(ed).places.flatMap(p => p.items).find(x => x.id === 'iss-us-tg2'); return /long-term unemployment is rising/.test(i.text) && !/DELETE ME/.test(i.text); })());

    let refused = 'accepted (BAD)';
    try { await docxRead(await zipWrite([{ name: 'word/other.xml', text: '<a/>' }])); } catch (e) { refused = 'refused — ' + e.message; }
    say('TEST 8  a file that is not a thesis document: ' + refused);
  } catch (e) { say('ERROR ' + (e && e.stack || e)); }
  const txt = log.join('\n');
  const out = document.getElementById('out');
  out.innerHTML = txt.replace(/\bPASS\b/g, '<span class="PASS">PASS</span>').replace(/\bFAIL\b/g, '<span class="FAIL">FAIL</span>');
  window.__RESULT = txt;
})();
