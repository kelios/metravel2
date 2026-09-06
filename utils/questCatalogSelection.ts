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
// Личные срезы каталога: «что я уже прошёл» и «что ещё не проходил». Оба
// существуют только для вошедшего игрока — у гостя `is_completed_by_me`
// приходит `false` на каждом квесте, поэтому «Пройденные» гарантированно
// пусты, а «Не пройденные» дословно повторяют весь каталог.
export const COMPLETED_FILTER_ID = '__completed__';
export const UNCOMPLETED_FILTER_ID = '__uncompleted__';

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
