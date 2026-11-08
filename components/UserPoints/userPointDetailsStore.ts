// components/UserPoints/userPointDetailsStore.ts
// #3161 — полные карточки точек подгружаются окном, а не всей коллекцией.
//
// Общая коллекция `userPointsAll` держит лёгкие пины (id, координаты, цвет,
// статус, категория). Название, адрес, фото, заметки нужны только карточкам
// на экране и открытому попапу — их просят сами карточки при монтировании,
// store склеивает запросы одного кадра в один `GET /user-points/?ids=…`.
// Хранилище вне React Query: записи меняются точечно (правка, удаление,
// массовые действия), читателей сотни (карточки FlashList), и подписка через
// `useSyncExternalStore` дешевле сотен `useQuery`.

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { userPointsApi } from '@/api/userPoints';
import type { ImportedPoint, UserPointPin } from '@/types/userPoints';
import { logError } from '@/utils/logger';

/** Пауза склейки запросов одного кадра: карточки окна монтируются вместе. */
const BATCH_DELAY_MS = 24;
/** Пинов в одном запросе: видимое окно + запас FlashList, ниже потолка `ids` (200). */
const BATCH_SIZE = 60;
/** Повторы упавшего запроса карточек: 2 с, 4 с, 8 с. */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

type Listener = () => void;

type Snapshot = {
  owner: string | null;
  byId: Map<number, ImportedPoint>;
  version: number;
};

const toId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const createStore = () => {
  let snapshot: Snapshot = { owner: null, byId: new Map(), version: 0 };
  const listeners = new Set<Listener>();
  const pending = new Set<number>();
  const inFlight = new Set<number>();
  // id, которых сервер не вернул по `ids=` (точка удалена с другого устройства):
  // карточки не будет — карточка рисует пин без каркаса, коллекция перечитывается.
  const gone = new Set<number>();
  const missingListeners = new Set<(ids: number[]) => void>();
  // id, по которым последний запрос упал (повтор — `scheduleRetry`).
  const failed = new Set<number>();
  const attempts = new Map<number, number>();
  // Растёт на смене владельца и `clear()`: отложенные повторы прежнего
  // поколения не заказывают карточки заново.
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    snapshot = { ...snapshot, version: snapshot.version + 1 };
    listeners.forEach((listener) => listener());
  };

  const flush = async () => {
    timer = null;
    const owner = snapshot.owner;
    const ids = Array.from(pending).filter((id) => !inFlight.has(id) && !snapshot.byId.has(id));
    pending.clear();
    if (ids.length === 0) return;
    // Все id партии — «в полёте» сразу: иначе `ensure` во время первого
    // чанка снова заказал бы id второго и ушёл бы дубль запроса.
    ids.forEach((id) => inFlight.add(id));
    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        try {
          const items = await userPointsApi.getPointsByIds(chunk);
          // Смена владельца, пока запрос летел: чужие карточки в store не кладём.
          if (snapshot.owner !== owner) return;
          const returned = new Set<number>();
          for (const item of items) {
            const id = toId(item?.id);
            if (id === null) continue;
            snapshot.byId.set(id, item);
            returned.add(id);
          }
          chunk.forEach((id) => {
            failed.delete(id);
            attempts.delete(id);
          });
          const missing = chunk.filter((id) => !returned.has(id));
          if (missing.length > 0) {
            missing.forEach((id) => gone.add(id));
            missingListeners.forEach((listener) => listener(missing));
          }
          emit();
        } catch (error) {
          if (snapshot.owner !== owner) return;
          logError(error, { scope: 'userPointDetailsStore.flush', ids: chunk.length });
          chunk.forEach((id) => failed.add(id));
          scheduleRetry(chunk);
          emit();
        } finally {
          chunk.forEach((id) => inFlight.delete(id));
        }
      }
    } finally {
      // Ранний выход по смене владельца: хвост партии не должен остаться «в полёте».
      ids.forEach((id) => inFlight.delete(id));
    }
  };

  // Обрыв сети не должен оставлять карточку каркасом навсегда: эффект карточки
  // заказывает id один раз на монтирование, поэтому повтор — здесь, с паузой
  // и потолком попыток (не долбим сервер при стойкой ошибке).
  const scheduleRetry = (chunk: number[]) => {
    const due = chunk.filter((id) => {
      const next = (attempts.get(id) ?? 0) + 1;
      attempts.set(id, next);
      return next <= MAX_RETRIES;
    });
    if (due.length === 0) return;
    const attempt = attempts.get(due[0]) ?? 1;
    const retryGeneration = generation;
    setTimeout(() => {
      if (generation !== retryGeneration) return;
      store.ensure(due);
    }, RETRY_BASE_MS * 2 ** (attempt - 1));
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => void flush(), BATCH_DELAY_MS);
  };

  const store = {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    /** Сменился владелец (вход/выход) — чужие карточки стираются. */
    setOwner(owner: string | null) {
      if (snapshot.owner === owner) return;
      generation += 1;
      pending.clear();
      failed.clear();
      gone.clear();
      attempts.clear();
      snapshot = { owner, byId: new Map(), version: snapshot.version + 1 };
      listeners.forEach((listener) => listener());
    },
    get(id: number): ImportedPoint | undefined {
      return snapshot.byId.get(id);
    },
    /** Сервер не вернул точку по `ids=` — карточки не будет. */
    isGone(id: number): boolean {
      return gone.has(id);
    },
    /** Подписка на id, которых сервер не вернул: модель перечитывает коллекцию. */
    onMissing(listener: (ids: number[]) => void) {
      missingListeners.add(listener);
      return () => {
        missingListeners.delete(listener);
      };
    },
    isFailed(id: number): boolean {
      return failed.has(id);
    },
    /** Заказать карточки; уже известные и летящие пропускаются. */
    ensure(ids: ReadonlyArray<number>) {
      let added = false;
      for (const raw of ids) {
        const id = toId(raw);
        if (id === null || snapshot.byId.has(id) || inFlight.has(id) || pending.has(id) || gone.has(id)) continue;
        pending.add(id);
        failed.delete(id);
        added = true;
      }
      if (added) schedule();
    },
    upsert(item: ImportedPoint) {
      const id = toId(item?.id);
      if (id === null) return;
      snapshot.byId.set(id, item);
      emit();
    },
    /** Частичное обновление (массовая смена цвета/статуса) — без перезапроса. */
    patch(ids: ReadonlyArray<number>, updates: Partial<ImportedPoint>) {
      let changed = false;
      for (const raw of ids) {
        const id = toId(raw);
        const current = id === null ? undefined : snapshot.byId.get(id);
        if (!current || id === null) continue;
        snapshot.byId.set(id, { ...current, ...updates });
        changed = true;
      }
      if (changed) emit();
    },
    /**
     * Забыть карточки удалённых точек — без оповещения: карточка уходит вместе
     * с пином из коллекции, а оповещение раньше обновления коллекции (React
     * Query рассылает его позже) перерисовало бы её каркасом и заказало `ids=`
     * уже удалённой точки.
     */
    remove(ids: ReadonlyArray<number>) {
      for (const raw of ids) {
        const id = toId(raw);
        if (id !== null) snapshot.byId.delete(id);
      }
    },
    /** Импорт/инвалидация коллекции: карточки могли измениться — перечитать окном. */
    clear() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      generation += 1;
      pending.clear();
      failed.clear();
      gone.clear();
      attempts.clear();
      snapshot = { owner: snapshot.owner, byId: new Map(), version: snapshot.version + 1 };
      listeners.forEach((listener) => listener());
    },
  };
  return store;
};

export const userPointDetailsStore = createStore();

/** Пин, у которого полная карточка ещё не пришла. */
/**
 * Полная карточка, а не пин. Пин несёт ровно восемь ключей контракта
 * (`id, latitude, longitude, color, status, category, category_ids, name`,
 * #3129/#3172/#3185) — признак полной записи только в полях, которых у пина
 * не бывает. По `name` отличать нельзя: с #3185 он есть и у пина.
 */
const FULL_ITEM_ONLY_KEYS: ReadonlyArray<keyof ImportedPoint> = [
  'address',
  'description',
  'notes',
  'photo',
  'tags',
  'source',
  'imported_at',
  'created_at',
  'updated_at',
];
export const isHydratedPoint = (point: UserPointPin | ImportedPoint): point is ImportedPoint =>
  Boolean(point) && FULL_ITEM_ONLY_KEYS.some((key) => key in (point as object));

export type HydratedUserPoint = {
  /** Пин с подмешанной карточкой (если пришла). */
  point: ImportedPoint;
  /** Карточка ещё не пришла — рисуем каркас вместо названия/фото. */
  hydrating: boolean;
  /** Запрос карточки упал; store повторяет его сам (до `MAX_RETRIES` раз). */
  failed: boolean;
};

/**
 * Карточка точки для пина: заказывает полную запись у store и отдаёт пин,
 * склеенный с ней. Полная запись (есть `name`) проходит как есть — карточки из
 * мастера travel и тесты с полными fixture-точками ничего не заказывают.
 */
export function useUserPointDetail(point: UserPointPin | ImportedPoint): HydratedUserPoint {
  const id = toId(point?.id);
  const alreadyFull = isHydratedPoint(point);
  const wantedId = alreadyFull ? null : id;
  // Подписка селекторами по своему id, а не на весь снимок: ответ партии
  // перерисовывает только карточки, чья запись изменилась, а не всё окно.
  const detail = useSyncExternalStore(
    userPointDetailsStore.subscribe,
    () => (wantedId === null ? undefined : userPointDetailsStore.get(wantedId)),
  );
  const failed = useSyncExternalStore(
    userPointDetailsStore.subscribe,
    () => wantedId !== null && userPointDetailsStore.isFailed(wantedId),
  );
  const gone = useSyncExternalStore(
    userPointDetailsStore.subscribe,
    () => wantedId !== null && userPointDetailsStore.isGone(wantedId),
  );
  const owner = useSyncExternalStore(userPointDetailsStore.subscribe, getOwner);
  useEffect(() => {
    if (wantedId === null) return;
    userPointDetailsStore.ensure([wantedId]);
    // `owner`/`detail`: смена владельца или `clear()` стирает запись — заказать заново.
  }, [wantedId, owner, detail]);

  // Поля пина побеждают карточку (оптимистичные правки пишутся в коллекцию
  // сразу); зависимость — сами поля, а не ссылка на пин, которая новая на
  // каждый пересчёт модели.
  const { latitude, longitude, color, status } = point as UserPointPin;
  const merged = useMemo(
    () => (detail ? { ...detail, latitude, longitude, color, status } : null),
    [detail, latitude, longitude, color, status],
  );
  if (alreadyFull) return { point, hydrating: false, failed: false };
  if (merged) return { point: merged, hydrating: false, failed: false };
  // Точки на сервере уже нет (удалена с другого устройства): пин без каркаса,
  // коллекция перечитывается по `onMissing` и уберёт её.
  if (gone) return { point: point as unknown as ImportedPoint, hydrating: false, failed: false };
  return { point: point as unknown as ImportedPoint, hydrating: true, failed };
}

const getOwner = () => userPointDetailsStore.getSnapshot().owner;

/** Подписка владельца: смена аккаунта стирает карточки чужих точек. */
export function useUserPointDetailsOwner(owner: string | null): void {
  useEffect(() => {
    userPointDetailsStore.setOwner(owner);
  }, [owner]);
}
