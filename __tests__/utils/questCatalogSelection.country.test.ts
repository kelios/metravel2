/**
 * Выбор всей страны в каталоге квестов живёт в том же слоте, что и город
 * (`openspec/changes/quest-sidebar-country-accordion`, D1): id `__country__:<ISO>`.
 */
import {
    ALL_QUESTS_ID,
    COMPLETED_FILTER_ID,
    parseCountrySelectionId,
    resolveStoredQuestCatalogSelection,
    toCountrySelectionId,
} from '@/utils/questCatalogSelection'

describe('id выбора страны', () => {
    it('собирается из кода и разбирается обратно', () => {
        expect(toCountrySelectionId('BY')).toBe('__country__:BY')
        expect(parseCountrySelectionId(toCountrySelectionId('BY'))).toBe('BY')
    })

    it('код страны нормализуется к верхнему регистру без пробелов', () => {
        expect(toCountrySelectionId(' pl ')).toBe('__country__:PL')
        expect(parseCountrySelectionId('__country__:pl')).toBe('PL')
    })

    it('город и виртуальные срезы страной не считаются', () => {
        expect(parseCountrySelectionId('123')).toBeNull()
        expect(parseCountrySelectionId('minsk')).toBeNull()
        expect(parseCountrySelectionId(ALL_QUESTS_ID)).toBeNull()
        expect(parseCountrySelectionId(COMPLETED_FILTER_ID)).toBeNull()
        expect(parseCountrySelectionId('__country__:')).toBeNull()
        expect(parseCountrySelectionId(null)).toBeNull()
    })

    it('сохранённый выбор страны восстанавливается как есть', () => {
        expect(resolveStoredQuestCatalogSelection('__country__:BY')).toBe('__country__:BY')
    })
})
