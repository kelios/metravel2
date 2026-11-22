// api/questCatalogPages.ts
// Маппинг и постраничное чтение списка квестов: дефолты метаданных
// (`withQuestMetaDefaults`) и дочитывание пагинированных эндпоинтов. Вынесено
// из `api/quests.ts` (#3367) без изменения поведения.
import { apiClient, ApiError } from '@/api/client';
import { readEnvelopeTotal, unwrapList } from '@/api/clientResponse';
import type { TravelMediaImage } from '@/types/types';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { resolveTotalPages } from '@/utils/fetchAllPages';
import { normalizeQuestCityLegacyIds } from '@/utils/questCityAlias';
import type { ApiQuestMeta } from '@/api/questTypes';

/**
 * DEV-only мок прохождений (#363): бэк теперь отдаёт реальные
 * is_completed_by_me/completions_count — мок выключен, чтобы в DEV-сборке
 * на устройстве не показывались фейковые «Пройден»/«N прохождения».
 */
const QUEST_COMPLETION_MOCK = false;

function withQuestCompletionMock(meta: ApiQuestMeta): ApiQuestMeta {
    if (!__DEV__ || !QUEST_COMPLETION_MOCK) return meta;
    if (meta.is_completed_by_me || meta.completions_count > 0) return meta;
    return {
        ...meta,
        is_completed_by_me: meta.id % 2 === 0,
        completions_count: (meta.id % 7) + 1,
    };
}

/**
 * Бэкенд может не отдавать поля рейтинга/прохождений (старая схема) —
 * проставляем безопасные дефолты, чтобы UI и адаптеры не падали.
 */
export function withQuestMetaDefaults(meta: ApiQuestMeta): ApiQuestMeta {
    // Обложка квеста показывается в `contain`, поэтому её поля тоже должна
    // заливать `dominant_color` из манифеста (#1208). Карточка знает только
    // `cover_url`, поэтому цвет индексируется и под ним.
    const coverMedia = meta?.media?.cover;
    // Компактная запись (`compact=1`, каталог с #3459) несёт обложку только в
    // `media.cover.src`; потребители читают `cover_url`, поэтому поле одно.
    const coverUrl = meta?.cover_url ?? coverMedia?.src ?? null;
    const indexedCoverMedia: TravelMediaImage | null | undefined = coverMedia
        ? {
            ...coverMedia,
            variants: coverMedia.variants
                ? Object.fromEntries(
                    Object.entries(coverMedia.variants).filter(
                        (entry): entry is [string, string] => typeof entry[1] === 'string',
                    ),
                )
                : null,
        }
        : coverMedia;
    indexMediaImage(indexedCoverMedia, [
        coverUrl,
        coverMedia?.src_square,
        coverMedia?.variants?.square_160,
        coverMedia?.variants?.square_320,
    ]);
    return withQuestCompletionMock({
        ...meta,
        cover_url: coverUrl,
        city_legacy_ids: normalizeQuestCityLegacyIds(meta.city_legacy_ids),
        rating_avg: meta.rating_avg ?? null,
        rating_count: meta.rating_count ?? 0,
        user_rating: meta.user_rating ?? null,
        completions_count: meta.completions_count ?? 0,
        personal_status_unavailable: meta.personal_status_unavailable === true
            || typeof meta.is_completed_by_me !== 'boolean',
        is_completed_by_me: meta.is_completed_by_me ?? false,
        first_completer: meta.first_completer ?? null,
    });
}

export type PaginatedEnvelope<T> = {
    data?: T[];
    results?: T[];
    total?: number;
    count?: number;
    next_page_url?: string | null;
    next?: string | null;
};

/**
 * Списочные эндпоинты отдают по 20 записей на страницу, а `fetchAllQuestPages`
 * дочитывает их до конца: каталог из 139 квестов уходил семью последовательными
 * запросами (~405 КБ) на каждый экран, которому нужен список. Обычный список
 * просит по 100 записей.
 */
const LIST_PAGE_SIZE = 100;

/**
 * Каталог квестов — одним компактным ответом (#3459, #3476): лимит страницы
 * каталога на бэкенде 1000, а `compact=1` несёт всё, что нужно плитке
 * (квадратная обложка и заливка). Бэкенд со старым лимитом урежет страницу —
 * тогда остаток дочитается по размеру выборки, как у любого списка.
 */
export const CATALOG_PAGE_SIZE = 1000;

function buildListPageUrl(path: string, page: number, pageSize: number): string {
    const separator = path.includes('?') ? '&' : '?';
    const pageParam = page > 1 ? `&page=${page}` : '';
    return `${path}${separator}page_size=${pageSize}${pageParam}`;
}

/** Номер следующей страницы из ссылки `next` бэкенда; `null`, если страница последняя. */
function nextPageNumber<T>(res: PaginatedEnvelope<T>): number | null {
    const next = res?.next_page_url ?? res?.next ?? null;
    const match = typeof next === 'string' ? next.match(/[?&]page=(\d+)/) : null;
    return match ? Number(match[1]) : null;
}

/**
 * Отказ «такой страницы нет»: у DRF несуществующая страница пагинации — это 404
 * «Invalid page». Для страниц, чьё существование не подтверждено ссылкой `next`,
 * это конец каталога, а не сбой загрузки.
 */
function isMissingPage(err: unknown): boolean {
    return err instanceof ApiError && err.status === 404;
}

/**
 * Бэкенд перевёл списочные эндпоинты на пагинацию ({data/results, next}) — разворачиваем конверт и дочитываем все страницы.
 *
 * Число страниц берётся из размера выборки первого ответа, и остаток читается
 * одним заходом. Ответ без размера выборки читается по-старому, страница за
 * страницей.
 *
 * Почему это не общий `utils/fetchAllPages` (#1710): тот принимает загрузчик
 * страницы и возвращает список, а здесь на ту же ось намотаны три вещи, которых
 * у остальных потребителей нет — 404-как-конец-каталога вместо отказа и
 * последовательное дочитывание по ссылке `next`, когда размер выборки
 * разошёлся с отданным. Общее у двух обвязок ровно
 * одно — правило «сколько страниц читать», и оно берётся из `resolveTotalPages`
 * общего хелпера, а не считается здесь заново.
 */
export async function fetchAllQuestPages<T>(
    path: string,
    maxPages = 20,
    options?: { signal?: AbortSignal; pageSize?: number },
): Promise<T[]> {
    const getPage = (page: number) => {
        const url = buildListPageUrl(path, page, options?.pageSize ?? LIST_PAGE_SIZE);
        return options?.signal
            ? apiClient.get<T[] | PaginatedEnvelope<T>>(url, undefined, { signal: options.signal })
            : apiClient.get<T[] | PaginatedEnvelope<T>>(url);
    };

    const first = await getPage(1);

    if (Array.isArray(first)) return [...first];

    // Копия обязательна: `unwrapList` отдаёт сам массив из конверта, и `push`
    // дописывал бы записи следующих страниц в объект ответа первой.
    const out = [...unwrapList<T>(first)];
    const pageSize = out.length;
    // Первая страница оказалась последней: каталог пришёл одним ответом (#3459).
    if (nextPageNumber(first) === null) return out;

    let read = 1;
    let lastRead: PaginatedEnvelope<T> = first;

    const total = readEnvelopeTotal(first);
    // Хвостовые страницы посчитаны из размера выборки, а не анонсированы ссылкой
    // `next`: у DRF несуществующая страница — 404 «Invalid page». Их 404 означает
    // конец каталога и обрывает дочитывание целиком: `next` последней прочитанной
    // страницы ведёт как раз на ту, которой нет, и последовательный проход ниже
    // запросил бы её повторно.
    let catalogEnded = false;
    if (total !== null && pageSize > 0) {
        // Размер страницы берём фактический, а не запрошенный: бэкенд вправе
        // урезать `page_size` своим максимумом, и тогда страниц окажется больше.
        const lastPage = resolveTotalPages({ total, pageSize, maxPages });
        // Именно `allSettled`: `all` отвергается первым попавшимся отказом, а
        // решать, конец это каталога или потеря страницы, надо по тому, какая
        // страница отказала первой ПО ПОРЯДКУ.
        const rest = await Promise.allSettled(
            Array.from({ length: Math.max(lastPage - read, 0) }, (_, index) => getPage(read + index + 1)),
        );
        // Порядок массива совпадает с порядком страниц, поэтому записи
        // склеиваются ровно так же, как при последовательном чтении.
        for (const settled of rest) {
            if (settled.status === 'rejected') {
                // Прочие отказы фатальны: транзиентный 500 молча съел бы сотню
                // записей, и неполный каталог выглядел бы полным.
                if (!isMissingPage(settled.reason)) throw settled.reason;
                catalogEnded = true;
                break;
            }
            out.push(...unwrapList<T>(settled.value));
            if (!Array.isArray(settled.value)) lastRead = settled.value;
            read += 1;
        }
    }

    // Если размер выборки разошёлся с тем, что бэкенд реально отдаёт, хвост
    // дочитывается по-старому: лишний последовательный запрос дешевле молча
    // потерянных записей.
    let page = catalogEnded ? null : nextPageNumber(lastRead);
    if (page !== null && page <= read) page = null;
    for (let i = read; i < maxPages && page !== null; i++) {
        const res = await getPage(page);
        if (Array.isArray(res)) {
            out.push(...res);
            break;
        }
        out.push(...unwrapList<T>(res));
        page = nextPageNumber(res);
    }
    return out;
}
