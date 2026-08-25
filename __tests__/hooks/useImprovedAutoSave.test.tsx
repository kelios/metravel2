import { act, renderHook } from '@testing-library/react-native'

import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave'

describe('useImprovedAutoSave', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('does not switch to error state for an aborted save', async () => {
    jest.useFakeTimers()

    const onSave = jest.fn(async () => {
      throw new Error('Request aborted')
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          onError,
        }),
      {
        initialProps: { data: { value: 'initial' } },
      }
    )

    rerender({ data: { value: 'updated' } })

    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.status).toBe('debouncing')
    expect(result.current.phase).toBe('pending')
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.error).toBeNull()
  })

  // Прод-инцидент 2026-08-19 (travel/619): upsert тяжёлого маршрута идёт 11–12 c,
  // дольше debounce. Старое поведение «следующий тик отменяет предыдущий запрос»
  // означало, что медленный сейв не доживал до ответа НИКОГДА: nginx писал 499,
  // клиент стартовал новый запрос, и так по кругу (466 запросов за сутки).
  it('does not abort a save that is still in flight when the debounce fires again', async () => {
    jest.useFakeTimers()

    const abortedSignals: boolean[] = []
    let resolveSave: ((value: { value: string }) => void) | null = null
    const onSave = jest.fn((data: { value: string }, signal?: AbortSignal) => {
      signal?.addEventListener('abort', () => abortedSignals.push(true))
      return new Promise<{ value: string }>((resolve) => {
        resolveSave = resolve
      })
    })

    const { rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'updated' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // Запрос всё ещё летит — следующие тики debounce обязаны его пропустить,
    // а не оборвать и перезапустить.
    for (let tick = 0; tick < 3; tick += 1) {
      rerender({ data: { value: 'updated' } })
      await act(async () => {
        jest.advanceTimersByTime(60)
        await Promise.resolve()
      })
    }

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(abortedSignals).toEqual([])

    await act(async () => {
      resolveSave?.({ value: 'updated' })
      await Promise.resolve()
    })
  })

  it('keeps changes local while offline and saves them after reconnect', async () => {
    jest.useFakeTimers()
    const onSave = jest.fn(async (data: { value: string }) => data)

    const { result, rerender } = renderHook(
      ({ data, isOnline }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          isOnline,
        }),
      { initialProps: { data: { value: 'initial' }, isOnline: false } },
    )

    rerender({ data: { value: 'offline edit' }, isOnline: false })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.isOnline).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.phase).toBe('pending')

    rerender({ data: { value: 'offline edit' }, isOnline: true })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ value: 'offline edit' }, expect.any(Object), expect.any(Object))
    expect(result.current.isOnline).toBe(true)
  })

  it('does not retry an expired-session response', async () => {
    jest.useFakeTimers()
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    const onSave = jest.fn(async () => {
      throw authError
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 20,
          retryDelay: 10,
          onSave,
          onError,
          isOnline: true,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'needs auth' } })
    await act(async () => {
      jest.advanceTimersByTime(200)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(authError)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error & { status?: number }).status).toBe(401)

    rerender({ data: { value: 'another local edit' } })
    await act(async () => {
      jest.advanceTimersByTime(200)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error & { status?: number }).status).toBe(401)
  })

  // #1516: потребителю нужно знать, ЧЕМ подтверждённое состояние отличается от
  // отправляемого, иначе он не может послать только изменившиеся поля. Baseline
  // приходит третьим аргументом и обязан быть последним подтверждённым payload,
  // а не исходными данными и не текущим снимком.
  it('passes the confirmed baseline to onSave', async () => {
    jest.useFakeTimers()

    const onSave = jest.fn(async (data: { value: string }) => data)

    const { rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'first' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    // Первое сохранение: подтверждённым остаётся исходное состояние.
    expect(onSave).toHaveBeenLastCalledWith(
      { value: 'first' },
      expect.any(Object),
      { value: 'initial' },
    )

    rerender({ data: { value: 'second' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    // Второе: baseline сдвинулся на успешно отправленный payload.
    expect(onSave).toHaveBeenLastCalledWith(
      { value: 'second' },
      expect.any(Object),
      { value: 'first' },
    )

    jest.useRealTimers()
  })

  // Пропущенный тик не должен просто исчезать: правки, сделанные во время
  // полёта, обязаны уйти ОДНИМ сохранением после его завершения, иначе автор
  // видит «Сохранено», а последние абзацы на сервер не попали.
  it('sends the edits made during a flight as a single follow-up save', async () => {
    jest.useFakeTimers()

    let resolveSave: ((value: { value: string }) => void) | null = null
    const onSave = jest.fn((data: { value: string }) => new Promise<{ value: string }>((resolve) => {
      resolveSave = () => resolve(data)
    }))

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'first' } })
    expect(result.current.phase).toBe('pending')
    expect(result.current.localRevision).toBe(1)
    expect(result.current.confirmedRevision).toBe(0)
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'first' }, expect.any(Object), expect.any(Object))
    expect(result.current.phase).toBe('saving')
    expect(result.current.inFlightRevision).toBe(1)

    // Автор продолжает печатать, пока первый сейв ещё летит.
    rerender({ data: { value: 'second' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('saving')
    expect(result.current.localRevision).toBe(2)
    expect(result.current.inFlightRevision).toBe(1)

    await act(async () => {
      resolveSave?.({ value: 'first' })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Сохранение подтверждено, но неотправленные правки есть — статус не «saved».
    expect(result.current.status).toBe('debouncing')
    expect(result.current.phase).toBe('pending')
    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.confirmedRevision).toBe(1)
    expect(result.current.localRevision).toBe(2)
    expect(result.current.lastSavedAt).not.toBeNull()

    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'second' }, expect.any(Object), expect.any(Object))

    await act(async () => {
      resolveSave?.({ value: 'second' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('saved')
    expect(result.current.confirmedRevision).toBe(2)
    expect(result.current.localRevision).toBe(2)
    expect(result.current.inFlightRevision).toBeNull()
  })

  it('recognizes the exact confirmed snapshot even after later revisions revert to it', async () => {
    jest.useFakeTimers()

    let resolveSave: ((value: { value: string }) => void) | null = null
    const onSave = jest.fn((data: { value: string }) => new Promise<{ value: string }>((resolve) => {
      resolveSave = () => resolve(data)
    }))

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'first' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    rerender({ data: { value: 'second' } })
    rerender({ data: { value: 'first' } })
    expect(result.current.localRevision).toBe(3)

    await act(async () => {
      resolveSave?.({ value: 'first' })
      await Promise.resolve()
      await Promise.resolve()
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('saved')
    expect(result.current.confirmedRevision).toBe(3)
    expect(result.current.localRevision).toBe(3)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('keeps the saved confirmation after the form adopts an equal server snapshot', async () => {
    jest.useFakeTimers()
    const onSave = jest.fn(async (data: { value: string }) => data)

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'confirmed' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('saved')
    const savedAt = result.current.lastSavedAt

    // applySavedData/reset creates a new object even when the confirmed content
    // is unchanged. The status must still describe the server confirmation.
    rerender({ data: { value: 'confirmed' } })
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('saved')
    expect(result.current.lastSavedAt).toBe(savedAt)
  })

  it('keeps a compensating revert pending when an in-flight request will overwrite the baseline', async () => {
    jest.useFakeTimers()

    let resolveSave: ((value: { value: string }) => void) | null = null
    const onSave = jest.fn((data: { value: string }) => new Promise<{ value: string }>((resolve) => {
      resolveSave = () => resolve(data)
    }))

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'server-will-receive-this' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    rerender({ data: { value: 'initial' } })
    expect(result.current.phase).toBe('saving')

    await act(async () => {
      resolveSave?.({ value: 'server-will-receive-this' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('pending')
    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'initial' }, expect.any(Object), expect.any(Object))
  })

  // Порог для смоука из карточки #1511: за длительную непрерывную правку число
  // дошедших до сервера сохранений не превышает «завершённые + одно летящее».
  it('keeps at most one in-flight save while the author types continuously', async () => {
    jest.useFakeTimers()

    const abortedSignals: string[] = []
    const pending: Array<(value: { value: string }) => void> = []
    const onSave = jest.fn((data: { value: string }, signal?: AbortSignal) => {
      signal?.addEventListener('abort', () => abortedSignals.push(data.value))
      return new Promise<{ value: string }>((resolve) => {
        pending.push(resolve)
      })
    })

    const { rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    // Десять debounce-тиков подряд при неотвечающем сервере.
    for (let tick = 1; tick <= 10; tick += 1) {
      rerender({ data: { value: `edit-${tick}` } })
      await act(async () => {
        jest.advanceTimersByTime(60)
        await Promise.resolve()
      })
      expect(onSave.mock.calls.length).toBeLessThanOrEqual(1)
    }

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(abortedSignals).toEqual([])

    await act(async () => {
      pending[0]?.({ value: 'edit-1' })
      await Promise.resolve()
      await Promise.resolve()
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    // Одно завершённое + одно летящее.
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'edit-10' }, expect.any(Object), expect.any(Object))
    expect(abortedSignals).toEqual([])
  })

  // Право вытеснения остаётся у явного действия автора, и его результат
  // не откатывается поздним завершением фонового сохранения.
  it('lets an explicit save preempt the background one and win', async () => {
    jest.useFakeTimers()

    const abortedSignals: string[] = []
    const resolvers = new Map<string, (value: { value: string }) => void>()
    const onSave = jest.fn((data: { value: string }, signal?: AbortSignal) => {
      signal?.addEventListener('abort', () => abortedSignals.push(data.value))
      return new Promise<{ value: string }>((resolve) => {
        resolvers.set(data.value, resolve)
      })
    })
    const onSuccess = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          onSuccess,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'background' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    rerender({ data: { value: 'explicit' } })
    let explicitSave: Promise<unknown> | null = null
    await act(async () => {
      explicitSave = result.current.saveNow()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'explicit' }, expect.any(Object), expect.any(Object))
    expect(abortedSignals).toEqual(['background'])

    await act(async () => {
      // Фоновое сохранение отвечает уже после того, как его вытеснили.
      resolvers.get('background')?.({ value: 'background' })
      await Promise.resolve()
      resolvers.get('explicit')?.({ value: 'explicit' })
      await explicitSave
      await Promise.resolve()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith({ value: 'explicit' })
    expect(result.current.status).toBe('saved')
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  // Наш таймаут не отменяет работу сервера. Повтор сразу после него — вторая
  // тяжёлая транзакция по той же статье, поэтому повторов нет, а фоновые сейвы
  // молчат, пока предыдущая попытка может выполняться.
  it('does not retry after a client timeout and holds off background saves', async () => {
    jest.useFakeTimers()

    const timeoutError = Object.assign(new Error('Превышено время ожидания 65000 ms'), {
      name: 'TimeoutError',
    })
    const onSave = jest.fn(async () => {
      throw timeoutError
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 20,
          retryDelay: 10,
          maxRetries: 3,
          timeoutCooldown: 1000,
          onSave,
          onError,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'slow server' } })
    await act(async () => {
      jest.advanceTimersByTime(50)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(timeoutError)
    expect(result.current.status).toBe('error')

    // Правка внутри окна — запрос не уходит.
    rerender({ data: { value: 'more typing' } })
    await act(async () => {
      jest.advanceTimersByTime(50)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // Окно истекло — сохранение возобновляется само, без новой правки.
    await act(async () => {
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'more typing' }, expect.any(Object), expect.any(Object))
  })

  it('does not retry a gateway timeout and holds off background saves', async () => {
    jest.useFakeTimers()

    // Штатный исход перегруженного сохранения: SAVE_TRAVEL_TIMEOUT (65 с) выше
    // nginx `proxy_read_timeout 60s`, поэтому сдаётся сервер, а не клиент. На
    // HTTP/2 `statusText` пуст, так что сообщение слова "timeout" не содержит —
    // распознаём по статусу, иначе 504 уходил бы в общий retry для 5xx.
    const gatewayTimeout = Object.assign(new Error('HTTP 504'), { status: 504 })
    const onSave = jest.fn(async () => {
      throw gatewayTimeout
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 20,
          retryDelay: 10,
          maxRetries: 3,
          timeoutCooldown: 1000,
          onSave,
          onError,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'slow server' } })
    await act(async () => {
      jest.advanceTimersByTime(50)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(gatewayTimeout)
    expect(result.current.status).toBe('error')

    // Правка внутри окна — вторая транзакция по заблокированной строке не уходит.
    rerender({ data: { value: 'more typing' } })
    await act(async () => {
      jest.advanceTimersByTime(50)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // Окно истекло — сохранение возобновляется само, с актуальными данными.
    await act(async () => {
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({ value: 'more typing' }, expect.any(Object), expect.any(Object))
  })

  it('does not retry a validation rejection and surfaces it to the author', async () => {
    jest.useFakeTimers()

    const validationError = Object.assign(new Error('Bad request'), { status: 400 })
    const onSave = jest.fn(async () => {
      throw validationError
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 20,
          retryDelay: 10,
          onSave,
          onError,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'invalid' } })
    await act(async () => {
      jest.advanceTimersByTime(200)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(validationError)
    expect(result.current.status).toBe('error')
    expect(result.current.phase).toBe('error')
    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.lastSavedAt).toBeNull()
  })

  // Уход со страницы: результат летящего сохранения не применяется к состоянию
  // размонтированного экрана, неподтверждённые правки остаются у черновика.
  it('drops the result of an in-flight save after unmount', async () => {
    jest.useFakeTimers()

    const abortedSignals: string[] = []
    let resolveSave: (() => void) | null = null
    const onSave = jest.fn((data: { value: string }, signal?: AbortSignal) => {
      signal?.addEventListener('abort', () => abortedSignals.push(data.value))
      return new Promise<{ value: string }>((resolve) => {
        resolveSave = () => resolve(data)
      })
    })
    const onSuccess = jest.fn()
    const onError = jest.fn()

    const { rerender, unmount } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          onSuccess,
          onError,
          enableRetry: false,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'leaving' } })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    await act(async () => {
      unmount()
      await Promise.resolve()
    })
    expect(abortedSignals).toEqual(['leaving'])

    resolveSave?.()
    await Promise.resolve()
    await Promise.resolve()
    jest.advanceTimersByTime(200)
    await Promise.resolve()

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
