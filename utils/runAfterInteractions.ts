/**
 * Замена `InteractionManager.runAfterInteractions`, удалённого из react-native 0.88
 * (#2727). RN рекомендует `requestIdleCallback`: Hermes и браузеры отдают колбэк,
 * когда поток JS свободен, что покрывает оба прежних сценария — «после жеста
 * отпустить тяжёлую работу» и «размонтировать после хвоста touch-каскада».
 *
 * `timeout` — верхняя граница ожидания: idle может не наступить под постоянной
 * нагрузкой (анимация, скролл), а отложенная работа всё равно обязана выполниться.
 * Где `requestIdleCallback` нет (jsdom, старый web-рантайм) — обычный таймер.
 */
export type ScheduledTask = { cancel: () => void }

type IdleScheduler = {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

const DEFAULT_TIMEOUT_MS = 500

export function runAfterInteractions(task: () => void, timeoutMs: number = DEFAULT_TIMEOUT_MS): ScheduledTask {
  const scheduler = globalThis as unknown as IdleScheduler
  let done = false
  const run = () => {
    if (done) return
    done = true
    task()
  }

  if (typeof scheduler.requestIdleCallback === 'function') {
    const handle = scheduler.requestIdleCallback(run, { timeout: timeoutMs })
    return {
      cancel: () => {
        done = true
        scheduler.cancelIdleCallback?.(handle)
      },
    }
  }

  const handle = setTimeout(run, 0)
  return {
    cancel: () => {
      done = true
      clearTimeout(handle)
    },
  }
}
