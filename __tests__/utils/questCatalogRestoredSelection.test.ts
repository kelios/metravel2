/**
 * #2320: сохранённый срез каталога квестов применяется к первому кадру
 * синхронным скриптом головы (класс на <html>) — тем же предикатом, по которому
 * экран прячет SEO-вводку.
 */
import fs from 'fs'
import path from 'path'

import {
  ALL_QUESTS_ID,
  BIKE_FILTER_ID,
  NEARBY_ID,
  QUEST_CATALOG_RESTORED_CLASS,
  REVIEWED_FILTER_ID,
  STORAGE_SELECTED_CITY,
  getQuestCatalogRestoredSelectionCss,
  getQuestCatalogRestoredSelectionScript,
  isNarrowingStoredQuestCatalogSelection,
  releaseQuestCatalogRestoredClass,
  toCountrySelectionId,
} from '@/utils/questCatalogSelection'

const runHeadScript = (pathname: string, saved: string | null) => {
  document.documentElement.className = ''
  window.history.replaceState({}, '', pathname)
  window.localStorage.clear()
  if (saved !== null) window.localStorage.setItem(STORAGE_SELECTED_CITY, saved)
  new Function(getQuestCatalogRestoredSelectionScript())()
  return document.documentElement.classList.contains(QUEST_CATALOG_RESTORED_CLASS)
}

describe('сохранённый срез каталога квестов до первого кадра (#2320)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    window.localStorage.clear()
    document.documentElement.className = ''
  })

  it.each([
    [REVIEWED_FILTER_ID, true],
    [BIKE_FILTER_ID, true],
    ['42', true],
    [toCountrySelectionId('by'), true],
    [ALL_QUESTS_ID, false],
    [NEARBY_ID, false],
    [null, false],
  ])('срез %s → класс %s, как предикат экрана', (saved, expected) => {
    expect(isNarrowingStoredQuestCatalogSelection(saved)).toBe(expected)
    expect(runHeadScript('/quests', saved)).toBe(expected)
    expect(runHeadScript('/quests/', saved)).toBe(expected)
  })

  it('только на самом каталоге: город, квест и другие страницы класс не получают', () => {
    expect(runHeadScript('/quests/minsk', REVIEWED_FILTER_ID)).toBe(false)
    expect(runHeadScript('/', REVIEWED_FILTER_ID)).toBe(false)
  })

  it('CSS прячет оба слота SEO-текста только под классом; экран снимает класс', () => {
    expect(getQuestCatalogRestoredSelectionCss()).toBe(
      `html.${QUEST_CATALOG_RESTORED_CLASS} [data-quests-seo-slot]{display:none!important}`,
    )
    runHeadScript('/quests', REVIEWED_FILTER_ID)
    releaseQuestCatalogRestoredClass()
    expect(document.documentElement.classList.contains(QUEST_CATALOG_RESTORED_CLASS)).toBe(false)
  })

  it('голова страницы подключает скрипт и CSS, слоты вводки помечены', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
    expect(html).toContain('getQuestCatalogRestoredSelectionScript()')
    expect(html).toContain('getQuestCatalogRestoredSelectionCss()')
    const panel = fs.readFileSync(path.resolve(process.cwd(), 'screens/tabs/QuestsContentPanel.tsx'), 'utf8')
    expect(panel).toContain("webDataSetProps({ questsSeoSlot: 'intro' })")
    expect(panel).toContain("webDataSetProps({ questsSeoSlot: 'faq' })")
  })
})


describe('explicit theme first-frame priority (#2403)', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 15, 12)); });
  afterEach(() => { jest.useRealTimers(); document.documentElement.className = ''; });
  it.each(['unknown', '', 'halloween&theme=detective'])('invalid %s ignores saved narrowing city', (value) => {
    expect(runHeadScript(`/quests?theme=${value}`, 'minsk')).toBe(false);
  });
  it('active normalized URL narrows even when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(runHeadScript('/quests?theme=%20HALLOWEEN%20', null)).toBe(true);
    jest.restoreAllMocks();
  });
  it('uses the same civil calendar at both active boundaries and natural off-season', () => {
    for (const [date, active] of [[new Date(2026, 9, 14), false], [new Date(2026, 9, 15), true], [new Date(2026, 10, 1), true], [new Date(2026, 10, 2), false]] as const) {
      jest.setSystemTime(date);
      expect(runHeadScript('/quests?theme=halloween', 'minsk')).toBe(active);
    }
  });
});
