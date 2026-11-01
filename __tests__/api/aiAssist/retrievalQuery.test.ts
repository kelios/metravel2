import { buildRetrievalQuery, isFollowUpQuestion, isStandaloneQuestion, resolveRetrievalAnchor } from '@/api/aiAssist/retrievalQuery'
import { buildRetrievalQuery as reExportedBuildRetrievalQuery } from '@/api/aiAssist/retrieval'

/**
 * Опора уточнений (#2719) в общем для экрана и сервера `/ai/ask` модуле (#2884):
 * без `@/`-импортов, чтобы `scripts/ai-assist` собирался тем же кодом.
 */
describe('aiAssist retrievalQuery: опора уточнений (#2719 → #2884)', () => {
  it('уточнение в диалоге ищется вместе с прошлым запросом, своё место — само по себе', () => {
    const previous = 'Какие квесты есть в Гродно?'
    expect(isFollowUpQuestion('А какой из них подойдёт детям?')).toBe(true)
    expect(isFollowUpQuestion('Што там паглядзець?')).toBe(true)
    expect(isFollowUpQuestion('And which of them is for kids?')).toBe(true)
    expect(isFollowUpQuestion('Какие квесты есть в Минске?')).toBe(false)
    // Английский артикль «A …» и «этой зимой» — не уточнение.
    expect(isFollowUpQuestion('A good castle for kids?')).toBe(false)
    expect(isFollowUpQuestion('A weekend with kids — where to go?')).toBe(false)
    expect(isFollowUpQuestion('Куда поехать этой зимой с детьми?')).toBe(false)
    expect(isFollowUpQuestion('A co w Gdańsku?')).toBe(true)

    expect(buildRetrievalQuery('А какой из них подойдёт детям?', previous)).toBe('Какие квесты есть в Гродно? А какой из них подойдёт детям?')
    expect(buildRetrievalQuery('А в Бресте?', previous)).toBe('А в Бресте?')
    expect(buildRetrievalQuery('Что посмотреть в Риге?', previous)).toBe('Что посмотреть в Риге?')
    expect(buildRetrievalQuery('А какой из них подойдёт детям?', null)).toBe('А какой из них подойдёт детям?')
    // Своё место после «про/на» — тоже самостоятельный вопрос.
    expect(buildRetrievalQuery('А про Брест?', previous)).toBe('А про Брест?')
    expect(buildRetrievalQuery('А на Нарочи что есть?', previous)).toBe('А на Нарочи что есть?')
    // Английское «I …» — местоимение, а не польское «И …»; «is there/there are» — оборот.
    expect(isFollowUpQuestion('I want to see castles with kids')).toBe(false)
    expect(isFollowUpQuestion("I'm looking for a quest")).toBe(false)
    expect(isFollowUpQuestion('Is there a quest for kids?')).toBe(false)
    expect(isFollowUpQuestion('There are castles nearby?')).toBe(false)
    expect(isFollowUpQuestion('Are there cafes there?')).toBe(true)
    expect(isFollowUpQuestion('A co z dziećmi?')).toBe(true)
    expect(isFollowUpQuestion('I gdzie zaparkować?')).toBe(true)
  })

  it('retrieval.ts отдаёт ту же функцию: клиент llamacpp и сервер не расходятся', () => {
    expect(reExportedBuildRetrievalQuery).toBe(buildRetrievalQuery)
    expect(isStandaloneQuestion('Какие квесты есть в Гродно?')).toBe(true)
    expect(isStandaloneQuestion('А в Бресте?')).toBe(true)
    expect(isStandaloneQuestion('А какой из них подойдёт детям?')).toBe(false)
  })

  it('опора из истории — последний самостоятельный вопрос посетителя; уточнения и ответы модели опорой не становятся', () => {
    expect(resolveRetrievalAnchor([])).toBeNull()
    expect(
      resolveRetrievalAnchor([
        { role: 'user', text: 'Что посмотреть в Несвиже?' },
        { role: 'assistant', text: 'Несвижский замок и парк.' },
      ]),
    ).toBe('Что посмотреть в Несвиже?')
    // Цепочка уточнений: опора — Несвиж, а не «А там есть музеи?» и не «Где поесть там?».
    expect(
      resolveRetrievalAnchor([
        { role: 'user', text: 'Что  посмотреть в Несвиже? ' },
        { role: 'assistant', text: 'Замок.' },
        { role: 'user', text: 'А какой подойдёт детям?' },
        { role: 'assistant', text: 'Парк.' },
        { role: 'user', text: 'А там есть музеи?' },
        { role: 'assistant', text: 'Есть.' },
      ]),
    ).toBe('Что посмотреть в Несвиже?')
    // Своё место в уточнении переключает опору.
    expect(
      resolveRetrievalAnchor([
        { role: 'user', text: 'Что посмотреть в Несвиже?' },
        { role: 'assistant', text: 'Замок.' },
        { role: 'user', text: 'А в Бресте?' },
        { role: 'assistant', text: 'Крепость.' },
      ]),
    ).toBe('А в Бресте?')
    // Ответ модели с названием места — не вопрос посетителя.
    expect(resolveRetrievalAnchor([{ role: 'assistant', text: 'Поезжайте в Гродно.' }, { role: 'user', text: 'А из них?' }])).toBeNull()
    // Склейка ровно такая же, как у клиента llamacpp.
    const history = [
      { role: 'user' as const, text: 'Какие квесты есть в Гродно?' },
      { role: 'assistant' as const, text: 'Три квеста.' },
    ]
    expect(buildRetrievalQuery('А какой из них подойдёт детям?', resolveRetrievalAnchor(history))).toBe(
      'Какие квесты есть в Гродно? А какой из них подойдёт детям?',
    )
  })
})
