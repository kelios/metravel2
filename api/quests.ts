// src/api/quests.ts
// API модуль для работы с квестами через бэкенд
import { apiClient, ApiError } from '@/api/client';
import { LONG_TIMEOUT } from '@/api/apiConfig';
import { unwrapList } from '@/api/clientResponse';
import { toContentId } from '@/types/contentSafety';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { retry } from '@/utils/retry';
import { isUsableRouteSegment } from '@/utils/routePaths';
import { QUEST_POPULARITY_SORT, selectPopularQuests } from '@/utils/questPopularity';
import { QuestProgressLineageMismatch } from '@/utils/questProgressMerge';
import {
    readCachedQuestBundle,
    writeCachedQuestBundle,
    readCachedQuestsList,
    writeCachedQuestsList,
} from '@/api/questBundleCache';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { queryKeys } from '@/api/queryKeys';
import { getQuestContentLocale, withQuestLang } from '@/api/questContentLocale';
import { buildQuestCityLandingGroups, normalizeQuestCityLegacyIds } from '@/utils/questCityAlias';
import {
    CATALOG_EAGER_PAGES,
    fetchAllQuestPages,
    withQuestMetaDefaults,
    type PaginatedEnvelope,
} from '@/api/questCatalogPages';
import type {
    ApiQuestBundle,
    ApiQuestMeta,
    ApiQuestNearLocation,
    ApiQuestProgress,
    ApiQuestProgressCreate,
    ApiQuestReview,
    ApiQuestStats,
    ApiQuestStep,
    NearLocationParams,
    QuestAnswerAttemptsBulkPayload,
    QuestAnswerAttemptsBulkResult,
    QuestGuestHandoffPayload,
    QuestReview,
    QuestReviewPhoto,
} from '@/api/questTypes';

// Типы (#3367: живут в `api/questTypes.ts`) и маппинг списка
// (`api/questCatalogPages.ts`) — публичный контракт этого модуля, как и раньше.
export { withQuestMetaDefaults };
export type {
    ApiQuestAnswerPattern,
    ApiQuestBundle,
    ApiQuestCity,
    ApiQuestCoverMedia,
    ApiQuestFinale,
    ApiQuestFirstCompleter,
    ApiQuestMediaGroup,
    ApiQuestMeta,
    ApiQuestNearLocation,
    ApiQuestProgress,
    ApiQuestProgressCreate,
    ApiQuestReview,
    ApiQuestReviewPhoto,
    ApiQuestSquareVariants,
    ApiQuestStats,
    ApiQuestStep,
    NearLocationParams,
    QuestAnswerAttemptPayload,
    QuestAnswerAttemptsBulkPayload,
    QuestAnswerAttemptsBulkResult,
    QuestGuestHandoffPayload,
    QuestReview,
    QuestReviewPhoto,
} from '@/api/questTypes';

function normalizeQuestStep(step: ApiQuestStep): ApiQuestStep {
    return {
        ...step,
        image_url: step.image_url ? normalizeMediaUrl(step.image_url) : step.image_url,
    };
}

function normalizeQuestBundle(bundle: ApiQuestBundle): ApiQuestBundle {
    indexMediaImage(bundle?.media?.cover, [bundle?.cover_url]);
    let normalizedSteps = bundle.steps;
    let normalizedIntro = bundle.intro;

    try {
        const parsedSteps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps;
        if (Array.isArray(parsedSteps)) {
            normalizedSteps = parsedSteps.map((step) => normalizeQuestStep(step as ApiQuestStep));
        }
    } catch {
        normalizedSteps = bundle.steps;
    }

    try {
        if (typeof bundle.intro === 'string' && bundle.intro.trim()) {
            const parsedIntro = JSON.parse(bundle.intro) as ApiQuestStep;
            normalizedIntro = normalizeQuestStep(parsedIntro);
        } else if (bundle.intro && typeof bundle.intro === 'object') {
            normalizedIntro = normalizeQuestStep(bundle.intro);
        }
    } catch {
        normalizedIntro = bundle.intro;
    }

    return {
        ...bundle,
        ...(bundle.city ? { city: { ...bundle.city, legacy_ids: normalizeQuestCityLegacyIds(bundle.city.legacy_ids) } } : {}),
        cover_url: bundle.cover_url ? normalizeMediaUrl(bundle.cover_url) : bundle.cover_url,
        steps: normalizedSteps,
        intro: normalizedIntro,
        finale: bundle.finale
            ? {
                ...bundle.finale,
                video_url: bundle.finale.video_url ? normalizeMediaUrl(bundle.finale.video_url) : bundle.finale.video_url,
                poster_url: bundle.finale.poster_url ? normalizeMediaUrl(bundle.finale.poster_url) : bundle.finale.poster_url,
            }
            : bundle.finale,
    };
}

function adaptQuestReviewPhotos(raw: ApiQuestReview['photos']): QuestReviewPhoto[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((photo) => {
            const url = photo?.url ? normalizeMediaUrl(photo.url) : null;
            if (!url) return null;
            return {
                id: Number(photo.id),
                url,
                stepId: typeof photo.step_id === 'number' ? photo.step_id : null,
            };
        })
        .filter((photo): photo is QuestReviewPhoto => photo !== null);
}

function adaptQuestReview(raw: ApiQuestReview): QuestReview {
    return {
        id: raw.id,
        rating: Number(raw.rating) || 0,
        liked: raw.liked ?? '',
        disliked: raw.disliked ?? '',
        authorName: raw.author_name ?? null,
        authorAvatar: raw.author_avatar ? normalizeMediaUrl(raw.author_avatar) : null,
        // Бэк отдаёт IntegerField; строку не принимаем — id не выдумывается.
        authorId: typeof raw.user === 'number' ? toContentId(raw.user) : null,
        createdAt: raw.created_at ?? null,
        photos: adaptQuestReviewPhotos(raw.photos),
    };
}

/**
 * Публичные отзывы о квесте (читалка чужих отзывов).
 *
 * КОНТРАКТ ЭНДПОИНТА (реализован; проба 25.08.2026 → `200`):
 *   GET /api/quests/quest{questId}/reviews/
 *     где questId — строковый quest_id (напр. "minsk-cmok").
 *   Публичный (без авторизации), пагинация как у остальных списков
 *   (массив | {data|results, next}).
 *   Элемент ответа — `ApiQuestReview` (см. тип выше).
 *
 * Заглушки здесь быть не должно ни в одном окружении. До #1486 при `404`
 * подставлялся детерминированный мок с выдуманными авторами; он однажды доехал
 * до прода и показал пользователям несуществующие отзывы как настоящие. Пустой
 * ответ и `404` дают честное пустое состояние — читалка пишет «Пока нет отзывов».
 */
export async function fetchQuestReviews(questId: string): Promise<QuestReview[]> {
    try {
        const list = await fetchAllQuestPages<ApiQuestReview>(`/quests/quest${questId}/reviews/`);
        return list.map(adaptQuestReview);
    } catch (err: unknown) {
        // Пусто — это утверждение о квесте, а не о состоянии сети, поэтому в
        // пустой список сваливаются ровно два случая: эндпоинт ответил `404` и
        // запрос отменили (анмаунт, смена экрана — показывать ошибку не за что).
        // Всё остальное поднимается в состояние ошибки читалки, у которой есть
        // «Не удалось загрузить отзывы» с повтором. Проверять статус на
        // истинность здесь нельзя: офлайн приходит как `ApiError(0)`
        // (`api/client.ts:330`), а клиентский таймаут — вообще обычным `Error`
        // с `name = 'TimeoutError'` и без статуса (`utils/fetchWithTimeout.ts`),
        // и оба когда-то читались как «у квеста нет отзывов» (#1486).
        if (err instanceof ApiError && err.status === 404) return [];
        if (err instanceof Error && err.name === 'AbortError') return [];
        throw err;
    }
}

// ===================== API ФУНКЦИИ =====================

/**
 * Получить список всех квестов (метаданные).
 * При успехе кэширует сырой список в AsyncStorage (fire-and-forget) для офлайна.
 * При сетевом фейле возвращает кэш, если он есть, — иначе пробрасывает ошибку.
 *
 * Кэш общий на устройство, поэтому персональных полей (`is_completed_by_me`,
 * `user_rating`) в офлайн-ответе нет: их снимает слой кэша (#1793).
 */
export async function fetchQuestsList(
    options?: { signal?: AbortSignal; locale?: string },
): Promise<ApiQuestMeta[]> {
    const locale = options?.locale ?? getQuestContentLocale();
    try {
        const list = await fetchAllQuestPages<ApiQuestMeta>(withQuestLang('/quests/', locale), 20, { signal: options?.signal, eagerPages: CATALOG_EAGER_PAGES });
        const withDefaults = list.map(withQuestMetaDefaults);
        void writeCachedQuestsList(withDefaults, locale);
        return withDefaults;
    } catch (err) {
        const cached = await readCachedQuestsList(locale);
        if (cached) return cached;
        throw err;
    }
}

/**
 * N самых популярных квестов каталога ОДНИМ запросом — для промо-блоков,
 * которым нужна пара карточек. Через полный `fetchQuestsList` такой блок
 * вытягивал весь каталог: 139 квестов и ~405 КБ на страницу, где видно два
 * (#1239), поэтому отбор делает бэкенд: `?sort=popular` — это прохождения по
 * убыванию, просмотры, id (`quests/catalog.py`). Раньше здесь была просто
 * первая страница, то есть витрина показывала квесты с наименьшими id.
 *
 * Ответ намеренно НЕ пишется в офлайн-кэш каталога: это срез, и он затёр бы
 * полный список, на который опираются экран квестов и офлайн-режим.
 */
export async function fetchQuestsPreview(
    limit: number,
    options?: { signal?: AbortSignal; locale?: string },
): Promise<ApiQuestMeta[]> {
    const locale = options?.locale ?? getQuestContentLocale();
    const signalOption = options?.signal ? { signal: options.signal } : undefined;
    const request = (query: string) =>
        apiClient.get<ApiQuestMeta[] | PaginatedEnvelope<ApiQuestMeta>>(
            withQuestLang(`/quests/?${query}`, locale),
            undefined,
            signalOption,
        );
    const pageQuery = `page_size=${limit}`;

    try {
        let res: ApiQuestMeta[] | PaginatedEnvelope<ApiQuestMeta>;
        try {
            res = await request(`sort=${QUEST_POPULARITY_SORT}&${pageQuery}`);
        } catch (err) {
            // Бэкенд без каталожной сортировки отвечает на неизвестный `sort`
            // валидационной 400. Промо-блок не должен из-за этого исчезать:
            // повторяем запрос без параметра и показываем прежний порядок.
            if (!(err instanceof ApiError) || err.status !== 400) throw err;
            res = await request(pageQuery);
        }
        const list = Array.isArray(res) ? res : unwrapList<ApiQuestMeta>(res);
        return list.slice(0, limit).map(withQuestMetaDefaults);
    } catch (err) {
        // Офлайн-контракт тот же, что у полного списка: лучше показать кэш
        // каталога, чем пустой промо-блок. Сортировать его приходится самим —
        // в кэше лежит полный каталог в порядке id.
        const cached = await readCachedQuestsList(locale);
        if (cached) return selectPopularQuests(cached, limit);
        throw err;
    }
}

/**
 * Компактный каталог для петли возврата (#1484): коллекция города и подбор
 * следующего квеста. От `fetchQuestsList` отличается двумя вещами — `compact=1`
 * (одна ссылка на обложку вместо полного медиа-манифеста) и отсутствием записи
 * в офлайн-кэш: это срез по полям, и он затёр бы полный список каталога.
 *
 * `is_completed_by_me` приходит по текущему пользователю: серверный кэш
 * списка объявлен `Vary: Authorization`, поэтому чужое прохождение не
 * подставится. У гостя флаг всегда `false` — только что закрытый квест
 * докладывает вызывающий (см. `buildQuestCityCollection`). В офлайне флага
 * нет вовсе: общий на устройство кэш каталога персональных полей не хранит.
 */
export async function fetchQuestsCompactCatalog(
    options?: { signal?: AbortSignal; locale?: string },
): Promise<ApiQuestMeta[]> {
    const locale = options?.locale ?? getQuestContentLocale();
    try {
        const list = await fetchAllQuestPages<ApiQuestMeta>(withQuestLang('/quests/?compact=1', locale), 20, { signal: options?.signal, eagerPages: CATALOG_EAGER_PAGES });
        return list.map(withQuestMetaDefaults);
    } catch (err) {
        // Офлайн-контракт тот же, что у полного списка: лучше показать кэш
        // каталога, чем спрятать блок следующего шага. Персональный флаг из
        // кэша не придёт — он снимается в `readCachedQuestsList` (#1793),
        // иначе после смены аккаунта коллекция показывала чужие прохождения.
        const cached = await readCachedQuestsList(locale);
        if (cached) return cached;
        throw err;
    }
}

/**
 * Число игроков считает только бэкенд: `completions_count` — прохождения по
 * квесту, и их сумма учитывает человека столько раз, сколько квестов он
 * прошёл. Неожиданная форма ответа — `null`, чтобы UI просто не показал число.
 */
export async function fetchQuestStats(
    options?: { signal?: AbortSignal },
): Promise<ApiQuestStats | null> {
    const res = await apiClient.get<Partial<ApiQuestStats> | null>(
        '/quests/stats/',
        undefined,
        options?.signal ? { signal: options.signal } : undefined,
    );
    const playersCount = res?.players_count;
    return typeof playersCount === 'number' && Number.isInteger(playersCount) && playersCount >= 0
        ? { players_count: playersCount }
        : null;
}

type NearLocationResponse<T> = {
    results: T[];
    count: number;
};

function buildNearLocationQuery(params: NearLocationParams): string {
    const search = new URLSearchParams();
    const city = params.city?.trim();
    const country = params.country?.trim();
    const countryCode = params.country_code?.trim();
    if (city) search.set('city', city);
    if (country) search.set('country', country);
    if (countryCode) search.set('country_code', countryCode);
    if (typeof params.lat === 'number' && Number.isFinite(params.lat)) {
        search.set('lat', String(params.lat));
    }
    if (typeof params.lng === 'number' && Number.isFinite(params.lng)) {
        search.set('lng', String(params.lng));
    }
    if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
        search.set('limit', String(params.limit));
    }
    return search.toString();
}

/**
 * Гео-рекомендации квестов рядом с локацией (score/distance считает бэкенд).
 * Кидает {@link ApiError} со status 404 на старом деплое без эндпоинта —
 * потребитель делает graceful fallback на клиентский расчёт.
 */
export async function fetchQuestsNearLocation(
    params: NearLocationParams,
    options?: { signal?: AbortSignal; locale?: string },
): Promise<ApiQuestNearLocation[]> {
    const query = buildNearLocationQuery(params);
    const res = await apiClient.get<NearLocationResponse<ApiQuestNearLocation>>(
        withQuestLang(`/quests/near-location/${query ? `?${query}` : ''}`, options?.locale ?? getQuestContentLocale()),
        undefined,
        options?.signal ? { signal: options.signal } : undefined,
    );
    return (res?.results ?? []).map((item) => ({
        ...item,
        quest: withQuestMetaDefaults(item.quest),
    }));
}

/**
 * #1185: экран квеста берёт `questId` из сегмента маршрута. Если пользователь
 * пришёл по битой ссылке `/quests/undefined/undefined`, роутер отдаёт строку
 * `"undefined"`, и запрос уходил на `/api/quests/by-quest-id/undefined/` — в
 * проде это подтверждённые 404. Отбиваем такой идентификатор до сети: ошибка
 * сразу, вместо бессмысленного запроса и записи мусора в офлайн-кэш.
 */
function assertUsableQuestId(questId: string, caller: string): void {
    if (isUsableRouteSegment(questId)) return;
    throw new ApiError(400, `${caller}: quest id is missing or invalid`);
}

/** Addressed classification/cover fallback; never downloads the whole catalog. */
export async function fetchQuestsByCity(
    cityId: number,
    locale: string = getQuestContentLocale(),
): Promise<ApiQuestMeta[]> {
    try {
        const list = await apiClient.get<ApiQuestMeta[]>(withQuestLang(`/quests/by-city/${cityId}/`, locale));
        return list.map(withQuestMetaDefaults);
    } catch (error) {
        const cached = await readCachedQuestsList(locale);
        if (cached) {
            const canonical = cached.filter((quest) => String(quest.city_id) === String(cityId));
            const cityQuests = canonical.length ? canonical : buildQuestCityLandingGroups(cached)
                .find((group) => group.legacyCityIds.includes(String(cityId)))?.quests ?? [];
            return cityQuests.map(withQuestMetaDefaults);
        }
        throw error;
    }
}

/**
 * Получить полный бандл квеста по quest_id (строковый, напр. "minsk-cmok").
 * При успехе кэширует сырой бандл в AsyncStorage (fire-and-forget) для офлайна.
 * При сетевом фейле возвращает кэш, если он есть, — иначе пробрасывает ошибку.
 */
export async function fetchQuestByQuestId(
    questId: string,
    options: { persistOffline?: boolean; signal?: AbortSignal; locale?: string } = {},
): Promise<ApiQuestBundle> {
    assertUsableQuestId(questId, 'fetchQuestByQuestId');
    const path = withQuestLang(`/quests/by-quest-id/${questId}/`, options.locale ?? getQuestContentLocale());
    try {
        const bundle = await retry(
            // Quest bundles include the intro, all steps and finale media. Do not
            // abort a valid cold response at the generic 10 s API deadline.
            //
            // `signal` доводится до реального `fetch` (`utils/fetchWithTimeout.ts`),
            // как в каталоге (`fetchAllQuestPages`): без него `cancelQueries` по
            // ключу бандла отменяет только query-объект, а 8 КБ всё равно уходят
            // по сети — смена identity на bootstrap отменяет летящий запрос и
            // тут же повторяет его (#1992).
            () => (options.signal
                ? apiClient.get<ApiQuestBundle>(path, LONG_TIMEOUT, { signal: options.signal })
                : apiClient.get<ApiQuestBundle>(path, LONG_TIMEOUT)),
            {
                maxAttempts: 2,
                delay: 300,
                shouldRetry: (error) =>
                    error instanceof ApiError &&
                    (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504),
            },
        );
        const normalized = normalizeQuestBundle(bundle);
        // The catalog commit is the single durable quest-package write. Await
        // its best-effort wrapper so a successful online response cannot race a
        // force-stop before the offline snapshot is committed.
        //
        // `persistOffline: false` is for readers that show a quest the user has
        // not opened — the city landing notes (#1569) read up to three bundles
        // per page. Committing those would fill the offline catalog with quests
        // nobody picked and push actually-opened ones out of its 20 LRU slots.
        if (options.persistOffline !== false) {
            await writeCachedQuestBundle(questId, normalized);
        }
        return normalized;
    } catch (err) {
        // Отмена — не сетевой сбой. Без этой ветки `cancelQueries` по ключу
        // бандла (смена identity, уход с экрана) превращался бы в «успех» с
        // офлайн-копией: вызывающий не отличил бы отменённый запрос от
        // доставленных данных. Таймаут сюда НЕ попадает —
        // `utils/fetchWithTimeout.ts` отдаёт его отдельной ошибкой, и офлайн-
        // фолбэк по таймауту продолжает работать (#1992).
        // Формы отмены сверены с `api/client.ts`: он пробрасывает как есть и
        // `AbortError`, и случай уже прерванного `signal` (на native expo
        // отдаёт своё сообщение, а не `name`), поэтому одного `name` мало.
        if (options.signal?.aborted || (err as { name?: string } | null)?.name === 'AbortError') throw err;
        const cached = await readCachedQuestBundle(questId);
        if (cached) return normalizeQuestBundle(cached);
        throw err;
    }
}

/** Получить полный бандл квеста по числовому ID */
export async function fetchQuestById(
    id: number,
    locale: string = getQuestContentLocale(),
): Promise<ApiQuestBundle> {
    const bundle = await apiClient.get<ApiQuestBundle>(withQuestLang(`/quests/${id}/`, locale));
    return normalizeQuestBundle(bundle);
}

// ---- Прогресс ----

/** Получить все прогрессы текущего пользователя */
export async function fetchAllProgress(): Promise<ApiQuestProgress[]> {
    return apiClient.get<ApiQuestProgress[]>('/quest-progress/');
}

/**
 * 404 чтения прогресса бывает двух видов (`get_progress` в бэке): строки нет —
 * и нет опубликованного квеста (`Quest with quest_id=… not found`). Второй не
 * подтверждает отсутствие прохождения: строка цела, квест снят с публикации.
 * Принять его за «строки нет» значит стереть живую копию (#2033). Тело без
 * этой пометки читается по-старому — как отсутствие строки.
 */
const isUnpublishedQuestNotFound = (err: ApiError): boolean => {
    const body = err.data as { error?: unknown } | null | undefined;
    return typeof body?.error === 'string' && body.error.startsWith('Quest with quest_id=');
};

/**
 * Прочитать прогресс, НЕ создавая его. `null` — прохождения ещё нет.
 *
 * Отдельно от `fetchOrCreateProgress`, потому что открытие экрана квеста не
 * должно оставлять строку прохождения: до #1803 каждый просмотр создавал
 * пустую запись, и восьмая часть «стартов» на проде оказалась просмотрами.
 */
export async function fetchQuestProgress(questId: string): Promise<ApiQuestProgress | null> {
    assertUsableQuestId(questId, 'fetchQuestProgress');
    try {
        return await apiClient.get<ApiQuestProgress>(`/quest-progress/quest/${questId}/`);
    } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404 && !isUnpublishedQuestNotFound(err)) return null;
        throw err;
    }
}

/**
 * Статусы, которыми бэкенд отвечает на POST уже существующего прохождения:
 * DRF-валидатор unique_together даёт 400, идемпотентный вариант — 409, а сырой
 * UniqueViolation доезжает до клиента как 500 (#1904). Во всех трёх случаях
 * запись на сервере уже есть — её надо перечитать, а не терять своё слияние.
 */
const PROGRESS_DUPLICATE_STATUSES = new Set([400, 409, 500]);

/**
 * Очередь писателей прохождения, по одной на quest_id. После логина миграция
 * гостевого прогресса (`useGuestQuestFlow`) и флаш отложенной очереди
 * (`pushMergedProgress`) стартуют одним и тем же переходом в авторизованное
 * состояние (#1905). Параллельно они не просто создавали запись дважды (второй
 * POST — 500 на unique_together (quest, user)): `answers` уходит на сервер
 * ПОЛНЫМ словарём и серверный заменяет, поэтому два писателя, посчитавшие
 * слияние от одной базы, затирают ответы друг друга. Значит сериализовать надо
 * всю тройку чтение → слияние → запись, а не один только POST.
 */
const questProgressWriters = new Map<string, Promise<unknown>>();

const ignoreResult = (): void => undefined;

const readOrCreateProgress = async (questId: string, lineageId: number): Promise<ApiQuestProgress> => {
    const existing = await fetchQuestProgress(questId);
    // Снапшот, согласованный со строкой, ложится только в неё: создать строку
    // под него значит отменить чужой сброс (#2033). Проверка стоит до POST —
    // внутри задачи строка была бы уже создана.
    if (lineageId > 0) {
        if (existing?.id === lineageId) return existing;
        throw new QuestProgressLineageMismatch(questId, lineageId, existing);
    }
    if (existing) return existing;
    // Создание требует ЧИСЛОВОГО id квеста. Экран квеста уже держит бандл в
    // React Query под тем же ключом (`hooks/questBundleQuery.ts`), поэтому
    // сначала берём id оттуда: сырой GET тянул весь бандл (интро, все шаги и
    // медиа финала — ~8 КБ gzip на проде) ради одного целого числа, и на
    // холодном открытии квеста это был третий за загрузку запрос к
    // `by-quest-id` (#1992). Запрос остаётся фолбэком: очередь прогресса
    // флашится и без экрана квеста, там кэш пуст.
    // Числовой id от языка не зависит: годится копия на любой локали (#2197).
    const cachedNumericId = getActiveQueryClient()
        ?.getQueriesData<ApiQuestBundle>({ queryKey: queryKeys.questBundleAllLocales(questId) })
        .map(([, bundle]) => bundle?.id)
        .find((id): id is number => typeof id === 'number');
    const questNumericId = cachedNumericId
        ?? (await apiClient.get<{ id: number }>(withQuestLang(`/quests/by-quest-id/${questId}/`, getQuestContentLocale()))).id;
    try {
        return await apiClient.post<ApiQuestProgress>('/quest-progress/', {
            quest: questNumericId,
        });
    } catch (err: unknown) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === undefined || !PROGRESS_DUPLICATE_STATUSES.has(status)) throw err;
        // Гонку мог выиграть не наш поток, а второе устройство или прошлый
        // запуск: запись уже создана — читаем её и продолжаем слияние.
        const created = await fetchQuestProgress(questId);
        if (created) return created;
        throw err;
    }
};

/**
 * Прочитать (при необходимости создать) прохождение квеста и сделать над ним
 * работу эксклюзивно: следующий писатель получает запись уже с результатом
 * предыдущего, а не ту же устаревшую базу.
 *
 * `task` НЕ должен сам звать `withQuestProgress`/`fetchOrCreateProgress` по
 * тому же квесту — это самоблокировка очереди.
 *
 * `lineageId` — поколение снапшота, `id` строки, с которой он согласован. Если он
 * задан, строка обязана существовать с этим `id`, иначе
 * `QuestProgressLineageMismatch` без POST и без `task` (#2033).
 */
export async function withQuestProgress<T>(
    questId: string,
    task: (progress: ApiQuestProgress) => Promise<T>,
    options: { lineageId?: number } = {},
): Promise<T> {
    assertUsableQuestId(questId, 'withQuestProgress');
    const previous = questProgressWriters.get(questId);
    // Падение предыдущего писателя очередь не рвёт: следующий делает своё чтение.
    const slot = previous ? previous.then(ignoreResult, ignoreResult) : Promise.resolve();
    const run = slot.then(async () => task(await readOrCreateProgress(questId, options.lineageId ?? 0)));
    const tail: Promise<unknown> = run.then(ignoreResult, ignoreResult).then(() => {
        if (questProgressWriters.get(questId) === tail) questProgressWriters.delete(questId);
    });
    questProgressWriters.set(questId, tail);
    return run;
}

/**
 * Получить или создать прогресс по quest_id. Зовётся только там, где игрок уже
 * начал прохождение и строку создать НАДО (отправка снапшота), — на чтении при
 * открытии экрана используется `fetchQuestProgress`.
 *
 * Идёт через ту же очередь: POST на `/quest-progress/` не идемпотентен, и
 * второй создатель получает ошибку.
 */
export async function fetchOrCreateProgress(questId: string): Promise<ApiQuestProgress> {
    return withQuestProgress(questId, async (progress) => progress);
}

/** Создать прогресс */
export async function createProgress(data: ApiQuestProgressCreate): Promise<ApiQuestProgress> {
    return apiClient.post<ApiQuestProgress>('/quest-progress/', data);
}

/** Обновить прогресс (PATCH) */
export async function updateProgress(
    id: number,
    data: Partial<ApiQuestProgressCreate>
): Promise<ApiQuestProgress> {
    return apiClient.patch<ApiQuestProgress>(`/quest-progress/${id}/`, data);
}

/** Удалить прогресс */
export async function deleteProgress(id: number): Promise<void> {
    return apiClient.delete<void>(`/quest-progress/${id}/`);
}

// ===================== ТЕЛЕМЕТРИЯ ПОПЫТОК ОТВЕТА (#1275/#1276) =====================

/**
 * Приём батча попыток ответа. Эндпоинт auth-optional: гостевое прохождение
 * пишется так же, поэтому токен прикладывается, только если он есть.
 * Повтор того же `client_attempt_id` возвращается как `duplicates`, не как 4xx.
 */
export async function sendQuestAnswerAttempts(
    payload: QuestAnswerAttemptsBulkPayload,
): Promise<QuestAnswerAttemptsBulkResult> {
    return apiClient.post<QuestAnswerAttemptsBulkResult>(
        '/quest-answer-attempts/bulk/',
        payload,
    );
}

/** Таймаут снимка: он стоит перед отправкой формы регистрации и не должен её тормозить. */
const QUEST_GUEST_HANDOFF_TIMEOUT_MS = 5000;

/**
 * Снимок гостевого прогресса на сервер перед регистрацией по письму (#2739,
 * бэк — #2749): подтверждение часто открывается в другом браузере, где
 * локальной копии нет. Эндпоинт анонимный, ответ — 204.
 *
 * `skipAuth`: шлёт гость, а до выката #2749 путь попадает в detail-маршрут
 * `QuestProgressViewSet` (`IsAuthenticated`) и отвечает 401. Без `skipAuth`
 * клиент принял бы его за протухшую сессию — контрольная проба `/user/me/verifications/`
 * (ещё до 10 с перед отправкой формы) и auth-invalidation у гостя.
 */
export async function sendQuestGuestHandoff(payload: QuestGuestHandoffPayload): Promise<void> {
    await apiClient.request<null>(
        '/quest-progress/guest-handoff/',
        { method: 'POST', body: JSON.stringify(payload), skipAuth: true },
        QUEST_GUEST_HANDOFF_TIMEOUT_MS,
    );
}
