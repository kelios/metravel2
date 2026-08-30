import { render } from '@testing-library/react';
import { Platform } from 'react-native';

import {
    DELEGATION_READY_ATTR,
    findPrimaryScrollOwner,
    findVerticallyScrollableAncestor,
    isVerticallyScrollable,
    normalizeWheelDelta,
    scrollOwnerBy,
    useWebScrollDelegation,
} from '@/hooks/useWebScrollDelegation';

const originalPlatform = Platform.OS;

type Box = { client: number; scroll: number };

/** jsdom не считает layout: геометрию задаём руками, включая изменяемый scrollTop. */
function sizeElement(el: HTMLElement, vertical: Box, horizontal: Box = { client: 100, scroll: 100 }) {
    Object.defineProperty(el, 'clientHeight', { value: vertical.client, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: vertical.scroll, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: horizontal.client, configurable: true });
    Object.defineProperty(el, 'scrollWidth', { value: horizontal.scroll, configurable: true });
    let top = 0;
    Object.defineProperty(el, 'scrollTop', {
        get: () => top,
        set: (next: number) => {
            top = next;
        },
        configurable: true,
    });
}

function Harness() {
    useWebScrollDelegation();
    return (
        <div>
            <div data-testid="chrome">Шапка оболочки</div>
            <div data-testid="rail">
                <span data-testid="rail-item">Полка</span>
            </div>
            <div data-testid="owner">
                <span data-testid="card">Карточка</span>
            </div>
        </div>
    );
}

/** jsdom не реализует hit-test, а оболочка ищет владельца именно им. */
function stubElementsFromPoint(impl: (x: number, y: number) => Element[]): () => void {
    const previous = (document as any).elementsFromPoint;
    (document as any).elementsFromPoint = impl;
    return () => {
        if (previous) (document as any).elementsFromPoint = previous;
        else delete (document as any).elementsFromPoint;
    };
}

function fireWheel(target: Element, init: WheelEventInit = {}): WheelEvent {
    const event = new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

type TouchPoint = { clientX: number; clientY: number };

/** jsdom не даёт конструктор TouchEvent: событию хватает точек и cancelable. */
function fireTouch(
    target: Element,
    type: 'touchstart' | 'touchmove' | 'touchend',
    points: TouchPoint[],
): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points, configurable: true });
    target.dispatchEvent(event);
    return event;
}

describe('useWebScrollDelegation — чистые предикаты', () => {
    it('вертикально прокручиваемым считает только элемент с overflow-y и запасом', () => {
        const scroller = document.createElement('div');
        scroller.style.overflowY = 'auto';
        sizeElement(scroller, { client: 500, scroll: 4000 });
        expect(isVerticallyScrollable(scroller)).toBe(true);

        const noOverflow = document.createElement('div');
        sizeElement(noOverflow, { client: 500, scroll: 4000 });
        expect(isVerticallyScrollable(noOverflow)).toBe(false);

        const noExtent = document.createElement('div');
        noExtent.style.overflowY = 'auto';
        sizeElement(noExtent, { client: 500, scroll: 500 });
        expect(isVerticallyScrollable(noExtent)).toBe(false);
    });

    it('горизонтальная полка не считается владельцем вертикального жеста (#1615)', () => {
        // Навигация в шапке — `overflow-x: auto` и по вертикали мёртвая. Раньше
        // она перехватывала решение на себя, и шапка оставалась мёртвой зоной.
        const rail = document.createElement('div');
        rail.style.overflowX = 'auto';
        sizeElement(rail, { client: 44, scroll: 44 }, { client: 390, scroll: 900 });
        const item = document.createElement('span');
        rail.appendChild(item);
        document.body.appendChild(rail);

        expect(findVerticallyScrollableAncestor(item)).toBeNull();
        rail.remove();
    });

    it('находит ближайшего вертикального предка и null в инертной области', () => {
        const scroller = document.createElement('div');
        scroller.style.overflowY = 'auto';
        sizeElement(scroller, { client: 500, scroll: 4000 });
        const inner = document.createElement('span');
        scroller.appendChild(inner);
        const inert = document.createElement('div');
        document.body.append(scroller, inert);

        expect(findVerticallyScrollableAncestor(inner)).toBe(scroller);
        expect(findVerticallyScrollableAncestor(inert)).toBeNull();
        expect(findVerticallyScrollableAncestor(null)).toBeNull();

        scroller.remove();
        inert.remove();
    });

    it('приводит колесо к пикселям для строчного и страничного режимов', () => {
        expect(normalizeWheelDelta(120, 0, 800)).toBe(120);
        expect(normalizeWheelDelta(3, 1, 800)).toBe(48);
        expect(normalizeWheelDelta(1, 2, 800)).toBe(800);
    });

    it('прокручивает владельца с зажимом по границам и снимает smooth на время записи', () => {
        const owner = document.createElement('div');
        owner.style.overflowY = 'auto';
        owner.style.scrollBehavior = 'smooth';
        sizeElement(owner, { client: 500, scroll: 1000 });

        expect(scrollOwnerBy(owner, 300)).toBe(true);
        expect(owner.scrollTop).toBe(300);

        // Ниже конца не уезжаем, а на самой границе сообщаем «не сдвинулись».
        expect(scrollOwnerBy(owner, 10_000)).toBe(true);
        expect(owner.scrollTop).toBe(500);
        expect(scrollOwnerBy(owner, 200)).toBe(false);

        expect(scrollOwnerBy(owner, -10_000)).toBe(true);
        expect(owner.scrollTop).toBe(0);
        // Исходное CSS-значение возвращается на место.
        expect(owner.style.scrollBehavior).toBe('smooth');
    });

    it('боковую панель владельцем не берёт: она не должна забирать жест с другой части экрана', () => {
        // Прод-риск с /map: левые фильтры (≈348×440 при вьюпорте 1280×900 — 13%)
        // оказывались единственной прокручиваемой областью, и обычное колесо
        // над полотном карты прокручивало бы их вместо ничего.
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

        const sidePanel = document.createElement('div');
        sidePanel.style.overflowY = 'auto';
        sizeElement(sidePanel, { client: 440, scroll: 9000 }, { client: 348, scroll: 348 });
        // Полотно карты присутствует в DOM ровно так же, как на живом `/map`:
        // именно оно делает экран составным и запрещает запасное правило #1615.
        const mapCanvas = document.createElement('div');
        mapCanvas.className = 'leaflet-container';
        document.body.append(sidePanel, mapCanvas);

        const restore = stubElementsFromPoint(() => [sidePanel]);

        expect(findPrimaryScrollOwner(document)).toBeNull();

        restore();
        sidePanel.remove();
        mapCanvas.remove();
    });

    it('единственную длинную колонку берёт владельцем, даже если она уже 25% вьюпорта (#1615)', () => {
        // Прод `/quests` 1280×900: каталог живёт в колонке 339×577 — 17% вьюпорта,
        // ниже MIN_OWNER_VIEWPORT_SHARE. Пока порог площади был единственным
        // правилом, владелец не выбирался вовсе и весь хром экрана оставался
        // мёртвым: колесо работало только над самой колонкой.
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

        const column = document.createElement('div');
        column.style.overflowY = 'auto';
        sizeElement(column, { client: 577, scroll: 8557 }, { client: 339, scroll: 339 });
        document.body.appendChild(column);

        const restore = stubElementsFromPoint((x) => (x < 400 ? [column] : []));

        expect(findPrimaryScrollOwner(document)).toBe(column);

        restore();
        column.remove();
    });

    it('короткую единственную панель владельцем не берёт: длины на несколько экранов нет', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

        const shortPanel = document.createElement('div');
        shortPanel.style.overflowY = 'auto';
        // extent = 1500 px, меньше трёх экранов по 900 px.
        sizeElement(shortPanel, { client: 577, scroll: 2077 }, { client: 339, scroll: 339 });
        document.body.appendChild(shortPanel);

        const restore = stubElementsFromPoint(() => [shortPanel]);

        expect(findPrimaryScrollOwner(document)).toBeNull();

        restore();
        shortPanel.remove();
    });

    it('при двух конкурирующих узких скроллерах владельца не назначает', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

        const left = document.createElement('div');
        left.style.overflowY = 'auto';
        sizeElement(left, { client: 577, scroll: 8557 }, { client: 339, scroll: 339 });
        const right = document.createElement('div');
        right.style.overflowY = 'auto';
        sizeElement(right, { client: 577, scroll: 8557 }, { client: 300, scroll: 300 });
        document.body.append(left, right);

        const restore = stubElementsFromPoint((x) => (x < 400 ? [left] : [right]));

        expect(findPrimaryScrollOwner(document)).toBeNull();

        restore();
        left.remove();
        right.remove();
    });

    it('основным владельцем берёт самую крупную область под точками вьюпорта', () => {
        const wide = document.createElement('div');
        wide.style.overflowY = 'auto';
        sizeElement(wide, { client: 700, scroll: 9000 }, { client: 900, scroll: 900 });
        const narrow = document.createElement('div');
        narrow.style.overflowY = 'auto';
        sizeElement(narrow, { client: 500, scroll: 9000 }, { client: 300, scroll: 300 });
        document.body.append(wide, narrow);

        const restore = stubElementsFromPoint((x) => (x < 400 ? [narrow] : [wide]));

        expect(findPrimaryScrollOwner(document)).toBe(wide);

        restore();
        wide.remove();
        narrow.remove();
    });
});

describe('useWebScrollDelegation — поведение оболочки', () => {
    let owner: HTMLElement;
    let restoreHitTest: (() => void) | null = null;

    beforeAll(() => {
        (Platform as any).OS = 'web';
    });

    afterAll(() => {
        (Platform as any).OS = originalPlatform;
    });

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    });

    afterEach(() => {
        restoreHitTest?.();
        restoreHitTest = null;
        document.querySelectorAll('[aria-modal="true"]').forEach((node) => node.remove());
    });

    function mount() {
        const view = render(<Harness />);
        owner = view.getByTestId('owner');
        owner.style.overflowY = 'auto';
        sizeElement(owner, { client: 700, scroll: 20_000 }, { client: 900, scroll: 900 });
        restoreHitTest = stubElementsFromPoint(() => [owner]);
        return view;
    }

    it('устанавливает признак готовности контракта и снимает его при размонтировании', () => {
        const view = mount();
        expect(document.documentElement.getAttribute(DELEGATION_READY_ATTR)).toBe('on');
        view.unmount();
        expect(document.documentElement.hasAttribute(DELEGATION_READY_ATTR)).toBe(false);
    });

    it('переадресует колесо из инертного хрома основному владельцу', () => {
        const view = mount();
        const event = fireWheel(view.getByTestId('chrome'));

        expect(owner.scrollTop).toBe(300);
        expect(event.defaultPrevented).toBe(true);
        view.unmount();
    });

    it('не вмешивается, когда жест уже принадлежит прокручиваемой области', () => {
        const view = mount();
        const event = fireWheel(view.getByTestId('card'));

        expect(owner.scrollTop).toBe(0);
        expect(event.defaultPrevented).toBe(false);
        view.unmount();
    });

    it('молчит при открытом диалоге: страница под модалкой не должна ехать', () => {
        const view = mount();
        const dialog = document.createElement('div');
        dialog.setAttribute('aria-modal', 'true');
        document.body.appendChild(dialog);

        const event = fireWheel(view.getByTestId('chrome'));

        expect(owner.scrollTop).toBe(0);
        expect(event.defaultPrevented).toBe(false);
        view.unmount();
    });

    it('не трогает ctrl/cmd + колесо: это зум браузера и карты', () => {
        const view = mount();
        const ctrl = fireWheel(view.getByTestId('chrome'), { ctrlKey: true });
        expect(owner.scrollTop).toBe(0);
        expect(ctrl.defaultPrevented).toBe(false);

        const meta = fireWheel(view.getByTestId('chrome'), { metaKey: true });
        expect(owner.scrollTop).toBe(0);
        expect(meta.defaultPrevented).toBe(false);
        view.unmount();
    });

    it('не превращает горизонтальный wheel-жест полки в вертикальный скролл экрана', () => {
        const view = mount();

        const shifted = fireWheel(view.getByTestId('rail'), { shiftKey: true });
        expect(owner.scrollTop).toBe(0);
        expect(shifted.defaultPrevented).toBe(false);

        const trackpad = fireWheel(view.getByTestId('rail'), { deltaX: 500, deltaY: 30 });
        expect(owner.scrollTop).toBe(0);
        expect(trackpad.defaultPrevented).toBe(false);
        view.unmount();
    });

    it('уступает тому, кто уже забрал жест себе', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');
        chrome.addEventListener('wheel', (e) => e.preventDefault());

        fireWheel(chrome);

        expect(owner.scrollTop).toBe(0);
        view.unmount();
    });

    it('после размонтирования слушателей не остаётся', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');
        view.unmount();

        document.body.appendChild(chrome);
        fireWheel(chrome);

        expect(owner.scrollTop).toBe(0);
        chrome.remove();
    });

    it('не ищет владельца заново на каждое событие, когда владельца нет', () => {
        // Экран без прокручиваемой колонки (карта): hit-test на каждое колесо —
        // ~0.45 мс форсированного layout на заведомо пустую работу.
        const view = mount();
        restoreHitTest?.();
        let hits = 0;
        restoreHitTest = stubElementsFromPoint(() => {
            hits += 1;
            return [];
        });

        const chrome = view.getByTestId('chrome');
        for (let i = 0; i < 5; i += 1) fireWheel(chrome);

        // Один раунд из четырёх проб вьюпорта на всю серию, а не на каждое событие.
        expect(hits).toBe(4);
        view.unmount();
    });

    it('не залипает на владельце, которого больше нет в документе', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');
        fireWheel(chrome);
        expect(owner.scrollTop).toBe(300);

        // Смена маршрута: колонка предыдущего экрана уходит из DOM.
        const stale = owner;
        stale.remove();
        const next = document.createElement('div');
        next.style.overflowY = 'auto';
        sizeElement(next, { client: 700, scroll: 20_000 }, { client: 900, scroll: 900 });
        document.body.appendChild(next);
        restoreHitTest?.();
        restoreHitTest = stubElementsFromPoint(() => [next]);

        fireWheel(chrome);

        expect(next.scrollTop).toBe(300);
        expect(stale.scrollTop).toBe(300);
        next.remove();
        view.unmount();
    });
});

describe('useWebScrollDelegation — свайп в инертной области', () => {
    let owner: HTMLElement;
    let restoreHitTest: (() => void) | null = null;

    beforeAll(() => {
        (Platform as any).OS = 'web';
    });

    afterAll(() => {
        (Platform as any).OS = originalPlatform;
    });

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    });

    afterEach(() => {
        restoreHitTest?.();
        restoreHitTest = null;
    });

    function mount() {
        const view = render(<Harness />);
        owner = view.getByTestId('owner');
        owner.style.overflowY = 'auto';
        sizeElement(owner, { client: 700, scroll: 20_000 }, { client: 390, scroll: 390 });
        restoreHitTest = stubElementsFromPoint(() => [owner]);
        return view;
    }

    it('вертикальный свайп по хрому двигает владельца и забирает жест себе', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');

        fireTouch(chrome, 'touchstart', [{ clientX: 195, clientY: 400 }]);
        const first = fireTouch(chrome, 'touchmove', [{ clientX: 195, clientY: 380 }]);
        fireTouch(chrome, 'touchmove', [{ clientX: 195, clientY: 340 }]);

        // Смещение считается от точки касания: порог оси не съедает первые пиксели.
        expect(owner.scrollTop).toBe(60);
        expect(first.defaultPrevented).toBe(true);
        view.unmount();
    });

    it('горизонтальный свайп по полке не отдаёт экран дрожанию руки', () => {
        const view = mount();
        const rail = view.getByTestId('rail');

        fireTouch(rail, 'touchstart', [{ clientX: 300, clientY: 400 }]);
        // Полка ведёт жест: ось зафиксирована горизонтальной на весь свайп.
        fireTouch(rail, 'touchmove', [{ clientX: 280, clientY: 398 }]);
        // Дрожание с вертикальным доминированием больше не переключает ось,
        // а накопленное смещение не выстреливает прыжком по экрану.
        fireTouch(rail, 'touchmove', [{ clientX: 270, clientY: 340 }]);
        fireTouch(rail, 'touchmove', [{ clientX: 265, clientY: 300 }]);

        expect(owner.scrollTop).toBe(0);
        view.unmount();
    });

    it('микродвижение внутри порога ещё никому не принадлежит', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');

        fireTouch(chrome, 'touchstart', [{ clientX: 195, clientY: 400 }]);
        const tiny = fireTouch(chrome, 'touchmove', [{ clientX: 195, clientY: 396 }]);

        expect(owner.scrollTop).toBe(0);
        expect(tiny.defaultPrevented).toBe(false);
        view.unmount();
    });

    it('второй палец снимает делегирование: это pinch, а не прокрутка', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');

        fireTouch(chrome, 'touchstart', [
            { clientX: 150, clientY: 400 },
            { clientX: 250, clientY: 420 },
        ]);
        fireTouch(chrome, 'touchmove', [
            { clientX: 150, clientY: 300 },
            { clientX: 250, clientY: 520 },
        ]);

        expect(owner.scrollTop).toBe(0);
        view.unmount();
    });

    it('состояние жеста не переживает его окончание', () => {
        const view = mount();
        const chrome = view.getByTestId('chrome');

        fireTouch(chrome, 'touchstart', [{ clientX: 195, clientY: 400 }]);
        fireTouch(chrome, 'touchmove', [{ clientX: 195, clientY: 360 }]);
        expect(owner.scrollTop).toBe(40);
        fireTouch(chrome, 'touchend', []);

        // Без нового touchstart движение пальца ничего не двигает.
        fireTouch(chrome, 'touchmove', [{ clientX: 195, clientY: 200 }]);
        expect(owner.scrollTop).toBe(40);
        view.unmount();
    });

    it('не вмешивается в свайп внутри прокручиваемой колонки', () => {
        const view = mount();
        const card = view.getByTestId('card');

        fireTouch(card, 'touchstart', [{ clientX: 195, clientY: 400 }]);
        const move = fireTouch(card, 'touchmove', [{ clientX: 195, clientY: 300 }]);

        expect(owner.scrollTop).toBe(0);
        expect(move.defaultPrevented).toBe(false);
        view.unmount();
    });
});
