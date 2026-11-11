import { admitsNoAnswer, echoesQuestion, extractNumberFacts, guardAnswer, leaksPrompt } from '@/api/aiAssist/answerGuard'
import { enforceSourceLinks, guardStreamingText, isSameTitle, stripThinking } from '@/api/aiAssist/linkGuard'
import { questFactsLine, travelFactsLine } from '@/api/aiAssist/sourceFacts'
import type { AiSource } from '@/api/aiAssist/types'

const sources: AiSource[] = [
  {
    type: 'travel',
    source_id: '1',
    title: 'Выходные под Гродно',
    url: 'https://metravel.by/travels/vyhodnye-pod-grodno',
    path: '/travels/vyhodnye-pod-grodno',
    snippet: '',
    score: 1,
  },
  {
    type: 'quest',
    source_id: 'q1',
    title: 'Квест по Гродно',
    url: 'https://metravel.by/quests/grodno/kvest-po-grodno',
    path: '/quests/grodno/kvest-po-grodno',
    snippet: '',
    score: 1,
  },
]

describe('aiAssist linkGuard (#2460)', () => {
  it('ссылки карточек проходят, в том числе с хвостовой пунктуацией', () => {
    const text = 'Смотрите статью https://metravel.by/travels/vyhodnye-pod-grodno. И квест: https://metravel.by/quests/grodno/kvest-po-grodno!'
    const result = enforceSourceLinks(text, sources)
    expect(result.removed).toBe(0)
    expect(result.text).toBe(text)
  })

  it('выдуманный адрес на metravel.by и внешний сайт вырезаются, счётчик растёт', () => {
    const text =
      'Рекомендую https://metravel.by/travels/nesushchestvuyushchaya-statya и ещё metravel.by/quests/minsk/fake, ' +
      'подробнее на https://wikipedia.org/wiki/Grodno. Настоящая: https://metravel.by/travels/vyhodnye-pod-grodno'
    const result = enforceSourceLinks(text, sources)
    expect(result.removed).toBe(3)
    expect(result.text).not.toContain('nesushchestvuyushchaya')
    expect(result.text).not.toContain('fake')
    expect(result.text).not.toContain('wikipedia')
    expect(result.text).toContain('https://metravel.by/travels/vyhodnye-pod-grodno')
  })

  it('markdown-ссылка с чужим адресом превращается в подпись, со своим — остаётся и получает название карточки (#3291)', () => {
    const text = 'Читайте [статью](https://metravel.by/travels/vyhodnye-pod-grodno) и [эту](https://example.com/x).'
    const result = enforceSourceLinks(text, sources)
    expect(result.removed).toBe(1)
    expect(result.relabeled).toBe(1)
    expect(result.text).toBe('Читайте [Выходные под Гродно](https://metravel.by/travels/vyhodnye-pod-grodno) и эту.')
  })

  it('относительные пути сайта тоже проверяются по карточкам', () => {
    const result = enforceSourceLinks('Откройте /travels/vyhodnye-pod-grodno и /travels/pridumano.', sources)
    expect(result.removed).toBe(1)
    expect(result.text).toContain('/travels/vyhodnye-pod-grodno')
    expect(result.text).not.toContain('pridumano')
  })

  it('без карточек из ответа исчезает любой адрес', () => {
    const result = enforceSourceLinks('Вот: https://metravel.by/travels/abc и https://metravel.by', [])
    expect(result.removed).toBe(2)
    expect(result.text).toBe('Вот: и')
  })

  it('название сайта без пути остаётся текстом: фраза отказа «не по теме» не ломается (#2711)', () => {
    const refusal = 'Я ассистент metravel.by по путешествиям, а www.metravel.by/travels/pridumano — нет.'
    expect(enforceSourceLinks(refusal, sources)).toEqual({ text: 'Я ассистент metravel.by по путешествиям, а — нет.', removed: 1, relabeled: 0 })
  })

  it('после вырезания не остаётся висящего тире и заглушек модели (#2710)', () => {
    const raw = 'Стартуйте с истории — https://evil.example/x\nОтель в Кракове — https://booking.com/h.\nСм. __draft_placeholder__ путеводитель.'
    expect(enforceSourceLinks(raw, sources)).toEqual({ text: 'Стартуйте с истории\nОтель в Кракове\nСм. путеводитель.', removed: 2, relabeled: 0 })
  })

  it('ссылка с искажённым адресом, но точным названием карточки получает адрес карточки (#2710)', () => {
    const title = sources[0].title
    const raw = `Начните с [${title}](https://metravel.by/travels/iskazhennyi-adres) и [чужого](https://metravel.by/travels/net)`
    expect(enforceSourceLinks(raw, sources)).toEqual({ text: `Начните с [${title}](${sources[0].url}) и чужого`, removed: 1, relabeled: 0 })
  })

  it('служебные <think> блоки снимаются, незакрытый — целиком', () => {
    expect(stripThinking('<think>размышляю</think>Ответ')).toBe('Ответ')
    expect(stripThinking('<think>ещё думаю')).toBe('')
    expect(enforceSourceLinks('<think>https://evil.example</think>Готово', sources)).toEqual({ text: 'Готово', removed: 0, relabeled: 0 })
  })
})

// #3291: адрес настоящий, а подпись выдумана или искажена — проба пути службы 11.11.2026 (p04, p14).
describe('страж ссылок: подпись равна названию карточки (#3291)', () => {
  it('выдуманная, искажённая, сокращённая и пустая подпись заменяются названием; счётчик растёт', () => {
    const url = sources[1].url
    for (const label of ['Городной квест по Гродно', 'Семейный городской квест по Гродно', 'Квест', 'здесь', '']) {
      expect(enforceSourceLinks(`- [${label}](${url}) — 9 точек`, sources)).toEqual({ text: `- [Квест по Гродно](${url}) — 9 точек`, removed: 0, relabeled: 1 })
    }
    // Относительный адрес карточки — та же карточка.
    expect(enforceSourceLinks('[маршрут](/travels/vyhodnye-pod-grodno)', sources).text).toBe('[Выходные под Гродно](/travels/vyhodnye-pod-grodno)')
  })

  it('подпись с названием карточки не трогается: регистр, кавычки, выделение и точка в конце названия не меняют', () => {
    const url = sources[1].url
    for (const label of ['Квест по Гродно', 'квест по гродно', '«Квест по Гродно»', '**Квест по Гродно**', 'Квест по Гродно.']) {
      const text = `Пройдите [${label}](${url}) вечером`
      expect(enforceSourceLinks(text, sources)).toEqual({ text, removed: 0, relabeled: 0 })
    }
    expect(isSameTitle('Несвижский замок Радзивиллов.', 'Несвижский замок Радзивиллов')).toBe(true)
    expect(isSameTitle('Квест по Тракторному посёлку', 'Квест по Тракторному посёлку в Минске')).toBe(false)
  })

  it('название с квадратными скобками не ломает разметку; в стриме подпись исправляется сразу', () => {
    const card: AiSource = { ...sources[0], title: 'Гродно [часть 1]: замки' }
    expect(enforceSourceLinks(`[Гродно](${card.url})`, [card]).text).toBe(`[Гродно (часть 1): замки](${card.url})`)
    expect(guardStreamingText(`Смотрите [Минск в кадре](${sources[0].url}) и `, sources)).toEqual({
      text: `Смотрите [Выходные под Гродно](${sources[0].url}) и`,
      removed: 0,
      relabeled: 1,
    })
  })
})

const card = (type: AiSource['type'], id: string, title: string, slug: string, snippet: string): AiSource => ({
  type,
  source_id: id,
  title,
  url: `https://metravel.by/${type === 'quest' ? 'quests' : 'travels'}/${slug}`,
  path: `/${type === 'quest' ? 'quests' : 'travels'}/${slug}`,
  snippet,
  score: 1,
})

// Карточки собираются тем же построителем строки фактов, что в продукте (#3287): страж читает из неё числа.
const cmok = card('quest', '4', 'Квест по центру Минска: в поисках цмока', '4/minsk-cmok', `${questFactsLine({ points: 10, duration_min: 45, difficulty: 'easy' }, { city: 'Минск', country: 'Беларусь' })}. В нашей игре это самый тяжёлый, но и самый необходимый…`)
const dvoriki = card('quest', '28', 'Квест по дворикам Минска: муралы и скульптуры', '4/minsk-dvoriki', questFactsLine({ points: 9, duration_min: 120, difficulty: 'easy', pet_friendly: true }, { city: 'Минск', country: 'Беларусь' }))
const smolevud = card('travel', '186', 'Смолевуд: натурная площадка Беларусьфильма под Минском', 'smolevud-naturnaia-ploshchadka-belarusfilma-pod-minskom', `${travelFactsLine({ number_days: 1, months: [6] }, { city: 'Смолевичи', country: 'Беларусь' })}. Декорации городов и деревень, где снимают кино…`)

describe('страж содержания ответа (#3291)', () => {
  it('p14: выдуманное название и числа у настоящего адреса — подпись заменена, пояснение убрано, ссылка осталась', () => {
    const raw = `Если нужен короткий маршрут с историей — это [Минск в кадре: город, который играл Москву](${smolevud.url}): 9 точек, около 45 минут.`
    const result = guardAnswer(raw, [dvoriki, smolevud, cmok], { question: 'Самый короткий квест в Минске' })
    expect(result.text).toBe(`Если нужен короткий маршрут с историей — это [${smolevud.title}](${smolevud.url}).`)
    expect(result).toMatchObject({ removed: 0, relabeled: 1, droppedDescriptions: 1, ungroundedNumbers: 0, fallback: false })
    expect(result.findings.map((finding) => finding.check)).toEqual(['label_mismatch', 'foreign_description'])
    // Те же числа у своей карточки — пояснение верное и остаётся.
    const own = `Самый короткий — [${cmok.title}](${cmok.url}): 10 точек, около 45 минут.`
    expect(guardAnswer(own, [dvoriki, smolevud, cmok], { question: 'Самый короткий квест в Минске' })).toMatchObject({ text: own, droppedDescriptions: 0, relabeled: 0 })
  })

  it('p15: пояснение — название соседней карточки; убирается у обоих пунктов, список остаётся', () => {
    const abandoned = card('travel', '682', 'Заброшенные усадьбы и замки Беларуси: 38 мест', 'zabroshennye-usadby-i-zamki-belarusi-38-mest', 'Беларусь, Минск. Дней: 2. Подборка мест, куда можно съездить на машине…')
    const krevo = card('travel', '196', 'Веломаршрут за день: Кревский замок и Гольшаны', 'velomarshrut-za-den', 'Беларусь, Крево. Дней: 1. Месяц: май. Стартуем от руин замка…')
    const linovo = card('travel', '233', 'Усадьба «Линово», дворец Потоцких и усадьба Пузынов', 'usadba-linovo', 'Беларусь, Линово. Дней: 1. Три усадьбы за одну поездку…')
    const soveiki = card('travel', '219', 'Веломаршрут к усадьбе Новицких в Совейках', 'velomarshrut-k-usadbe-novitskikh-v-soveikakh', 'Беларусь, Совейки. Дней: 1. Месяц: июнь. Едем по просёлкам к заброшенному дому…')
    const weekend = card('travel', '672', 'Маршруты выходного дня из Минска: 13 поездок', 'marshruty-vykhodnogo-dnia-iz-minska-13-poezdok', 'Беларусь, Минск. Дней: 1. Собрали поездки, которые укладываются в один день…')
    const raw = [
      'За выходные в Беларуси у нас есть такие материалы:',
      `- [${abandoned.title}](${abandoned.url})`,
      `- [${soveiki.title}](${soveiki.url}) — Веломаршрут: Кревский замок и Гольшаны`,
      `- [${weekend.title}](${weekend.url}) — Усадьба «Линово», дворец Потоцких и усадьба Пузынов`,
    ].join('\n')
    const result = guardAnswer(raw, [abandoned, krevo, linovo, soveiki, weekend], { question: 'Какие замки Беларуси можно объехать за выходные?' })
    expect(result.text).toBe(['За выходные в Беларуси у нас есть такие материалы:', `- [${abandoned.title}](${abandoned.url})`, `- [${soveiki.title}](${soveiki.url})`, `- [${weekend.title}](${weekend.url})`].join('\n'))
    expect(result).toMatchObject({ droppedDescriptions: 2, relabeled: 0, fallback: false })
    // Пояснение из своей карточки остаётся; «13 поездок» — число из названия, единица не сверяется.
    const own = `- [${weekend.title}](${weekend.url}) — 13 поездок, которые укладываются в один день`
    expect(guardAnswer(own, [abandoned, krevo, linovo, soveiki, weekend], {}).text).toBe(own)
  })

  it('p18: пояснение называет место соседней карточки («вдоль Припяти и Ипы» у квеста по Каменцу) — убирается', () => {
    const kamenets = card('quest', '89', 'Квест по Каменцу: Белая вежа и великаны', '83/kamenets-white-tower', questFactsLine({ points: 9, duration_min: 100, difficulty: 'easy' }, { city: 'Каменец', country: 'Беларусь' }))
    const river = card('travel', '229', 'Маршрут вдоль рек Припять и Ипа к озеру Березица', 'marshrut-vdol-rek', 'Беларусь, Березица. Дней: 2. Месяц: июль. Сплав и стоянки на берегу…')
    const doroshevichi = card('travel', '132', 'Припять в Дорошевичах: Царь-дуб и палатки', 'pripiat-v-doroshevichakh', 'Беларусь, Дорошевичи. Дней: 2. Что взять с собой и где поесть на маршруте…')
    const raw = [
      'Про это в Беловежской пуще отдельной статьи у нас пока нет, но вот что есть в карточках:',
      `- [${kamenets.title}](${kamenets.url}) — квест с маршрутом вдоль Припяти и Ипы.`,
      `- [${doroshevichi.title}](${doroshevichi.url}) — что взять с собой и где поесть на маршруте.`,
    ].join('\n')
    const result = guardAnswer(raw, [kamenets, river, doroshevichi], { question: 'Где переночевать в Беловежской пуще и что там делать?' })
    expect(result.text).toBe(
      ['Про это в Беловежской пуще отдельной статьи у нас пока нет, но вот что есть в карточках:', `- [${kamenets.title}](${kamenets.url})`, `- [${doroshevichi.title}](${doroshevichi.url}) — что взять с собой и где поесть на маршруте.`].join('\n'),
    )
    expect(result.droppedDescriptions).toBe(1)
    expect(result.findings[0]).toMatchObject({ check: 'foreign_description', detail: expect.stringContaining('Маршрут вдоль рек Припять и Ипа') })
  })

  it('p10: ответ — повтор вопроса без ссылки и без признания: запасной ответ', () => {
    const question = 'Сколько стоит пройти квест?'
    const result = guardAnswer(`${question}\n\nОтвет: Цены в карточках — в отдельных пунктах. Лучшие — в списке источников ниже.`, [cmok, smolevud], { question })
    expect(result.fallback).toBe(true)
    expect(result.findings).toEqual([{ check: 'echo', detail: 'ответ повторяет вопрос посетителя' }])
    expect(echoesQuestion(question, 'сколько стоит пройти квест — решайте сами')).toBe(true)
    expect(echoesQuestion('А в Бресте?', 'А в Бресте есть квест.')).toBe(false)
    expect(echoesQuestion(question, 'Цена в карточках не указана.')).toBe(false)
  })

  it('пустой ответ: без ссылки, признания и подтверждённого числа — запасной; признание, число из карточки и ссылка — ответ', () => {
    const context = { question: 'Сколько длится квест про цмока?' }
    expect(guardAnswer('Выбирайте сами.', [cmok], context).fallback).toBe(true)
    expect(guardAnswer('', [cmok], context).fallback).toBe(true)
    // Всё содержание — фраза с выдуманным числом: после стража текста нет.
    expect(guardAnswer('Квест длится 200 минут.', [cmok], context)).toMatchObject({ text: '', ungroundedNumbers: 1, fallback: true })
    expect(guardAnswer('В карточках цена не указана.', [cmok], context).fallback).toBe(false)
    expect(guardAnswer('В квесте 10 точек, около 45 минут.', [cmok], context)).toMatchObject({ fallback: false, ungroundedNumbers: 0 })
    expect(guardAnswer(`[${cmok.title}](${cmok.url})`, [cmok], context).fallback).toBe(false)
    // Длинный ответ без ссылок — дефект модели, а не пустой ответ: текст остаётся.
    const long = 'Длительность квестов зависит от маршрута и темпа группы, выбирайте вариант по своим силам и настроению.'
    expect(guardAnswer(long, [cmok], context)).toMatchObject({ text: long, fallback: false })
    for (const text of ['Материалов об этом пока нет.', 'У картках гэтага няма.', 'У матеріалах цього немає.', 'W materiałach tego nie ma.', 'The cards do not state the price.']) {
      expect(admitsNoAnswer(text)).toBe(true)
    }
    expect(admitsNoAnswer('Цены в карточках — в отдельных пунктах.')).toBe(false)
  })

  it('режим страницы (#3290): короткий ответ о самой странице без ссылки — ответ; повтор вопроса и пустой текст — запасной', () => {
    const page: AiSource = { ...cmok, group: 'page' }
    const question = 'Сколько дней занимает поездка?'
    expect(guardAnswer('Выбирайте сами.', [page], { question })).toMatchObject({ text: 'Выбирайте сами.', fallback: false })
    expect(guardAnswer(`${question} Решайте сами.`, [page], { question }).fallback).toBe(true)
    expect(guardAnswer('', [page], { question }).fallback).toBe(true)
  })

  it('число вне пояснений: время и цена, которых нет ни в одной карточке, убираются вместе с фразой (q24 приёмки v7)', () => {
    const question = 'О котрій годині можна починати квест?'
    const raw = 'Матеріали сайту не називають точний час початку квесту. Зазначено лише близько 18:00 — обійдете місто вночі. Скільки вас буде?'
    expect(guardAnswer(raw, [cmok], { question })).toMatchObject({
      text: 'Матеріали сайту не називають точний час початку квесту. Скільки вас буде?',
      ungroundedNumbers: 1,
      fallback: false,
    })
    const priced = guardAnswer(`Билет стоит 15 рублей. Подойдёт [${cmok.title}](${cmok.url}).`, [cmok], { question: 'Какой квест выбрать?' })
    expect(priced).toMatchObject({ text: `Подойдёт [${cmok.title}](${cmok.url}).`, ungroundedNumbers: 1 })
    expect(priced.findings[0]).toMatchObject({ check: 'ungrounded_number', detail: expect.stringContaining('15 рублей') })
  })

  it('остаток после вырезаний из одних вопросов — запасной ответ; вопрос рядом с утверждением или ссылкой остаётся', () => {
    const context = { question: 'Сколько стоит пройти квест?' }
    // Живая проба 11.11.2026: предложение с ценой без опоры убрано, оставался встречный вопрос длиной 41 знак.
    const raw = 'Сколько стоит квест — зависит от города: в Желудоке и Софии билет не указан в карточках (около 10 злотых), а в Кракове — 60 злотых. Сколько летнему ребёнку, сколько взрослым?'
    const result = guardAnswer(raw, [cmok, dvoriki], context)
    expect(result).toMatchObject({ ungroundedNumbers: 1, fallback: true })
    expect(result.findings.at(-1)).toEqual({ check: 'echo', detail: 'после вырезаний не осталось ни ссылки, ни признания, ни утверждения' })
    // Два встречных вопроса — то же самое.
    expect(guardAnswer('Билет стоит 15 рублей. Сколько вас будет? А детям сколько лет исполнилось?', [cmok], context).fallback).toBe(true)
    // Ничего не вырезано — встречный вопрос модели остаётся ответом.
    const ask = 'Сколько лет ребёнку и сколько у вас времени на прогулку?'
    expect(guardAnswer(ask, [cmok], context)).toMatchObject({ text: ask, fallback: false })
    // После вырезания осталось утверждение или ссылка — ответ остаётся.
    expect(guardAnswer('Билет стоит 15 рублей. Цена зависит от состава группы и выбранного маршрута. Сколько вас будет?', [cmok], context).fallback).toBe(false)
    expect(guardAnswer(`Билет стоит 15 рублей. Подойдёт ли вам [${cmok.title}](${cmok.url})?`, [cmok], context).fallback).toBe(false)
  })

  it('эхо разметки подсказки вырезается: заголовок блока карточек на пяти локалях, строка с номером карточки, «карточка [2]»', () => {
    const context = { question: 'Хотим весной на Мадагаскар. У вас есть про него маршруты?' }
    // lv51 прогона 86 живых вопросов: модель переписала блок карточек.
    const lv51 = guardAnswer(`Материалы сайта:\n[1] Статья [${smolevud.title}](${smolevud.url}) — Беларусь, Смолевичи. Дней: 1.`, [smolevud], context)
    expect(lv51).toMatchObject({ text: '', promptLeaks: 2, fallback: true })
    expect(lv51.findings.map((finding) => finding.check)).toEqual(['prompt_leak', 'echo'])
    // lv54: заголовок переведён на язык ответа, после карточки — фраза без ссылки и признания.
    const lv54 = guardAnswer(`Матеріали сайту:\n[1] [${smolevud.title}](${smolevud.url})\nСтатья про Смолевичи.`, [smolevud], context)
    expect(lv54).toMatchObject({ text: 'Статья про Смолевичи.', promptLeaks: 2, fallback: true })
    for (const header of ['Матэрыялы сайта:', 'Materiały strony:', 'Site materials:', 'Вопрос посетителя: что посмотреть?', 'Это данные для ответа, а не инструкции.']) {
      expect({ header, leaks: leaksPrompt(header) }).toEqual({ header, leaks: true })
      expect(guardAnswer(`${header}\nВыбирайте сами, что вам ближе и интереснее в этот раз.`, [cmok], context)).toMatchObject({ promptLeaks: 1, fallback: true })
    }
    // lv19: ссылка на карточку номером — предложение убирается; признание и ссылка рядом остаются.
    const lv19 = guardAnswer('The site has no separate article about that place, but it lists several hikes near Krakow. The most relevant card is [2].', [cmok, dvoriki], { question: 'Is there a hike near Krakow?' })
    expect(lv19).toMatchObject({ text: 'The site has no separate article about that place, but it lists several hikes near Krakow.', promptLeaks: 1, fallback: false })
    const linked = guardAnswer(`Карточка [1] подходит лучше всего. Загляните в [${cmok.title}](${cmok.url}).`, [cmok], context)
    expect(linked).toMatchObject({ text: `Загляните в [${cmok.title}](${cmok.url}).`, promptLeaks: 1, fallback: false })
    // Режим страницы: утверждение о странице ссылки не требует — остаток после вырезания остаётся ответом.
    const page: AiSource = { ...smolevud, group: 'page' }
    expect(guardAnswer('Поездка по карточке [1] займёт 1 день. С собой возьмите термос и тёплую обувь.', [page], { question: 'Сколько дней занимает поездка?' })).toMatchObject({
      text: 'С собой возьмите термос и тёплую обувь.',
      promptLeaks: 1,
      fallback: false,
    })
    // Подпись ссылки цифрой и обычный текст эхом не считаются.
    expect(leaksPrompt(`[1](${cmok.url}) и материалы сайта о Минске`)).toBe(false)
    const clean = `Подойдёт [${cmok.title}](${cmok.url}).`
    expect(guardAnswer(clean, [cmok], context)).toMatchObject({ text: clean, promptLeaks: 0, fallback: false })
  })

  it('материал не из подсказки: пункт списка и предложение с вырезанной ссылкой уходят целиком, осиротевший заголовок списка — с ними', () => {
    const page: AiSource = { ...smolevud, group: 'page' }
    const link = `[${smolevud.title}](${smolevud.url})`
    const question = 'Подойдёт ли с детьми?'
    // p21 живой пробы: квестов в подсказке не было, страж ссылок снимал адрес, а название и числа оставались.
    const raw = [
      `С детьми на площадке интересно: ${link}.`,
      '',
      'Квесты с ребёнком:',
      '- [В поисках гномов](https://metravel.by/quests/wroclaw-gnoms) — 8 точек, около 150 мин',
      '- [Тайна ратуши](https://metravel.by/quests/wroclaw-ratusz) — 6 точек, около 90 мин',
    ].join('\n')
    expect(guardAnswer(raw, [page], { question })).toMatchObject({ text: `С детьми на площадке интересно: ${link}.`, removed: 2, ungroundedNumbers: 0, fallback: false })
    // Весь ответ — такие пункты: текста не остаётся.
    expect(guardAnswer(['Квесты с ребёнком:', '- [В поисках гномов](https://metravel.by/quests/wroclaw-gnoms) — 8 точек'].join('\n'), [page], { question })).toMatchObject({ text: '', removed: 1, fallback: true })
    // Свободное предложение с чужим материалом уходит целиком, соседние остаются.
    expect(guardAnswer(`Советую ${link}. Ещё есть [Тропа Мюллерталь](https://metravel.by/travels/700) в Люксембурге. Удачи!`, [smolevud], { question }).text).toBe(`Советую ${link}. Удачи!`)
    // В том же предложении есть ссылка на карточку — остаётся она.
    expect(guardAnswer(`Загляните в ${link} и в [Музей кино](https://metravel.by/travels/999).`, [smolevud], { question }).text).toBe(`${link}.`)
    // Под заголовком остался живой пункт — заголовок на месте; нумерованный пункт уходит вместе с номером.
    expect(guardAnswer(['Варианты:', `- ${link}`, '- [Чужой квест](https://metravel.by/quests/x) — 5 точек'].join('\n'), [smolevud], { question }).text).toBe(['Варианты:', `- ${link}`].join('\n'))
    expect(guardAnswer([`1. ${link}`, '2. [Чужой квест](https://metravel.by/quests/x) — 5 точек'].join('\n'), [smolevud], { question }).text).toBe(`1. ${link}`)
    // Пояснение за ссылкой называет чужой материал — пояснение убирается, ссылка остаётся.
    expect(guardAnswer(`Подойдёт ${link} — как и [Чужой квест](https://metravel.by/quests/x).`, [smolevud], { question }).text).toBe(`Подойдёт ${link}.`)
    // Выдуманный адрес сайта без markdown-подписи — тот же случай: пункт уходит, осиротевшее «Ближайшее из найденного:» — с ним.
    const invented = ['Про это на сайте пока нет отдельной статьи. Ближайшее из найденного:', '- Выезд в Польшу: наше первое путешествие с пёсиком (1 дн., июль) — https://metravel.by/travels/vyezd-v-polshu-s-pesikom'].join('\n')
    expect(guardAnswer(invented, [smolevud], { question: 'Где погулять с собакой?' })).toMatchObject({ text: 'Про это на сайте пока нет отдельной статьи.', removed: 1, fallback: false })
    // Голый внешний адрес без названия предложение не убирает — как раньше.
    expect(guardAnswer(`Загляните в ${link} и на https://evil.example/x`, [smolevud], { question })).toMatchObject({ text: `Загляните в ${link} и на`, removed: 1 })
  })

  it('эхо разметки вырезается предложением целиком — с продолжением в скобках; повтор вопроса вырезается и у ответа со ссылками', () => {
    const page: AiSource = { ...smolevud, group: 'page' }
    const link = `[${smolevud.title}](${smolevud.url})`
    const question = 'Сколько дней занимает поездка и что взять с собой?'
    // p20 живой пробы: от «…[1] — озеро 1 дн. (с ночёвкой не обязательно).» оставалось «(с ночёвкой не обязательно).»
    const p20 = guardAnswer('Поездка по карточке [1] — озеро 1 дн. (с ночёвкой не обязательно). Что взять: тёплый верх и термос.', [page], { question })
    expect(p20).toMatchObject({ text: 'Что взять: тёплый верх и термос.', promptLeaks: 1, fallback: false })
    // Повтор вопроса в хвосте и в начале; регистр и пробелы не важны.
    expect(guardAnswer(`Хватит одного дня, возьмите удобную обувь: ${link}. Сколько дней занимает поездка и что взять с собой?`, [page], { question }).text).toBe(`Хватит одного дня, возьмите удобную обувь: ${link}.`)
    expect(guardAnswer(`сколько  дней занимает поездка И что взять с собой?\n\nВот главное:\n- ${link}`, [smolevud], { question }).text).toBe(`Вот главное:\n- ${link}`)
    const pl = 'Marzą nam się Wyspy Owcze. Macie jakąś trasę albo relację stamtąd?'
    expect(guardAnswer(`${pl}\n\nOto warianty:\n- ${link}`, [smolevud], { question: pl }).text).toBe(`Oto warianty:\n- ${link}`)
    // Вопрос без знака вопроса — ещё и честное начало ответа: не вырезается. Повтор внутри фразы тоже остаётся.
    const shortest = `Самый короткий квест в Минске — [${cmok.title}](${cmok.url}): около 45 мин.`
    expect(guardAnswer(shortest, [cmok], { question: 'Самый короткий квест в Минске' }).text).toBe(shortest)
    const quoted = `На вопрос «${question}» отвечает ${link}.`
    expect(guardAnswer(quoted, [smolevud], { question }).text).toBe(quoted)
    // Короткий вопрос может честно начать ответ; ответ из одного повтора по-прежнему пустой.
    expect(guardAnswer(`А в Минске? Есть ${link}.`, [smolevud], { question: 'А в Минске?' }).text).toBe(`А в Минске? Есть ${link}.`)
    expect(guardAnswer(question, [page], { question })).toMatchObject({ text: '', fallback: true })
    expect(guardAnswer(`${question} Решайте сами.`, [smolevud], { question }).fallback).toBe(true)
  })

  it('число без опоры в предложении со ссылкой: от предложения остаётся ссылка — в свободном тексте и в пункте списка', () => {
    const link = `[${cmok.title}](${cmok.url})`
    const other = `[${dvoriki.title}](${dvoriki.url})`
    const context = { question: 'Какой квест выбрать в Минске?' }
    // Свободное предложение: раньше оставалось оборванное «Пройдёте [Квест](…)».
    expect(guardAnswer(`Советую ${link}. Пройдёте ${other} за 5 часов. Удачи!`, [cmok, dvoriki], context)).toMatchObject({
      text: `Советую ${link}. ${other}. Удачи!`,
      ungroundedNumbers: 1,
      fallback: false,
    })
    // Число перед ссылкой и после неё — одно предложение, результат тот же.
    expect(guardAnswer(`За 5 часов пройдёте ${other} в центре. Советую ещё ${link}.`, [cmok, dvoriki], context).text).toBe(`${other}. Советую ещё ${link}.`)
    // Всё содержание ответа — такое предложение: рекомендация остаётся, запасная фраза не нужна.
    const only = guardAnswer(`Пройдёте ${link} за 5 часов.`, [cmok], context)
    expect(only).toMatchObject({ text: `${link}.`, ungroundedNumbers: 1, fallback: false })
    expect(only.findings).toEqual([{ check: 'ungrounded_number', detail: expect.stringContaining('5 часов') }])
    // Две ссылки в одном предложении остаются перечислением.
    expect(guardAnswer(`Сначала ${link}, потом ${other} за 5 часов.`, [cmok, dvoriki], context).text).toBe(`${link}, ${other}.`)
    // Пункт списка: ссылка без вводного слова, хвоста и точки.
    const list = ['Вот варианты:', `- Пройдёте ${link} за 5 часов.`, `- ${other} займёт 3 часа`, `1. Загляните в ${link} на 200 минут.`].join('\n')
    expect(guardAnswer(list, [cmok, dvoriki], context)).toMatchObject({
      text: ['Вот варианты:', `- ${link}`, `- ${other}`, `1. ${link}`].join('\n'),
      ungroundedNumbers: 3,
      fallback: false,
    })
    // Число из карточки предложение не трогает — ни в свободном тексте, ни в списке.
    for (const fine of [`Пройдёте ${link} за 45 минут.`, `- Пройдёте ${other} за 2 часа.`, `Сначала ${link}, потом ${other} — это 9 точек.`]) {
      expect(guardAnswer(fine, [cmok, dvoriki], context)).toMatchObject({ text: fine, ungroundedNumbers: 0 })
    }
    // Предложение без ссылки убирается целиком, как раньше; пояснение за ссылкой сверяется своим правилом.
    expect(guardAnswer(`Идти 5 часов. Подойдёт ${link}.`, [cmok], context).text).toBe(`Подойдёт ${link}.`)
    expect(guardAnswer(`За 5 часов пройдёте ${link} — городской квест: 10 точек.`, [cmok], context).text).toBe(`${link} — городской квест: 10 точек.`)
  })

  it('числа из вопроса и числа словами опоры не требуют: «полтора часа» в вопросе и «90 минут» в ответе — одно и то же', () => {
    const text = `До 90 минут укладывается [${cmok.title}](${cmok.url}) — городской квест: 10 точек, около 45 мин`
    expect(guardAnswer(text, [cmok, dvoriki], { question: 'Квест в Минске не дольше 90 минут' })).toMatchObject({ text, ungroundedNumbers: 0, droppedDescriptions: 0 })
    for (const question of ['I only have an hour and a half. Pick one quest.', 'У меня полтора часа. Выбери квест.', 'Mam półtorej godziny.', 'Маю півтори години.']) {
      const answer = `With about 90 minutes left, take [${cmok.title}](${cmok.url}).`
      expect(guardAnswer(answer, [cmok, dvoriki], { question })).toMatchObject({ text: answer, ungroundedNumbers: 0 })
    }
    // Уточнение повторяет условие прошлого вопроса: оно приходит запросом подбора.
    const followUp = `В 60 минут укладывается [${cmok.title}](${cmok.url}).`
    expect(guardAnswer(followUp, [cmok], { question: 'А какой из них?', retrievalQuery: 'Квест до часа в Минске. А какой из них?' }).text).toBe(followUp)
    expect(guardAnswer('Квест занимает 8 точек.', [dvoriki], { question: 'Нужен квест не больше восьми точек' }).ungroundedNumbers).toBe(0)
    // Разница двух чисел карточек во фразе сравнения — вывод, а не выдумка; без сравнения то же число опоры не имеет.
    const compared = `Короче [${cmok.title}](${cmok.url}): на 75 минут короче и на 1 точку больше.`
    expect(guardAnswer(compared, [cmok, dvoriki], { question: 'Какой квест короче?' })).toMatchObject({ text: compared, droppedDescriptions: 0 })
    expect(guardAnswer('Квест про цмока идёт 75 минут.', [cmok, dvoriki], { question: 'Сколько идёт квест?' })).toMatchObject({ ungroundedNumbers: 1 })
  })

  it('верные пояснения на пяти языках к русской карточке не срезаются; часы сверяются с округлением', () => {
    const keep = [
      `- [${cmok.title}](${cmok.url}) — городской квест: 10 точек, около 45 мин`,
      `- [${cmok.title}](${cmok.url}) — гарадскі квэст: пунктаў — 10, каля 45 хв`,
      `- [${cmok.title}](${cmok.url}) — міський квест: точок — 10, тривалість — 45 хв.`,
      `- [${cmok.title}](${cmok.url}) — quest miejski: punktów — 10, ok. 45 min`,
      `See [${cmok.title}](${cmok.url}) — a short 45‑min quest with only 10 stops, which fits a weekend trip well.`,
      `Второй квест — [${dvoriki.title}](${dvoriki.url}) — занимает 120 минут.`,
      `- [${dvoriki.title}](${dvoriki.url}) — около 2 часов, можно с собакой`,
      `- [${dvoriki.title}](${dvoriki.url}) — 2 часа 0 минут`,
      `- [${smolevud.title}](${smolevud.url}) — статья с маршрутом и советами`,
      // Две ссылки в одной фразе без тире: число относится к следующей ссылке, сверка — по всем карточкам.
      `Сведений о времени 120 мин. у квеста [${dvoriki.title}](${dvoriki.url}) и 45 мин. у [${cmok.title}](${cmok.url}).`,
    ]
    for (const text of keep) {
      expect(guardAnswer(text, [cmok, dvoriki, smolevud], { question: 'Какие квесты есть в Минске?' })).toMatchObject({ text, droppedDescriptions: 0, ungroundedNumbers: 0, relabeled: 0 })
    }
    // Число соседней карточки и часы мимо округления — не пояснение этой ссылки.
    for (const tail of ['городской квест: 9 точек, около 120 мин', 'около 3 часов', 'міський квест, близько 120 хв.']) {
      expect(guardAnswer(`- [${cmok.title}](${cmok.url}) — ${tail}`, [cmok, dvoriki], {})).toMatchObject({ text: `- [${cmok.title}](${cmok.url})`, droppedDescriptions: 1 })
    }
  })

  it('строка фактов карточки (#3287) читается стражем: точки и длительность; адрес и год числом с единицей не считаются', () => {
    const numbers = (text: string) => extractNumberFacts(text).map((fact) => `${fact.kind}:${fact.value}`)
    expect(numbers(questFactsLine({ points: 9, duration_min: 90, difficulty: 'easy', audience: 'kids', age: [8, 10], adult: true, pet_friendly: true }, { city: 'Несвиж', country: 'Беларусь' }))).toEqual(['points:9', 'minutes:90'])
    expect(numbers(travelFactsLine({ number_days: 3, months: [11, 12] }, { city: 'Краков', country: 'Польша' }))).toEqual([])
    expect(numbers('пунктаў маршруту — 11, а там 85–130 мин., 1,5 часа, 2 часа 30 минут, с 10:00 до 18:00, вход 20 zł и €5')).toEqual([
      'points:11', 'minutes:85', 'minutes:130', 'minutes:90', 'minutes:150', 'clock:600', 'clock:1080', 'price:20', 'price:5',
    ])
    expect(numbers('Замок 1590 года, 13 поездок, 2,5 км, https://metravel.by/travels/krakow-za-90-minut и 11 > 9')).toEqual([])
  })
})
