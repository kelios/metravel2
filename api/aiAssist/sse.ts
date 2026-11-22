/**
 * Разбор потока SSE (#2460, #2884) — общий для клиента `/ai/ask` (`askProvider.ts`) и генератора службы
 * (`scripts/ai-assist/generator.ts`). Модуль без `@/`-импортов: служба грузит его
 * `node --experimental-strip-types`. Отдельный файл, чтобы экран не тянул в сборку генератор (#3297).
 */

/** Предел ожидания ответа: один и тот же у запроса экрана к службе и у запроса службы к модели. */
export const GENERATION_TIMEOUT_MS = 120_000

/** Делит буфер SSE на готовые события; хвост без завершающей пустой строки возвращается. */
export const splitSseEvents = (buffer: string): { events: string[]; rest: string } => {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  return { events: parts.filter((part) => part.trim().length > 0), rest }
}

/**
 * Читает SSE-ответ до конца или пока `isFinished()` не скажет, что событий больше не
 * ждём: по мере прихода через `ReadableStream` (web) или целиком из `text()` (native
 * `fetch` тела не стримит). Все события одного куска отдаются `consume` — финальный
 * `usage` llama.cpp приходит после `finish_reason` в том же куске.
 */
export const consumeSseResponse = async (
  response: Response,
  { consume, isFinished }: { consume: (event: string) => void; isFinished: () => boolean },
): Promise<void> => {
  const body = response.body as ReadableStream<Uint8Array> | null | undefined
  if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (!isFinished()) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = splitSseEvents(buffer)
      buffer = rest
      for (const event of events) consume(event)
    }
    if (!isFinished() && buffer.trim()) consume(buffer)
    if (isFinished()) void reader.cancel().catch(() => undefined)
    return
  }
  const text = await response.text()
  const { events, rest } = splitSseEvents(text)
  for (const event of events) consume(event)
  if (rest.trim()) consume(rest)
}
