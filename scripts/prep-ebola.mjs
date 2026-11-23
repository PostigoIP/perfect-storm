// Build public/data/ebola.json for Observed mode from two public sources:
//  - Nextstrain `ebola` build (time-resolved tree of 1,610 Makona genomes)
//  - WHO weekly case counts by district, as compiled in ebov/space-time (CC BY-SA 4.0)
// Usage: node scripts/prep-ebola.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TREE_URL = 'https://data.nextstrain.org/ebola.json';
const CASES_URL = 'https://raw.githubusercontent.com/ebov/space-time/master/Scripts/notebooks/auxiliaries/EBOV_maxCases.csv';
const START = '2013-12-30';                       // Monday of the first WHO epi-week in the counts table
const startMs = Date.parse(START + 'T00:00:00Z');

const LINEAGES = [
  { key: 'GIN', match: /guinea/i, name: 'Guinea', surface: 'stone' },
  { key: 'SLE', match: /sierra/i, name: 'Sierra Leone', surface: 'glass' },
  { key: 'LBR', match: /liberia/i, name: 'Liberia', surface: 'metal' },
  { key: 'OTH', match: /.*/, name: 'Elsewhere', surface: 'leaf' },
];
const lineageOf = (country) => LINEAGES.findIndex((l) => l.match.test(country ?? ''));

function decimalYearToDays(y) {
  const year = Math.floor(y);
  const a = Date.UTC(year, 0, 1), b = Date.UTC(year + 1, 0, 1);
  return (a + (y - year) * (b - a) - startMs) / 86400000;
}

const tree = await (await fetch(TREE_URL)).json();
const nodes = [], tips = [];
const countryCounts = {};
(function walk(n, parent) {
  const id = nodes.length;
  const country = n.node_attrs?.country?.value;
  const date = +decimalYearToDays(n.node_attrs.num_date.value).toFixed(2);
  let lineage = lineageOf(country);
  if (!country && parent >= 0) lineage = nodes[parent].lineage;   // internal nodes may lack a country
  nodes.push({ id, parent, date, lineage });
  if (!n.children?.length) { tips.push({ id, t: date }); countryCounts[country] = (countryCounts[country] ?? 0) + 1; }
  for (const c of n.children ?? []) walk(c, id);
})(tree.tree, -1);

const csv = (await (await fetch(CASES_URL)).text()).trim().split('\n').map((r) => r.split(','));
const header = csv[0];
const weekCols = header.slice(3);
const weeks = weekCols.map((h, i) => ({ t0: i * 7, counts: [0, 0, 0, 0], label: h }));
for (const row of csv.slice(1)) {
  const l = LINEAGES.findIndex((x) => x.key === row[0]);
  for (let i = 0; i < weekCols.length; i++) weeks[i].counts[l < 0 ? 3 : l] += Math.round(+row[3 + i] || 0);
}
const firstWeek = new Date(startMs).toISOString().slice(0, 10);
if (weekCols[0] !== '2013-Dec-30') throw new Error(`unexpected first week ${weekCols[0]} (expected ${firstWeek})`);
while (weeks.length && weeks.at(-1).counts.every((x) => !x)) weeks.pop();
const total = weeks.reduce((s, w) => s + w.counts.reduce((a, b) => a + b, 0), 0);

const usedOther = weeks.some((w) => w.counts[3]) || nodes.some((n) => n.lineage === 3);
const LIN_OUT = usedOther ? LINEAGES : LINEAGES.slice(0, 3);
for (const w of weeks) if (!usedOther) w.counts.length = 3;
const out = {
  meta: {
    title: 'West Africa, 2013–2016',
    lede: `Ebola virus, Zaire species (the Makona variant). ${total.toLocaleString('en')} reported cases in Guinea, Sierra Leone and Liberia, one drop each, week by week. ${tips.length.toLocaleString('en')} genomes grow the tree as their sampling dates arrive.`,
    start: START,
    defaultSpeed: 5,
    inferred: { severe: 0.6, fatal: 0.4 },
    sources: [
      { name: 'Nextstrain · ebola', url: 'https://nextstrain.org/ebola', citation: `Time-resolved phylogeny of Makona genomes; Dudas et al., Nature 544:309 (2017). Build updated ${tree.meta.updated}.`, license: 'see nextstrain.org' },
      { name: 'ebov/space-time · weekly cases by district', url: 'https://github.com/ebov/space-time', citation: 'WHO patient database counts (max of confirmed and probable), compiled for Dudas et al. 2017.', license: 'CC BY-SA 4.0' },
    ],
    transformations: [
      'Tree dates (decimal years) converted to days since 30 Dec 2013; tips coloured by sampling country; internal nodes inherit their parent\'s country when unannotated.',
      'District weekly counts summed to country; trailing empty weeks removed.',
      'Each week\'s count is replayed as that many onsets spread evenly across the week.',
      'At most 400 tips are drawn at once, thinned evenly over time.',
    ],
  },
  lineages: LIN_OUT.map(({ name, surface }) => ({ name, surface })),
  nodes, tips,
  weeks: weeks.map(({ t0, counts }) => ({ t0, counts })),
};
mkdirSync(join(root, 'public/data'), { recursive: true });
writeFileSync(join(root, 'public/data/ebola.json'), JSON.stringify(out));
console.log(`nodes ${nodes.length}, tips ${tips.length}, weeks ${out.weeks.length}, cases ${total}`);
console.log('tip countries', countryCounts);
console.log('date range of tips', Math.min(...tips.map((t) => t.t)), Math.max(...tips.map((t) => t.t)), 'root', nodes[0].date);
