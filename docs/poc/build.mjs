/* Rebuild the two prototype pages from src/ and the repo's own data.
   Run: node docs/poc/build.mjs
   The economies are read from data/*.yaml with the editor's own YAML parser, so
   the prototypes never drift from the thesis they claim to round-trip. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');

/* the editor is the single source of truth for reading YAML */
const editor = readFileSync(join(root, 'EDITOR-country-investment-thesis.html'), 'utf8');
const a = editor.indexOf('const YAML = (() => {');
const b = editor.indexOf('  return { parse, dump };', a);
if (a < 0 || b < 0) throw new Error('could not find the YAML module in the editor');
const YAML = new Function(editor.slice(a, b) + '  return { parse, dump };\n})();\nreturn YAML;')();

const ids = YAML.parse(readFileSync(join(root, 'config.yaml'), 'utf8')).economies.map(e => e.id);
const ALL = {};
for (const id of ids) ALL[id] = YAML.parse(readFileSync(join(root, 'data', `${id}.yaml`), 'utf8'));
const REAL = ALL[ids[0]];

/* The writer is NOT kept in src/: it is lifted out of the editor, so the prototype can
   never test a document builder that has drifted from the one the tool actually ships. */
const w = editor.indexOf('const DOCX = (() => {');
const wEnd = editor.indexOf('  return { write };\n})();', w);
if (w < 0 || wEnd < 0) throw new Error('could not find the DOCX module in the editor');
const writer = editor.slice(w, wEnd) + '  return { write };\n})();\nconst docxWrite = (eco) => DOCX.write(eco);\n';

const modules = [src('zip.js'), writer, src('docx-read.js')].join('\n');

/* 1. the test runner */
writeFileSync(join(here, 'docx-round-trip.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>docx round-trip tests</title>
<style>body{font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:28px;background:#f6f7f9;color:#1c2024}
h1{font:600 16px/1.3 -apple-system,Segoe UI,sans-serif;margin:0 0 14px}
pre{background:#fff;border:1px solid #dfe3e8;border-radius:8px;padding:16px;overflow:auto}
.PASS{color:#0f7b3e;font-weight:600}.FAIL{color:#c0392b;font-weight:600}</style></head><body>
<h1>docx round-trip tests — open in Edge or Chrome</h1><pre id="out">running…</pre>
<script>\nconst REAL = ${JSON.stringify(REAL)};\nconst ALL = ${JSON.stringify(ALL)};\n${modules}\n${src('tests.js')}\n</script></body></html>\n`);

/* 2. the interactive page (also published as an Artifact) */
writeFileSync(join(here, 'word-round-trip.html'),
  src('page-head.html') + src('page-prose.html')
  + `\n<script>\nconst ECO = ${JSON.stringify(REAL)};\n${modules}\n${src('ui.js')}${src('analyser.js')}\n</script>\n`);

console.log(`built from ${ids.length} economies:
  docs/poc/docx-round-trip.html   test runner
  docs/poc/word-round-trip.html   interactive + drop in a .docx Word has saved`);
