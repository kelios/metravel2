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

  // Регистр решает: конвейер транслитерирует ДО lower(), а `unidecode('Є')`
  // даёт `E` против `ie` у строчной. Свип по всему кириллическому блоку в обоих
  // регистрах нашёл ровно одну такую асимметрию — она и закреплена здесь.
  it.each([
    ['Тур ЄС', 'tur-es'],
    ['Свято Єднання', 'sviato-ednannia'],
    ['ЄВРОПА', 'evropa'],
    ['Єдність', 'ednist'],
    ['єдність', 'iednist'],
  ])('заглавная Є транслитерируется не как строчная: %s → %s', (name, slug) => {
    expect(expectedTravelSlug(name)).toBe(slug)
  })

  // Собственные шаги python-slugify помимо транслитерации: запятая между
  // цифрами исчезает, диакритика снимается, невидимки ведут себя по-разному.
  it.each([
    ['Тур 1,5 часа', 'tur-15-chasa'],
    ['Маршрут 1,500 км', 'marshrut-1500-km'],
    ['café', 'cafe'],
    ['naïve café', 'naive-cafe'],
    ['a\u200bb', 'a-b'],
    ['a\ufeffb', 'ab'],
    ['a\u00adb', 'ab'],
  ])('шаги конвейера помимо транслитерации: %s → %s', (name, slug) => {
    expect(expectedTravelSlug(name)).toBe(slug)
  })

  // Тире — список, а не категория `\p{Pd}`: перебор всех 44 символов
  // `\p{Zs} ∪ \p{Pd}` через саму библиотеку дал 40 разделителей и ровно эти
  // четыре, которые unidecode УДАЛЯЕТ.
  //
  // Что эти строки запирают, а что нет: они закрепляют СОСТАВ `DROPPED` —
  // удаление любого из четырёх роняет ровно четыре теста. Возврат `SEPARATOR`
  // к категории они НЕ ловят и поймать не могут: `DROPPED` спрашивается раньше,
  // поэтому на сегодняшних кодпоинтах обе модели ведут себя одинаково. Смысл
  // инверсии — в символе, которого ещё нет; за ним следит проверка ниже.
  it.each([
    ['a\u05beb', 'ab'],
    ['a\u1806b', 'ab'],
    ['a\u{10d6e}b', 'ab'],
    ['a\u{10ead}b', 'ab'],
    ['a\u2013b', 'a-b'],
    ['a\u2014b', 'a-b'],
    ['a\uff0db', 'a-b'],
  ])('тире, которое удаляется, против тире-разделителя: %s → %s', (name, slug) => {
    expect(expectedTravelSlug(name)).toBe(slug)
  })

  // Единственный наблюдаемый сегодня эффект инверсии `SEPARATOR`: список обязан
  // покрывать ВЕСЬ `\p{Zs} ∪ \p{Pd}` рантайма. Список снят с ICU конкретной ноды
  // и молча устаревает — новый дефис Юникода уедет в отказ, и никто об этом не
  // узнает. Апгрейд ноды красит этот тест и говорит: пересними свип по библиотеке.
  it('классифицирует каждый пробел и тире текущего рантайма', () => {
    const unclassified: string[] = []
    for (let cp = 0; cp <= 0x10ffff; cp += 1) {
      const char = String.fromCodePoint(cp)
      if (!/[\p{Zs}\p{Pd}]/u.test(char)) continue
      // Разделитель даёт `a-b`, удаляемый знак — `ab`; `null` значит «не знаю».
      if (expectedTravelSlug(`a${char}b`) === null) unclassified.push(`U+${cp.toString(16).toUpperCase()}`)
    }

    expect(unclassified).toEqual([])
  })

  // Апостроф в ASCII разделяет слова, а типографский исчезает без следа —
  // разница видна только на самой библиотеке, поэтому она и зафиксирована.
  it('различает ASCII-апостроф и типографский', () => {
    expect(expectedTravelSlug("O'Hara")).toBe('o-hara')
    expect(expectedTravelSlug('O’Hara')).toBe('ohara')
  })

  // Ошибка в сторону «не знаю» стоит пропущенного алиаса, ошибка в другую
  // сторону — канонического адреса живой статьи. Поэтому неизвестное = null.
  it.each([
    ['emoji 🚀 тест'],
    ['Σοφία'],
    ['东京'],
    ['стрелка → вправо'],
    ['©'],
    ['   '],
    [''],
    // HTML-сущность бэкенд раскрывает и гонит через unidecode заново.
    ['Море &amp; горы'],
    ['Дом &#8470;5'],
    ['x &#x2014; y'],
    // Комбинирующий знак вне снимаемых диапазонов: U+0489 разворачивается
    // в «1 000 000», а U+0350 — в разделитель. Огульное снятие \p{M} врало бы.
    ['a\u0489b'],
    ['a\u0350b'],
  ])('отказывается предсказывать «%s»', (name) => {
    expect(expectedTravelSlug(name)).toBeNull()
  })
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
