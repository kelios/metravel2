// Проверка контента квеста hel-fishermen: каждый answer_pattern прогоняется через
// реальный buildAnswerChecker — ожидаемый ответ принимается, заведомо неверный
// отклоняется, ответ не утекает в story/hint, маршрут не выходит за пеший кап.
import { buildAnswerChecker } from '@/utils/questAdapters';

const quests = require('../../scripts/hel-fishermen-quest-data.js');

type Step = {
    step_id: string;
    story: string;
    task: string;
    hint: string | null;
    lat: number;
    lng: number;
    mapsUrl: string;
    answer_pattern: { type: string; value: string };
    poi_info?: Record<string, unknown>;
};

const quest = quests[0];
const steps: Step[] = quest.steps;

// Ожидаемые верные ответы (то, что игрок прочитает на табличке/камне)
// и заведомо неверные — чтобы чекер не пропускал всё подряд.
const CASES: Record<string, { ok: string[]; bad: string[] }> = {
    'hel-cmentarz-obroncow': { ok: ['31', 'тридцать один'], bad: ['32', '100', '3600'] },
    'hel-dom-necla': { ok: ['Netzel', 'netzel', 'Нетцель'], bad: ['Necel', 'Нецель', 'Sienkiewicz'] },
    'hel-rzepka-zeromski': { ok: ['100', 'сотая', 'столетие'], bad: ['50', '150', '1964'] },
    'hel-pomnik-myslisza': { ok: ['Virtuti Militari', 'виртути милитари'], bad: ['Крест Валечных', 'Grunwald'] },
    'hel-kosciol': { ok: ['Bożego Ciała', 'божьего тела', 'Corpus Christi'], bad: ['святого петра', 'успения'] },
    'hel-willa-jeannette': { ok: ['Jeannette', 'жаннет'], bad: ['Jeanne', 'Marianna', 'демель'] },
    'hel-laboratorium': { ok: ['1923'], bad: ['1921', '1932', '1938'] },
    'hel-dab-franciszek': { ok: ['белка', 'белочка', 'wiewiórka'], bad: ['кабан', 'сойка', 'францисканцы'] },
    'hel-muzeum-rybolowstwa': { ok: ['27', 'двадцать семь'], bad: ['17', '1816', '211'] },
    'hel-patron-herb': { ok: ['ключ', 'klucz', 'золотой ключ'], bad: ['корона', 'звезда', 'сеть'] },
    'hel-krzyz-rybakow': { ok: ['цепь', 'корабельная цепь', 'łańcuch'], bad: ['решётка', 'канат', 'штакетник'] },
};

const OPTIONAL_STEPS = ['hel-fokarium', 'hel-wedzarnia'];

const distance = (a: Step, b: Step) => {
    const R = 6371000;
    const rad = (x: number) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

describe('hel-fishermen: контент квеста', () => {
    it('имеет 14 шагов (12 обязательных), вступление и финал', () => {
        expect(steps).toHaveLength(14);
        expect(steps.filter((s) => s.answer_pattern.type !== 'any')).toHaveLength(12);
        expect(quest.intro.answer_pattern.type).toBe('any');
        expect(String(quest.finale.text).length).toBeGreaterThan(500);
    });

    it('не повторяет quest_id и storage_key роадтрипа по косе', () => {
        expect(quest.quest_id).toBe('hel-fishermen');
        expect(quest.quest_id).not.toBe('hel-jurata-amber');
        expect(quest.storage_key).not.toBe('quest_hel_jurata_v1');
    });

    it('у каждого шага есть координаты, mapsUrl и answer_pattern', () => {
        steps.forEach((s) => {
            expect(typeof s.lat).toBe('number');
            expect(typeof s.lng).toBe('number');
            expect(s.lat).toBeGreaterThan(54.59);
            expect(s.lat).toBeLessThan(54.62);
            expect(s.lng).toBeGreaterThan(18.79);
            expect(s.mapsUrl).toContain(String(s.lat));
            expect(s.answer_pattern?.type).toBeTruthy();
            expect(s.story.length).toBeGreaterThan(400);
        });
    });

    it('маршрут пеший: сумма перегонов до 4 км, каждый перегон до 1,2 км', () => {
        let total = 0;
        for (let i = 1; i < steps.length; i += 1) {
            const leg = distance(steps[i - 1], steps[i]);
            expect(leg).toBeLessThan(1200);
            total += leg;
        }
        expect(total).toBeLessThan(4000);
    });

    it('маршрут идёт с севера на юг без возвратов', () => {
        for (let i = 1; i < steps.length; i += 1) {
            // Допуск 30 м на кластер точек в одном сквере.
            expect(steps[i].lat).toBeLessThan(steps[i - 1].lat + 0.0003);
        }
    });

    it('poi_info заполнен по контракту бэкенда', () => {
        const allowed = ['is_museum', 'opening_hours', 'ticket_price', 'website'];
        steps
            .filter((s) => s.poi_info)
            .forEach((s) => {
                Object.keys(s.poi_info!).forEach((key) => expect(allowed).toContain(key));
                expect(typeof s.poi_info!.is_museum).toBe('boolean');
            });
        // Музей рыболовства и фокарий обязаны нести посетительскую информацию.
        ['hel-muzeum-rybolowstwa', 'hel-fokarium'].forEach((id) => {
            expect(steps.find((s) => s.step_id === id)!.poi_info).toBeTruthy();
        });
    });

    it.each(Object.keys(CASES))('шаг %s принимает верный ответ и отклоняет неверный', (stepId) => {
        const step = steps.find((s) => s.step_id === stepId);
        expect(step).toBeDefined();
        const check = buildAnswerChecker(step!.answer_pattern.type, step!.answer_pattern.value);
        CASES[stepId].ok.forEach((answer) => {
            expect(check(answer)).toBe(true);
        });
        CASES[stepId].bad.forEach((answer) => {
            expect(check(answer)).toBe(false);
        });
    });

    it('финальный шаг принимает свободный ответ, необязательные — любой', () => {
        const free = steps.find((s) => s.step_id === 'hel-pirs-rybacki')!;
        const checkFree = buildAnswerChecker(free.answer_pattern.type, free.answer_pattern.value);
        expect(checkFree('пахнет соляркой и рыбой, кричат чайки')).toBe(true);
        expect(checkFree('ыы')).toBe(false);

        OPTIONAL_STEPS.forEach((id) => {
            const opt = steps.find((s) => s.step_id === id)!;
            const check = buildAnswerChecker(opt.answer_pattern.type, opt.answer_pattern.value);
            expect(check('')).toBe(true);
        });
    });

    it('у каждого проверяемого шага есть подсказка без ответа внутри', () => {
        Object.keys(CASES).forEach((stepId) => {
            const step = steps.find((s) => s.step_id === stepId)!;
            expect(step.hint).toBeTruthy();
            const haystack = `${step.story} ${step.hint ?? ''}`.toLowerCase();
            const primary = CASES[stepId].ok[0].toLowerCase();
            const escaped = primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(haystack).not.toMatch(
                new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u'),
            );
        });
    });
});
