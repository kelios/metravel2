/**
 * #1643: `Intl.*` конструкторы резолвят данные локали заново на каждый вызов.
 * Пооперационный прод-замер показал, что дорог только ПЕРВЫЙ конструктор на
 * странице (разогрев ICU), поэтому пул — не рычаг TBT, а устранение лишней
 * работы на экранах со списками. Форматтеры пулятся внутри `i18n/format`.
 *
 * Пул намеренно не имеет публичного API — проверяем наблюдаемое поведение:
 * сколько раз реально позван конструктор `Intl` и не поехал ли при этом вывод.
 * Каждый кейс грузит модуль заново (`jest.isolateModules`), поэтому кэш
 * стартует пустым и тесты не зависят от порядка.
 */

type FormatModule = typeof import('@/i18n/format')

type IntlConstructorName = 'NumberFormat' | 'DateTimeFormat' | 'PluralRules' | 'Collator'

type CountedRun = {
  format: FormatModule
  counts: Record<IntlConstructorName, number>
}

const COUNTED: IntlConstructorName[] = ['NumberFormat', 'DateTimeFormat', 'PluralRules', 'Collator']

/**
 * Считает вызовы конструкторов `Intl` внутри одного свежего экземпляра модуля.
 * Подмена — `Proxy` с ловушкой `construct` поверх настоящего конструктора:
 * прототип, `.format()` и вызов без `new` остаются родными (мок jest'а тут не
 * годится — `new` вернул бы объект с чужим прототипом).
 */
const withCountedIntl = (run: (ctx: CountedRun) => void): void => {
  const counts = { NumberFormat: 0, DateTimeFormat: 0, PluralRules: 0, Collator: 0 }
  const originals = new Map<IntlConstructorName, PropertyDescriptor | undefined>()

  for (const name of COUNTED) {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, name)
    originals.set(name, descriptor)
    const Original = (Intl as unknown as Record<string, unknown>)[name]
    if (typeof Original !== 'function') continue
    const Counted = new Proxy(Original as (...args: unknown[]) => unknown, {
      construct(target, args, newTarget) {
        counts[name] += 1
        return Reflect.construct(target as never, args, newTarget as never)
      },
    })
    Object.defineProperty(Intl, name, { configurable: true, writable: true, value: Counted })
  }

  try {
    jest.isolateModules(() => {
      const format: FormatModule = require('@/i18n/format')
      run({ format, counts })
    })
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(Intl, name, descriptor)
      else Reflect.deleteProperty(Intl, name)
    }
  }
}

describe('Intl formatter pool (#1643)', () => {
  it('builds one Intl.NumberFormat for repeated calls with the same locale and options', () => {
    withCountedIntl(({ format, counts }) => {
      for (let index = 0; index < 25; index += 1) {
        format.formatInteger(index, 'ru')
      }
      expect(counts.NumberFormat).toBe(1)
    })
  })

  it('keys options by value, not by property order', () => {
    withCountedIntl(({ format, counts }) => {
      // `formatCompactNumber` собирает опции спредом (`{ notation, ...options }`),
      // поэтому один и тот же набор полей приходит в разном порядке.
      format.formatNumber(1, { notation: 'compact', maximumFractionDigits: 1 }, 'ru')
      format.formatNumber(2, { maximumFractionDigits: 1, notation: 'compact' }, 'ru')
      expect(counts.NumberFormat).toBe(1)
    })
  })

  it('never serves one locale or option set from another entry', () => {
    withCountedIntl(({ format, counts }) => {
      expect(format.formatInteger(1234, 'ru')).not.toBe(format.formatInteger(1234, 'en'))
      // ru + en, затем третий конструктор на другой набор опций.
      expect(counts.NumberFormat).toBe(2)
      format.formatNumber(1234.5, { style: 'currency', currency: 'EUR' }, 'ru')
      expect(counts.NumberFormat).toBe(3)
    })
  })

  it('pools Intl.DateTimeFormat, Intl.Collator and Intl.PluralRules the same way', () => {
    withCountedIntl(({ format, counts }) => {
      const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' }
      format.formatDate(Date.UTC(2026, 7, 30), options, 'ru')
      format.formatDate(Date.UTC(2026, 7, 31), options, 'ru')
      expect(counts.DateTimeFormat).toBe(1)

      format.createCollator({}, 'ru').compare('а', 'б')
      format.createCollator({}, 'ru').compare('б', 'а')
      expect(counts.Collator).toBe(1)

      const forms = { one: 'место', few: 'места', many: 'мест', other: 'места' }
      format.selectPlural(1, forms, 'ru')
      format.selectPlural(5, forms, 'ru')
      expect(counts.PluralRules).toBe(1)
    })
  })

  it('produces exactly what a freshly constructed formatter would', () => {
    withCountedIntl(({ format }) => {
      const tag = format.getFormatLocale('ru')

      const currency: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR' }
      expect(format.formatNumber(1234.5, currency, 'ru')).toBe(
        new Intl.NumberFormat(tag, currency).format(1234.5),
      )

      const value = Date.UTC(2026, 7, 30)
      const dateOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' }
      expect(format.formatDate(value, dateOptions, 'ru')).toBe(
        new Intl.DateTimeFormat(tag, dateOptions).format(new Date(value)),
      )

      expect(format.formatCompactNumber(1500, {}, 'ru')).toBe(
        new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 }).format(1500),
      )
      expect(format.formatCompactNumber(999, {}, 'ru')).toBe(
        new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(999),
      )
    })
  })

  it('stays correct after the pool overflows and clears', () => {
    withCountedIntl(({ format }) => {
      // Лимит — страховка от call site, который генерирует опции динамически.
      // Переполнение обязано ронять только кэш, не корректность.
      for (let index = 0; index < 200; index += 1) {
        format.formatNumber(index, { minimumIntegerDigits: (index % 20) + 1 }, 'ru')
      }
      const tag = format.getFormatLocale('ru')
      const currency: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR' }
      expect(format.formatNumber(1234.5, currency, 'ru')).toBe(
        new Intl.NumberFormat(tag, currency).format(1234.5),
      )
    })
  })

  it('keeps plural selection per locale after pooling Intl.PluralRules', () => {
    withCountedIntl(({ format }) => {
      const forms = { one: 'место', few: 'места', many: 'мест', other: 'места' }
      expect(format.selectPlural(1, forms, 'ru')).toBe('место')
      expect(format.selectPlural(3, forms, 'ru')).toBe('места')
      expect(format.selectPlural(5, forms, 'ru')).toBe('мест')
      // Повтор после чужой локали: пул ключуется языковым тегом, а не последним вызовом.
      expect(format.selectPlural(1, { one: 'place', other: 'places' }, 'en')).toBe('place')
      expect(format.selectPlural(5, forms, 'ru')).toBe('мест')
    })
  })
})
