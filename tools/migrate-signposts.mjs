// One-off migration, September 2026: the old top-level signposts (scenario categories growth /
// inflation / policy) become the baseline, upside and downside cells of the issue they track,
// per signpost-migration.json (signpost id -> [issue id, old signpost title]).
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
  const issues = {}; for (const d of eco.drivers) for (const s of d.subsections) for (const i of s.issues) issues[i.id] = i;
  for (const c of eco.scenarios) for (const sp of c.issues || []) {
    const home = homes[sp.id]; if (!home) throw new Error(`${f}: no home for signpost ${sp.id} in tools/signpost-migration.json`);
    const issue = issues[home[0]]; if (!issue) throw new Error(`${f}: issue ${home[0]} does not exist`);
    if (issue.baseline) throw new Error(`${f}: issue ${home[0]} would receive two signposts`);
    issue.baseline = sp.baseline; issue.upside = sp.upside; issue.downside = sp.downside;
  }
  for (const [k, v] of Object.entries(eco.implications || {})) if (k.startsWith('scenarios/')) { dropped.push(`${eco.id}: ${k} ${JSON.stringify(v)}`); delete eco.implications[k]; }
  delete eco.scenarios;
  const header = text.split('\n').filter(l => l.startsWith('#')).join('\n');
  const body = YAML.dump({ id: eco.id, name: eco.name, version: eco.version, updated_at: eco.updated_at, updated_by: eco.updated_by, drivers: eco.drivers, implications: eco.implications });
  fs.writeFileSync('data/' + f, (header ? header + '\n\n' : '') + body);
  console.log(f, 'migrated');
}
const yamlById = {};
for (const f of fs.readdirSync('data').filter(x => x.endsWith('.yaml'))) yamlById[f.replace('.yaml', '')] = fs.readFileSync('data/' + f, 'utf8');
let n = 0;
const out = html.replace(/const DEMO_YAML = [^\r\n]*;/, () => { n++; return `const DEMO_YAML = ${JSON.stringify(yamlById)};`; });
if (n !== 1) throw new Error('DEMO_YAML not found');
fs.writeFileSync(PAGE, out);
console.log('DEMO_YAML refreshed');
if (dropped.length) console.log('\nMatrix arrows on the old scenario rows, dropped (no row to carry them any more):\n  ' + dropped.join('\n  '));
