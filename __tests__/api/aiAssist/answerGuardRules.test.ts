import { admitsNoAnswer, guardAnswer } from '@/api/aiAssist/answerGuard'
import { nameBareSourceLinks } from '@/api/aiAssist/linkGuard'
import type { AiSource } from '@/api/aiAssist/types'

// #3345: единый набор правил стража. После #3291 приёмка на живой службе (12.11.2026) нашла пять новых
// форм мусора — каждая обходила правило, написанное под прежний случай. Здесь на каждую форму стоит
// сырой ответ модели v7 из записанных прогонов (`.codex-temp/train-live/**`, поле `trace.raw_text` либо
// `modelCall.text`) с карточками того же хода. Две формы приёмки сохранены только цитатой в карточке
// #3345 — они собраны из цитаты и помечены.
const card = (type: AiSource['type'], title: string, url: string, snippet: string, extra: Partial<AiSource> = {}): AiSource => ({
  type,
  source_id: url,
  title,
  url,
  path: url.replace('https://metravel.by', ''),
  snippet,
  score: 1,
  ...extra,
})

const cmok = card(
  'quest',
  'Квест по центру Минска: в поисках цмока',
  'https://metravel.by/quests/4/minsk-cmok',
  'Городской квест по городу Минск (Беларусь). Точек: 10. Длительность: 45 мин. Сложность: лёгкий. В нашей игре это самый тяжёлый, но и самый необходимый…',
)
const trakai = card(
  'quest',
  'Квест: Тракай — Що зберігає озеро',
  'https://metravel.by/uk/quests/27/trakai-castle',
  'Городской квест по городу Тракай (Литва). Точек: 9. Длительность: 120 мин. Сложность: лёгкий. Можно с собакой. Острівний замок добудували за Вітовта на початку XV…',
)
const riga = card('travel', 'Латвия. Рига и Юрмала в октябре.', 'https://metravel.by/travels/latviya-riga-i-yurmala-v-oktyabre', 'Латвия, Рига. Дней: 4. Месяц: октябрь. Старый город, рынок в ангарах для дирижаблей и…')
const rigaQuest = card('quest', 'Quest po Rydze: miasto, którego nigdy nie ukończą', 'https://metravel.by/pl/quests/89/riga-unfinished-city', 'Городской квест по городу Рига (Латвия). Точек: 10. Длительность: 150 мин. Сложность: средний.')
const gdansk = card('quest', 'Quest po Gdańsku: bursztynowe miasto', 'https://metravel.by/pl/quests/22/gdansk-amber', 'Городской квест по городу Гданьск (Польша). Точек: 8. Длительность: 120 мин. Сложность: лёгкий. Można z psem.')
const krakow = card('quest', 'Quest po Krakowie: Smok Wawelski', 'https://metravel.by/pl/quests/1/krakow-dragon', 'Городской квест по городу Краков (Польша). Точек: 11. Длительность: 120 мин. Сложность: лёгкий.')
const zheludok = card(
  'quest',
  'Квэст па Жалудку: сем знакаў мястэчка і палац з кіно',
  'https://metravel.by/be/quests/63/zheludok-palace',
  'Городской квест по городу Желудок (Беларусь). Точек: 9. Длительность: 140 мин. Сложность: лёгкий. Можно с собакой.',
)

describe('страж ответа: единый набор правил (#3345)', () => {
  describe('форма 1 — голый адрес карточки вместо пояснения', () => {
    it('адрес уже названной карточки убирается вместе с подводкой, пояснение остаётся («городской квест: https://…»)', () => {
      // Приёмка 12.11.2026, «Самый короткий квест в Минске»: сырой ответ не сохранён, форма — по цитате карточки #3345.
      const raw = `Самый короткий квест в Минске — [${cmok.title}](${cmok.url}) — городской квест: ${cmok.url}`
      const result = guardAnswer(raw, [cmok], { question: 'Самый короткий квест в Минске' })
      expect(result.text).toBe(`Самый короткий квест в Минске — [${cmok.title}](${cmok.url}) — городской квест`)
      expect(result).toMatchObject({ bareLinks: 1, removed: 0, fallback: false })
      expect(result.findings).toContainEqual({ check: 'bare_url', detail: 'голых адресов карточек в ответе: 1' })
      // lv48 (frag200x100): пояснение пункта — тот же адрес ещё раз.
      const lv48 = `Karty:\n- [${krakow.title}](${krakow.url}) — ${krakow.url}`
      expect(guardAnswer(lv48, [krakow], { question: 'Skąd zaczyna się ten quest i ile ma punktów?' }).text).toBe(`Karty:\n- [${krakow.title}](${krakow.url})`)
    })

    it('адрес ещё не названной карточки становится ссылкой с её названием; повтор того же адреса уходит вместе с подписью', () => {
      // lv35 (on): «Почати: <адрес>» — посетитель видел голый адрес вместо названия квеста.
      const lv35 = 'У квест: Тракай — Що зберігає озеро візьмо близько 120 хв. Щоб встигнути в замок, варто розпочати раніше.\n\nПочати: https://metravel.by/uk/quests/27/trakai-castle'
      expect(guardAnswer(lv35, [trakai], { question: 'Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.' }).text).toBe(
        `У квест: Тракай — Що зберігає озеро візьмо близько 120 хв. Щоб встигнути в замок, варто розпочати раніше.\n\nПочати: [${trakai.title}](${trakai.url})`,
      )
      // lv40 (frag200x100): «Горад: <адрес>» на вопрос о том, как проходит квест.
      const lv40 = `Квэсты — гарадскія падарожжах, якія патрабуюць рэгістрацыйнага ліку для ўходу: без яго не будзеш знаходзіць пунктаў маршруту. Горад: ${zheludok.url}`
      expect(guardAnswer(lv40, [zheludok], { question: 'Як праходзіць квэст — трэба рэгістравацца ці можна проста прыйсці на старт і пачаць?' }).text).toContain(`Горад: [${zheludok.title}](${zheludok.url})`)
      // lv63 (off): один адрес под двумя выдуманными подписями — вторая строка уходит целиком.
      const lv63 = `Rozpocznij zwiedzanie przy głównym rynku i zamku, by poczuć atmosferę miasta.\n\nGłówny rynek: ${riga.url}\nZamek w Rzydze: ${riga.url}`
      const result = guardAnswer(lv63, [riga, rigaQuest], { question: 'Wybieramy się do Rygi na cztery dni. Od czego zacząć zwiedzanie?' })
      expect(result.text).toBe(`Rozpocznij zwiedzanie przy głównym rynku i zamku, by poczuć atmosferę miasta.\n\nGłówny rynek: [${riga.title}](${riga.url})`)
      expect(result.bareLinks).toBe(2)
    })

    it('ссылка с названием и чужой адрес правило не задевает; адрес с точкой в конце фразы — тоже ссылка', () => {
      const clean = `Подойдёт [${cmok.title}](${cmok.url}) — городской квест: 10 точек, около 45 мин.`
      expect(nameBareSourceLinks(clean, [cmok])).toEqual({ text: clean, named: 0, dropped: 0 })
      expect(nameBareSourceLinks(`Смотрите ${cmok.url}.`, [cmok])).toEqual({ text: `Смотрите [${cmok.title}](${cmok.url}).`, named: 1, dropped: 0 })
      // Адрес без протокола и путь приложения становятся ссылкой на полный адрес карточки: экран узнаёт
      // ссылкой только `[…](https://…)`, иначе посетитель увидел бы разметку.
      expect(nameBareSourceLinks('Смотрите metravel.by/quests/4/minsk-cmok.', [cmok]).text).toBe(`Смотрите [${cmok.title}](${cmok.url}).`)
      expect(nameBareSourceLinks('Смотрите /quests/4/minsk-cmok', [cmok]).text).toBe(`Смотрите [${cmok.title}](${cmok.url})`)
      // Адрес не из карточек до этого шага не доходит: его снимает страж ссылок.
      expect(nameBareSourceLinks('Смотрите https://example.com/x', [cmok])).toEqual({ text: 'Смотрите https://example.com/x', named: 0, dropped: 0 })
    })
  })

  describe('форма 2 — оборванная фраза карточки вместо своих слов', () => {
    it('вводная к ссылке — конец оборванного фрагмента («самый тяжёлый, но и самый необходимый»): остаётся ссылка', () => {
      // Приёмка 12.11.2026: вводная без чисел, сырой ответ не сохранён; фраза — конец фрагмента карточки квеста.
      const intro = guardAnswer(`Самый тяжёлый, но и самый необходимый: [${cmok.title}](${cmok.url}).`, [cmok], { question: 'Самый короткий квест в Минске' })
      expect(intro).toMatchObject({ text: `[${cmok.title}](${cmok.url}).`, cardFragments: 1, fallback: false })
      expect(intro.findings).toContainEqual({ check: 'card_fragment', detail: expect.stringContaining('самый необходимый') })
      // Та же фраза пояснением и отдельным предложением.
      expect(guardAnswer(`- [${cmok.title}](${cmok.url}) — это самый тяжёлый, но и самый необходимый`, [cmok], {})).toMatchObject({ text: `- [${cmok.title}](${cmok.url})`, cardFragments: 1 })
      expect(guardAnswer(`Советую [${cmok.title}](${cmok.url}). В игре это самый тяжёлый, но и самый необходимый…`, [cmok], {}).text).toBe(`Советую [${cmok.title}](${cmok.url}).`)
    })

    it('lv02 и lv85 живого прогона: пояснение пункта обрывается там же, где фрагмент карточки', () => {
      const linovo = card(
        'travel',
        'Усадьба «Линово», дворец Потоцких и усадьба Пузынов',
        'https://metravel.by/travels/usadba-linovo-dvorets-pototskikh-i-usadba-puzynov',
        'Беларусь, Усадебный дом Трембицких в Линово / Сядзібны дом Трамбіцкіх у Лінаве. Дней: 1. Месяц: ноябрь. Дворцово-парковый комплекс Слацьвинских и усадьба Потоцких — ещё один маршрут по белорусским дворцам за один день. Веломаршрут на 2 дня: усадебный парк Потоцких «Репихово» — красивый парковый…',
      )
      const lv02 = `Для поездки из Минска на два дня с одной ночёвкой посмотрите:\n- [${linovo.title}](${linovo.url}) — Веломаршрут на 2 дня: усадебный парк Потоцких «Репихово» — красивый парковый…`
      expect(guardAnswer(lv02, [linovo], { question: 'Куда съездить из Минска на два дня с одной ночёвкой? Хочется замки или усадьбы.' })).toMatchObject({
        text: `Для поездки из Минска на два дня с одной ночёвкой посмотрите:\n- [${linovo.title}](${linovo.url})`,
        cardFragments: 1,
        fallback: false,
      })
      const krevo = card(
        'travel',
        'Веломаршрут за день: Кревский замок и Гольшаны',
        'https://metravel.by/travels/velomarshrut-za-den-krevskii-zamok-i-golshany',
        'Беларусь, Ошмяны - Боруны - граница Минской области. Дней: 1. Месяц: сентябрь. Если понравился формат «замки + усадьбы за один день на велосипеде», вот ещё маршруты в том же духе: Заброшенные…',
      )
      const lv85 = `Из того, что нашлось, можно начать с этого:\n- [${krevo.title}](${krevo.url}) — Если понравился формат «замки + усадьбы за один день на велосипеде», вот ещё маршруты в том же духе: Заброшенные`
      expect(guardAnswer(lv85, [krevo], { question: 'Какие замки Беларуси можно объехать за выходные?' }).text).toBe(`Из того, что нашлось, можно начать с этого:\n- [${krevo.title}](${krevo.url})`)
    })

    it('фраза, договорённая дальше обрыва, и режим страницы правило не задевают', () => {
      const weekend = card(
        'travel',
        'Маршруты выходного дня из Минска: 13 поездок',
        'https://metravel.by/travels/marshruty-vykhodnogo-dnia-iz-minska-13-poezdok',
        'Беларусь. Маршруты выходного дня из Минска — в этой подборке 13 проверенных однодневных поездок: озёра и родники, старинные замки…',
      )
      // lv57 (off): модель закончила фразу сама — пояснение остаётся.
      const kept = `- [${weekend.title}](${weekend.url}) — в этой подборке 13 проверенных однодневных поездок: озёра и родники, старинные замки и церкви.`
      expect(guardAnswer(kept, [weekend], { question: 'Будем в Минске два дня. Что посмотреть в первую очередь?' })).toMatchObject({ text: kept, cardFragments: 0, droppedDescriptions: 0 })
      // Режим страницы: ответ — пересказ фрагментов самой страницы.
      const page = { ...cmok, group: 'page' as const }
      const about = 'В нашей игре это самый тяжёлый, но и самый необходимый'
      expect(guardAnswer(about, [page], { question: 'Что это за точка?' })).toMatchObject({ text: about, cardFragments: 0, fallback: false })
    })
  })

  describe('форма 3 — мусорный остаток после вырезанного предложения', () => {
    it('lv40: после числа без опоры остаются три обрывка — запасной ответ', () => {
      const raw = 'Квэсты — гэта ўзаемадзеянне з горадам: каля 10 хв. вароўнага часу, калі не рэгістраваўся. Колькі гадоў назад? Зараз. Астатняе — у картцы.'
      const result = guardAnswer(raw, [zheludok, krakow], { question: 'Як праходзіць квэст — трэба рэгістравацца ці можна проста прыйсці на старт і пачаць?' })
      expect(result).toMatchObject({ ungroundedNumbers: 1, fallback: true })
      expect(result.findings.at(-1)).toEqual({ check: 'echo', detail: 'после вырезаний не осталось ни ссылки, ни признания, ни утверждения' })
    })

    it('lv06: остаток без ссылки и признания — запасной; остаток со ссылкой или признанием — ответ', () => {
      const lodz = card('travel', 'Лодзь - город муралов и фабрик: что посмотреть за день', 'https://metravel.by/travels/lodz-gorod-muralov-i-fabrik-chto-posmotret-za-den-1', 'Польша, Лодзь. Дней: 1. Месяц: май.')
      const question = 'Куди поїхати з Варшави на вихідні, щоб дорога була недовгою?'
      const lv06 = 'З варшавського аеропорту до Кракова — близько 200 км і близько 150 хв. З Варшави до Кракова можна дістатися за кілька годин на поїзді, автобусі або машиною.'
      expect(guardAnswer(lv06, [lodz], { question })).toMatchObject({ ungroundedNumbers: 1, fallback: true })
      expect(guardAnswer(`${lv06} Подивіться [${lodz.title}](${lodz.url}).`, [lodz], { question }).fallback).toBe(false)
      const admitted = guardAnswer(`Дорога займе близько 150 хв. Матеріали сайту не називають точного часу в дорозі.`, [lodz], { question })
      expect(admitted).toMatchObject({ text: 'Матеріали сайту не називають точного часу в дорозі.', fallback: false })
      for (const text of ['Материалы сайта не называют точное время.', 'Карткі гэтага не згадваюць.', 'Karty o tym nie wspominają.', 'Картки про це не повідомляють.']) expect(admitsNoAnswer(text)).toBe(true)
    })

    it('режим страницы: утверждение о странице ссылки не требует и после вырезания', () => {
      const page = { ...cmok, group: 'page' as const }
      expect(guardAnswer('Квест длится 200 минут. Старт у ратуши, финиш у реки.', [page], { question: 'Сколько длится квест?' })).toMatchObject({
        text: 'Старт у ратуши, финиш у реки.',
        ungroundedNumbers: 1,
        fallback: false,
      })
    })
  })

  describe('замер r1 (12.11.2026): число без опоры и признание не по теме', () => {
    it('lv74: «about 1 km» и «at 20 BYN» страницы не называет — оба предложения уходят, ответ запасной', () => {
      const page = card('travel', 'Брест: путеводитель по крепости, фонарщику и старому городу', 'https://metravel.by/travels/brest-putevoditel', 'Беларусь. Дней: 1. … Брестская крепость (Цитадель): три-четыре часа с музеем … У Тереспольских ворот есть платная парковка.', { group: 'page' })
      const raw = 'The article states that you can park your car in Bereza (Beresterie) at 20 BYN, but it does not provide specific details about leaving the car near the fortress itself. The nearest parking is in Bereza, about 1 km away from the fortress entrance.'
      const result = guardAnswer(raw, [page], { question: 'Does this page say where to leave the car near the fortress?' })
      // Первое предложение вырезает число цены (правило #3291), второе — расстояние: раньше оно оставалось единственным показанным.
      expect(result).toMatchObject({ text: '', ungroundedNumbers: 2, fallback: true })
      expect(result.findings.map((finding) => finding.detail)).toEqual([expect.stringContaining('20 BYN'), expect.stringContaining('1 km'), expect.any(String)])
    })

    it('lv79 и p08: «Возрастные ограничения: 12 лет» при карточках без возраста — строка уходит, рекомендация остаётся', () => {
      const hut = card('travel', 'Териева хата в Высоких Татрах: маршрут из Старого Смоковца через водопады', 'https://metravel.by/travels/terieva-khata', 'Словакия. Дней: 1. Месяц: июнь. Маршрут идёт вдоль водопадов Студёного потока…')
      const raw = `Для маршрута в Татрах на один день без машины:\n- [${hut.title}](${hut.url})\nВозрастные ограничения: 12 лет`
      expect(guardAnswer(raw, [hut], { question: 'Посоветуй маршрут в Татрах для новичков без машины' })).toMatchObject({
        text: `Для маршрута в Татрах на один день без машины:\n- [${hut.title}](${hut.url})`,
        ungroundedNumbers: 1,
        fallback: false,
      })
    })

    it('lv35 (замер r2): число сверяется с карточками подсказки — соседний источник на 150 минут опорой не служит', () => {
      const vilnius = card('quest', 'Квест по Вильнюсу: город Гедимина', 'https://metravel.by/uk/quests/26/vilnius', 'Городской квест по городу Вильнюс (Литва). Точек: 11. Длительность: 150 мин.', { group: 'nearby' })
      const prompt = [{ ...trakai, group: 'match' as const }]
      const question = 'Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.'
      // Сырой ответ повтора 3: в подсказке одна карточка на 120 минут, «150 хв» — выдумка.
      const raw = 'У квест: Тракай — Що зберігає озеро візьмо близько 120 хв. Скільки часу потрібно на вхід і розгортку замку — у картці не вказано. Скільки часу потрібно на вхід і розгортку замку — загалом близько 150 хв.'
      const guarded = guardAnswer(raw, [...prompt, vilnius], { question, promptSources: prompt })
      expect(guarded).toMatchObject({ text: 'У квест: Тракай — Що зберігає озеро візьмо близько 120 хв. Скільки часу потрібно на вхід і розгортку замку — у картці не вказано.', ungroundedNumbers: 1 })
      // Без списка подсказки опорой служили все источники — число проходило (так служба и пропустила его).
      expect(guardAnswer(raw, [...prompt, vilnius], { question }).ungroundedNumbers).toBe(0)
      // Ссылка на соседний источник по-прежнему разрешена, а пояснение при ней сверяется с её карточкой.
      const linked = `Рядом есть [${vilnius.title}](${vilnius.url}) — около 150 мин.`
      expect(guardAnswer(linked, [...prompt, vilnius], { question, promptSources: prompt })).toMatchObject({ text: linked, removed: 0, droppedDescriptions: 0 })
    })

    it('километры и годы из карточки и из вопроса — опора: цифрой, словами, диапазоном, слитным словом', () => {
      const walk = card('quest', 'Квест по центру Минска: в поисках цмока', 'https://metravel.by/quests/4/minsk-cmok', 'Детский городской квест по городу Минск (Беларусь). Возраст: 8–10 лет. Точек: 10. Длительность: 45 мин. Маршрут пеший, около двух с половиной километров вдоль Свислочи')
      const bike = card('travel', 'Веломаршрут на 1 день ~30 км вдоль реки Вилия.', 'https://metravel.by/travels/velomarshrut-30-km', 'Беларусь. Дней: 1. Месяц: июнь.')
      const link = `[${walk.title}](${walk.url})`
      for (const [question, answer] of [
        ['Что за квест про цмока?', `${link} — около 2,5 км пешком, детям 8–10 лет, ребёнку 9 лет подойдёт.`],
        ['Что выбрать, если с нами будет шестилетка?', `Для ребёнка 6 лет ${link} сложноват.`],
        ['Їдемо з дев’ятирічним сином', `Дитині 9 років буде цікаво: ${link}.`],
        // lv23: условие вопроса словами — «километров на сорок-пятьдесят» — и число карточки «~30 км».
        ['Посоветуй веломаршрут на день недалеко от Минска, километров на сорок-пятьдесят.', `Если нужен один день и 30–50 км — это [${bike.title}](${bike.url}).`],
        ['Маршрут на сорок-пятьдесят километров', `На 40–50 км подойдёт [${bike.title}](${bike.url}).`],
      ]) {
        expect({ question, result: guardAnswer(answer, [walk, bike], { question }) }).toMatchObject({ question, result: { text: answer, ungroundedNumbers: 0, droppedDescriptions: 0 } })
      }
      expect(guardAnswer(`${link} — около 4 км пешком.`, [walk], { question: 'Что за квест?' })).toMatchObject({ text: `${link}.`, droppedDescriptions: 1 })
    })

    it('lv61, lv34: признание о возрасте или сложности на вопрос о времени — не ответ; по теме вопроса и без предмета — ответ', () => {
      const mir = card('quest', 'Квэст па Міры: Мірскі замак і мястэчка', 'https://metravel.by/be/quests/16/mir-castle', 'Городской квест по городу Мир (Беларусь). Точек: 8. Длительность: 90 мин. Сложность: лёгкий.')
      const context = { question: 'А квэст там колькі часу займае?', retrievalQuery: 'Хочам з’ездзіць у Мір. Што там ёсць акрамя замка? А квэст там колькі часу займае?' }
      // lv61#1 замера r1: сырой ответ целиком.
      const lv61 = guardAnswer('У картках не пазначаны ўзроставыя абмежаванні. Колькі гадоў дзіцяці, каб з’явіцца ў Міры?', [mir], context)
      expect(lv61).toMatchObject({ fallback: true, counterQuestions: 1 })
      expect(lv61.findings.at(-1)).toEqual({ check: 'echo', detail: 'признание не о том, что спросили, без ссылки и подтверждённого числа' })
      // lv34: «не пазначаны ўзровень складанасці» на «колькі часу трэба».
      expect(guardAnswer('У картцы не пазначаны ўзровень складанасці. Астатняе — у спісе крыніц ніжэй.', [mir], { question: 'Колькі часу трэба на велаквэст з Лунінца? Ці паспеем вярнуцца да вечара?' }).fallback).toBe(true)
      // lv46: рядом стоит число из карточки — это ответ на вопрос о времени.
      const lv46 = 'У картцы не пазначаны ўзровень гадин; каля 90 хв.'
      expect(guardAnswer(lv46, [mir], { question: 'Колькі часу зойме гэты квэст?' })).toMatchObject({ text: lv46, fallback: false })
      // Признание о том, что спросили, и признание без предмета.
      expect(guardAnswer('У картках не пазначана, колькі часу займае квэст.', [mir], context).fallback).toBe(false)
      expect(guardAnswer('У картках не пазначаны ўзроставыя абмежаванні.', [mir], { question: 'Ці падыдзе квэст дзецям?' }).fallback).toBe(false)
      expect(guardAnswer('Отдельного материала о прогулках с собакой на сайте пока нет.', [mir], { question: 'Где погулять с собакой недалеко от Варшавы?' }).fallback).toBe(false)
      // Длинный ответ без ссылок и без признания остаётся, как решено в #3291: общее правило «нет ссылки — запасной»
      // на записанных ответах снимало верный ответ lv19.
      const lv19 = 'The site has one article about a dog-friendly hike near Krakow, the Dog-friendly trek in Zabnik Valley. It is highlighted for its wild nature as it lacks mass tourism infrastructure.'
      expect(guardAnswer(lv19, [mir], { question: 'Is there a dog-friendly hike within an hour of Krakow?' })).toMatchObject({ text: lv19, fallback: false })
    })
  })

  describe('форма 4 — повтор вопроса в хвосте пересказом', () => {
    it('lv35: вопрос посетителя пересказан другими словами — вырезается, ответ со ссылкой остаётся', () => {
      const question = 'Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.'
      const raw = `У квесту [${trakai.title}](${trakai.url}) близько 120 хв. Скільки часу потрібно на встигнення в замок?`
      const result = guardAnswer(raw, [trakai], { question })
      expect(result).toMatchObject({ text: `У квесту [${trakai.title}](${trakai.url}) близько 120 хв.`, counterQuestions: 1, fallback: false })
      expect(result.findings).toContainEqual({ check: 'counter_question', detail: expect.stringContaining('встигнення в замок') })
      // Одно предложение из вопроса в два предложения — дословный повтор его части.
      expect(guardAnswer(`У квесту [${trakai.title}](${trakai.url}) близько 120 хв. Скільки часу потрібно на квест у Тракаї?`, [trakai], { question }).text).toBe(`У квесту [${trakai.title}](${trakai.url}) близько 120 хв.`)
    })

    it('p20, режим страницы: половина составного вопроса в хвосте', () => {
      const page = card('travel', 'Рождественские ярмарки Польши 2026', 'https://metravel.by/travels/rozhdestvenskie-iarmarki-polshi-2026', 'Польша. Дней: 1. Месяц: декабрь. … Из Кракова в Катовице ходит поезд за час.', { group: 'page' })
      const question = 'Сколько дней занимает поездка и что взять с собой?'
      expect(guardAnswer('Хватит одного дня: из Кракова в Катовице поезд идёт час. Сколько дней занимает поездка?', [page], { question })).toMatchObject({
        text: 'Хватит одного дня: из Кракова в Катовице поезд идёт час.',
        counterQuestions: 1,
        fallback: false,
      })
      expect(guardAnswer('Хватит одного дня. А что взять с собой в такую поездку?', [page], { question }).text).toBe('Хватит одного дня.')
    })
  })

  describe('форма 5 — встречный вопрос без смысла', () => {
    it('p05, lv08, lv63: «Сколько лет собаке?», «Ile lat ma Twój pies?», «Ile lat ma Riga?» вырезаются', () => {
      // p05 приёмки 12.11.2026: сырой ответ не сохранён, встречный вопрос — по цитате карточки #3345.
      const p05 = guardAnswer('Отдельного материала о прогулках с собакой на сайте пока нет. Сколько лет собаке?', [cmok], { question: 'Где погулять с собакой недалеко от Варшавы?' })
      expect(p05).toMatchObject({ text: 'Отдельного материала о прогулках с собакой на сайте пока нет.', counterQuestions: 1, fallback: false })
      const lv08 = `Oto najważniejsze trasy i miasta do wyjazdu z Gdańska:\n- [${gdansk.title}](${gdansk.url}) — quest miejski: punktów — 8, ok. 120 min\nKarty nie podają innych miejscowości. Ile lat ma Twój pies?`
      expect(guardAnswer(lv08, [gdansk], { question: 'Dokąd wybrać się na jednodniową wycieczkę z Gdańska?' }).text).toBe(
        `Oto najważniejsze trasy i miasta do wyjazdu z Gdańska:\n- [${gdansk.title}](${gdansk.url}) — quest miejski: punktów — 8, ok. 120 min\nKarty nie podają innych miejscowości.`,
      )
      const lv63 = `Zacznij od [${riga.title}](${riga.url}).\n\nMiasto ma też wiele ciekawych miejsc do odwiedzenia. Ile lat ma Riga?`
      expect(guardAnswer(lv63, [riga], { question: 'Wybieramy się do Rygi na cztery dni. Od czego zacząć zwiedzanie?' }).text).toBe(`Zacznij od [${riga.title}](${riga.url}).\n\nMiasto ma też wiele ciekawych miejsc do odwiedzenia.`)
    })

    it('уточнение возраста ребёнка остаётся только на вопрос о детях без названного возраста — на пяти языках', () => {
      const link = `[${cmok.title}](${cmok.url})`
      const cases: Array<[string, string]> = [
        ['Какой квест выбрать с детьми?', 'Сколько лет ребёнку?'],
        ['Што паглядзець з дзецьмі?', 'Колькі гадоў дзіцяці?'],
        ['Куди поїхати з дітьми?', 'Скільки років дитині?'],
        ['Co robić z dziećmi?', 'Ile lat ma dziecko?'],
        ['What can we do with kids?', 'How old is the child?'],
      ]
      for (const [question, clarification] of cases) {
        const answer = `Посмотрите ${link}. ${clarification}`
        expect({ question, text: guardAnswer(answer, [cmok], { question }).text }).toEqual({ question, text: answer })
      }
      // Возраст уже назван — уточнять нечего; о детях не спрашивали — вопрос не к месту.
      for (const question of ['Что выбрать ребёнку 9 лет?', 'Їдемо в Прагу з дев’ятирічним сином. Що там є для нього?', 'Чи є у вас велоквести?']) {
        expect({ question, text: guardAnswer(`Посмотрите ${link}. Сколько лет ребёнку?`, [cmok], { question }).text }).toEqual({ question, text: `Посмотрите ${link}.` })
      }
      // Условие пришло опорой уточнения: «А какой из них?» после вопроса о детях.
      expect(guardAnswer(`Посмотрите ${link}. Сколько лет ребёнку?`, [cmok], { question: 'А какой из них?', retrievalQuery: 'Квесты в Минске с детьми. А какой из них?' }).counterQuestions).toBe(0)
    })

    it('вопрос, переписанный из карточки, и вопрос со ссылкой на карточку', () => {
      const budapest = card('travel', 'Будапешт в ноябре: четыре дня', 'https://metravel.by/travels/budapesht-v-noiabre', 'Венгрия, Будапешт. Дней: 4. Месяц: ноябрь. В купальни с животными нельзя. Сколько стоят купальни Сеченьи и пивные ванны в 2026 году?…')
      // lv47 (final): заголовок раздела статьи стал вопросом посетителю.
      const lv47 = `Из того, что есть, можно посмотреть цены и правила:\n- [${budapest.title}](${budapest.url}) — В купальни с животными нельзя. Сколько стоят купальни Сеченьи и пивные ванны в 2026 году?`
      expect(guardAnswer(lv47, [budapest], { question: 'Чи підійде ця поїздка, якщо їхати з дитиною?' }).text).toBe(`Из того, что есть, можно посмотреть цены и правила:\n- [${budapest.title}](${budapest.url}) — В купальни с животными нельзя.`)
      // Вопрос со ссылкой — рекомендация, она остаётся.
      const offer = `Подойдёт ли вам [${cmok.title}](${cmok.url})?`
      expect(guardAnswer(offer, [cmok], { question: 'Какой квест выбрать?' })).toMatchObject({ text: offer, counterQuestions: 0 })
    })
  })
})
