// #3228: каталог квестов — сначала страна посетителя, затем ближайшие.
import {
    resolveQuestVisitorOrigin,
    resolveTimeZoneOrigin,
    sortQuestsByVisitorOrigin,
} from '@/utils/questVisitorOrder'

const q = (id: string, countryCode: string | undefined, lat: number, lng: number) => ({ id, countryCode, lat, lng })

// Порядок каталога с прода 09.11.2026: по номерам городов, Краков первым.
const catalog = [
    q('krakow', 'PL', 50.06, 19.94),
    q('barkovshchina', 'BY', 55.4, 27.9),
    q('minsk', 'BY', 53.9, 27.56),
    q('yerevan', 'AM', 40.18, 44.51),
    q('warsaw', 'PL', 52.23, 21.01),
    q('vilnius', 'LT', 54.69, 25.28),
    q('grodno', 'BY', 53.68, 23.83),
    q('nowhere', 'BY', Number.NaN, Number.NaN),
]
const ids = (list: { id: string }[]) => list.map((item) => item.id)

describe('resolveQuestVisitorOrigin', () => {
    it('пояс устройства даёт страну и опорный город', () => {
        expect(resolveTimeZoneOrigin('Europe/Minsk')).toEqual({ source: 'timezone', countryCode: 'BY', lat: 53.9, lng: 27.56 })
        expect(resolveTimeZoneOrigin('Europe/Warsaw')?.countryCode).toBe('PL')
    })

    it('без сигнала порядок не меняется: неизвестный пояс и его отсутствие — null', () => {
        expect(resolveQuestVisitorOrigin(null, 'America/Bogota')).toBeNull()
        expect(resolveQuestVisitorOrigin(null, null)).toBeNull()
    })

    it('известная позиция посетителя важнее пояса', () => {
        expect(resolveQuestVisitorOrigin({ lat: 52.1, lng: 23.7 }, 'Europe/Minsk'))
            .toEqual({ source: 'location', countryCode: null, lat: 52.1, lng: 23.7 })
    })
})

describe('sortQuestsByVisitorOrigin', () => {
    it('гость из Беларуси: белорусские квесты первыми, ближние к Минску раньше, без координат — в конце своей части', () => {
        const origin = resolveTimeZoneOrigin('Europe/Minsk')!
        expect(ids(sortQuestsByVisitorOrigin(catalog, origin))).toEqual([
            'minsk', 'barkovshchina', 'grodno', 'nowhere', 'vilnius', 'warsaw', 'krakow', 'yerevan',
        ])
    })

    it('гость из Польши: польские первыми, затем ближайшие соседи', () => {
        const origin = resolveTimeZoneOrigin('Europe/Warsaw')!
        expect(ids(sortQuestsByVisitorOrigin(catalog, origin)).slice(0, 4)).toEqual(['warsaw', 'krakow', 'grodno', 'vilnius'])
    })

    it('точная позиция: чистое расстояние без деления по странам', () => {
        const brest = resolveQuestVisitorOrigin({ lat: 52.1, lng: 23.7 }, null)!
        expect(ids(sortQuestsByVisitorOrigin(catalog, brest)).slice(0, 3)).toEqual(['grodno', 'warsaw', 'vilnius'])
    })

    it('не меняет входной массив', () => {
        const copy = catalog.slice()
        sortQuestsByVisitorOrigin(catalog, resolveTimeZoneOrigin('Europe/Minsk')!)
        expect(catalog).toEqual(copy)
    })
})
