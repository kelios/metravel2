import coverCopy from '../../../../data/travelBooks/cover-copy.json';

type SourcePreset = {id: string; text: {ru: string; be: string; uk: string; pl: string; en: string}};
type SourceEdition = {defaultPresetId: string; presets: SourcePreset[]};
const editions = coverCopy.editions as Record<string, SourceEdition>;

/** Published v2 preset shape, as scripts/books/source-ready-book.mjs builds it from data (#2946). */
export function editionCoverPresets(bookId = 'belarus-memory') {
  const edition = editions[bookId] ?? editions['belarus-memory'];
  return {
    schemaVersion: 2 as const, maxCharacters: 120 as const, defaultPresetId: edition.defaultPresetId,
    presets: edition.presets.map(({id, text: {ru, ...translations}}) => ({id, text: ru, translations})),
  };
}

/** The two shared inscriptions of every revision published before 02.11.2026. */
export const legacyCoverPresets = {
  schemaVersion: 1 as const, maxCharacters: 120 as const, defaultPresetId: 'home-memories' as const,
  presets: [
    {id: 'home-memories' as const, text: 'Хорошо, когда есть куда вернуться. Прекрасно, когда есть что вспомнить'},
    {id: 'world-memories' as const, text: 'Однажды мы выйдем за порог — и принесём домой целый мир воспоминаний'},
  ],
};
