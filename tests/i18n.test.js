import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ES_STRINGS, t, tName, num, month, setLang, pickLang } from '../src/i18n.js';
import { CHAPTERS } from '../src/story.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const missing = (list) => list.filter((s) => s && !(s in ES_STRINGS));

describe('Spanish', () => {
  afterEach(() => setLang('en'));

  it('covers every marked text in the page', () => {
    const html = read('index.html');
    const marked = [...html.matchAll(/data-i18n(?=[\s>])[^>]*>([^<]+)</g)].map((m) => m[1].trim());
    expect(marked.length).toBeGreaterThan(30);
    expect(missing(marked)).toEqual([]);
  });

  it('covers the story: chapter titles, texts and milestones', () => {
    expect(missing(CHAPTERS.flatMap((c) => [c.title, c.body, c.mark]).filter((x) => !/^Variant /.test(x ?? '')))).toEqual([]);
  });

  it('covers the real-data texts: titles, ledes, lineages, sources, milestones', () => {
    for (const f of ['public/data/ebola.json', 'public/data/compare.json']) {
      const d = JSON.parse(read(f));
      const m = d.meta;
      const texts = [m.title, m.lede, m.unitLabel, ...d.lineages.map((l) => l.name), ...m.sources.flatMap((s) => [s.name, s.citation, s.license]), ...m.transformations,
        ...(d.phases ?? []).flatMap((p) => [p.title, p.lede, ...p.events.map((e) => e.label)])];
      expect(missing(texts.filter((x) => x !== 'Contained, or not'))).toEqual([]);
    }
  });

  it('switches text, numbers, months and variant names', () => {
    expect(t('Deaths')).toBe('Deaths');
    setLang('es');
    expect(t('Deaths')).toBe('Muertes');
    expect(t('not in the dictionary')).toBe('not in the dictionary');
    expect(tName('Variant β')).toBe('Variante β');
    expect(num(10699)).toBe('10.699');
    expect(month(8)).toBe('sept');
  });
});

describe('pickLang', () => {
  it('opens in English whatever the browser prefers', () => {
    expect(pickLang({ browser: 'es-ES' })).toBe('en');
    expect(pickLang({ browser: 'es-419' })).toBe('en');
    expect(pickLang({ browser: 'es' })).toBe('en');
    expect(pickLang({ browser: 'en-GB' })).toBe('en');
    expect(pickLang({ browser: 'fr-FR' })).toBe('en');
    expect(pickLang({ browser: 'eu-ES' })).toBe('en');
    expect(pickLang({})).toBe('en');
  });
  it('a saved choice beats the browser, and ?lang= beats both', () => {
    expect(pickLang({ browser: 'es-ES', saved: 'en' })).toBe('en');
    expect(pickLang({ browser: 'en-US', saved: 'es' })).toBe('es');
    expect(pickLang({ browser: 'es-ES', saved: 'es', param: 'en' })).toBe('en');
    expect(pickLang({ browser: 'en-US', param: 'xx' })).toBe('en');
  });
});
