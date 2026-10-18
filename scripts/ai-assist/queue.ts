/**
 * Один запрос к модели одновременно. Остальные ждут в FIFO не дольше таймаута; не дождавшиеся
 * получают BusyError → 503 `{error: 'busy'}`. На 1 vCPU параллельный ONNX только удлиняет
 * каждый запрос, поэтому очередь — единственный честный режим.
 */

export class BusyError extends Error {
  readonly waitedMs: number

  constructor(waitedMs: number) {
    super(`модель занята: ожидание ${waitedMs} мс истекло`)
    this.name = 'BusyError'
    this.waitedMs = waitedMs
  }
}

type Waiter = { grant: () => void; timer: ReturnType<typeof setTimeout> }

export class SingleFlight {
  private busy = false
  private readonly waiters: Waiter[] = []

  get waiting(): number {
    return this.waiters.length
  }

  get isBusy(): boolean {
    return this.busy
  }

  /** Дождаться очереди (≤ timeoutMs) и выполнить `fn` эксклюзивно. */
  async run<T>(timeoutMs: number, fn: () => Promise<T>): Promise<T> {
    await this.acquire(timeoutMs)
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(timeoutMs: number): Promise<void> {
    if (!this.busy) {
      this.busy = true
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        grant: () => {
          clearTimeout(waiter.timer)
          resolve()
        },
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter)
          if (index >= 0) this.waiters.splice(index, 1)
          reject(new BusyError(timeoutMs))
        }, timeoutMs),
      }
      this.waiters.push(waiter)
    })
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next) next.grant()
    else this.busy = false
  }
}
