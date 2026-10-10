// Выбор среза в каталоге квестов: ключ хранилища, id виртуальных фильтров и
// предикат личных срезов.
//
// Лист без зависимостей, потому что константы нужны по обе стороны от экрана
// каталога: сам экран (`screens/tabs/QuestsScreen.helpers.ts` их
// ре-экспортирует) и профиль, который ведёт «Показать все» в срез «Пройденные»
// (#1794). Тянуть ради двух строк весь модуль helpers — это таблица стран,
// геометрия карты и `@/i18n` в бандле профиля.

// v2: сброс устаревшего авто-сохранённого города (старый код по гео сохранял
// единственный ближайший город, из-за чего по умолчанию был виден лишь 1 город).
export const STORAGE_SELECTED_CITY = 'quests_selected_city_v2';

export const ALL_QUESTS_ID = '__all__';
export const NEARBY_ID = '__nearby__';
export const KIDS_FILTER_ID = '__kids__';
export const BIKE_FILTER_ID = '__bike__';
export const REVIEWED_FILTER_ID = '__reviewed__';
// Срезы прохождений доступны вошедшему игроку: личный статус позволяет
// отличить свои прохождения от прохождений других игроков.
export const COMPLETED_FILTER_ID = '__completed__';
export const COMPLETED_BY_OTHERS_FILTER_ID = '__completed_by_others__';
export const UNCOMPLETED_FILTER_ID = '__uncompleted__';

/**
 * Вся страна каталога — тот же слот выбора, что и город: `__country__:BY`.
 * Отдельный слот для страны мог бы разойтись с выбранным городом другой
 * страны, а каждому потребителю выбора (сетка, заголовки, сброс, сохранение)
 * пришлось бы учить второе поле.
 */
export const COUNTRY_FILTER_PREFIX = '__country__:';

export function toCountrySelectionId(countryCode: string): string {
    return `${COUNTRY_FILTER_PREFIX}${countryCode.trim().toUpperCase()}`;
}

/** Код страны из id выбора; `null` для города и любого другого среза. */
export function parseCountrySelectionId(selectionId: string | null | undefined): string | null {
    if (!selectionId || !selectionId.startsWith(COUNTRY_FILTER_PREFIX)) return null;
    const code = selectionId.slice(COUNTRY_FILTER_PREFIX.length).trim().toUpperCase();
    return code || null;
}

/**
 * Тематическая подборка (#2377) — тот же слот выбора, что город и страна:
 * `__theme__:halloween`. Реестр тем и предикат живут в `utils/questThemes.ts`;
 * здесь только форма id, чтобы профиль, хранилище и SSG-скрипт восстановления
 * выбора (#2320) узнавали срез без импорта реестра и i18n.
 */
export const THEME_FILTER_PREFIX = '__theme__:';

export function toThemeSelectionId(themeId: string): string {
    return `${THEME_FILTER_PREFIX}${themeId.trim().toLowerCase()}`;
}

/** Id темы из id выбора; `null` для города и любого другого среза. */
export function parseThemeSelectionId(selectionId: string | null | undefined): string | null {
    if (!selectionId || !selectionId.startsWith(THEME_FILTER_PREFIX)) return null;
    const id = selectionId.slice(THEME_FILTER_PREFIX.length).trim().toLowerCase();
    return id || null;
}

/**
 * Предикат этих двух срезов. Флаг приходит в каждом элементе `/quests/`
 * (`is_completed_by_me` → `isCompletedByMe`), поэтому срез не стоит отдельного
 * запроса. Живёт рядом со своими id и без зависимостей: одним правилом каталог
 * фильтрует сайдбар (#1791), а профиль собирает список «Мои квесты» (#1794).
 */
export function filterQuestsByCompletion<T extends { isCompletedByMe?: boolean }>(
    quests: T[],
    completed: boolean,
): T[] {
    return quests.filter((quest) => Boolean(quest.isCompletedByMe) === completed);
}

/** Общий счётчик включает личное прохождение: оно само по себе не считается чужим. */
export function filterQuestsCompletedByOthers<T extends {
    isCompletedByMe?: boolean;
    completionsCount?: number;
    personalStatusUnavailable?: boolean;
}>(
    quests: T[],
): T[] {
    return quests.filter((quest) => !quest.personalStatusUnavailable
        && (quest.completionsCount ?? 0) > (quest.isCompletedByMe ? 1 : 0));
}

/**
 * Разовая передача среза другому экрану (#1794): профиль кладёт сюда id, а
 * каталог на фокусе забирает его и удаляет.
 *
 * Писать напрямую в {@link STORAGE_SELECTED_CITY} нельзя: каталог читает этот
 * ключ ровно один раз, при монтировании, а вкладка живёт всю сессию
 * (`lazy: true` без `unmountOnBlur`), и `router.push` на соседнюю вкладку
 * второй экземпляр не создаёт. Уже открытый каталог остался бы в прежнем
 * срезе, и единственная кнопка секции давала бы неверный ответ. Отдельный
 * одноразовый ключ ещё и не портит сохранённый выбор, если до каталога так и
 * не дошли.
 */
export const STORAGE_PENDING_CATALOG_SELECTION = 'quests_pending_selection_v1';

/**
 * «Рядом» требует свежей геолокации и поэтому не восстанавливается между
 * сессиями. Старое значение `__nearby__` могло означать как настоящий
 * геофильтр, так и прежний «мягкий» дефолт всего каталога, поэтому безопасно
 * мигрируем его в явное состояние «Все квесты».
 */
export function resolveStoredQuestCatalogSelection(savedId: string | null): string {
    if (!savedId || savedId === NEARBY_ID) return ALL_QUESTS_ID;
    return savedId;
}

/**
 * #2320: сохранённый срез, сужающий каталог, — тот же предикат, по которому
 * каталог прячет SEO-вводку (`filtersActive` в `QuestsScreen`): любой
 * восстановленный выбор, кроме «Все квесты».
 */
export function isNarrowingStoredQuestCatalogSelection(savedId: string | null): boolean {
    return resolveStoredQuestCatalogSelection(savedId) !== ALL_QUESTS_ID;
}

/**
 * #2320: статический HTML `/quests` один для всех и рисует общий каталог с
 * SEO-вводкой над сеткой; сохранённый срез React применяет только после
 * гидратации, вводка исчезает — сетка прыгала вверх (CLS 0,32 на 390). Срез
 * лежит в `localStorage`, поэтому его признак ставит синхронный скрипт головы
 * классом на `<html>` ДО первого кадра, а CSS прячет слоты вводки — первый кадр
 * совпадает с итогом. Класс снимает экран, когда восстановленный выбор уже
 * отрисован (`releaseQuestCatalogRestoredClass`), иначе «Все квесты» после сброса
 * остались бы без вводки. Краулер `localStorage` не имеет — вводка у него видна.
 */
export const QUEST_CATALOG_RESTORED_CLASS = 'quests-slice-restored';

export function getQuestCatalogRestoredSelectionScript(): string {
    const key = JSON.stringify(STORAGE_SELECTED_CITY);
    const keep = JSON.stringify([ALL_QUESTS_ID, NEARBY_ID]);
    const cls = JSON.stringify(QUEST_CATALOG_RESTORED_CLASS);
    return `(function(){try{var p=window.location.pathname.replace(/\\/+$/,'');if(p!=='/quests')return;var v=window.localStorage.getItem(${key});if(v&&${keep}.indexOf(v)<0)document.documentElement.classList.add(${cls})}catch(_){}})();`;
}

export function getQuestCatalogRestoredSelectionCss(): string {
    return `html.${QUEST_CATALOG_RESTORED_CLASS} [data-quests-seo-slot]{display:none!important}`;
}

export function releaseQuestCatalogRestoredClass(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove(QUEST_CATALOG_RESTORED_CLASS);
}
