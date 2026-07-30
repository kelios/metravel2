// Регресс контента квеста hel-jurata-amber: каждый answer_pattern прогоняется
// через реальный buildAnswerChecker — ожидаемый ответ принимается, заведомо
// неверный отклоняется, а ответ не утекает в story/hint своего шага.
// Ловит две реальные ошибки, найденные при создании квеста: «2» без словесного
// варианта «два» и hint, который сам называл ответ.
import { buildAnswerChecker } from '@/utils/questAdapters';

const quests = require('../../scripts/hel-jurata-quest-data.js');

type Step = {
    step_id: string;
    story: string;
    task: string;
    hint: string | null;
    answer_pattern: { type: string; value: string };
};

const quest = quests[0];
const steps: Step[] = quest.steps;

// Ожидаемые верные ответы (то, что игрок реально прочитает/увидит на точке)
// и заведомо неверные — для проверки, что чекер не пропускает всё подряд.
const CASES: Record<string, { ok: string[]; bad: string[] }> = {
    'zarnowiec-klasztor': { ok: ['Гавриил', 'гавриил', 'Gabriel'], bad: ['Михаил', 'Рафаил'] },
    'gwiazda-polnocy': { ok: ['50'], bad: ['54', '8', '18'] },
    'lisi-jar': { ok: ['орёл', 'орел', 'Orzeł'], bad: ['ястреб', 'сокол'] },
    'rozewie-latarnia': { ok: ['2', 'два'], bad: ['1', '3'] },
    'wladyslawowo-hallerowka': { ok: ['дерево', 'Дерево', 'деревянный'], bad: ['кирпич', 'камень'] },
    'chalupy-przerwanie': { ok: ['1939'], bad: ['1920', '1945'] },
    'jastarnia-kosciol': { ok: ['лодка', 'Лодка', 'łódź'], bad: ['рыба', 'сеть', 'весло'] },
    'jurata-pomnik': { ok: ['правая', 'в правой', 'правой руке'], bad: ['левая', 'в левой'] },
    'hel-latarnia': { ok: ['1905'], bad: ['1942', '1826'] },
    'hel-kopiec-kaszubow': { ok: ['гриф', 'грифон', 'Gryf'], bad: ['орёл', 'лев', 'медведь'] },
};

describe('hel-jurata-amber: контент квеста', () => {
    it('имеет 14 шагов, вступление и финал', () => {
        expect(steps).toHaveLength(14);
        expect(quest.intro.answer_pattern.type).toBe('any');
        expect(String(quest.finale.story).length).toBeGreaterThan(500);
    });

    it('у каждого шага есть координаты, mapsUrl и answer_pattern', () => {
        steps.forEach((s: any) => {
            expect(typeof s.lat).toBe('number');
            expect(typeof s.lng).toBe('number');
            expect(s.lat).toBeGreaterThan(54);
            expect(s.lng).toBeGreaterThan(17);
            expect(s.mapsUrl).toContain('maps.google.com');
            expect(s.answer_pattern?.type).toBeTruthy();
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

    it('свободные и необязательные шаги принимают осмысленный ответ', () => {
        const free = steps.find((s) => s.step_id === 'krokowa-zamek')!;
        const checkFree = buildAnswerChecker(free.answer_pattern.type, free.answer_pattern.value);
        expect(checkFree('одна семья, две присяги')).toBe(true);
        expect(checkFree('ыы')).toBe(false);

        ['kuznica-przetwornia', 'hel-muzeum-obrony', 'hel-fokarium'].forEach((id) => {
            const opt = steps.find((s) => s.step_id === id)!;
            const check = buildAnswerChecker(opt.answer_pattern.type, opt.answer_pattern.value);
            expect(check('')).toBe(true);
        });
    });

    it('ответ не утекает в story или hint своего шага', () => {
        Object.keys(CASES).forEach((stepId) => {
            const step = steps.find((s) => s.step_id === stepId)!;
            const haystack = `${step.story} ${step.hint ?? ''}`.toLowerCase();
            const primary = CASES[stepId].ok[0].toLowerCase();
            // По границе слова: цифра ответа не должна считаться утечкой внутри
            // года («2» в «1822»), а слово-ответ — внутри другого слова.
            const escaped = primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(haystack).not.toMatch(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u'));
        });
    });
});
