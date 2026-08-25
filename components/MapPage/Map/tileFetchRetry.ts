// components/MapPage/Map/tileFetchRetry.ts
//
// #1561 — политика повторной загрузки тайла базовой подложки на native.
//
// Leaflet сам тайл НЕ перезапрашивает: `createTile` уже отдал <img>, и слой
// ждёт ровно один `done()`. Значит единственный промах сети (429/503 из
// nginx-зоны при бурсте зума — см. #807, таймаут, обрыв) навсегда оставлял бы
// пустую клетку. Ретраи живут здесь, между мостом и дисковым кэшем.
import type { downloadTileToDisk } from '@/utils/mapTileCache';

/**
 * Паузы между повторными попытками: две поверх первой. Покрывают короткий
 * 429/503 при бурсте зума, но не растягивают ожидание настолько, чтобы
 * пользователь успел уйти с этого масштаба (тогда тайл всё равно снимут).
 */
export const TILE_FETCH_RETRY_DELAYS_MS: readonly number[] = [400, 1200];

export interface TileFetchRetryDeps {
  /** Одна попытка загрузки: размер в байтах или `null` при провале. */
  download: () => ReturnType<typeof downloadTileToDisk>;
  /** Онлайн ли устройство прямо сейчас (между попытками сеть могла отвалиться). */
  isOnline: () => boolean;
  /** Пауза перед следующей попыткой. */
  wait: (ms: number) => Promise<void>;
  /** Переопределение пауз (тесты). */
  delaysMs?: readonly number[];
}

/**
 * Возвращает `true`, если тайл в итоге лёг на диск, и `false`, когда окно
 * ретраев исчерпано или устройство ушло в офлайн. `false` обязан приводить к
 * НАБЛЮДАЕМОЙ ошибке тайла в мосте, а не к «успешно загруженной» серой клетке.
 */
export const fetchTileWithRetry = async ({
  download,
  isOnline,
  wait,
  delaysMs = TILE_FETCH_RETRY_DELAYS_MS,
}: TileFetchRetryDeps): Promise<boolean> => {
  for (let attempt = 0; ; attempt += 1) {
    const bytes = await download();
    if (bytes != null) return true;
    const delayMs = delaysMs[attempt];
    // Окно ретраев кончилось либо сеть пропала — дальше повторять нечего.
    if (delayMs == null || !isOnline()) return false;
    await wait(delayMs);
    // Пауза длится сотни миллисекунд — ровно то окно, в котором NetInfo и
    // переключает статус. Без повторной проверки офлайн-переход прямо в backoff
    // всё равно отправлял бы запрос и держал слот семафора (их всего
    // MAX_TILE_FETCH), задерживая тайлы, которые ещё можно взять из кэша.
    if (!isOnline()) return false;
  }
};
