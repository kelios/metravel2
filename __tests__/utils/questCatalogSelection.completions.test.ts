import { pluralizeCompletions } from '@/screens/tabs/questsShared';
import { countQuestCompletions } from '@/utils/questCatalogSelection';

describe('countQuestCompletions', () => {
    const quests = [
        { id: 'others-only', isCompletedByMe: false, completionsCount: 2 },
        { id: 'mine-and-others', isCompletedByMe: true, completionsCount: 5 },
        { id: 'mine-only', isCompletedByMe: true, completionsCount: 1 },
        { id: 'nobody', isCompletedByMe: false, completionsCount: 0 },
        { id: 'legacy-without-count', isCompletedByMe: false },
    ];

    it('складывает прохождения всех квестов среза', () => {
        expect(countQuestCompletions(quests)).toBe(8);
    });

    it('в срезе «Пройдено другими» не считает своё прохождение', () => {
        expect(countQuestCompletions(quests, { excludeMine: true })).toBe(6);
    });

    it('пустой список даёт ноль', () => {
        expect(countQuestCompletions([])).toBe(0);
    });
});

describe('pluralizeCompletions', () => {
    it('склоняет число прохождений по-русски', () => {
        expect(pluralizeCompletions(1)).toBe('1 прохождение');
        expect(pluralizeCompletions(2)).toBe('2 прохождения');
        expect(pluralizeCompletions(5)).toBe('5 прохождений');
        expect(pluralizeCompletions(21)).toBe('21 прохождение');
    });
});
