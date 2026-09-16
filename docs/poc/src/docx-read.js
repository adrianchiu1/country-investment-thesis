/* ===================== docx READ (v3) ===================== */
const kids = (el, ln) => [...el.children].filter(c => c.localName === ln);
const NORM = (s) => s.replace(/ /g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');
function paraText(p) {
  let out = '';
  (function walk(n) {
    for (const c of n.children) {
      if (c.localName === 'del') continue;                 // tracked deletion -> read as accepted
      if (c.localName === 'r') {
        const rPr = kids(c, 'rPr')[0];
        const bold = rPr && kids(rPr, 'b').length && kids(rPr, 'b')[0].getAttribute('w:val') !== '0';
        let t = '';
        for (const x of c.children) { if (x.localName === 't') t += x.textContent; else if (x.localName === 'tab') t += ' '; else if (x.localName === 'br') t += '\n'; }
        out += bold && t.trim() ? '**' + t + '**' : t;
      } else walk(c);                                       // ins, hyperlink, smartTag, inline sdt
    }
  })(p);
  return out;
}
const styleOf = (p) => { const pPr = kids(p, 'pPr')[0]; const s = pPr && kids(pPr, 'pStyle')[0]; return s ? s.getAttribute('w:val') : 'Normal'; };
function paraLevel(p) {
  const st = styleOf(p); if (st === 'CITBullet2') return 1; if (st === 'CITBullet') return 0;
  const pPr = kids(p, 'pPr')[0], numPr = pPr && kids(pPr, 'numPr')[0];
  const il = numPr && kids(numPr, 'ilvl')[0];
  return il ? Math.min(+il.getAttribute('w:val'), 1) : -1;
}
function paras(node) { const out = []; (function w(n) { for (const c of n.children) { if (c.localName === 'p') out.push(c); else w(c); } })(node); return out; }
function blockText(node) {
  const lines = [];
  for (const p of paras(node)) {
    const t = NORM(paraText(p)).trimEnd(); if (!t.trim()) continue;
    lines.push((paraLevel(p) > 0 ? '  - ' : '- ') + t.replace(/^\s*[•○▪ o·]\s+/, '').replace(/^-\s+/, ''));
  }
  return lines.join('\n');
}
const tagOf = (s) => { const pr = kids(s, 'sdtPr')[0], t = pr && kids(pr, 'tag')[0]; return t ? t.getAttribute('w:val') : null; };
const isPlaceholder = (s) => { const pr = kids(s, 'sdtPr')[0]; return !!(pr && kids(pr, 'showingPlcHdr').length); };
const contentOf = (s) => kids(s, 'sdtContent')[0];
const CELLS_R = ['baseline', 'upside', 'downside'];

function readItem(box, id) {
  /* Collect the field controls, and separately every paragraph that is NOT inside one:
     those are the remains of a control a paste destroyed, and each field falls back to
     them independently — a box can lose one control and keep the others. */
  const fields = {}, loose = [];
  (function walk(n) { for (const c of n.children) {
    if (c.localName === 'sdt') { const t = tagOf(c); if (t && t.startsWith('field|')) { fields[t.split('|')[1]] = c; continue; } walk(contentOf(c) || c); }
    else if (c.localName === 'p') loose.push(c);
    else walk(c); } })(contentOf(box));
  const body = loose.filter(p => !['CITTableHead', 'CITPlaceholder'].includes(styleOf(p)));
  const ti = body.findIndex(p => styleOf(p) === 'CITIssueTitle');
  const rec = { id, controlsIntact: !!(fields.title && fields.text) };
  rec.title = fields.title ? NORM(paras(fields.title).map(paraText).join(' ')).trim()
            : ti >= 0 ? NORM(paraText(body[ti])).trim() : '';
  rec.text = fields.text ? blockText(fields.text)
           : body.slice(ti + 1).map(p => (paraLevel(p) > 0 ? '  - ' : '- ') + NORM(paraText(p)).trim()).filter(l => l.length > 2).join('\n');
  /* an untouched cell still shows its italic hint: that is "no signpost", not content */
  for (const k of CELLS_R) rec[k] = fields[k] && !isPlaceholder(fields[k]) ? blockText(fields[k]) : '';
  rec.cellsUnreadable = CELLS_R.some(k => !fields[k]);
  const filled = CELLS_R.filter(k => (rec[k] || '').trim());
  rec.retired = !rec.title.trim() && !rec.text.trim() && !filled.length;
  rec.titleMissing = !rec.title.trim() && !rec.retired;
  /* main's validate() refuses the WHOLE import if one cell of three is blank, so catch it here */
  rec.partialSignpost = filled.length > 0 && filled.length < 3 ? CELLS_R.filter(k => !(rec[k] || '').trim()) : null;
  return rec;
}
/* free text a human typed into a slot */
function readTyped(node) {
  const out = []; let cur = null;
  for (const p of paras(node)) {
    const st = styleOf(p), raw = NORM(paraText(p)).trim();
    if (!raw || st === 'CITPlaceholder') continue;
    const m = raw.match(/^(baseline|upside|downside)\s*[:–-]\s*(.+)$/i);
    if (m && cur) { cur[m[1].toLowerCase()] = '- ' + m[2].trim(); continue; }
    if (st === 'CITIssueTitle' || !cur) { cur = { id: null, title: raw.replace(/^[-•]\s*/, ''), lines: [], baseline: '', upside: '', downside: '' }; out.push(cur); continue; }
    cur.lines.push((paraLevel(p) > 0 ? '  - ' : '- ') + raw.replace(/^\s*[•○▪ o·]\s+/, '').replace(/^-\s+/, ''));
  }
  return out.map(o => {
    const rec = { id: null, title: o.title, text: o.lines.join('\n'), baseline: o.baseline, upside: o.upside, downside: o.downside, isNew: true };
    const filled = CELLS_R.filter(k => rec[k].trim());
    rec.partialSignpost = filled.length > 0 && filled.length < 3 ? CELLS_R.filter(k => !rec[k].trim()) : null;
    return rec;
  });
}
function docxParse(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('document.xml is not well-formed');
  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('no w:body');
  const res = { meta: null, manifest: null, places: [], newSubs: [], orphans: [] };
  let place = null, orphan = null;
  (function walk(node) {
    for (const c of node.children) {
      if (c.localName !== 'sdt') {
        /* A paragraph sitting directly in a subsection means its issue box was
           destroyed (pasted over). Rebuild the item from the style anchor so it is
           never silently lost — being lost would read as a retirement. */
        if (place && c.localName === 'p') {
          const st = styleOf(c), t = NORM(paraText(c)).trim();
          if (st === 'CITIssueTitle') { orphan = { id: null, isOrphan: true, title: t, lines: [] }; place.items.push(orphan); }
          else if (orphan && t && !['CITH1', 'CITH3', 'CITTableHead', 'CITPlaceholder'].includes(st)) {
            orphan.lines.push((paraLevel(c) > 0 ? '  - ' : '- ') + t.replace(/^\s*[\u2022\u25cb\u25aa o·]\s+/, '').replace(/^-\s+/, ''));
          }
          continue;
        }
        walk(c); continue;
      }
      const tag = tagOf(c), content = contentOf(c);
      if (!tag || !content) { walk(content || c); continue; }
      const [kind, a, bb] = tag.split('|');
      if (kind === 'meta') { res.meta = { economy: a, version: Number(bb) }; continue; }
      if (kind === 'manifest') { res.manifest = NORM(paras(content).map(paraText).join(' ')).trim().split(/\s+/).filter(Boolean); continue; }
      if (kind === 'group' || kind === 'matrix' || kind === 'readme') continue;   // fixed / read-only by design
      if (kind === 'sub') {
        place = { key: a, name: '', items: [] }; res.places.push(place);
        const h = paras(content).find(p => /^CITH[23]$/.test(styleOf(p)));
        place.name = h ? NORM(paraText(h)).trim() : '';
        walk(content); orphan = null; place = null; continue;
      }
      if (kind === 'issue') { orphan = null; const rec = readItem(c, a); rec.order = place ? place.items.length + 1 : null; (place ? place.items : res.orphans).push(rec); continue; }
      if (kind === 'slot') {
        orphan = null;
        if (isPlaceholder(c)) continue;                      // untouched: never a phantom addition
        if (a === 'issue') { for (const it of readTyped(content)) { it.order = place ? place.items.length + 1 : null; (place ? place.items : res.orphans).push(it); } }
        else if (a === 'sub') { const ps = paras(content).filter(p => NORM(paraText(p)).trim() && styleOf(p) !== 'CITPlaceholder');
          if (ps.length) { const holder = document.createElement('div'); for (const p of ps.slice(1)) holder.appendChild(p.cloneNode(true));
            res.newSubs.push({ group: bb, name: NORM(paraText(ps[0])).trim(), items: readTyped(holder) }); } }
        continue;
      }
      walk(content);
    }
  })(body);
  for (const p of res.places) for (const it of p.items) if (it.isOrphan) {
    it.text = it.lines.join('\n'); delete it.lines;
    for (const k of CELLS_R) it[k] = '';
    it.cellsUnreadable = true; it.retired = false; it.titleMissing = false; it.partialSignpost = null;
  }
  return res;
}
async function docxRead(bytes) {
  const files = await zipRead(bytes);
  if (!files['word/document.xml']) throw new Error('not a Word document (no word/document.xml)');
  return docxParse(files['word/document.xml']);
}
/* ===== reconcile against what is on disk: what the review screen would show ===== */
function reconcile(parsed, cur) {
  const r = { added: [], recovered: [], untouched: [], edited: [], retired: [], signpostsCleared: [], reordered: [], moved: [], problems: [], newSubs: parsed.newSubs };
  const where = {}, byId = {};
  for (const p of cur.places) p.items.forEach((i, n) => { where[i.id] = p.key; byId[i.id] = { ...i, order: n + 1 }; });
  const seen = new Set();
  for (const p of parsed.places) p.items.forEach((it, n) => {
    const order = n + 1;
    if (it.partialSignpost) r.problems.push({ place: p.key, id: it.id, title: it.title, why: `signposts are half filled — ${it.partialSignpost.join(' and ')} empty. Fill them in, or clear all three to drop the signposts.` });
    if (it.titleMissing) { r.problems.push({ place: p.key, id: it.id, why: 'lost its title but still has content — restore the title, or clear the whole box to retire the issue' }); seen.add(it.id); return; }
    if (it.isOrphan) {
      const match = cur.places.find(q => q.key === p.key)?.items.find(x => x.title.trim() === it.title.trim() && !seen.has(x.id));
      if (match) { seen.add(match.id); it.id = match.id; r.recovered.push({ id: match.id, place: p.key, title: it.title, order, item: it, how: 'control destroyed; matched by title' });
        if (match.order !== order) r.reordered.push({ id: match.id, place: p.key, from: match.order, to: order, title: it.title });
        return; }
      r.added.push({ place: p.key, title: it.title, order, item: it, note: 'no control and no title match' }); return;
    }
    if (it.isNew) { r.added.push({ place: p.key, title: it.title, order, item: it }); return; }
    seen.add(it.id);
    const was = byId[it.id];
    if (!was) { r.added.push({ place: p.key, title: it.title, order, item: it, note: 'id not on file' }); return; }
    if (where[it.id] !== p.key) r.moved.push({ id: it.id, from: where[it.id], to: p.key, title: it.title });
    else if (was.order !== order) r.reordered.push({ id: it.id, place: p.key, from: was.order, to: order, title: it.title });
    if (it.retired) { r.retired.push({ id: it.id, place: p.key, title: was.title, how: 'box emptied' }); return; }
    const hadCells = CELLS_R.some(k => (was[k] || '').trim()), hasCells = CELLS_R.some(k => (it[k] || '').trim());
    if (hadCells && !hasCells && !it.cellsUnreadable) r.signpostsCleared.push({ id: it.id, place: p.key, title: it.title });
    const fields = ['title', 'text', ...CELLS_R].filter(k => NORM(String(was[k] ?? '')) !== NORM(String(it[k] ?? '')));
    if (fields.length && !(hadCells && !hasCells && fields.every(f => CELLS_R.includes(f)))) r.edited.push({ id: it.id, place: p.key, title: it.title, fields });
  });
  for (const id of Object.keys(byId)) {
    if (seen.has(id)) continue;
    /* absent from the document. If the manifest says it was not in the file when it was
       exported, someone added it on disk since: leave it alone rather than deleting it. */
    if (parsed.manifest && !parsed.manifest.includes(id)) { r.untouched.push({ id, place: where[id], title: byId[id].title, why: 'added since this document was exported; kept as it is on disk' }); continue; }
    r.retired.push({ id, place: where[id], title: byId[id].title, how: 'box missing from the document — may be accidental' });
  }
  return r;
}
