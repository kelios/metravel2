/**
 * Окно (windowing) для нативных Instagram-эмбедов.
 *
 * На web один эмбед — это iframe, и `useStableContentWebEffects` держит живыми не
 * больше CAP=5 одновременно. На native каждый эмбед — отдельный WebView: свой
 * рендер-процесс, свой network-стек, десятки мегабайт. Статья-список вроде travel
 * 439 («Аккаунты в Instagram» — ~40 постов) подняла бы их все и уронила скролл,
 * поэтому лимит здесь строже.
 *
 * Слот выдаётся в порядке запроса и освобождается, когда эмбед уходит из зоны
 * viewport-гейта (`richMediaViewport`) или размонтируется. Кто не получил слот,
 * показывает карточку-ссылку — тапом пост всё равно открывается.
 */

const MAX_LIVE_EMBEDS = 3

type SlotToken = object

const live = new Set<SlotToken>()
const queue: { token: SlotToken; onGrant: () => void }[] = []

const pump = () => {
  while (live.size < MAX_LIVE_EMBEDS && queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    live.add(next.token)
    next.onGrant()
  }
}

export const requestInstagramEmbedSlot = (token: SlotToken, onGrant: () => void): void => {
  if (live.has(token) || queue.some((entry) => entry.token === token)) return
  queue.push({ token, onGrant })
  pump()
}

export const releaseInstagramEmbedSlot = (token: SlotToken): void => {
  const queued = queue.findIndex((entry) => entry.token === token)
  if (queued >= 0) queue.splice(queued, 1)
  if (live.delete(token)) pump()
}

export const getInstagramEmbedSlotLimit = () => MAX_LIVE_EMBEDS

// Только для тестов: слоты живут в модуле и текут между кейсами.
export const __resetInstagramEmbedSlots = () => {
  live.clear()
  queue.length = 0
}
