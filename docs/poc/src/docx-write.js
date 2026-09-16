/* ===================== docx WRITE (v3 — one hierarchy) =====================
   Main now has a single tree: drivers > subsections > issues, and a signpost is
   three optional cells ON an issue, not a separate item.  So the document has
   exactly one kind of editable box: the issue.
   A tag carries IDENTITY ONLY; placement comes from the enclosing container and
   document order, so moving a box moves the item.                            */
const X = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const CELLS = ['baseline', 'upside', 'downside'];
let SDTID = 1000;
function runs(text) {
  if (text === '') return '';
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(seg => {
    const b = /^\*\*[^*]+\*\*$/.test(seg), t = b ? seg.slice(2, -2) : seg;
    return `<w:r>${b ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
  }).join('');
}
const para = (style, text, extra = '') => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${runs(text)}</w:p>`;
function bulletParas(text) {
  if (!text || !text.trim()) return para('CITBullet', '');
  return text.split('\n').map(line => {
    const m = line.match(/^(\s*)-\s+(.*)$/);
    if (!m) return para('CITBody', line.trim());
    const lvl = Math.min(Math.floor(m[1].length / 2), 1);
    return para(lvl ? 'CITBullet2' : 'CITBullet', m[2], `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="1"/></w:numPr>`);
  }).join('');
}
/* sdtLocked locks the FRAME, not the contents: the box cannot be deleted, but it can be
   emptied — which is how "retire this issue" and "remove these signposts" are expressed. */
function sdt(tag, alias, inner, opt = {}) {
  return `<w:sdt><w:sdtPr><w:alias w:val="${X(alias)}"/><w:tag w:val="${X(tag)}"/><w:id w:val="${SDTID++}"/>`
    + `<w:lock w:val="${opt.lock || 'sdtLocked'}"/>` + (opt.placeholder ? '<w:showingPlcHdr/>' : '')
    + `</w:sdtPr><w:sdtContent>${inner}</w:sdtContent></w:sdt>`;
}
const SLOT_ISSUE = 'Click here and type a new issue: its title on the first line, then one bullet per line. To give it signposts, add lines beginning Baseline:, Upside: and Downside:.';
const SLOT_SUB = 'Click here and type the name of a new subsection, then its first issue title and bullets.';
const CELL_HINT = { baseline: 'Baseline — what we expect. Leave all three empty if this issue has no signposts.', upside: 'Upside — what would make it better.', downside: 'Downside — what would make it worse.' };

function issueBlock(i) {
  const cell = (k) => {
    const filled = (i[k] || '').trim();
    return `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>`
      + sdt('field|' + k, k[0].toUpperCase() + k.slice(1),
          filled ? bulletParas(i[k]) : para('CITPlaceholder', CELL_HINT[k]), { placeholder: !filled })
      + `</w:tc>`;
  };
  const head = ['Baseline', 'Upside', 'Downside'].map(h => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${para('CITTableHead', h)}</w:tc>`).join('');
  return sdt(`issue|${i.id}`, i.title || 'Issue',
    sdt('field|title', 'Title', para('CITIssueTitle', i.title))
    + sdt('field|text', 'View', bulletParas(i.text))
    + `<w:tbl><w:tblPr><w:tblStyle w:val="CITTable"/><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>`
    + `<w:tr>${head}</w:tr><w:tr>${CELLS.map(cell).join('')}</w:tr></w:tbl>`
    + para('CITBody', ''));
}
function buildDocument(eco) {
  SDTID = 1000;
  let b = para('CITTitle', eco.name);
  b += sdt(`meta|${eco.id}|${eco.version}`, 'Do not edit',
    para('CITMeta', `${eco.name} · version ${eco.version} · edit inside the boxes, then import this file back into the page`), { lock: 'sdtContentLocked' });
  /* The manifest records which issues existed when this file was exported. Without it, an issue
     a colleague adds while the document is out would be absent here and read as a deletion. */
  const exported = eco.drivers.flatMap(d => d.subsections.flatMap(s => s.issues.map(i => i.id)));
  b += sdt('manifest', 'Do not edit — records what this file was exported from',
    `<w:p><w:pPr><w:pStyle w:val="CITMeta"/><w:rPr><w:vanish/></w:rPr></w:pPr>`
    + `<w:r><w:rPr><w:vanish/></w:rPr><w:t xml:space="preserve">${X(exported.join(' '))}</w:t></w:r></w:p>`,
    { lock: 'sdtContentLocked' });
  for (const d of eco.drivers) {
    /* the four driver groups are fixed: the page cannot add, remove or reorder them,
       so the heading is read-only and the reader ignores group order entirely */
    b += sdt(`group|${d.id}`, d.name, para('CITH1', d.name), { lock: 'sdtContentLocked' });
    for (const s of d.subsections) {
      let inner = para('CITH3', s.name);
      for (const i of s.issues) inner += issueBlock(i);
      inner += sdt('slot|issue', 'New issue in ' + s.name, para('CITPlaceholder', SLOT_ISSUE), { placeholder: true });
      b += sdt(`sub|drivers/${d.id}/${s.id}`, s.name, inner);
    }
    b += sdt(`slot|sub|${d.id}`, 'New subsection under ' + d.name, para('CITPlaceholder', SLOT_SUB), { placeholder: true });
  }
  b += para('CITH1', 'Investment implications');
  b += sdt('matrix', 'Set these by clicking in the page, not here',
    `<w:tbl><w:tblPr><w:tblStyle w:val="CITTable"/><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>`
    + Object.entries(eco.implications || {}).map(([k, cells]) =>
      `<w:tr><w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${para('CITBody', k)}</w:tc>`
      + `<w:tc><w:tcPr><w:tcW w:w="6000" w:type="dxa"/></w:tcPr>${para('CITBody', Object.entries(cells).map(([f, v]) => `${f} ${v === 'up' ? '↑' : '↓'}`).join(', '))}</w:tc></w:tr>`).join('')
    + `</w:tbl>`, { lock: 'sdtContentLocked' });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${b}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
}
