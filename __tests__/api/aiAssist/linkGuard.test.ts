import { enforceSourceLinks, stripThinking } from '@/api/aiAssist/linkGuard'
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

  it('markdown-ссылка с чужим адресом превращается в подпись, со своим — остаётся', () => {
    const text = 'Читайте [статью](https://metravel.by/travels/vyhodnye-pod-grodno) и [эту](https://example.com/x).'
    const result = enforceSourceLinks(text, sources)
    expect(result.removed).toBe(1)
    expect(result.text).toContain('[статью](https://metravel.by/travels/vyhodnye-pod-grodno)')
    expect(result.text).toContain('и эту.')
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
    expect(enforceSourceLinks(refusal, sources)).toEqual({ text: 'Я ассистент metravel.by по путешествиям, а — нет.', removed: 1 })
  })

  it('после вырезания не остаётся висящего тире и заглушек модели (#2710)', () => {
    const raw = 'Стартуйте с истории — https://evil.example/x\nОтель в Кракове — https://booking.com/h.\nСм. __draft_placeholder__ путеводитель.'
    expect(enforceSourceLinks(raw, sources)).toEqual({ text: 'Стартуйте с истории\nОтель в Кракове\nСм. путеводитель.', removed: 2 })
  })

  it('ссылка с искажённым адресом, но точным названием карточки получает адрес карточки (#2710)', () => {
    const title = sources[0].title
    const raw = `Начните с [${title}](https://metravel.by/travels/iskazhennyi-adres) и [чужого](https://metravel.by/travels/net)`
    expect(enforceSourceLinks(raw, sources)).toEqual({ text: `Начните с [${title}](${sources[0].url}) и чужого`, removed: 1 })
  })

  it('служебные <think> блоки снимаются, незакрытый — целиком', () => {
    expect(stripThinking('<think>размышляю</think>Ответ')).toBe('Ответ')
    expect(stripThinking('<think>ещё думаю')).toBe('')
    expect(enforceSourceLinks('<think>https://evil.example</think>Готово', sources)).toEqual({ text: 'Готово', removed: 0 })
  })
})
