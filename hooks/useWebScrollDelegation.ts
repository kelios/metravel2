// hooks/useWebScrollDelegation.ts
// Web-only: единый контракт прокрутки для оболочки приложения.
//
// Оболочка на вебе — контейнер ровно во вьюпорт (`html/body/#root { height:100% }`
// + `overflow:hidden` у контейнера экрана react-navigation), поэтому документ не
// скроллится никогда, а длинный контент живёт во внутреннем `overflow-y:auto`
// экрана. Побочный эффект: любая часть хрома, лежащая ВНЕ этого контейнера —
// глобальная шапка, шапка/счётчик экрана, нижний док, десктопный футер, фон —
// становится мёртвой зоной: колесо и вертикальный свайп там не двигают ничего,
// и страница выглядит зависшей (#1615, замер на /quests, /search, /travelsby).
//
// Контракт: у экрана один основной владелец прокрутки; оболочка ПЕРЕАДРЕСУЕТ ему
// вертикальный жест из инертной области. Делегирование включается только когда
// событие заведомо ничего бы не сделало: ни один предок не прокручивается ПО
// ВЕРТИКАЛИ, документ не прокручивается, модалка не открыта, и жест не забрал
// себе никто другой (`defaultPrevented`). Поэтому независимая прокрутка
// сайдбара, карты и диалогов не затрагивается, а горизонтальная полка в шапке
// (`overflow-x:auto`, вертикально мёртвая) перестаёт быть мёртвой зоной: полки,
// которые реально забирают колесо себе, снимаются проверкой defaultPrevented.

import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Атрибут на <html>: слушатели делегирования установлены (гейт для e2e и QA). */
export const DELEGATION_READY_ATTR = 'data-scroll-delegation';

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);
const MIN_SCROLL_EXTENT = 1;
/**
 * Доля вьюпорта, ниже которой прокручиваемая область не считается основным
 * владельцем экрана: сайдбар и панель фильтров не должны забирать жест,
 * сделанный над другой частью экрана.
 */
const MIN_OWNER_VIEWPORT_SHARE = 0.25;
/**
 * Запасной критерий владельца, когда порог площади не берёт никто (#1615).
 * На проде каталог `/quests` живёт в колонке 339×577 — это ~17% вьюпорта
 * 1280×900, ниже `MIN_OWNER_VIEWPORT_SHARE`, поэтому владелец не выбирался
 * вовсе и экран оставался мёртвым везде, кроме самой колонки.
 *
 * По площади узкую панель от узкой колонки контента не отличить: фильтры карты
 * занимают 13% вьюпорта, каталог квестов — 17%. Различают два других признака.
 *
 * Первый — длина прокрутки: колонка каталога тянется на 7980 px, почти девять
 * экранов. Второй — отсутствие на экране собственного потребителя колеса: на
 * `/map` полотно Leaflet зумится тем же жестом, поэтому там любая догадка о
 * «владельце» опасна, и порог площади остаётся единственным правилом.
 * Дополнительно требуется единственность кандидата: два конкурирующих
 * скроллера означают составной макет, где отдавать чужой жест наугад нельзя.
 */
const MIN_FALLBACK_OWNER_SCREENS = 3;
/** Полотно карты забирает колесо себе (зум), поэтому запасное правило там не работает. */
const WHEEL_OWNING_SURFACE_SELECTOR = '.leaflet-container';
/** Владелец кэшируется на время жеста: hit-test на каждое событие колеса лишний. */
const OWNER_CACHE_MS = 400;
/**
 * Отрицательный вердикт живёт заметно меньше положительного: на экране без
 * прокручиваемой колонки (карта) кэш всё равно снимает hit-test-шторм, а на
 * доезжающем каталоге пользователь не должен ждать полный OWNER_CACHE_MS,
 * прежде чем первое колесо начнёт работать. Замер 29.08: при едином TTL 400 мс
 * mobile /travelsby падал в спеке примерно в одном прогоне из трёх.
 */
const OWNER_MISS_CACHE_MS = 150;
/** Решение «инертная область» кэшируется на серию событий одного жеста. */
const INERT_CACHE_MS = 150;
/** До этого смещения свайп ещё не принадлежит ни одной оси. */
const TOUCH_AXIS_LOCK_PX = 8;

/** Фаза свайпа: ось выбирается один раз за жест и до конца его не меняется. */
type TouchPhase = 'idle' | 'pending' | 'vertical';

function isElement(node: unknown): node is Element {
    return !!node && (node as Node).nodeType === 1;
}

/** Прокручивается ли элемент по вертикали прямо сейчас. */
export function isVerticallyScrollable(el: Element): boolean {
    // Дешёвая проверка экстента идёт первой: у подавляющего большинства узлов он
    // нулевой, и до дорогого getComputedStyle дело не доходит.
    if (el.scrollHeight - el.clientHeight <= MIN_SCROLL_EXTENT) return false;
    const view = el.ownerDocument?.defaultView;
    if (!view) return false;
    return SCROLLABLE_OVERFLOW.has(view.getComputedStyle(el).overflowY);
}

/**
 * Ближайший предок (включая сам узел), который принял бы вертикальный жест сам.
 * Инертная область — та, где такого предка нет.
 */
export function findVerticallyScrollableAncestor(start: EventTarget | null): HTMLElement | null {
    let el: Element | null = isElement(start) ? start : null;
    while (el) {
        if (isVerticallyScrollable(el)) return el as HTMLElement;
        el = el.parentElement;
    }
    return null;
}

/**
 * Основной владелец прокрутки экрана: самая крупная по видимой площади
 * вертикально-прокручиваемая область под характерными точками вьюпорта.
 * Hit-test вместо обхода всего DOM — на каталоге это тысячи узлов.
 */
export function findPrimaryScrollOwner(doc: Document): HTMLElement | null {
    const view = doc.defaultView;
    if (!view || typeof doc.elementsFromPoint !== 'function') return null;

    const w = view.innerWidth;
    const h = view.innerHeight;
    if (w <= 0 || h <= 0) return null;

    const probes: Array<[number, number]> = [
        [w / 2, h / 2],
        [w / 2, h * 0.72],
        [w * 0.75, h * 0.5],
        [w * 0.25, h * 0.5],
    ];

    // Владелец — ОСНОВНАЯ область экрана, а не любая прокручиваемая панель.
    // Без этого порога боковая панель забирает жест из чужой части экрана:
    // на проде левые фильтры `/map` (≈348×440 при вьюпорте 1280×900) стали бы
    // «владельцем», и обычное колесо над полотном карты прокручивало бы их.
    // Замер долей: колонка каталога /quests 62% вьюпорта, правая колонка
    // /search 65%, мобильные — 73–86%; сайдбар /quests 17%, фильтры карты 13%.
    const minArea = w * h * MIN_OWNER_VIEWPORT_SHARE;

    let best: HTMLElement | null = null;
    let bestArea = minArea;
    // Кандидаты нужны для запасного правила ниже: без них экран, у которого
    // единственная длинная колонка не дотягивает до порога площади, остаётся
    // вообще без владельца (#1615).
    const candidates = new Set<HTMLElement>();
    for (const [x, y] of probes) {
        for (const hit of doc.elementsFromPoint(Math.round(x), Math.round(y))) {
            const owner = findVerticallyScrollableAncestor(hit);
            if (!owner) continue;
            candidates.add(owner);
            const area = owner.clientWidth * owner.clientHeight;
            if (area > bestArea) {
                bestArea = area;
                best = owner;
            }
            break;
        }
    }
    if (best) return best;

    // Запасное правило: ровно один прокручиваемый кандидат, он длиной в
    // несколько экранов, и на экране нет полотна, которое само забирает колесо.
    // Это основной контент в узкой колонке, а не панель рядом с картой —
    // отдать ему жест безопаснее, чем оставить экран неподвижным.
    if (candidates.size !== 1) return null;
    if (doc.querySelector(WHEEL_OWNING_SURFACE_SELECTOR)) return null;
    const [only] = candidates;
    const extent = only.scrollHeight - only.clientHeight;
    return extent >= h * MIN_FALLBACK_OWNER_SCREENS ? only : null;
}

/** Колесо приходит в пикселях, строках или страницах — приводим к пикселям. */
export function normalizeWheelDelta(
    deltaY: number,
    deltaMode: number,
    viewportHeight: number,
): number {
    if (deltaMode === 1) return deltaY * 16;
    if (deltaMode === 2) return deltaY * viewportHeight;
    return deltaY;
}

export function scrollOwnerBy(owner: HTMLElement, delta: number): boolean {
    const max = owner.scrollHeight - owner.clientHeight;
    const next = Math.max(0, Math.min(max, owner.scrollTop + delta));
    if (next === owner.scrollTop) return false;

    // Прокрутка ОБЯЗАНА быть мгновенной: у колонки каталога квестов стоит
    // `scroll-behavior: smooth`, а он распространяется и на программную
    // прокрутку. Замер 29.08 на /quests: `scrollTo({behavior:'instant'|'auto'})`
    // не сдвигает такой элемент вовсе, а `scrollTop` под smooth анимировал бы
    // каждый тик колеса и превращал обычную прокрутку в вязкую. Рабочий путь —
    // присваивание scrollTop с временным снятием smooth на самом элементе.
    const previousBehavior = owner.style.scrollBehavior;
    owner.style.scrollBehavior = 'auto';
    owner.scrollTop = next;
    owner.style.scrollBehavior = previousBehavior;
    return true;
}

export function useWebScrollDelegation(): void {
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        let cachedOwner: HTMLElement | null = null;
        let cachedOwnerAt = 0;
        /** Отличает «кэш пуст» от «кэшировано отсутствие владельца». */
        let ownerResolved = false;
        let inertTarget: EventTarget | null = null;
        let inertVerdict = false;
        let inertAt = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchAnchorY = 0;
        let touchPhase: TouchPhase = 'idle';

        const now = () => Date.now();

        const documentScrolls = () => {
            const de = document.documentElement;
            return !!de && de.scrollHeight - de.clientHeight > MIN_SCROLL_EXTENT;
        };

        // Диалог перехватывает взаимодействие целиком: прокручивать страницу под
        // ним — регрессия, поэтому при открытой модалке делегирование выключено.
        const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

        const isInertRegion = (target: EventTarget | null): boolean => {
            const t = now();
            if (target === inertTarget && t - inertAt < INERT_CACHE_MS) return inertVerdict;
            inertTarget = target;
            inertAt = t;
            inertVerdict = findVerticallyScrollableAncestor(target) === null;
            return inertVerdict;
        };

        const getOwner = (): HTMLElement | null => {
            const t = now();
            const ttl = cachedOwner ? OWNER_CACHE_MS : OWNER_MISS_CACHE_MS;
            if (ownerResolved && t - cachedOwnerAt < ttl) {
                // Отсутствие владельца кэшируется наравне с находкой: на экранах
                // без прокручиваемой колонки (карта) hit-test иначе крутится на
                // каждое событие колеса. Замер 29.08 на /map: 20 событий = 80
                // вызовов elementsFromPoint, ~0.45 мс на событие на пустую работу.
                if (!cachedOwner) return null;
                if (
                    document.contains(cachedOwner) &&
                    cachedOwner.scrollHeight - cachedOwner.clientHeight > MIN_SCROLL_EXTENT
                ) {
                    return cachedOwner;
                }
            }
            cachedOwner = findPrimaryScrollOwner(document);
            cachedOwnerAt = t;
            ownerResolved = true;
            return cachedOwner;
        };

        // Порядок проверок — от самой дешёвой к самой дорогой: вердикт по цели
        // кэшируется на серию событий жеста, а `querySelector` по всему документу
        // не должен выполняться на каждое колесо в обычной прокрутке контента.
        const shouldDelegate = (target: EventTarget | null): boolean =>
            isInertRegion(target) && !documentScrolls() && !modalOpen();

        const onWheel = (event: WheelEvent) => {
            if (event.defaultPrevented) return;
            // Ctrl/Cmd + колесо — зум браузера и ctrl-wheel-zoom карты.
            if (event.ctrlKey || event.metaKey) return;
            // Shift+wheel и trackpad-жест с доминирующим deltaX принадлежат
            // горизонтальным полкам/галереям, а не владельцу вертикального
            // скролла экрана.
            if (event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            if (!event.deltaY) return;
            if (!shouldDelegate(event.target)) return;

            const owner = getOwner();
            if (!owner) return;

            const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight);
            if (scrollOwnerBy(owner, delta) && event.cancelable) {
                event.preventDefault();
            }
        };

        const onTouchStart = (event: TouchEvent) => {
            touchPhase = 'idle';
            // Второй палец — это pinch-zoom или жест карты, а не прокрутка экрана.
            if (event.touches.length !== 1) return;
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchAnchorY = touch.clientY;
            if (shouldDelegate(event.target)) touchPhase = 'pending';
        };

        const onTouchMove = (event: TouchEvent) => {
            if (touchPhase === 'idle' || event.defaultPrevented) return;
            if (event.touches.length !== 1) {
                touchPhase = 'idle';
                return;
            }

            const touch = event.touches[0];

            if (touchPhase === 'pending') {
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                // Ось фиксируется один раз за жест и от точки касания. Покадровое
                // решение отдавало прокрутку дрожанию руки посреди горизонтального
                // свайпа по полке, а кадры, отвергнутые как горизонтальные,
                // копили смещение и выстреливали одним прыжком.
                if (Math.max(Math.abs(dx), Math.abs(dy)) < TOUCH_AXIS_LOCK_PX) return;
                // Горизонтальный жест принадлежит полкам и галереям — не трогаем.
                if (Math.abs(dy) <= Math.abs(dx)) {
                    touchPhase = 'idle';
                    return;
                }
                touchPhase = 'vertical';
            }

            const delta = touchAnchorY - touch.clientY;
            touchAnchorY = touch.clientY;

            const owner = getOwner();
            if (!owner) return;
            if (scrollOwnerBy(owner, delta) && event.cancelable) {
                event.preventDefault();
            }
        };

        const onTouchEnd = () => {
            touchPhase = 'idle';
        };

        const onInvalidate = () => {
            cachedOwner = null;
            ownerResolved = false;
            inertTarget = null;
            inertAt = 0;
        };

        // Наблюдаемый признак того, что контракт прокрутки реально установлен:
        // до гидрации слушателей нет, и мёртвые зоны ещё не переадресуются.
        // Регрессия #1615 гейтится по нему, а не по таймауту.
        document.documentElement.setAttribute(DELEGATION_READY_ATTR, 'on');

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });
        window.addEventListener('resize', onInvalidate);

        return () => {
            document.documentElement.removeAttribute(DELEGATION_READY_ATTR);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
            window.removeEventListener('resize', onInvalidate);
        };
    }, []);
}
