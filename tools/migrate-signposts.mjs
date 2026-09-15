// One-off migration, September 2026: signposts move from top-level scenario categories
// (growth / inflation / policy) to the driver subsection they track, per signpost-migration.json.
// Also refreshes the built-in sample data (DEMO_YAML) in the editor page.
// Run from the repository root:  node tools/migrate-signposts.mjs
import fs from 'node:fs';
const PAGE = 'EDITOR-country-investment-thesis.html';
const html = fs.readFileSync(PAGE, 'utf8');
const a = html.indexOf('const YAML = (() => {'), b = html.indexOf('})();', a) + 5;
const YAML = new Function(html.slice(a, b) + '\nreturn YAML;')();   // the page's own reader/writer, so output matches what the page writes
const map = JSON.parse(fs.readFileSync('tools/signpost-migration.json', 'utf8'));
const dropped = [];
for (const f of fs.readdirSync('data').filter(x => x.endsWith('.yaml')).sort()) {
  const text = fs.readFileSync('data/' + f, 'utf8');
  const eco = YAML.parse(text);
  if (!eco.scenarios) { console.log(f, 'already migrated'); continue; }
  const homes = map[eco.id] || {};
  for (const d of eco.drivers) for (const s of d.subsections) s.signposts = s.signposts || [];
  for (const c of eco.scenarios) for (const sp of c.issues || []) {
    const home = homes[sp.id]; if (!home) throw new Error(`${f}: no home for signpost ${sp.id} in tools/signpost-migration.json`);
    const [dId, sId] = home.split('/');
    const sub = eco.drivers.find(d => d.id === dId)?.subsections.find(s => s.id === sId);
    if (!sub) throw new Error(`${f}: ${home} does not exist`);
    sub.signposts.push({ id: sp.id, title: sp.title, baseline: sp.baseline, upside: sp.upside, downside: sp.downside });
  }
  for (const [k, v] of Object.entries(eco.implications || {})) if (k.startsWith('scenarios/')) { dropped.push(`${eco.id}: ${k} ${JSON.stringify(v)}`); delete eco.implications[k]; }
  delete eco.scenarios;
  const header = text.split('\n').filter(l => l.startsWith('#')).join('\n');
  const body = YAML.dump({ id: eco.id, name: eco.name, version: eco.version, updated_at: eco.updated_at, updated_by: eco.updated_by, drivers: eco.drivers, implications: eco.implications });
  fs.writeFileSync('data/' + f, (header ? header + '\n\n' : '') + body);
  console.log(f, 'migrated');
}
// refresh the page's embedded sample data from the migrated files
const yamlById = {};
for (const f of fs.readdirSync('data').filter(x => x.endsWith('.yaml'))) yamlById[f.replace('.yaml', '')] = fs.readFileSync('data/' + f, 'utf8');
let n = 0;
const out = html.replace(/const DEMO_YAML = [^\r\n]*;/, () => { n++; return `const DEMO_YAML = ${JSON.stringify(yamlById)};`; });
if (n !== 1) throw new Error('DEMO_YAML not found');
fs.writeFileSync(PAGE, out);
console.log('DEMO_YAML refreshed');
if (dropped.length) console.log('\nMatrix arrows on the old scenario rows, dropped (no row to carry them any more):\n  ' + dropped.join('\n  '));
