// Build public/data/compare.json for Compare mode: a contained outbreak and one
// that got away, replayed one after the other on the same axis and scale.
//  - Kasai 2025 (Zaire ebolavirus): daily cases by symptom onset, read off WHO's
//    epidemic curve (DON589, Figure 2, as of 30 Nov 2025): 53 confirmed + 11 probable.
//  - Bundibugyo 2026: cumulative confirmed cases from dated WHO Disease Outbreak
//    News reports (DON602–DON625), turned into a daily pace between reports.
// Usage: node scripts/prep-compare.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const dayOf = (start, iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / DAY);

// ── Kasai 2025: [onset date, confirmed, probable], from WHO's daily epi curve ──
const KASAI_START = '2025-08-04';
const KASAI_CURVE = [
  ['2025-08-04', 0, 1], ['2025-08-16', 0, 2], ['2025-08-18', 0, 1], ['2025-08-19', 1, 1],
  ['2025-08-21', 1, 1], ['2025-08-24', 0, 3], ['2025-08-25', 2, 0], ['2025-08-26', 2, 0],
  ['2025-08-27', 1, 0], ['2025-08-28', 4, 0], ['2025-08-29', 3, 0], ['2025-08-30', 2, 0],
  ['2025-09-01', 3, 2], ['2025-09-02', 4, 0], ['2025-09-03', 3, 0], ['2025-09-04', 1, 0],
  ['2025-09-05', 3, 0], ['2025-09-07', 1, 0], ['2025-09-08', 3, 0], ['2025-09-09', 3, 0],
  ['2025-09-10', 1, 0], ['2025-09-11', 4, 0], ['2025-09-13', 2, 0], ['2025-09-16', 3, 0],
  ['2025-09-17', 3, 0], ['2025-09-19', 2, 0], ['2025-09-23', 1, 0],
];
const kasaiConfirmed = KASAI_CURVE.reduce((s, r) => s + r[1], 0), kasaiProbable = KASAI_CURVE.reduce((s, r) => s + r[2], 0);
if (kasaiConfirmed !== 53 || kasaiProbable !== 11) throw new Error(`Kasai curve reads ${kasaiConfirmed}+${kasaiProbable}, WHO says 53+11`);

// ── Bundibugyo 2026: cumulative confirmed cases by report date ──
const BDB_START = '2026-04-24';   // symptom onset of the first known (suspected) case, WHO DON602
// DRC: confirmed cases as of each WHO report
const DRC = [
  ['2026-06-10', 676], ['2026-06-17', 896], ['2026-07-01', 1460], ['2026-07-15', 2124],
  ['2026-07-30', 3605], ['2026-08-12', 4665], ['2026-08-26', 5794], ['2026-09-07', 6757],
  ['2026-09-23', 7890], ['2026-10-06', 8728], ['2026-10-20', 9704], ['2026-11-03', 10668],
];
// Uganda: 2 imported cases confirmed 15–16 May, 19 by 10 Jun (none new after 5 Jun), 20 by 2 Jul
const UGA = [['2026-05-14', 0], ['2026-05-16', 2], ['2026-06-05', 19], ['2026-06-18', 19], ['2026-07-02', 20], ['2026-11-03', 20]];
// Elsewhere: France 1 (between 17 Jun and 1 Jul), Kenya 1 by 6 Oct and 9 by 20 Oct, Nigeria 1 by 20 Oct
const ELSE = [['2026-06-17', 0], ['2026-07-01', 1], ['2026-10-05', 1], ['2026-10-06', 2], ['2026-10-20', 11], ['2026-11-03', 11]];

// Daily counts from cumulative points: a steady pace between two reports, rounded
// so every report's total is met exactly. Before the first point, a straight ramp from 0.
function daily(points, start, nDays, ramp = false) {
  const pts = [[0, 0], ...points.map(([d, c]) => [dayOf(start, d), c])];
  const cum = (t) => {
    for (let i = 1; i < pts.length; i++) {
      const [t0, c0] = pts[i - 1], [t1, c1] = pts[i];
      if (t > t1) continue;
      const k = Math.max(0, (t - t0) / (t1 - t0));
      // first stretch with ramp: the daily pace rises in a straight line from 0
      return i === 1 && ramp ? c1 * k * k : c0 + (c1 - c0) * k;
    }
    return pts.at(-1)[1];
  };
  const out = [];
  for (let t = 0; t < nDays; t++) out.push(Math.round(cum(t + 1)) - Math.round(cum(t)));
  return out;
}

const bdbDays = dayOf(BDB_START, '2026-11-03') + 1;
const drc = daily(DRC, BDB_START, bdbDays, true);
const uga = daily(UGA, BDB_START, bdbDays);
const els = daily(ELSE, BDB_START, bdbDays);
const sum = (a) => a.reduce((s, x) => s + x, 0);
if (sum(drc) !== 10668 || sum(uga) !== 20 || sum(els) !== 11) throw new Error(`Bundibugyo totals ${sum(drc)}/${sum(uga)}/${sum(els)}`);

const kasaiDays = KASAI_CURVE.map(([d, c, p]) => ({ t: dayOf(KASAI_START, d), counts: [c + p, 0, 0, 0] }));
const bdbSeries = [];
for (let t = 0; t < bdbDays; t++) if (drc[t] || uga[t] || els[t]) bdbSeries.push({ t, counts: [0, drc[t], uga[t], els[t]] });
const bdbTotal = sum(drc) + sum(uga) + sum(els);
const peak = Math.max(...bdbSeries.map((d) => d.counts.reduce((a, b) => a + b, 0)));

const out = {
  meta: {
    title: 'Contained, or not',
    defaultSpeed: 5,
    binDays: 1,
    yMax: peak,
    domain: { t0: -4, t1: 205 },
    unitLabel: 'cases per day, since the first case',
    sources: [
      { name: 'WHO · Disease Outbreak News, Ebola, DRC (DON580, DON589)', url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2025-DON589', citation: 'Kasai 2025: 53 confirmed and 11 probable cases, with 45 deaths. Daily epidemic curve by symptom onset (Figure 2), as of 30 Nov 2025.' },
      { name: 'WHO AFRO · End of the 16th Ebola outbreak', url: 'https://www.afro.who.int/countries/democratic-republic-of-congo/news/democratic-republic-congo-declares-end-of16thebola-outbreak', citation: '47,577 people were vaccinated, and the outbreak was declared over on 1 Dec 2025.' },
      { name: 'WHO · Disease Outbreak News, Bundibugyo virus (DON602–DON625)', url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON625', citation: 'Bundibugyo 2026: confirmed cases by country as of 3 Nov 2026 (DRC: 10,668 confirmed cases and 5,198 deaths).' },
    ],
    transformations: [
      'For Kasai 2025, daily cases (confirmed and probable) were read from the WHO epidemic curve by date of symptom onset; the extracted totals match WHO\'s 53 + 11.',
      'For Bundibugyo 2026, confirmed cases are plotted by date of report rather than onset. Between two WHO reports, new cases are distributed at a steady pace so that each report\'s cumulative total is matched exactly.',
      'Before 10 June, WHO counted only suspected cases in Bundibugyo 2026; the 676 cases confirmed by that date are distributed along a rising ramp starting from the first known onset on 24 April.',
      'The jump in the second half of July reflects WHO\'s data reconciliation on 22 July, not only newly diagnosed cases.',
      'Both outbreaks start on day 0 (the first known case) and share the same speed, time axis and vertical scale. Kasai remains on the axis as an outline while Bundibugyo plays.',
      'Deaths match the reported totals (45 and 5,202), but which specific cases died—and on which day—is assigned at random, since the data does not specify it.',
    ],
  },
  lineages: [
    { name: 'Kasai, DRC 2025', surface: 'glass' },
    { name: 'Bundibugyo · DRC', surface: 'stone' },
    { name: 'Bundibugyo · Uganda', surface: 'metal' },
    { name: 'Bundibugyo · elsewhere', surface: 'leaf' },
  ],
  phases: [
    {
      key: 'kasai', start: KASAI_START, end: dayOf(KASAI_START, '2025-12-01'), deaths: 45,
      title: 'Kasai, DRC 2025: contained',
      lede: 'Ebola virus, Zaire species, in Bulape (Kasai province, DRC). There were 64 cases and 45 deaths. Because a vaccine was available, 47,577 people were vaccinated; the last patient fell ill on 23 September, and the outbreak was declared over on 1 December.',
      days: kasaiDays,
      events: [
        { t: dayOf(KASAI_START, '2025-09-04'), label: 'Declared' },
        { t: dayOf(KASAI_START, '2025-10-19'), label: 'Last patient discharged' },
        { t: dayOf(KASAI_START, '2025-12-01'), label: 'Over' },
      ],
    },
    {
      key: 'bundibugyo', start: BDB_START, end: bdbDays, deaths: 5198 + 2 + 2,   // DRC, Uganda, Kenya
      title: 'Bundibugyo 2026: not contained',
      lede: `Bundibugyo virus, a different ebolavirus species, spreading from Ituri into Uganda, Kenya and beyond. With no approved vaccine or treatment, there were ${bdbTotal.toLocaleString('en')} confirmed cases and 5,202 deaths by 3 November, and the outbreak was still ongoing.`,
      days: bdbSeries,
      events: [
        { t: dayOf(BDB_START, '2026-05-15'), label: 'Declared' },
      ],
    },
  ],
};
mkdirSync(join(root, 'public/data'), { recursive: true });
writeFileSync(join(root, 'public/data/compare.json'), JSON.stringify(out));
console.log(`Kasai: ${kasaiConfirmed + kasaiProbable} cases over ${kasaiDays.length} days; Bundibugyo: ${bdbTotal} cases over ${bdbSeries.length} days, peak ${peak}/day`);
