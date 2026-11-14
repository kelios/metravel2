// api/questTypes.ts
// Типы ответов и запросов квестового API (соответствуют OpenAPI схеме бэкенда).
// Вынесены из `api/quests.ts` (#3367); потребители импортируют их оттуда же.
import type { TravelMediaGroup, TravelMediaImage } from '@/types/types';
import type { QuestProgressServerPayload } from '@/utils/questProgressMerge';


export type ApiQuestCoordinate = number | string;

export type ApiQuestFirstCompleter = {
    id: number;
    name: string;
    avatar: string | null;
};

export type ApiQuestRatingSnapshot = {
    rating_avg: number | null;
    rating_count: number;
    user_rating: 1 | 2 | 3 | 4 | 5 | null;
    completions_count: number;
    is_completed_by_me: boolean;
    first_completer: ApiQuestFirstCompleter | null;
    /**
     * Уникальные просмотры квеста. Бэкенд отдаёт поле в списке каталога и
     * ломает им ничью по прохождениям в `?sort=popular`; на клиенте оно нужно
     * только правилу популярности, поэтому необязательное.
     */
    views_count?: number;
};

export type ApiQuestOptionalRatingSnapshot = Partial<ApiQuestRatingSnapshot>;

export type ApiQuestAnswerPattern = {
    type: string;
    value: unknown;
} | string | null;

/** Город квеста (из бэкенда) */
export type ApiQuestCity = {
    id: number;
    /** Historical city IDs that resolve to this canonical city. Missing on old DTOs. */
    legacy_ids?: number[];
    name: string | null;
    /** Имя на языке запроса независимо от перевода контента (#2392). */
    name_localized?: string;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    country_code?: string | null;
    /** Русское имя города при локализованном `name` (#2197): по нему считается alias. */
    name_canonical?: string | null;
};

/** Финал квеста (из бэкенда) */
export type ApiQuestFinale = {
    text: string;
    video_url: string | null;
    poster_url: string | null;
};

/** Шаг квеста (из бэкенда) */
export type ApiQuestStep = {
    id: number | string;
    step_id?: string | null;
    title: string;
    location: string;
    story: string;
    task: string;
    hint?: string | null;
    answer_pattern?: ApiQuestAnswerPattern;
    // Старый формат (для обратной совместимости)
    answer_type?: string;
    answer_value?: string;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    geo_verify?: {
        enabled?: boolean;
        radius_m?: number;
    } | null;
    maps_url: string;
    image_url?: string | null;
    input_type?: 'number' | 'text';
    order?: number;
    is_intro?: boolean;
    /** Canonical point classification for progress/count parity (#1614). */
    point_role?: 'start' | 'required' | 'optional' | 'final' | null;
    country_code?: string | null;
    poi_info?: {
        is_museum: boolean;
        opening_hours?: string | null;
        ticket_price?: string | null;
        website?: string | null;
    } | null;
};

/** Метаданные квеста для каталога */
export type ApiQuestSquareVariants = {
    [name: string]: string | null | undefined;
    square_160?: string | null;
    square_320?: string | null;
};

export type ApiQuestCoverMedia = Omit<TravelMediaImage, 'variants'> & {
    /**
     * Квадратная производная для фиксированной плитки 132×132 (#1542).
     * Поля nullable: до backfill #1587 контракт уже присутствует в API, но
     * значения остаются `null`, поэтому потребитель обязан сохранить fallback.
     */
    src_square?: string | null;
    srcset_square?: string | null;
    sizes_hint_square?: string | null;
    variants?: ApiQuestSquareVariants | null;
};

export type ApiQuestMediaGroup = Omit<TravelMediaGroup, 'cover'> & {
    cover?: ApiQuestCoverMedia | null;
};

export type ApiQuestMeta = {
    /** Client-only: shared offline metadata has no reliable personal status. */
    personal_status_unavailable?: boolean;
    id: number;
    quest_id: string;
    title: string;
    points: number | string; // readOnly from backend
    city_id: string; // readOnly
    /** Historical city IDs that resolve to city_id. Missing on old DTOs/cache. */
    city_legacy_ids?: number[];
    city_name: string; // readOnly
    /** Имя на языке запроса независимо от перевода контента (#2392). */
    city_name_localized?: string;
    /**
     * Публичный alias города (#2211): единственный источник `/quests/<alias>`.
     * Пустая строка — у города alias нет; отсутствие поля — старый ответ/кэш,
     * тогда alias выводит эвристика `utils/questCityAlias.js`.
     */
    city_alias?: string; // readOnly
    /**
     * #3327: число опубликованных квестов всего города строки (бэк #3282). Приходит
     * в подборе статьи (`/quests/web/discovery/?view=travel`), где строк не больше
     * шести; у старого ответа и других выдач поля нет.
     */
    city_quest_count?: number;
    country_id?: string | null;
    country_name?: string | null;
    country_code?: string | null;
    lat: ApiQuestCoordinate;
    lng: ApiQuestCoordinate;
    duration_min: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | '' | null;
    /**
     * `Quest.tags` is `JSONField(default=list)`: a slug list or a `{tag: true}` map — read via `@/utils/questTags`.
     * Audience tags (#3276): `kids`, `family`, `age-<from>-<to>` (`age-5-7`, `age-8-10`, `age-11-14`),
     * `adult-required` / `adult-recommended` — the assistant card reads them in `api/aiAssist/questAudience.ts`.
     */
    tags: string[] | Record<string, unknown> | null;
    pet_friendly: boolean;
    cover_url: string | null;
    /**
     * Язык контента квеста (#2197): `lang` запроса, если перевод опубликован,
     * иначе язык источника. Отсутствие поля — `ru` (старый бэкенд, офлайн-кэш).
     */
    content_locale?: string;
    available_locales?: string[];
    /**
     * #3349: locales whose page of this quest the server actually serves
     * (`translated_detail_served`); `[]` without an active publication. Membership
     * of the locale hubs `/{locale}/quests` (#3217) — never `available_locales`.
     */
    served_locales?: string[];
    /** Русское имя города при локализованном `city_name`: по нему считается alias. */
    city_name_canonical?: string;
    /**
     * Медиа-манифест обложки (#1208): отсюда берётся `dominant_color` для заливки
     * полей letterbox. В UI не пробрасывается — прогревает общий индекс, см.
     * `utils/mediaPlaceholderIndex.ts`.
     */
    media?: ApiQuestMediaGroup | null;
} & ApiQuestRatingSnapshot;

/** Полный бандл квеста */
export type ApiQuestBundle = {
    id: number;
    quest_id: string;
    title: string;
    cover_url?: string | null;
    /** Optional on older detail responses; city metadata supplies classification. */
    tags?: string[] | Record<string, unknown> | null;
    steps: ApiQuestStep[] | string;
    finale: ApiQuestFinale;
    intro: ApiQuestStep | string | null;
    storage_key: string;
    city: ApiQuestCity;
    /** Язык контента бандла и его шагов (#2197); отсутствие — `ru`. */
    content_locale?: string;
    source_locale?: string;
    available_locales?: string[];
    /** См. `ApiQuestMeta.media`: манифест обложки для индекса заливки (#1208). */
    media?: TravelMediaGroup | null;
} & ApiQuestOptionalRatingSnapshot;

/** Прогресс прохождения квеста */
export type ApiQuestProgress = {
    id: number;
    quest: number;
    user: number;
    current_index: number;
    unlocked_index: number;
    answers: Record<string, string>;
    attempts: Record<string, number>;
    hints: Record<string, boolean>;
    show_map: boolean;
    completed: boolean;
    /**
     * Точки, которые игрок официально пропустил: `{step_id: true}`. Бэкенд
     * принимает и отдаёт поле с #1454; до #1632 клиент его не слал, и на проде
     * оно было пустым во всех 33 строках прогресса.
     */
    skipped: Record<string, boolean>;
    /** Игрок закрыл квест на месте, не дойдя до оставшихся точек (#1454). */
    early_finish: boolean;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type ApiQuestProgressCreate = {
    quest: number;
    current_index?: number;
    unlocked_index?: number;
    answers?: Record<string, string>;
    attempts?: Record<string, number>;
    hints?: Record<string, boolean>;
    show_map?: boolean;
    completed?: boolean;
    skipped?: Record<string, boolean>;
    early_finish?: boolean;
};

/**
 * Фото игрока в публичном отзыве (#1575/#1576).
 * `step_id` — числовой PK шага квеста, если снимок привязан к точке.
 */
export type ApiQuestReviewPhoto = {
    id: number;
    url: string | null;
    step_id?: number | null;
};

/** Публичный отзыв о квесте (для читалки чужих отзывов) */
export type ApiQuestReview = {
    id: number;
    rating: number;
    liked: string;
    disliked: string;
    author_name: string | null;
    author_avatar: string | null;
    /**
     * #2163: id автора отзыва (nullable, read-only). На бэке до #2163 поля нет —
     * потребитель не выдумывает id: без него нет блокировки автора и фильтра кэша.
     */
    user?: number | null;
    created_at: string | null;
    /**
     * Не больше трёх снимков, непромодерированные сервер уже вырезал
     * (`quests/serializers.py:727`). Поле может отсутствовать на бэкенде без
     * #1576 — потребитель обязан переживать это пустым списком, а не пустым
     * местом на месте галереи.
     */
    photos?: ApiQuestReviewPhoto[] | null;
};

export type QuestReviewPhoto = {
    id: number;
    url: string;
    stepId: number | null;
};

/** Отзыв для UI (фронтенд формат) */
export type QuestReview = {
    id: number;
    rating: number;
    liked: string;
    disliked: string;
    authorName: string | null;
    authorAvatar: string | null;
    /** #2169: id автора (`user` бэка); null — старый бэк или удалённый автор. */
    authorId: number | null;
    createdAt: string | null;
    photos: QuestReviewPhoto[];
};

/** Публичная статистика квестов (`GET /api/quests/stats/`, #2760). */
export type ApiQuestStats = {
    /** Сколько разных людей прошли хотя бы один квест; сотрудники не считаются. */
    players_count: number;
};

/** Параметры гео-рекомендаций (город/страна и/или координаты). */
export type NearLocationParams = {
    city?: string | null;
    country?: string | null;
    /** ISO-код страны: сверка бэкенда по имени идёт только с `title_ru`/`title_en`. */
    country_code?: string | null;
    lat?: number | null;
    lng?: number | null;
    limit?: number | null;
};

/** Элемент ответа /quests/near-location/ (бэкенд считает score/distance). */
export type ApiQuestNearLocation = {
    quest: ApiQuestMeta;
    score: number;
    distance_km: number | null;
};

/** Одна попытка ответа. `raw_answer` не отправляется для свободных ответов. */
export type QuestAnswerAttemptPayload = {
    client_attempt_id: string;
    step_id: string;
    verdict: 'accepted' | 'rejected';
    raw_answer?: string;
    answer_length: number;
    attempt_no: number;
    hint_shown: boolean;
    elapsed_ms?: number;
    platform: string;
    locale: string;
    occurred_at: string;
};

export type QuestAnswerAttemptsBulkPayload = {
    quest_id: number;
    session_key: string;
    attempts: QuestAnswerAttemptPayload[];
};

export type QuestAnswerAttemptsBulkResult = {
    accepted: number;
    duplicates: number;
    rejected: number;
};

export type QuestGuestHandoffPayload = {
    /** `quest_attempts_session_v1` — тот же ключ, что у телеметрии попыток. */
    session_key: string;
    /** Строковый `quest.quest_id`, как в `/quest-progress/quest/<id>/`. */
    quest_id: string;
    /** Куда вернуть игрока после подтверждения: `/quests/<city>/<quest>`. */
    redirect_path: string;
    progress: QuestProgressServerPayload & {
        answered_at: Record<string, number>;
        updated_at: number;
    };
};
