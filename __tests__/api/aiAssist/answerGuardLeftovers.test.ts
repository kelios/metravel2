import { guardAnswer } from '@/api/aiAssist/answerGuard'
import type { AiSource } from '@/api/aiAssist/types'

// #3345, пятый заход (замер r4): повтор вопроса режется как единица-предложение, остаток с фактом из
// карточки остаётся; подводка к списку, под которой списка нет, уходит. Сырые ответы — из записанных
// прогонов v7 (`.codex-temp/train2/r3`, `r4`, `modelCall.text`) с карточками того же хода.
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

const trakai = card(
  'quest',
  'Квест: Тракай — Що зберігає озеро',
  'https://metravel.by/uk/quests/27/trakai-castle',
  'Городской квест по городу Тракай (Литва). Точек: 9. Длительность: 120 мин. Сложность: лёгкий. Можно с собакой. Острівний замок добудували за Вітовта на початку…',
)
const malborkQuest = card('quest', 'Quest po Malborku: kula, która chybiła Zakon', 'https://metravel.by/pl/quests/84/malbork-marienburg', 'Городской квест по городу Malbork (Польша). Точек: 6. Длительность: 180 мин. Сложность: лёгкий')
const malbork = card('travel', 'Замок Мальборк: крупнейший кирпичный замок мира', 'https://metravel.by/travels/zamok-malbork-krupneishii-kirpichnyi-zamok-mira', 'Польша. Дней: 1. Месяц: апрель. Сокращённый прогулочный маршрут по дворам, садам и рвам старого замка')
const grodno = card('travel', 'Гродно за 1 день: что посмотреть и как доехать', 'https://metravel.by/travels/grodno-za-1-den-chto-posmotret-i-kak-doekhat', 'Беларусь. Дней: 1. Месяц: октябрь. Готовые маршруты по Гродно Один день в городе Утро — Старый замок')
const hel = card('travel', 'Хельская коса: три маяка и неделя на Балтике', 'https://metravel.by/travels/khelskaia-kosa-tri-maiaka-i-nedelia-na-baltike', 'От вокзала до маяка десять минут пешком. На пароме в сезон из Гдыни, Сопота и Гданьска')
const sofia = card('quest', 'Квест по Софии: Сердика под ногами', 'https://metravel.by/quests/sofia/serdica', 'Городской квест по городу София (Болгария). Точек: 9. Длительность: 100 мин. Сложность: лёгкий')

describe('повтор вопроса — единица-предложение (lv35, замер r4)', () => {
  const question = 'Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.'

  it.each(['візьмо', 'візьмуть', 'візьме'])('ответ с числом карточки и повтором вопроса из двух предложений: остаётся первое предложение (%s)', (verb) => {
    const raw = `У квест: Тракай — Що зберігає озеро ${verb} близько 120 хв. Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.`
    const result = guardAnswer(raw, [trakai], { question })
    expect(result).toMatchObject({ fallback: false, text: `У квест: Тракай — Що зберігає озеро ${verb} близько 120 хв.`, counterQuestions: 2, ungroundedNumbers: 0 })
    expect(result.findings.map((finding) => finding.check)).toEqual(['counter_question'])
  })

  it('строка «Почати: адрес» под таким ответом остаётся ссылкой с названием карточки', () => {
    const raw = `У квест: Тракай — Що зберігає озеро візьмуть близько 120 хв. Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.\n\nПочати: ${trakai.url}`
    expect(guardAnswer(raw, [trakai], { question })).toMatchObject({ fallback: false, text: `У квест: Тракай — Що зберігає озеро візьмуть близько 120 хв.\n\nПочати: [${trakai.title}](${trakai.url})` })
  })

  it('предложение вопроса без знака вопроса вырезается и у ответа со ссылкой', () => {
    const raw = `У квесту [${trakai.title}](${trakai.url}) близько 120 хв. Хочемо ще встигнути в замок.`
    expect(guardAnswer(raw, [trakai], { question })).toMatchObject({ fallback: false, text: `У квесту [${trakai.title}](${trakai.url}) близько 120 хв.`, counterQuestions: 1 })
  })

  it('повтор вопроса без числа из карточки по-прежнему пустой ответ; число, которое стоит только в вопросе, ответом не считается', () => {
    // p10: вопрос и фраза без ссылки, признания и числа.
    expect(guardAnswer('Сколько стоит пройти квест?\n\nОтвет: Цены в карточках — в отдельных пунктах.', [sofia], { question: 'Сколько стоит пройти квест?' })).toMatchObject({ fallback: true })
    // «до 90 минут» есть в вопросе, в карточке — 100 мин: остаток «Да, до 90 минут.» опоры в карточке не имеет.
    const asked = 'Есть ли квест до 90 минут в Софии? Мы идём с детьми вечером.'
    const echoed = guardAnswer(`${asked} Да, до 90 минут.`, [sofia], { question: asked })
    expect(echoed).toMatchObject({ fallback: true })
    expect(echoed.findings.at(-1)).toEqual({ check: 'echo', detail: 'ответ повторяет вопрос посетителя' })
  })

  it('целый повтор вопроса, вырезанный у ответа со ссылкой, — находка `counter_question`; у пустого ответа-повтора находка одна — `echo`', () => {
    const asked = 'Что посмотреть на Хельской косе за неделю?'
    const linked = guardAnswer(`${asked} Подойдёт [${hel.title}](${hel.url}).`, [hel], { question: asked })
    expect(linked).toMatchObject({ fallback: false, text: `Подойдёт [${hel.title}](${hel.url}).`, counterQuestions: 1 })
    expect(linked.findings).toEqual([{ check: 'counter_question', detail: `вопрос вместо ответа: «${asked}»` }])
    const empty = guardAnswer('Сколько стоит пройти квест?\n\nОтвет: Цены в карточках — в отдельных пунктах.', [sofia], { question: 'Сколько стоит пройти квест?' })
    expect(empty.findings.map((finding) => finding.check)).toEqual(['echo'])
  })

  it('вопрос, повторённый подводкой к списку, остаётся; короткое предложение вопроса повтором не считается', () => {
    const lead = `А куди звідти з'їздити на день до моря:\n- [${hel.title}](${hel.url})`
    expect(guardAnswer(lead, [hel], { question: "А куди звідти з'їздити на день до моря?" })).toMatchObject({ fallback: false, text: lead, counterQuestions: 0 })
    const short = `Едем в мае. Подойдёт [${hel.title}](${hel.url}).`
    expect(guardAnswer(short, [hel], { question: 'Куда поехать на море на неделю? Едем в мае.' })).toMatchObject({ fallback: false, text: short, counterQuestions: 0 })
  })
})

describe('подводка к списку, под которой списка нет (lv22 r4, lv45 r3)', () => {
  it('lv22@3: после вырезания встречных вопросов подводка и строка-название без ссылки не остаются', () => {
    const question = 'Nie mamy samochodu. Czy do Malborka da się dojechać pociągiem i co tam zwiedzić?'
    const raw =
      'Do Malborka można dojechać pociągiem z Gdańska, a w mieście warto zwiedzić nie tylko zamki, ale także ciekawe miejsca. Ile kosztuje podróż pociągiem z Gdańska do Malborka?\nKiedy najlepiej wybrać się na zwiedzanie Zamku Malbork i ile to kosztuje?\nRozkłady jazdy pociągów w Polsce:\nMiasto Malbork — Karta turystyczna'
    expect(guardAnswer(raw, [malborkQuest, malbork], { question })).toMatchObject({
      fallback: false,
      text: 'Do Malborka można dojechać pociągiem z Gdańska, a w mieście warto zwiedzić nie tylko zamki, ale także ciekawe miejsca.',
      counterQuestions: 2,
    })
  })

  it('lv45@2: подводка последней фразой ответа уходит и в режиме страницы; остальное на месте', () => {
    const page = { ...grodno, group: 'page' as const }
    const kept = `Статья [${grodno.title}](${grodno.url}) — о поездке по самому Гродну. О том, что рядом с городом не написано.`
    expect(guardAnswer(`${kept} Ближайшее из найденного:`, [page], { question: 'А что ещё есть рядом, если останется полдня?' })).toMatchObject({ fallback: false, text: kept })
  })

  it('подводка остаётся, когда после неё стоит ссылка, пункт списка, законченная фраза или другая подводка', () => {
    const question = 'Что посмотреть в Мальборке за день?'
    for (const answer of [
      `Вот что есть по Мальборку:\n- [${malbork.title}](${malbork.url})`,
      `Вот что есть по Мальборку:\n\n[${malbork.title}](${malbork.url})`,
      `Коротко о городе:\nВ Мальборке стоит посмотреть замок, а подробности — в [${malbork.title}](${malbork.url}).`,
      `Вот лучшие варианты:\n\nНачните с замка — в статье сказано, что смотреть:\n\nЗамок — [${malbork.title}](${malbork.url})`,
    ]) {
      expect({ answer, text: guardAnswer(answer, [malborkQuest, malbork], { question }).text }).toEqual({ answer, text: answer })
    }
  })

  it('каждое вырезание подводки — находка `orphan_lead_in`: и подводки без списка, и заголовка, под которым не осталось пунктов', () => {
    const lv22 = guardAnswer('Do Malborka można dojechać pociągiem z Gdańska, a w mieście warto zwiedzić zamek.\nRozkłady jazdy pociągów w Polsce:\nMiasto Malbork — Karta turystyczna', [malborkQuest, malbork], { question: 'Czy do Malborka da się dojechać pociągiem?' })
    expect(lv22.findings).toEqual([{ check: 'orphan_lead_in', detail: 'подводка без списка: «Rozkłady jazdy pociągów w Polsce: ⏎ Miasto Malbork — Karta turystyczna»' }])
    // Прежнее правило: пункт списка с числом без опоры убран, строка-заголовок над ним уходит вместе с ним.
    const emptied = guardAnswer(`Подробнее в [${malbork.title}](${malbork.url}).\nКороткие квесты:\n- Квест на 45 минут`, [malborkQuest, malbork], { question: 'Что посмотреть в Мальборке за день?' })
    expect(emptied.text).toBe(`Подробнее в [${malbork.title}](${malbork.url}).`)
    expect(emptied.findings.map((finding) => finding.check)).toEqual(['ungrounded_number', 'orphan_lead_in'])
    expect(emptied.findings.at(-1)).toEqual({ check: 'orphan_lead_in', detail: 'подводка без списка: «Короткие квесты:»' })
  })

  describe('строка с содержанием карточки — не название чужого материала (ревью гейта)', () => {
    const grodnoQuest = card('quest', 'Квест по Гродно: две звезды над Неманом', 'https://metravel.by/quests/1/grodno-two-stars', 'Городской квест по городу Гродно (Беларусь). Точек: 8. Время: 120 мин. Что взять с собой: удобную обувь, воду')
    const question = 'Сколько длится квест по Гродно?'

    it('«подводка: ⏎ число из карточки» остаётся ответом — с точкой в конце и без неё', () => {
      for (const answer of ['Время прохождения квеста по Гродно:\n120 мин', 'Время прохождения квеста по Гродно:\n120 мин.']) {
        expect({ answer, ...guardAnswer(answer, [grodnoQuest], { question }) }).toMatchObject({ answer, fallback: false, text: answer, findings: [] })
      }
    })

    it('строки под подводкой со словами карточки остаются; вырезаний без находки нет', () => {
      const answer = `[${grodnoQuest.title}](${grodnoQuest.url}) — 120 мин, 8 точек.\nЧто взять с собой:\nудобную обувь\nводу`
      expect(guardAnswer(answer, [grodnoQuest], { question })).toMatchObject({ fallback: false, text: answer, findings: [] })
    })

    it('число, которого в карточке нет, строку содержанием не делает: подводка и строка уходят с находкой', () => {
      const result = guardAnswer(`Подробнее — [${grodnoQuest.title}](${grodnoQuest.url}).\nДругие маршруты рядом:\nТропа здоровья на 15 км`, [grodnoQuest], { question })
      expect(result.text).toBe(`Подробнее — [${grodnoQuest.title}](${grodnoQuest.url}).`)
      expect(result.findings.map((finding) => finding.check)).toContain('orphan_lead_in')
    })

    it('подводка, в которой самой стоит число карточки, последней фразой остаётся', () => {
      const answer = `Смотрите [${grodnoQuest.title}](${grodnoQuest.url}). На маршрут уйдёт 120 мин:`
      expect(guardAnswer(answer, [grodnoQuest], { question })).toMatchObject({ fallback: false, text: answer, findings: [] })
    })
  })

  it('режим страницы: строки под подводкой — пересказ страницы, они остаются', () => {
    const page = { ...grodno, group: 'page' as const }
    const answer = 'В статье названы места на утро:\nСтарый замок\nНовый замок'
    expect(guardAnswer(answer, [page], { question: 'Что посмотреть утром?' })).toMatchObject({ fallback: false, text: answer })
  })
})
