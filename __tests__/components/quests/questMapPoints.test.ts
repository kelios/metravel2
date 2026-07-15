import {
  groupQuestStepPoints,
  normalizeQuestStepPoints,
} from '@/components/quests/questMapPoints';

describe('questMapPoints', () => {
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
      },
      {
        lat: 52,
        lng: 26,
        indexes: [2],
        titles: ['Точка 2'],
      },
    ]);
  });
});
