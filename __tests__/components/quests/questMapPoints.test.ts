import {
  ACTIVE_QUEST_MARKER_Z_INDEX_OFFSET,
  getQuestMarkerZIndexOffset,
  groupQuestStepPoints,
  normalizeQuestStepPoints,
  formatQuestMapPointTitle,
  getQuestPointRoleAnnotation,
  getQuestPointRoleLabel,
} from '@/components/quests/questMapPoints';
import { i18n } from '@/i18n';
import { resources } from '@/i18n/resources';

describe('questMapPoints', () => {
  it.each(['ru', 'be', 'uk', 'pl', 'en'] as const)('optional annotations retain the canonical %s resource and RU authored fallback', async locale => {
    const previousLocale = i18n.language;
    try {
      await i18n.changeLanguage(locale);
      const label = resources[locale].quests['components.quests.questWizardStepCard.pointRole.optional'];
      expect(formatQuestMapPointTitle({ title: 'Tower', pointRole: 'optional', lat: 0, lng: 0 }))
        .toBe(`Tower · ${label}`);
      expect(formatQuestMapPointTitle({ title: 'Башня (по желанию)', pointRole: 'optional', lat: 0, lng: 0 }))
        .toBe('Башня (по желанию)');
    } finally {
      await i18n.changeLanguage(previousLocale);
    }
  });

  it.each([
    'Башня (по желанию)', 'Башня — опционально', 'Вежа (па жаданні)',
    'Вежа (за бажанням)', 'Tower (optional)', 'Wieża (opcjonalnie)',
    'Punkt opcjonalny', 'Wieża — nieobowiązkowa',
  ])('keeps the authored optional marker once: %s', (title) => {
    expect(getQuestPointRoleAnnotation(title, 'optional')).toBeNull();
    expect(formatQuestMapPointTitle({ title, pointRole: 'optional', lat: 0, lng: 0 })).toBe(title);
  });

  it('annotates an unmarked optional point and preserves required/final roles', () => {
    expect(formatQuestMapPointTitle({ title: 'Башня', pointRole: 'optional', lat: 0, lng: 0 }))
      .toBe(`Башня · ${getQuestPointRoleLabel('optional')}`);
    expect(getQuestPointRoleAnnotation('Optionality museum', 'optional'))
      .toBe(getQuestPointRoleLabel('optional'));
    expect(getQuestPointRoleAnnotation('Башня (по желанию)', 'required'))
      .toBe(getQuestPointRoleLabel('required'));
    expect(getQuestPointRoleAnnotation('Финиш', 'final')).toBe(getQuestPointRoleLabel('final'));
  });

  it('keeps only finite coordinates inside geographic bounds', () => {
    expect(normalizeQuestStepPoints([
      { lat: 53.9, lng: 27.56, title: 'Минск' },
      { lat: Number.NaN, lng: 27.56 },
      { lat: 91, lng: 27.56 },
      { lat: 53.9, lng: 181 },
    ])).toEqual([{ lat: 53.9, lng: 27.56, title: 'Минск' }]);
  });

  it('groups equal six-decimal coordinates in stable point order', () => {
    expect(groupQuestStepPoints([
      { lat: 53.9000001, lng: 27.5600001, title: 'Старт' },
      { lat: 52, lng: 26 },
      { lat: 53.9000002, lng: 27.5600002, title: 'Финиш' },
    ], pointNumber => `Точка ${pointNumber}`)).toEqual([
      {
        lat: 53.9000001,
        lng: 27.5600001,
        indexes: [1, 3],
        titles: ['Старт', 'Финиш'],
        zIndexOffset: 9900,
      },
      {
        lat: 52,
        lng: 26,
        indexes: [2],
        titles: ['Точка 2'],
        zIndexOffset: 9800,
      },
    ]);
  });

  it('keeps earlier point markers above later nearby markers', () => {
    expect(getQuestMarkerZIndexOffset([1])).toBeGreaterThan(getQuestMarkerZIndexOffset([3]));
    expect(ACTIVE_QUEST_MARKER_Z_INDEX_OFFSET).toBeGreaterThan(getQuestMarkerZIndexOffset([1]));
  });
});
