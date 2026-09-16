
/* ===================== drop in a .docx Word has saved =====================
   The tests up to here used synthetic edits. This reads a file that has been
   through real Word, reports what Word did to it, and shows what the editor
   would import. */
function diagFor(xml, files, bytes) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const tags = [...doc.getElementsByTagName('w:sdt')].map(s => {
    const t = s.getElementsByTagName('w:tag')[0]; return t ? t.getAttribute('w:val') : null; });
  const byKind = {};
  for (const t of tags) { const k = t ? t.split('|')[0] : '(untagged)'; byKind[k] = (byKind[k] || 0) + 1; }
  const styles = files['word/styles.xml'] || '';
  const citStyles = (styles.match(/w:styleId="CIT[A-Za-z0-9]*"/g) || []).length;
  const rewritten = /w:rsid|w:proofErr|w:noProof|w:lang /.test(xml);
  return {
    size: bytes.length, parts: Object.keys(files).length,
    controls: tags.length, byKind,
    runs: (xml.match(/<w:r[ >]/g) || []).length,
    paras: (xml.match(/<w:p[ >]/g) || []).length,
    citStyles, rewritten,
    tracked: (xml.match(/<w:ins /g) || []).length + (xml.match(/<w:del /g) || []).length,
    comments: !!files['word/comments.xml'],
  };
}
async function loadDocx(file) {
  const out = $('diag');
  out.innerHTML = '<p class="dnote">Reading ' + file.name + '…</p>';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const files = await zipRead(bytes);
    if (!files['word/document.xml']) throw new Error('not a Word document — no word/document.xml inside');
    const xml = files['word/document.xml'];
    const d = diagFor(xml, files, bytes);
    const parsed = docxParse(xml);
    const cur = currentOf(ECO);
    const wrongEco = parsed.meta && parsed.meta.economy !== ECO.id;
    const lost = parsed.manifest ? parsed.manifest.filter(id => !parsed.places.some(p => p.items.some(i => i.id === id))) : [];
    const rows = [
      ['File', `${file.name} · ${(d.size / 1024).toFixed(1)} KB · ${d.parts} parts`],
      ['Content controls', `${d.controls} — ` + Object.entries(d.byKind).map(([k, n]) => `${n} ${k}`).join(', ')],
      ['Issue boxes found', String((d.byKind.issue || 0))],
      ['Named styles kept', `${d.citStyles} CIT styles in styles.xml`],
      ['Word rewrote the file', d.rewritten ? 'yes — revision ids / proofing marks present (expected after a real save)' : 'no trace of a Word save — is this the file you saved?'],
      ['Runs / paragraphs', `${d.runs} / ${d.paras}`],
      ['Tracked changes', d.tracked ? `${d.tracked} insertions or deletions — read as accepted` : 'none'],
      ['Comments part', d.comments ? 'present' : 'none'],
      ['Version stamp', parsed.meta ? `${parsed.meta.economy} v${parsed.meta.version}` : 'MISSING — the meta control was destroyed'],
      ['Manifest', parsed.manifest ? `${parsed.manifest.length} ids recorded at export` : 'MISSING — a stale file could not be told from a deletion'],
    ];
    if (lost.length) rows.push(['Boxes that went missing', `${lost.length}: ${lost.join(', ')} — deliberate deletion, or a destroyed control`]);
    out.innerHTML = '<table class="diag">' + rows.map(([k, v]) =>
      `<tr><th>${k}</th><td>${v.replace(/MISSING/g, '<b class="bad">MISSING</b>').replace(/^no trace/, '<b class="bad">no trace</b>')}</td></tr>`).join('') + '</table>'
      + (wrongEco ? `<p class="dnote bad">This file is for <b>${parsed.meta.economy}</b>, but this page holds ${ECO.id}. The verdict below will be meaningless.</p>` : '')
      + '<p class="dnote">The panes below now show <b>your</b> file and what the editor would import from it.</p>';
    S.parts = files;
    S.doc = new DOMParser().parseFromString(xml, 'application/xml');
    renderDoc();
    await refresh();
    window.scrollTo({ top: document.querySelector('.split').offsetTop - 60, behavior: 'smooth' });
  } catch (e) {
    out.innerHTML = `<p class="dnote bad">Could not read it: ${String(e.message || e)}</p>`;
  }
}
$('docx-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadDocx(f); });
const drop = $('drop');
['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(n => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) loadDocx(f); });
