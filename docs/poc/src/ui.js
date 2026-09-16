/* ===================== live demo ===================== */
const $ = (id) => document.getElementById(id);
const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HINTS = { baseline: 'Baseline — what we expect. Leave all three empty if this issue has no signposts.',
                upside: 'Upside — what would make it better.', downside: 'Downside — what would make it worse.' };
const SLOT_TEXT = 'Click here and type a new issue: its title on the first line, then one bullet per line. To give it signposts, add lines beginning Baseline:, Upside: and Downside:.';

const S = { doc: null, parts: null, cur: null, stale: false, busy: false };

function currentOf(eco) {
  const places = [];
  for (const d of eco.drivers) for (const s of d.subsections)
    places.push({ key: `drivers/${d.id}/${s.id}`, name: s.name, items: s.issues.map(i => ({
      id: i.id, title: i.title, text: i.text, baseline: i.baseline || '', upside: i.upside || '', downside: i.downside || '' })) });
  return { places };
}
const COLLEAGUE = { id: 'iss-us-new9', title: 'Tariff refunds are a 2027 fiscal cliff',
  text: '- Added by a colleague in the page while your Word copy was out', baseline: '', upside: '', downside: '' };

async function boot() {
  const bytes = await docxWrite(ECO);
  const files = await zipRead(bytes);
  S.parts = files;
  S.doc = new DOMParser().parseFromString(files['word/document.xml'], 'application/xml');
  S.cur = currentOf(ECO);
  S.stale = false;
  renderDoc();
  await refresh();
}

/* ---------- writing back into the XML ---------- */
function mkPara(style, text, bullet) {
  const p = S.doc.createElementNS(WNS, 'w:p'), pPr = S.doc.createElementNS(WNS, 'w:pPr'), st = S.doc.createElementNS(WNS, 'w:pStyle');
  st.setAttribute('w:val', style); pPr.appendChild(st);
  if (bullet) { const n = S.doc.createElementNS(WNS, 'w:numPr'), il = S.doc.createElementNS(WNS, 'w:ilvl'), nid = S.doc.createElementNS(WNS, 'w:numId');
    il.setAttribute('w:val', '0'); nid.setAttribute('w:val', '1'); n.appendChild(il); n.appendChild(nid); pPr.appendChild(n); }
  p.appendChild(pPr);
  if (text) { const r = S.doc.createElementNS(WNS, 'w:r'), t = S.doc.createElementNS(WNS, 'w:t');
    t.setAttribute('xml:space', 'preserve'); t.textContent = text; r.appendChild(t); p.appendChild(r); }
  return p;
}
function setField(sdt, lines, kind) {
  const ph = sdt.getElementsByTagName('w:showingPlcHdr')[0]; if (ph) ph.remove();
  const c = sdt.getElementsByTagName('w:sdtContent')[0];
  while (c.firstChild) c.removeChild(c.firstChild);
  const keep = lines.filter(l => l.trim());
  if (!keep.length) { c.appendChild(mkPara(kind === 'title' ? 'CITIssueTitle' : 'CITBullet', '', false)); return; }
  if (kind === 'title') c.appendChild(mkPara('CITIssueTitle', keep.join(' '), false));
  else for (const l of keep) c.appendChild(mkPara('CITBullet', l, true));
}
function makePlaceholder(sdt, hint) {
  const pr = sdt.getElementsByTagName('w:sdtPr')[0];
  if (!sdt.getElementsByTagName('w:showingPlcHdr')[0]) pr.appendChild(S.doc.createElementNS(WNS, 'w:showingPlcHdr'));
  const c = sdt.getElementsByTagName('w:sdtContent')[0];
  while (c.firstChild) c.removeChild(c.firstChild);
  c.appendChild(mkPara('CITPlaceholder', hint, false));
}
const tagIs = (el, t) => { const g = el.getElementsByTagName('w:tag')[0]; return g && g.getAttribute('w:val') === t; };
const fieldOf = (box, k) => [...box.getElementsByTagName('w:sdt')].find(x => tagIs(x, 'field|' + k));
const boxOf = (id) => [...S.doc.getElementsByTagName('w:sdt')].find(x => tagIs(x, 'issue|' + id));

/* ---------- rendering the document pane ---------- */
function renderDoc() {
  const host = $('doc'); host.innerHTML = '';
  const body = S.doc.getElementsByTagName('w:body')[0];
  let place = null;
  (function walk(node, into) {
    for (const c of node.children) {
      if (c.localName !== 'sdt') {
        if (place && c.localName === 'p' && styleOf(c) === 'CITIssueTitle') {
          const d = document.createElement('div'); d.className = 'ctl broken';
          d.innerHTML = '<div class="tab"><span>control destroyed — rebuilt by style + title</span></div>'
            + '<div class="fld f-title">' + esc(NORM(paraText(c)).trim()) + '</div>';
          into.appendChild(d);
        }
        continue;
      }
      const tag = tagOf(c), content = contentOf(c); if (!tag || !content) continue;
      const [kind, a, bb] = tag.split('|');
      if (kind === 'meta') { const p = document.createElement('p'); p.className = 'docmeta'; p.textContent = NORM(paras(content).map(paraText).join(' ')); into.appendChild(p); continue; }
      if (kind === 'manifest' || kind === 'matrix') continue;
      if (kind === 'group') { const h = document.createElement('h3'); h.textContent = NORM(paras(content).map(paraText).join(' ')); into.appendChild(h); continue; }
      if (kind === 'sub') {
        const h = document.createElement('h4');
        const hp = paras(content).find(p => styleOf(p) === 'CITH3');
        h.textContent = hp ? NORM(paraText(hp)).trim() : a; into.appendChild(h);
        place = a; walk(content, into); place = null; continue;
      }
      if (kind === 'issue') { into.appendChild(issueEl(c, a)); continue; }
      if (kind === 'slot' && a === 'issue') { into.appendChild(slotEl(c)); continue; }
      if (kind === 'slot') continue;
      walk(content, into);
    }
  })(body, host);
}
function fieldEl(box, k, cls) {
  const sdt = fieldOf(box, k);
  const el = document.createElement('div');
  el.className = cls; el.contentEditable = 'true'; el.dataset.k = k; el._sdt = sdt;
  if (!sdt) { el.contentEditable = 'false'; el.innerHTML = '<span class="hint">(control gone)</span>'; return el; }
  const empty = isPlaceholder(sdt);
  if (empty) { el.dataset.empty = '1'; el.innerHTML = '<span class="hint">' + esc(HINTS[k] || '') + '</span>'; }
  else if (k === 'title') el.textContent = NORM(paras(sdt).map(paraText).join(' ')).trim();
  else {
    const lines = blockText(sdt).split('\n').filter(Boolean).map(l => l.replace(/^\s*-\s+/, ''));
    el.innerHTML = lines.length ? lines.map(l => '<div>' + esc(l) + '</div>').join('') : '<div></div>';
  }
  wire(el, k);
  return el;
}
function issueEl(box, id) {
  const d = document.createElement('div'); d.className = 'ctl'; d.dataset.id = id;
  const tab = document.createElement('div'); tab.className = 'tab';
  tab.innerHTML = '<span>issue | ' + esc(id) + '</span>';
  const acts = document.createElement('div'); acts.className = 'acts';
  const mk = (label, fn, title) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.onclick = fn; acts.appendChild(b); };
  mk('↑', () => { const prev = box.previousElementSibling; if (prev && tagOf(prev) && tagOf(prev).startsWith('issue|')) { box.parentNode.insertBefore(box, prev); renderDoc(); refresh(); } }, 'Move up');
  mk('↓', () => { const next = box.nextElementSibling; if (next && tagOf(next) && tagOf(next).startsWith('issue|')) { box.parentNode.insertBefore(next, box); renderDoc(); refresh(); } }, 'Move down');
  mk('Empty', () => { for (const k of ['title', 'text', 'baseline', 'upside', 'downside']) { const f = fieldOf(box, k); if (f) setField(f, [], k); } renderDoc(); refresh(); }, 'Clear every box — this is how an issue is retired');
  tab.appendChild(acts); d.appendChild(tab);
  d.appendChild(fieldEl(box, 'title', 'fld f-title'));
  d.appendChild(fieldEl(box, 'text', 'fld f-text'));
  const tbl = document.createElement('table'); tbl.className = 'cells';
  tbl.innerHTML = '<thead><tr><th>Baseline</th><th>Upside</th><th>Downside</th></tr></thead>';
  const tr = document.createElement('tr');
  for (const k of ['baseline', 'upside', 'downside']) { const td = document.createElement('td'); td.appendChild(fieldEl(box, k, 'cell')); tr.appendChild(td); }
  const tb = document.createElement('tbody'); tb.appendChild(tr); tbl.appendChild(tb); d.appendChild(tbl);
  return d;
}
function slotEl(sdt) {
  const el = document.createElement('div'); el.className = 'slot'; el.contentEditable = 'true'; el._sdt = sdt; el.dataset.k = 'slot';
  if (isPlaceholder(sdt)) { el.dataset.empty = '1'; el.textContent = SLOT_TEXT; }
  else { const ls = paras(contentOf(sdt)).map(p => NORM(paraText(p)).trim()).filter(Boolean);
    el.innerHTML = ls.length ? ls.map(l => '<div>' + esc(l) + '</div>').join('') : '<div></div>'; }
  wire(el, 'slot');
  return el;
}
let timer = null;
function wire(el, k) {
  el.addEventListener('focus', () => { if (el.dataset.empty) { el.textContent = ''; delete el.dataset.empty; } });
  el.addEventListener('blur', () => {
    if (el.innerText.trim()) return;
    if (k === 'slot') { makePlaceholder(el._sdt, SLOT_TEXT); el.dataset.empty = '1'; el.textContent = SLOT_TEXT; }
    else if (HINTS[k]) { makePlaceholder(el._sdt, HINTS[k]); el.dataset.empty = '1'; el.innerHTML = '<span class="hint">' + esc(HINTS[k]) + '</span>'; }
    refresh();
  });
  el.addEventListener('input', () => {
    const lines = el.innerText.split('\n').map(s => s.trim());
    if (k === 'slot') { const c = el._sdt.getElementsByTagName('w:sdtContent')[0];
      const ph = el._sdt.getElementsByTagName('w:showingPlcHdr')[0]; if (ph) ph.remove();
      while (c.firstChild) c.removeChild(c.firstChild);
      lines.filter(Boolean).forEach((l, i) => c.appendChild(mkPara(i === 0 ? 'CITIssueTitle' : 'CITBody', l, false)));
    } else setField(el._sdt, lines, k);
    clearTimeout(timer); timer = setTimeout(refresh, 260);
  });
}

/* ---------- round-trip + verdict ---------- */
async function refresh() {
  if (S.busy) return; S.busy = true;
  try {
    const xml = new XMLSerializer().serializeToString(S.doc);
    const t0 = performance.now();
    const bytes = await zipWrite(Object.entries({ ...S.parts, 'word/document.xml': xml }).map(([name, text]) => ({ name, text })));
    const t1 = performance.now();
    const parsed = await docxRead(bytes);
    const t2 = performance.now();
    const cur = currentOf(ECO);
    if (S.stale) cur.places.find(p => p.key === 'drivers/policy/fiscal').items.push({ ...COLLEAGUE });
    S.cur = cur;
    const rec = reconcile(parsed, cur);
    const n = parsed.places.reduce((a, p) => a + p.items.length, 0);
    const controls = (xml.match(/<w:sdt>/g) || []).length;
    const total = rec.added.length + rec.edited.length + rec.retired.length + rec.signpostsCleared.length
      + rec.reordered.length + rec.moved.length + rec.recovered.length + rec.newSubs.length;
    $('tele').innerHTML = [
      ['Word file', (bytes.length / 1024).toFixed(1) + ' KB'],
      ['Written in', Math.max(1, Math.round(t1 - t0)) + ' ms'],
      ['Read back in', Math.max(1, Math.round(t2 - t1)) + ' ms'],
      ['Content controls', controls],
      ['Issues read', n],
      ['Round trip', total || rec.problems.length ? '<span class="pill dirty">' + (total + rec.problems.length) + ' change' + (total + rec.problems.length === 1 ? '' : 's') + '</span>' : '<span class="pill ok">identical</span>'],
    ].map(([k, v]) => '<div><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('');
    $('telenote').innerHTML = 'Zipped with the browser\'s native <code class="tag">CompressionStream</code>'
      + (typeof CompressionStream === 'function' ? '' : ' — unavailable here, so the file is stored uncompressed')
      + ', unzipped with <code class="tag">DecompressionStream</code>, CRC checked on every part.';
    renderVerdict(rec, total);
  } catch (e) {
    $('verdict').innerHTML = '<div class="empty">The document could not be read: ' + esc(e.message || e) + '</div>';
  } finally { S.busy = false; }
}
function renderVerdict(r, total) {
  const out = [];
  const grp = (label, rows) => { if (!rows.length) return; out.push('<div class="grp">' + label + '</div>'); out.push(rows.join('')); };
  const row = (chip, cls, title, detail) => '<div class="row"><span class="chip ' + cls + '">' + chip + '</span><div class="rt"><b>' + esc(title) + '</b>'
    + (detail ? '<em>' + detail + '</em>' : '') + '</div></div>';
  grp('Needs an answer before anything is written', r.problems.map(p => row('ask', 'c-ask', p.title || p.id, esc(p.why))));
  grp('Retired', r.retired.map(x => row('retire', 'c-ret', x.title, esc(x.how))));
  grp('Added', r.added.map(x => row('add', 'c-add', x.title || '(untitled)', 'in ' + esc(x.place.split('/').slice(1).join(' › ')) + (x.note ? ' — ' + esc(x.note) : ''))));
  grp('New subsections', r.newSubs.map(x => row('add', 'c-add', x.name, 'under ' + esc(x.group) + ', with ' + x.items.length + ' issue' + (x.items.length === 1 ? '' : 's'))));
  grp('Edited', r.edited.map(x => row('edit', 'c-edit', x.title, 'changed: ' + x.fields.join(', '))));
  grp('Signposts dropped', r.signpostsCleared.map(x => row('cells', 'c-edit', x.title, 'the issue stays; its three cells are cleared')));
  grp('Reordered', r.reordered.map(x => row('order', 'c-move', x.title, 'position ' + x.from + ' → ' + x.to)));
  grp('Moved', r.moved.map(x => row('moved', 'c-move', x.title, esc(x.from.split('/').slice(1).join(' › ')) + ' → ' + esc(x.to.split('/').slice(1).join(' › ')))));
  grp('Recovered', r.recovered.map(x => row('fixed', 'c-edit', x.title, esc(x.how))));
  grp('Left alone', r.untouched.map(x => row('kept', 'c-edit', x.title, esc(x.why))));
  $('verdict').innerHTML = out.length ? out.join('')
    : '<div class="empty"><b>No changes.</b><br>A clean round-trip of all ' + S.cur.places.reduce((a, p) => a + p.items.length, 0)
      + ' issues produces nothing at all — no phantom additions from the unused slots or signpost cells, no phantom retirements, no edits on text nobody touched. That is the property that makes the review screen worth trusting.</div>';
  const blocked = r.problems.length > 0;
  $('applybtn').disabled = blocked || !total;
  $('applywhy').textContent = blocked ? 'Resolve the question' + (r.problems.length === 1 ? '' : 's') + ' above first'
    : total ? total + ' change' + (total === 1 ? '' : 's') + ' ready' : 'Nothing to import';
  $('vsub').textContent = blocked ? 'Blocked — ' + r.problems.length + ' question' + (r.problems.length === 1 ? '' : 's')
    : total ? total + ' change' + (total === 1 ? '' : 's') + ' for review' : 'Read back from the .docx';
}

/* ---------- gesture buttons ---------- */
const firstWithCells = () => ECO.drivers.flatMap(d => d.subsections.flatMap(s => s.issues)).find(i => (i.baseline || '').trim());
function g(id, fn) { $(id).onclick = async () => { fn(); renderDoc(); await refresh(); }; }
g('g-add', () => {
  const sub = [...S.doc.getElementsByTagName('w:sdt')].find(x => tagIs(x, 'sub|drivers/regime/trend-growth'));
  const slot = [...sub.getElementsByTagName('w:sdt')].find(x => tagIs(x, 'slot|issue'));
  const ph = slot.getElementsByTagName('w:showingPlcHdr')[0]; if (ph) ph.remove();
  const c = slot.getElementsByTagName('w:sdtContent')[0]; while (c.firstChild) c.removeChild(c.firstChild);
  [['CITIssueTitle', 'Demographics are now a drag on potential'],
   ['CITBody', 'Net migration turned negative for the first time since 2020'],
   ['CITBody', 'Baseline: working-age population flat through 2027'],
   ['CITBody', 'Upside: participation recovers among the over-55s'],
   ['CITBody', 'Downside: enforcement tightens and the labour force shrinks']]
    .forEach(([st, t]) => c.appendChild(mkPara(st, t, false)));
});
g('g-retire', () => { const box = boxOf(ECO.drivers[0].subsections[1].issues[0].id);
  for (const k of ['title', 'text', 'baseline', 'upside', 'downside']) { const f = fieldOf(box, k); if (f) setField(f, [], k); } });
g('g-clear', () => { const box = boxOf(firstWithCells().id);
  for (const k of ['baseline', 'upside', 'downside']) setField(fieldOf(box, k), [], k); });
g('g-half', () => { const box = boxOf(firstWithCells().id); setField(fieldOf(box, 'upside'), [], 'upside'); });
g('g-move', () => { const a = boxOf(ECO.drivers[0].subsections[0].issues[0].id), b = boxOf(ECO.drivers[0].subsections[0].issues[1].id);
  if (a && b) b.parentNode.insertBefore(b, a); });
g('g-break', () => {
  const box = boxOf(ECO.drivers[0].subsections[0].issues[0].id); if (!box) return;
  const frag = S.doc.createDocumentFragment();
  for (const n of [...contentOf(box).childNodes]) {
    if (n.localName === 'sdt') { const cc = contentOf(n); if (cc) for (const p of [...cc.childNodes]) frag.appendChild(p.cloneNode(true)); }
    else frag.appendChild(n.cloneNode(true));
  }
  box.parentNode.replaceChild(frag, box);
});
$('g-stale').onclick = async () => { S.stale = !S.stale; $('g-stale').textContent = S.stale ? 'Colleague edits on disk ✓' : 'Colleague edits on disk'; await refresh(); };
$('g-reset').onclick = async () => { $('g-stale').textContent = 'Colleague edits on disk'; await boot(); };
$('applybtn').onclick = () => { $('applywhy').textContent = 'In the editor this writes v3, appends one log entry with source: word-import, and releases the lock.'; };

boot();
