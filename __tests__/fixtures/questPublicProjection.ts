export const questPublicLocales = ['ru', 'be', 'uk', 'pl', 'en'] as const;

function prose(seed: number) {
  let state = seed;
  return Array.from({ length: 5 }, () => Array.from({ length: 18 }, () => {
    let word = '';
    for (let character = 0; character < 8; character += 1) {
      state = (state * 48271) % 2147483647;
      word += String.fromCharCode(97 + state % 26);
    }
    return word;
  }).join(' ') + '.').join(' ');
}

export function questPrivateSnapshot() {
  const quest = { id: 17, quest_id: 'fixture-city-walk', city_id: '7', city_name: 'Город',
    city_name_canonical: 'Город', country_code: 'BY', country_name: 'Беларусь',
    title: 'Квест по городу', points: 10, duration_min: 90, difficulty: 'easy', lat: 53.9, lng: 27.5,
    cover_url: 'https://metravel.by/quest-cover/fixture.webp' };
  const record = { quest_pk: 17, city_id: 7, quest_slug: quest.quest_id, source_revision: 'a'.repeat(64),
    locales: Object.fromEntries(questPublicLocales.map((locale, index) => [locale, { content_revision: String(index + 1).repeat(64),
      fence_revision: '1', published: true, complete: true }])) };
  const bundles = Object.fromEntries(questPublicLocales.map((locale) => [locale, { ['7/' + quest.quest_id]: {
    id: 17, quest_id: quest.quest_id, title: locale === 'ru' ? quest.title : `Quest ${locale}`,
    content_locale: locale, duration_min: 90,
    city: { id: 7, name: 'Город', name_canonical: 'Город', name_localized: locale === 'ru' ? 'Город' : 'City', country_code: 'BY' },
    intro: { id: 'intro', title: 'Вступление', story: 'Приглашение на прогулку по старому городу.', location: 'Площадь' },
    steps: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, step_id: `point-${index + 1}`,
      title: `Место ${index + 1}`, location: `Улица ${index + 1}`, story: prose(100003 + index * 7103),
      task: 'Посчитайте необычные резные листья на боковой стороне скамейки.',
      hint: 'Подсказка скрывается на обратной стороне старого городского знака.',
      answer_pattern: { type: 'text', value: 'секретная последовательность' },
      lat: 53.9 + index * 0.001, lng: 27.5, order: index, point_role: 'required',
      poi_info: { is_museum: false, opening_hours: '', ticket_price: '' } })),
    finale: { text: 'Заключение', video_url: null, poster_url: null },
  } } ]));
  return { schema_version: 2, source_snapshot: { receipt_digest: 'f'.repeat(64), quests: [record] },
    catalog: [quest], bundles, aliases: {}, travel_links: [] };
}
