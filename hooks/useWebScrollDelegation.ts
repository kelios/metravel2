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
/** Владелец кэшируется на время жеста: hit-test на каждое событие колеса лишний. */
const OWNER_CACHE_MS = 400;
/** Решение «инертная область» кэшируется на серию событий одного жеста. */
const INERT_CACHE_MS = 150;

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

    let best: HTMLElement | null = null;
    let bestArea = 0;
    for (const [x, y] of probes) {
        for (const hit of doc.elementsFromPoint(Math.round(x), Math.round(y))) {
            const owner = findVerticallyScrollableAncestor(hit);
            if (!owner) continue;
            const area = owner.clientWidth * owner.clientHeight;
            if (area > bestArea) {
                bestArea = area;
                best = owner;
            }
            break;
        }
    }
    return best;
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
        let inertTarget: EventTarget | null = null;
        let inertVerdict = false;
        let inertAt = 0;
        let touchX = 0;
        let touchY = 0;
        let touchActive = false;

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
            const cacheValid =
                cachedOwner &&
                t - cachedOwnerAt < OWNER_CACHE_MS &&
                document.contains(cachedOwner) &&
                cachedOwner.scrollHeight - cachedOwner.clientHeight > MIN_SCROLL_EXTENT;
            if (cacheValid) return cachedOwner;
            cachedOwner = findPrimaryScrollOwner(document);
            cachedOwnerAt = t;
            return cachedOwner;
        };

        const shouldDelegate = (target: EventTarget | null): boolean =>
            !documentScrolls() && !modalOpen() && isInertRegion(target);

        const onWheel = (event: WheelEvent) => {
            if (event.defaultPrevented) return;
            // Ctrl/Cmd + колесо — зум браузера и ctrl-wheel-zoom карты.
            if (event.ctrlKey || event.metaKey) return;
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
            touchActive = false;
            if (event.touches.length !== 1) return;
            const touch = event.touches[0];
            touchX = touch.clientX;
            touchY = touch.clientY;
            touchActive = shouldDelegate(event.target);
        };

        const onTouchMove = (event: TouchEvent) => {
            if (!touchActive || event.defaultPrevented || event.touches.length !== 1) return;

            const touch = event.touches[0];
            const dx = touch.clientX - touchX;
            const dy = touch.clientY - touchY;
            // Горизонтальный жест принадлежит полкам и галереям — не трогаем.
            if (Math.abs(dy) <= Math.abs(dx)) return;

            touchX = touch.clientX;
            touchY = touch.clientY;

            const owner = getOwner();
            if (!owner) return;
            if (scrollOwnerBy(owner, -dy) && event.cancelable) {
                event.preventDefault();
            }
        };

        const onTouchEnd = () => {
            touchActive = false;
        };

        const onInvalidate = () => {
            cachedOwner = null;
            inertTarget = null;
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
