import { act, renderHook, waitFor } from '@testing-library/react-native'

import { AskError, type AskClient, type AskResult } from '@/api/aiAssist/askProvider'
import { secondsToDayEnd } from '@/api/aiAssist/policy'
import type { AiSource } from '@/api/aiAssist/types'
import { buildHistoryFromTurns, useAssistantChat } from '@/components/screens/assistant/useAssistantChat'

const source: AiSource = {
  type: 'travel',
  source_id: '1',
  title: 'Выходные под Гродно',
  url: 'https://metravel.by/travels/vyhodnye-pod-grodno',
  path: '/travels/vyhodnye-pod-grodno',
  snippet: 'Замки и озёра',
  score: 2,
}


describe('useAssistantChat: серверный /ai/ask (#2884, #3297)', () => {
  type AskRequest = Parameters<AskClient['ask']>[0]
  const doneEvent = (patch: Partial<AskResult['done']> = {}): AskResult['done'] => ({
    status: 'done',
    reason: null,
    strikes: null,
    strikesToBlock: null,
    removedLinks: 0,
    fallback: false,
    relabeled: 0,
    droppedDescriptions: 0,
    ungroundedNumbers: 0,
    usage: null,
    remaining: null,
    turnId: null,
    ...patch,
  })
  /** Фальшивая служба: отдаёт источники, затем накопленный текст кусками, затем done. */
  const scriptedClient = (script: (request: AskRequest) => { sources?: AiSource[]; remaining?: number; texts?: string[]; done: AskResult['done'] }) => {
    const ask = jest.fn(async (request: AskRequest): Promise<AskResult> => {
      const step = script(request)
      const sources = step.sources ?? []
      request.onSources?.({ sources, degraded: false, remaining: step.remaining ?? null })
      let text = ''
      for (const piece of step.texts ?? []) {
        text = piece
        request.onText?.(text)
      }
      return { sources, text, done: step.done }
    })
    return { ask, client: { ask } as AskClient }
  }
  const failingClient = (error: Error): AskClient => ({
    ask: async () => {
      throw error
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('один вызов службы с вопросом, локалью и историей; до первого ответа счётчик неизвестен', async () => {
    const { ask, client } = scriptedClient(() => ({
      sources: [source],
      remaining: 19,
      texts: ['Поезжайте ', 'Поезжайте под Гродно: https://metravel.by/travels/vyhodnye-pod-grodno'],
      done: doneEvent({ removedLinks: 1, remaining: 19, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }),
    }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'pl', askClient: client }))
    expect(result.current.remaining).toBeNull()

    await act(async () => {
      await result.current.ask(' Jakie questy są w  Grodnie? ')
    })

    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask.mock.calls[0][0]).toMatchObject({ question: 'Jakie questy są w Grodnie?', locale: 'pl', history: [] })
    expect(result.current.turns[0]).toMatchObject({
      status: 'done',
      sources: [source],
      answer: 'Поезжайте под Гродно: https://metravel.by/travels/vyhodnye-pod-grodno',
      removedLinks: 1,
      usage: { completion_tokens: 20 },
    })
    expect(result.current.remaining).toBe(19)

    // Уточнение: истории отдаются завершённые пары, опору сервер берёт из неё сам.
    await act(async () => {
      await result.current.ask('А какой z nich dla dzieci?')
    })
    expect(ask.mock.calls[1][0].history).toEqual([
      { role: 'user', text: 'Jakie questy są w Grodnie?' },
      { role: 'assistant', text: 'Поезжайте под Гродно: https://metravel.by/travels/vyhodnye-pod-grodno' },
    ])
  })

  it('слишком длинный вопрос не уходит в сеть', async () => {
    const { ask, client } = scriptedClient(() => ({ sources: [source], texts: ['x'], done: doneEvent() }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    await act(async () => {
      await result.current.ask('в'.repeat(501))
    })
    expect(result.current.inputError).toBe('tooLong')
    expect(ask).not.toHaveBeenCalled()
    expect(result.current.turns).toHaveLength(0)
  })

  it('двойное нажатие «Спросить» не запускает второй вопрос поверх первого', async () => {
    const { ask, client } = scriptedClient(() => ({ sources: [source], texts: ['Ответ'], done: doneEvent() }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))

    await act(async () => {
      await Promise.all([result.current.ask('Куда поехать?'), result.current.ask('Куда поехать?')])
    })

    expect(result.current.turns).toHaveLength(1)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('retry при исчерпанном лимите не снимает ход с ленты и показывает лимит', async () => {
    const ask = jest
      .fn<Promise<AskResult>, [AskRequest]>()
      .mockRejectedValueOnce(new AskError('unavailable', 'down'))
      .mockImplementationOnce(async (request) => {
        request.onSources?.({ sources: [source], degraded: false, remaining: 0 })
        return { sources: [source], text: 'Ответ', done: doneEvent({ remaining: 0 }) }
      })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask } }))
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(result.current.turns[0].status).toBe('unavailable')
    await act(async () => {
      await result.current.ask('А под Гродно?')
    })
    expect(result.current.remaining).toBe(0)

    await act(async () => {
      await result.current.retry(result.current.turns[0].id)
    })
    expect(result.current.turns).toHaveLength(2)
    expect(result.current.turns[0].status).toBe('unavailable')
    expect(result.current.inputError).toBe('limit')
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('история для модели — только завершённые ответы, не длиннее трёх пар', () => {
    const turn = (id: string, status: 'done' | 'no_sources', answer = 'a') =>
      ({ id, question: `q${id}`, answer, sources: [], status, removedLinks: 0, retryAfterSec: null, usage: null }) as const
    const history = buildHistoryFromTurns([turn('1', 'done'), turn('2', 'no_sources'), turn('3', 'done'), turn('4', 'done'), turn('5', 'done', ' ')])
    expect(history.map((h) => h.text)).toEqual(['q1', 'a', 'q3', 'a', 'q4', 'a'])
  })

  // #3296: оценка ответа — идентификатор хода приходит от службы, голос уходит в `POST /ai/feedback`.
  it('#3296: голос за ответ — один на ход; после «Не помогло» причина уточняется один раз; ход без идентификатора не оценивается', async () => {
    const feedback = jest.fn(async () => true)
    const { ask } = scriptedClient(() => ({ sources: [source], remaining: 19, texts: ['Поезжайте под Гродно.'], done: doneEvent({ remaining: 19, turnId: 'turn-1' }) }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask, feedback } }))
    await act(async () => {
      await result.current.ask('Куда поехать на выходные?')
    })
    const [turn] = result.current.turns
    expect(turn).toMatchObject({ status: 'done', feedbackId: 'turn-1' })
    expect(turn.vote ?? null).toBeNull()

    await act(async () => {
      result.current.rate(turn.id, 'down')
    })
    expect(feedback).toHaveBeenLastCalledWith({ turnId: 'turn-1', vote: 'down', reason: null })
    expect(result.current.turns[0]).toMatchObject({ vote: 'down', voteReason: null })
    // Причина — тот же голос, уточнённый один раз.
    await act(async () => {
      result.current.rate(turn.id, 'down', 'place')
    })
    expect(feedback).toHaveBeenLastCalledWith({ turnId: 'turn-1', vote: 'down', reason: 'place' })
    expect(result.current.turns[0]).toMatchObject({ vote: 'down', voteReason: 'place' })
    // Второй голос и вторая причина не уходят.
    await act(async () => {
      result.current.rate(turn.id, 'up')
      result.current.rate(turn.id, 'down', 'facts')
    })
    expect(feedback).toHaveBeenCalledTimes(2)
    expect(result.current.turns[0]).toMatchObject({ vote: 'down', voteReason: 'place' })
  })

  it('#3296: «Помогло» — один запрос; служба без идентификатора хода и клиент без оценки кнопок не дают', async () => {
    const feedback = jest.fn(async () => false)
    const liked = scriptedClient(() => ({ sources: [source], remaining: 19, texts: ['Ответ.'], done: doneEvent({ remaining: 19, turnId: 'turn-2' }) }))
    const first = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask: liked.ask, feedback } }))
    await act(async () => {
      await first.result.current.ask('Куда поехать на выходные?')
    })
    await act(async () => {
      first.result.current.rate(first.result.current.turns[0].id, 'up')
      first.result.current.rate(first.result.current.turns[0].id, 'up')
    })
    expect(feedback).toHaveBeenCalledTimes(1)
    // Отказ службы голос на экране не отменяет: оценка необязательна.
    expect(first.result.current.turns[0]).toMatchObject({ vote: 'up', voteReason: null })

    // Служба без оценки (`turn_id` нет): ход не оценивается.
    const plain = scriptedClient(() => ({ sources: [source], remaining: 19, texts: ['Ответ.'], done: doneEvent({ remaining: 19 }) }))
    const second = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask: plain.ask, feedback } }))
    await act(async () => {
      await second.result.current.ask('Куда поехать на выходные?')
    })
    expect(second.result.current.turns[0].feedbackId ?? null).toBeNull()
    await act(async () => {
      second.result.current.rate(second.result.current.turns[0].id, 'up')
    })
    expect(feedback).toHaveBeenCalledTimes(1)

    // Клиент без метода оценки идентификатор не сохраняет вовсе.
    const { client } = scriptedClient(() => ({ sources: [source], remaining: 19, texts: ['Ответ.'], done: doneEvent({ remaining: 19, turnId: 'turn-3' }) }))
    const third = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    await act(async () => {
      await third.result.current.ask('Куда поехать на выходные?')
    })
    expect(third.result.current.turns[0].feedbackId ?? null).toBeNull()
  })

  it('#3290: группа карточки из события sources доходит до хода — экран рисует «Ещё по теме» отдельно', async () => {
    const pageCard: AiSource = { ...source, group: 'page' }
    const nearby: AiSource = { ...source, source_id: '700', title: 'Тропа Мюллерталь', url: 'https://metravel.by/travels/700', path: '/travels/700', group: 'nearby' }
    const { ask, client } = scriptedClient(() => ({ sources: [pageCard, nearby], remaining: 18, texts: ['На странице этого нет.'], done: doneEvent({ remaining: 18 }) }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client, source: { type: 'travel', id: 1 }, loadSource: async () => source }))
    await act(async () => {
      await result.current.ask('Сколько дней занимает поездка?')
    })
    expect(ask.mock.calls[0][0]).toMatchObject({ source: { type: 'travel', id: 1 } })
    expect(result.current.turns[0].sources.map((item) => [item.source_id, item.group])).toEqual([['1', 'page'], ['700', 'nearby']])
  })

  it('#3291: служба прислала done с fallback — ход done без текста и с признаком запасного ответа', async () => {
    const { client } = scriptedClient(() => ({ sources: [source], remaining: 18, texts: ['Сколько стоит', ''], done: doneEvent({ fallback: true, remaining: 18 }) }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    await act(async () => {
      await result.current.ask('Сколько стоит пройти квест?')
    })
    expect(result.current.turns[0]).toMatchObject({ status: 'done', answer: '', fallback: true, noMaterial: false, sources: [source] })
    expect(buildHistoryFromTurns(result.current.turns)).toEqual([])
  })

  it('#3345: служба прислала done с fallback и причиной no_material — ход «материала нет» с найденным рядом; без причины он остаётся запасным ответом стража', async () => {
    const nearby = { ...source, group: 'nearby' as const }
    const { client } = scriptedClient(() => ({ sources: [nearby], remaining: 18, texts: [''], done: doneEvent({ fallback: true, reason: 'no_material', remaining: 18 }) }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    await act(async () => {
      await result.current.ask('Где погулять с собакой недалеко от Варшавы?')
    })
    expect(result.current.turns[0]).toMatchObject({ status: 'done', answer: '', fallback: true, noMaterial: true, sources: [nearby] })
    expect(buildHistoryFromTurns(result.current.turns)).toEqual([])
    // Причина без `fallback` (чужой поток) ход «материала нет» не включает.
    const odd = scriptedClient(() => ({ sources: [source], remaining: 18, texts: ['Ответ.'], done: doneEvent({ reason: 'no_material', remaining: 18 }) }))
    const second = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: odd.client }))
    await act(async () => {
      await second.result.current.ask('Что посмотреть в Гродно?')
    })
    expect(second.result.current.turns[0]).toMatchObject({ status: 'done', answer: 'Ответ.', fallback: false, noMaterial: false })
  })

  it('вопрос не по теме: предупреждение с номером от сервера; отказ модели — без номера; нет карточек — no_sources', async () => {
    const { client } = scriptedClient(({ question }) =>
      question === 'каша'
        ? { remaining: 20, done: doneEvent({ status: 'off_topic', reason: 'offtopic_warning', strikes: 2, strikesToBlock: 3 }) }
        : question === 'refusal'
          ? { sources: [source], remaining: 19, texts: ['Я помогаю только'], done: doneEvent({ status: 'off_topic', reason: 'model_refusal' }) }
          : { remaining: 18, done: doneEvent({ status: 'no_sources' }) },
    )
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    for (const question of ['каша', 'refusal', 'Исландия зимой']) {
      await act(async () => {
        await result.current.ask(question)
      })
    }
    expect(result.current.turns.map((turn) => [turn.status, turn.offTopicStrikes, turn.answer, turn.sources.length])).toEqual([
      ['off_topic', 2, '', 0],
      ['off_topic', null, '', 0],
      ['no_sources', null, '', 0],
    ])
    expect(result.current.offTopicBlocked).toBe(false)
    expect(result.current.remaining).toBe(18)
  })

  it('429 offtopic_blocked: блок до полуночи с сервера — ход с подписью блока, следующий вопрос не уходит в сеть', async () => {
    const ask = jest.fn(async () => {
      throw new AskError('offtopic_blocked', 'blocked', { status: 429, retryAfterSec: 3600, strikes: 3 })
    })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask } }))
    await act(async () => {
      await result.current.ask('рецепт борща')
    })
    expect(result.current.turns[0]).toMatchObject({ status: 'off_topic', offTopicStrikes: 3 })
    expect(result.current.offTopicBlocked).toBe(true)

    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(ask).toHaveBeenCalledTimes(1)
    expect(result.current.inputError).toBe('offTopicBlocked')
    expect(result.current.turns).toHaveLength(1)
  })

  it('429 limit: вопрос снимается с ленты, счётчик — ноль, подпись лимита; повтор не уходит в сеть', async () => {
    const ask = jest.fn(async () => {
      throw new AskError('limit', 'limit', { status: 429, retryAfterSec: 3600 })
    })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask } }))
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(result.current.turns).toHaveLength(0)
    expect(result.current.remaining).toBe(0)
    expect(result.current.inputError).toBe('limit')
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('лимит и блок с сервера держатся до Retry-After, remaining=0 из ответа — до конца дня сервера; затем вопрос снова уходит на сервер', async () => {
    jest.useFakeTimers()
    try {
      const ask = jest
        .fn<Promise<AskResult>, [AskRequest]>()
        .mockResolvedValueOnce({ sources: [source], text: 'Последний', done: doneEvent({ remaining: 0 }) })
        .mockRejectedValueOnce(new AskError('limit', 'limit', { status: 429, retryAfterSec: 60 }))
        .mockRejectedValueOnce(new AskError('offtopic_blocked', 'blocked', { status: 429, retryAfterSec: 30, strikes: 3 }))
        .mockResolvedValue({ sources: [source], text: 'Ответ', done: doneEvent({ remaining: 19 }) })
      const { result, unmount } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask } }))

      // Двадцатый вопрос дня: сервер отдал remaining 0 без Retry-After — срок до конца дня сервера.
      await act(async () => {
        await result.current.ask('Куда поехать?')
      })
      expect(result.current.remaining).toBe(0)
      await act(async () => {
        await result.current.ask('Куда поехать?')
      })
      expect(ask).toHaveBeenCalledTimes(1)
      await act(async () => {
        jest.advanceTimersByTime(secondsToDayEnd() * 1000 + 1000)
      })
      expect(result.current.remaining).toBeNull()

      // 429 limit: срок из Retry-After.
      await act(async () => {
        await result.current.ask('Куда поехать?')
      })
      expect(ask).toHaveBeenCalledTimes(2)
      expect(result.current.inputError).toBe('limit')
      expect(result.current.remaining).toBe(0)
      await act(async () => {
        jest.advanceTimersByTime(61_000)
      })
      expect(result.current.remaining).toBeNull()
      expect(result.current.inputError).toBeNull()

      // 429 offtopic_blocked: блок до Retry-After, после — композер открыт и вопрос уходит на сервер.
      await act(async () => {
        await result.current.ask('рецепт борща')
      })
      expect(ask).toHaveBeenCalledTimes(3)
      expect(result.current.offTopicBlocked).toBe(true)
      await act(async () => {
        await result.current.ask('Куда поехать?')
      })
      expect(ask).toHaveBeenCalledTimes(3)
      expect(result.current.inputError).toBe('offTopicBlocked')
      await act(async () => {
        jest.advanceTimersByTime(31_000)
      })
      expect(result.current.offTopicBlocked).toBe(false)
      expect(result.current.inputError).toBeNull()
      await act(async () => {
        await result.current.ask('Куда поехать?')
      })
      expect(ask).toHaveBeenCalledTimes(4)
      expect(result.current.turns.at(-1)).toMatchObject({ status: 'done', answer: 'Ответ' })
      expect(result.current.remaining).toBe(19)
      unmount()
    } finally {
      jest.useRealTimers()
    }
  })

  it('служба недоступна → unavailable без журнала на клиенте; retry повторяет вопрос; 429 busy → busy с Retry-After', async () => {
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: failingClient(new AskError('unavailable', 'down', { status: 503 })) }))
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(result.current.turns[0].status).toBe('unavailable')
    expect(result.current.remaining).toBeNull()
    const turnId = result.current.turns[0].id
    await act(async () => {
      await result.current.retry(turnId)
    })
    expect(result.current.turns).toHaveLength(1)
    expect(result.current.turns[0].id).not.toBe(turnId)
    expect(result.current.turns[0].status).toBe('unavailable')

    const busy = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: failingClient(new AskError('busy', 'busy', { status: 429, retryAfterSec: 15 })) }))
    await act(async () => {
      await busy.result.current.ask('q')
    })
    expect(busy.result.current.turns[0]).toMatchObject({ status: 'busy', retryAfterSec: 15 })

    // Обрыв посреди ответа: показанное остаётся, статус — «недоступен» с кнопкой «Повторить».
    const broken = await renderHook(() =>
      useAssistantChat({ locale: 'ru', askClient: scriptedClient(() => ({ sources: [source], remaining: 19, texts: ['обрыв'], done: doneEvent({ status: 'unavailable' }) })).client }),
    )
    await act(async () => {
      await broken.result.current.ask('q')
    })
    expect(broken.result.current.turns[0]).toMatchObject({ status: 'unavailable', answer: 'обрыв', sources: [source] })
  })

  it('«Остановить» отменяет запрос службы → aborted', async () => {
    let stop: (() => void) | null = null
    const client: AskClient = {
      ask: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new AskError('aborted', 'aborted')))
          // Посетитель нажимает «Остановить», пока служба ещё отвечает.
          setTimeout(() => stop?.(), 0)
        }),
    }
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    stop = () => result.current.stop()
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(result.current.turns[0].status).toBe('aborted')
    expect(result.current.busy).toBe(false)
  })
})


describe('useAssistantChat: контекстный вход со страницы статьи/квеста (#2897)', () => {
  const pinned: AiSource = {
    type: 'travel',
    source_id: '816',
    title: 'Ярмарки Польши',
    url: 'https://metravel.by/travels/816',
    path: '/travels/816',
    snippet: 'Краков. Рождественские ярмарки',
    score: 1,
  }
  const ref = { type: 'travel' as const, id: 816 }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('источник уходит на сервер с каждым запросом, карточку для экрана грузит клиент', async () => {
    const ask = jest.fn(async (request: Parameters<AskClient['ask']>[0]): Promise<AskResult> => {
      request.onSources?.({ sources: [pinned, source], degraded: false, remaining: 19 })
      request.onText?.('Ответ')
      return { sources: [pinned, source], text: 'Ответ', done: { status: 'done', reason: null, strikes: null, strikesToBlock: null, removedLinks: 0, usage: null, remaining: 19 } }
    })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'pl', askClient: { ask }, source: ref, loadSource: async () => pinned }))
    await waitFor(() => expect(result.current.sourceCard).toEqual(pinned))

    await act(async () => {
      await result.current.ask('Ile czasu to zajmie?')
    })
    await act(async () => {
      await result.current.ask('A co jest w pobliżu?')
    })
    expect(ask).toHaveBeenCalledTimes(2)
    expect(ask.mock.calls[0][0]).toMatchObject({ question: 'Ile czasu to zajmie?', locale: 'pl', source: ref })
    expect(ask.mock.calls[1][0]).toMatchObject({ source: ref, history: [{ role: 'user', text: 'Ile czasu to zajmie?' }, { role: 'assistant', text: 'Ответ' }] })
    expect(result.current.turns[1].sources[0]).toEqual(pinned)
  })

  it('без источника запрос службы не несёт source, карточки нет', async () => {
    const ask = jest.fn(async (): Promise<AskResult> => ({ sources: [], text: '', done: { status: 'no_sources', reason: null, strikes: null, strikesToBlock: null, removedLinks: 0, usage: null, remaining: null } }))
    const loadSource = jest.fn()
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: { ask }, loadSource }))
    await act(async () => {
      await result.current.ask('Куда поехать?')
    })
    expect(loadSource).not.toHaveBeenCalled()
    expect(result.current.sourceRef).toBeNull()
    expect(ask.mock.calls[0][0].source).toBeNull()
  })
})
