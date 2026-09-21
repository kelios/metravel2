/**
 * Страны сайдбара каталога квестов (`openspec/specs/quest-catalog-sidebar/spec.md`):
 * группы, выбор всей страны и раскрытие по умолчанию.
 */
import { act, renderHook } from '@testing-library/react-native'

import {
    groupQuestCitiesByCountry,
    resolveQuestCountrySelection,
    useQuestCountrySelection,
} from '@/screens/tabs/useQuestCountrySelection'

type Quest = { id: string }

const CITIES = [
    { id: '10', name: 'Краков', countryCode: 'PL' },
    { id: '1', name: 'Минск', countryCode: 'BY' },
    { id: '2', name: 'Брест', countryCode: 'BY' },
    { id: '30', name: 'Безымянный' },
    { id: '20', name: 'Вена', countryCode: 'AT' },
]

const QUESTS_BY_CITY: Record<string, Quest[]> = {
    '1': [{ id: 'minsk-a' }, { id: 'minsk-b' }],
    '2': [{ id: 'brest-a' }],
    '10': [{ id: 'krakow-a' }],
    '20': [{ id: 'vienna-a' }],
    '30': [{ id: 'nowhere-a' }],
}

describe('groupQuestCitiesByCountry', () => {
    it('Беларусь первой, дальше по алфавиту, города без страны — в конце', () => {
        const groups = groupQuestCitiesByCountry(CITIES)
        expect(groups.map((group) => group.code)).toEqual(['BY', 'AT', 'PL', 'OTHER'])
        expect(groups[0].cities.map((city) => city.name)).toEqual(['Брест', 'Минск'])
        expect(groups[groups.length - 1].name).toBe('')
    })
})

describe('resolveQuestCountrySelection', () => {
    const groups = groupQuestCitiesByCountry(CITIES)

    it('вся страна — квесты всех её городов, столько же, сколько сумма счётчиков', () => {
        const selection = resolveQuestCountrySelection('__country__:BY', groups, QUESTS_BY_CITY)
        expect(selection.activeCountryCode).toBe('BY')
        expect(selection.selectedCountry?.name).toBe(groups[0].name)
        expect(selection.selectedCountry?.quests.map((quest) => quest.id).sort()).toEqual(['brest-a', 'minsk-a', 'minsk-b'])
    })

    it('город раскрывает свою страну, но страной целиком не считается', () => {
        const selection = resolveQuestCountrySelection('10', groups, QUESTS_BY_CITY)
        expect(selection).toEqual({ activeCountryCode: 'PL', selectedCountry: null })
    })

    it('страны нет в каталоге или в ней нет квестов — выбора нет', () => {
        expect(resolveQuestCountrySelection('__country__:FR', groups, QUESTS_BY_CITY))
            .toEqual({ activeCountryCode: null, selectedCountry: null })
        expect(resolveQuestCountrySelection('__country__:BY', groups, {}))
            .toEqual({ activeCountryCode: 'BY', selectedCountry: null })
    })

    it('сборная группа без кода страны целиком не выбирается', () => {
        expect(resolveQuestCountrySelection('__country__:OTHER', groups, QUESTS_BY_CITY))
            .toEqual({ activeCountryCode: null, selectedCountry: null })
    })

    it('виртуальный срез не принадлежит ни одной стране', () => {
        expect(resolveQuestCountrySelection('__all__', groups, QUESTS_BY_CITY))
            .toEqual({ activeCountryCode: null, selectedCountry: null })
    })
})

describe('useQuestCountrySelection — раскрытие', () => {
    it('по умолчанию все страны свёрнуты', () => {
        const { result } = renderHook(() => useQuestCountrySelection('__all__', CITIES, QUESTS_BY_CITY))
        expect(Object.values(result.current.collapsedCountryCodes).every(Boolean)).toBe(true)
        expect(result.current.areAllCountryGroupsCollapsed).toBe(true)
    })

    it('страна активного выбора раскрыта, а свернуть её снова можно', () => {
        const { result } = renderHook(() => useQuestCountrySelection('1', CITIES, QUESTS_BY_CITY))
        expect(result.current.collapsedCountryCodes.BY).toBe(false)
        expect(result.current.collapsedCountryCodes.PL).toBe(true)

        act(() => result.current.toggleCountryGroup('BY'))
        expect(result.current.collapsedCountryCodes.BY).toBe(true)
    })

    it('выбор, восстановленный до загрузки каталога, раскрывает свою страну, когда каталог пришёл', () => {
        const { result, rerender } = renderHook(
            ({ cities, questsByCityId }: { cities: typeof CITIES; questsByCityId: Record<string, Quest[]> }) =>
                useQuestCountrySelection('__country__:BY', cities, questsByCityId),
            { initialProps: { cities: [] as typeof CITIES, questsByCityId: {} as Record<string, Quest[]> } },
        )
        expect(result.current.activeCountryCode).toBeNull()

        rerender({ cities: CITIES, questsByCityId: QUESTS_BY_CITY })
        expect(result.current.collapsedCountryCodes.BY).toBe(false)
        expect(result.current.collapsedCountryCodes.PL).toBe(true)
    })

    it('свёрнутая вручную страна выбора не раскрывается снова от обновления каталога', () => {
        const { result, rerender } = renderHook(
            ({ cities, questsByCityId }: { cities: typeof CITIES; questsByCityId: Record<string, Quest[]> }) =>
                useQuestCountrySelection('1', cities, questsByCityId),
            { initialProps: { cities: CITIES, questsByCityId: QUESTS_BY_CITY } },
        )
        act(() => result.current.toggleCountryGroup('BY'))
        expect(result.current.collapsedCountryCodes.BY).toBe(true)

        // Рефетч отдаёт тот же каталог новыми ссылками — выбор при этом не менялся.
        rerender({ cities: CITIES.map((city) => ({ ...city })), questsByCityId: { ...QUESTS_BY_CITY } })
        expect(result.current.activeCountryCode).toBe('BY')
        expect(result.current.collapsedCountryCodes.BY).toBe(true)
    })

    it('смена выбора на другую страну раскрывает и её', () => {
        const { result, rerender } = renderHook(
            ({ selectedId }: { selectedId: string }) => useQuestCountrySelection(selectedId, CITIES, QUESTS_BY_CITY),
            { initialProps: { selectedId: '1' } },
        )
        rerender({ selectedId: '__country__:PL' })
        expect(result.current.collapsedCountryCodes.PL).toBe(false)
        expect(result.current.selectedCountry?.code).toBe('PL')
    })

    it('«Развернуть все» раскрывает все страны, повторно — сворачивает', () => {
        const { result } = renderHook(() => useQuestCountrySelection('__all__', CITIES, QUESTS_BY_CITY))
        act(() => result.current.toggleAllCountryGroups())
        expect(Object.values(result.current.collapsedCountryCodes).some(Boolean)).toBe(false)
        act(() => result.current.toggleAllCountryGroups())
        expect(result.current.areAllCountryGroupsCollapsed).toBe(true)
    })
})
