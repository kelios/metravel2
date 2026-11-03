import catalog from '../../../../data/travelBooks/catalog.json';
import manifest from '../../../../data/travelBooks/manifest.json';
import coverCopy from '../../../../data/travelBooks/cover-copy.json';
import frameCopy from '../../../../data/travelBooks/frame-copy.json';
import bySource from '../../../../data/travelBooks/by/source-records.json';
import plSource from '../../../../data/travelBooks/pl/source-records.json';
import mountainsKit from '../../../../data/travelBooks/series/mountains-pl-sources.json';
import castlesKit from '../../../../data/travelBooks/series/castles-pl-sources.json';
import mountainsCopy from '../../../../data/travelBooks/series/mountains-pl-copy.json';
import castlesCopy from '../../../../data/travelBooks/series/castles-pl-copy.json';
import {bannedPhrases, coverCopySourceSchema, frameCopySourceSchema, latinWords} from '../../../../data/travelBooks/schema/editionCopy';
import {coverPersonalizationSchema, publishedBookSchema} from '../../../../services/book/readyBooks/publication';
import {coverPresetLabel} from '../../../../services/book/readyBooks/coverPersonalization';
import {publishedFixture} from './publicationFixtures';
import {editionCoverPresets, legacyCoverPresets} from './coverCopyFixture';
import {runNodeCli} from '../../../scripts/cli-test-utils';

const editionIds = catalog.books.map(book => book.id).sort();
const cover = coverCopySourceSchema.parse(coverCopy);
const frame = frameCopySourceSchema.parse(frameCopy);
const placeRecords = [...bySource.records, ...plSource.records];
const seriesCopy = [...mountainsCopy.records, ...castlesCopy.records] as {id: string; copyRu: string; prompt: string}[];
const printedRussian = () => [
  ...Object.entries(frame.editions).flatMap(([id, edition]) => [edition.epigraph, edition.subtitle, ...(['intro', 'usage', 'outro', 'endpaper'] as const).flatMap(slot => [edition[slot].heading, edition[slot].text]), edition.backCover.heading].map(text => ({id, text}))),
  ...Object.entries(cover.editions).flatMap(([id, edition]) => edition.presets.map(preset => ({id, text: preset.text.ru}))),
  ...placeRecords.flatMap(record => [{id: record.id, text: record.copyRu}, {id: record.id, text: record.prompt}]),
  ...seriesCopy.flatMap(record => [{id: record.id, text: record.copyRu}, {id: record.id, text: record.prompt}]),
];

describe('per-edition cover inscriptions (#2946)', () => {
  it('covers exactly the published editions with 2–5 presets in every UI locale', () => {
    expect(Object.keys(cover.editions).sort()).toEqual(editionIds);
    expect(manifest.books.map(book => book.id).sort()).toEqual(editionIds);
    for (const edition of Object.values(cover.editions)) {
      expect(edition.presets.length).toBeGreaterThanOrEqual(2);
      expect(edition.presets.length).toBeLessThanOrEqual(5);
      for (const preset of edition.presets) expect(Object.keys(preset.text).sort()).toEqual(['be', 'en', 'pl', 'ru', 'uk']);
    }
  });

  it('never shares a preset id, inscription or preset set between two editions', () => {
    const presets = Object.values(cover.editions).flatMap(edition => edition.presets);
    expect(new Set(presets.map(preset => preset.id)).size).toBe(presets.length);
    for (const locale of ['ru', 'be', 'uk', 'pl', 'en'] as const) expect(new Set(presets.map(preset => preset.text[locale])).size).toBe(presets.length);
    const sets = Object.values(cover.editions).map(edition => edition.presets.map(preset => preset.text.ru).sort().join('|'));
    expect(new Set(sets).size).toBe(sets.length);
    const duplicated = structuredClone(coverCopy);
    duplicated.editions['poland-memory'].presets[0].id = duplicated.editions['belarus-memory'].presets[0].id;
    expect(coverCopySourceSchema.safeParse(duplicated).success).toBe(false);
  });

  it('publishes v2 descriptors with translations and still parses the shared two-preset revisions', () => {
    const current = publishedFixture();
    expect(current.coverPersonalization?.schemaVersion).toBe(2);
    const legacy = publishedFixture();
    legacy.coverPersonalization = coverPersonalizationSchema.parse({...legacy.coverPersonalization, ...legacyCoverPresets});
    expect(publishedBookSchema.safeParse(legacy).success).toBe(true);
    const descriptor = current.coverPersonalization!;
    const variants = [
      {...descriptor, presets: descriptor.presets.slice(0, 1)},
      {...descriptor, presets: [...descriptor.presets, ...descriptor.presets.map((preset, index) => ({...preset, id: `extra-${index}`}))]},
      {...descriptor, defaultPresetId: 'not-in-edition'},
      {...descriptor, presets: [descriptor.presets[0], {...descriptor.presets[1], id: descriptor.presets[0].id}]},
      {...descriptor, presets: descriptor.presets.map(({translations: _translations, ...preset}) => preset)},
      {...descriptor, schemaVersion: 1},
    ];
    for (const variant of variants) expect(coverPersonalizationSchema.safeParse(variant).success).toBe(false);
  });

  it('labels presets in the UI locale and falls back to the printed Russian text', () => {
    const preset = editionCoverPresets('poland-memory').presets[0];
    expect(coverPresetLabel(preset, 'pl')).toEqual({text: preset.translations.pl, lang: 'pl'});
    expect(coverPresetLabel(preset, 'be')).toEqual({text: preset.translations.be, lang: 'be'});
    expect(coverPresetLabel(preset, 'ru')).toEqual({text: preset.text, lang: 'ru'});
    expect(coverPresetLabel(legacyCoverPresets.presets[0], 'en')).toEqual({text: legacyCoverPresets.presets[0].text, lang: 'ru'});
  });

  it('builds the edition descriptor in the source script from the same data', () => {
    const result = runNodeCli(['--input-type=module', '-e', `
      import {readFile} from 'node:fs/promises';
      import {editionCoverPresets} from './scripts/books/source-ready-book.mjs';
      const copy = JSON.parse(await readFile('data/travelBooks/cover-copy.json', 'utf8'));
      const descriptor = editionCoverPresets(copy, 'poland-castles-memory');
      let missing; try { editionCoverPresets(copy, 'unknown-memory'); } catch (error) { missing = error.message; }
      console.log(JSON.stringify({descriptor, missing}));
    `]);
    expect(result.status).toBe(0);
    const {descriptor, missing} = JSON.parse(result.stdout);
    expect(descriptor).toEqual(editionCoverPresets('poland-castles-memory'));
    expect(missing).toContain('No approved cover inscriptions');
  });
});

describe('per-edition frame copy and place texts (#2947)', () => {
  it('gives every published edition its own frame copy', () => {
    expect(Object.keys(frame.editions).sort()).toEqual(editionIds);
    for (const slot of ['epigraph', 'subtitle'] as const) expect(new Set(Object.values(frame.editions).map(edition => edition[slot])).size).toBe(editionIds.length);
    for (const slot of ['intro', 'usage', 'outro', 'endpaper'] as const) expect(new Set(Object.values(frame.editions).map(edition => edition[slot].text)).size).toBe(editionIds.length);
  });

  it('keeps rejected clichés, the author-trip retelling and Latin words out of Russian printed copy', () => {
    const texts = printedRussian();
    expect(texts.length).toBeGreaterThan(400);
    expect(texts.filter(({text}) => bannedPhrases(text).length)).toEqual([]);
    expect(texts.filter(({text}) => latinWords(text).length).map(({id, text}) => `${id}: ${latinWords(text).join(',')}`)).toEqual([]);
    expect(bannedPhrases('Путешествие продолжается')).toEqual(['путешествие продолжается']);
    expect(latinWords('В XIX веке, Bobrowisko, QR и MeTravel')).toEqual(['Bobrowisko']);
  });

  it('stores a memory-page prompt for every place without printing it', () => {
    for (const record of [...placeRecords, ...seriesCopy]) expect(record.prompt.trim().length).toBeGreaterThan(10);
  });

  it('writes local names in the script of the place country', () => {
    for (const record of bySource.records) expect({id: record.id, cyrillic: /\p{Script=Cyrillic}/u.test(record.localName), latin: /\p{Script=Latin}/u.test(record.localName)}).toEqual({id: record.id, cyrillic: true, latin: false});
    for (const place of [...plSource.records.map(record => ({id: record.id, localName: record.localName})), ...mountainsKit.places, ...castlesKit.places]) {
      expect({id: place.id, cyrillic: /\p{Script=Cyrillic}/u.test(place.localName), latin: /\p{Script=Latin}/u.test(place.localName)}).toEqual({id: place.id, cyrillic: false, latin: true});
    }
  });
});
