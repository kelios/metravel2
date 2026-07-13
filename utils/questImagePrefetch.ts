// utils/questImagePrefetch.ts
// Префетч фото шагов/обложки/постера квеста для офлайн-прохождения.
// Прямой импорт expo-image здесь допустим: Image.prefetch — это НЕ рендер
// (гвард check-image-architecture проверяет только components/**), а прогрев
// дискового кэша expo-image, чтобы картинки открывались без сети.
import { Image } from 'expo-image';

export type QuestPrefetchResult = {
    total: number;
    ok: number;
};

const isHttpUrl = (url: unknown): url is string =>
    typeof url === 'string' && /^https?:\/\//i.test(url.trim());

/** Уникальные http(s)-урлы из произвольного набора (шаги, обложка, постер). */
export function collectQuestImageUrls(urls: Array<string | undefined | null>): string[] {
    const seen = new Set<string>();
    for (const url of urls) {
        if (isHttpUrl(url)) seen.add(url.trim());
    }
    return Array.from(seen);
}

/**
 * Прогревает дисковый кэш expo-image по списку урлов. Частичные фейлы не роняют
 * общий результат — возвращаем счётчик успешно загруженных.
 */
export async function prefetchQuestImages(
    urls: Array<string | undefined | null>,
): Promise<QuestPrefetchResult> {
    const list = collectQuestImageUrls(urls);
    if (list.length === 0) return { total: 0, ok: 0 };

    const results = await Promise.all(
        list.map((url) =>
            Image.prefetch(url, { cachePolicy: 'disk' })
                .then((ok) => ok !== false)
                .catch(() => false),
        ),
    );

    return {
        total: list.length,
        ok: results.filter(Boolean).length,
    };
}
