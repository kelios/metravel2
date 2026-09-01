const { expectedTravelSlug, describeSlugMismatch } = require('@/scripts/lib/travelSlug')

/**
 * #1690: предсказание слага решает, тронет ли `seo-alias-backfill` живую статью.
 * Поэтому здесь проверяется не «похоже на слаг», а совпадение с бэкендом:
 * все ожидания ниже сняты прогоном python-slugify 8.0.4 из
 * `travels/services/slug_service.py`, а не выведены по памяти.
 */
describe('expectedTravelSlug: зеркало бэкендового slugify', () => {
  it.each([
    ['Усадьба Трабутишки и Голубые озёра: маршрут', 'usadba-trabutishki-i-golubye-ozera-marshrut'],
    ['Лесное озеро Черный Став и Бобровая Заводь', 'lesnoe-ozero-chernyi-stav-i-bobrovaia-zavod'],
    ['Забежув и скалы Юры 1 мая 2025', 'zabezhuv-i-skaly-iury-1-maia-2025'],
    ['Оравский замок над Оравой', 'oravskii-zamok-nad-oravoi'],
    ['Львів і Київ', 'lviv-i-kiiv'],
    ['Мінск, вуліца', 'minsk-vulitsa'],
    ['Ёлки-палки', 'elki-palki'],
    ['ЪЬ тест', 'test'],
    ['Торунь. Форт № 1.', 'torun-fort-no-1'],
    ['Гродненские форты №4 и №6: пещеры и скалы', 'grodnenskie-forty-no4-i-no6-peshchery-i-skaly'],
    ['кафе «Уют»', 'kafe-uiut'],
    ['Hôtel Élysée', 'hotel-elysee'],
    ['Ćma i żółw', 'cma-i-zolw'],
    ['Straße Köln', 'strasse-koln'],
    ['Travel: 100% лето', 'travel-100-leto'],
    ['под_чертой', 'pod-chertoi'],
    ['  край  ', 'krai'],
    ['a--b', 'a-b'],
  ])('%s → %s', (name, slug) => {
    expect(expectedTravelSlug(name)).toBe(slug)
  })

  // Апостроф в ASCII разделяет слова, а типографский исчезает без следа —
  // разница видна только на самой библиотеке, поэтому она и зафиксирована.
  it('различает ASCII-апостроф и типографский', () => {
    expect(expectedTravelSlug("O'Hara")).toBe('o-hara')
    expect(expectedTravelSlug('O’Hara')).toBe('ohara')
  })

  // Ошибка в сторону «не знаю» стоит пропущенного алиаса, ошибка в другую
  // сторону — канонического адреса живой статьи. Поэтому неизвестное = null.
  it.each([['emoji 🚀 тест'], ['Σοφία'], ['东京'], ['стрелка → вправо'], ['©'], ['   '], ['']])(
    'отказывается предсказывать «%s»',
    (name) => {
      expect(expectedTravelSlug(name)).toBeNull()
    }
  )
})

describe('describeSlugMismatch: повод отказаться от прогона', () => {
  it('молчит, когда заголовок даёт ровно текущий слаг', () => {
    expect(
      describeSlugMismatch('Усадьба Трабутишки и Голубые озёра: маршрут', 'usadba-trabutishki-i-golubye-ozera-marshrut')
    ).toBeNull()
  })

  it('называет коллизионный суффикс отдельно — владельцу от него нужно другое решение', () => {
    const mismatch = describeSlugMismatch('Оравский замок над Оравой', 'oravskii-zamok-nad-oravoi-1')

    expect(mismatch.expected).toBe('oravskii-zamok-nad-oravoi')
    expect(mismatch.reason).toContain('коллизионным суффиксом')
  })

  it('на живом случае travel 404 печатает оба слага', () => {
    const mismatch = describeSlugMismatch(
      'Лесное озеро Черный Став и Бобровая Заводь',
      'lesnoe-ozero-chernyy-stav-i-bobrovyy-basseyn'
    )

    expect(mismatch.expected).toBe('lesnoe-ozero-chernyi-stav-i-bobrovaia-zavod')
    expect(mismatch.reason).toContain('lesnoe-ozero-chernyy-stav-i-bobrovyy-basseyn')
    expect(mismatch.reason).toContain('канонический адрес')
  })

  it('непредсказуемый заголовок — тоже отказ, а не молчаливое согласие', () => {
    expect(describeSlugMismatch('emoji 🚀 тест', 'emoji-test').reason).toContain('предсказать нечем')
  })
})
