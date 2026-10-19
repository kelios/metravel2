const {
  checkCreatedAt,
  checkGenreHeadings,
  checkPointNames,
  checkQuestLinks,
  dhashFromGray,
  extractImages,
  findDuplicates,
  findPeopleInCaption,
  findPrivateParams,
  hamming,
  questLinks,
  runChecks,
  textMarkers,
} = require('../../scripts/article-acceptance-check.js');

const ORIGIN = 'https://metravel.by';

type Stub = { status?: number; json?: unknown; bytes?: Buffer };

// Глобальный fetch под jest — RN-полифил, поэтому стаб передаётся явно.
const stubFetch = (routes: Record<string, Stub>) => async (url: string) => {
  const route = routes[url] ?? { status: 404 };
  const status = route.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => route.json,
    arrayBuffer: async () => {
      const bytes = route.bytes ?? Buffer.from('');
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
};

describe('article-acceptance-check: правила по отдельности', () => {
  it('ловит людей в подписях только целым словом, кириллические границы', () => {
    expect(findPeopleInCaption('Селфи Юли с мужем у карьера')).toBe('Селфи');
    expect(findPeopleInCaption('Портрет Юли у карьера')).toBe('Юли');
    expect(findPeopleInCaption('Мы вдвоём на маршруте')).toBe('Мы');
    expect(findPeopleInCaption('Идём к перевалу')).toBe('Идём');
    expect(findPeopleInCaption('Велосипедист на мосту')).toBe('Велосипедист');
    expect(findPeopleInCaption('Ворота Брамы Краковской')).toBeNull();
    expect(findPeopleInCaption('Холмы за окном поезда')).toBeNull();
    expect(findPeopleInCaption('Каменные ворота у Наскального')).toBeNull();
    expect(findPeopleInCaption('Карьер в Забежуве: известняковая стена над водой')).toBeNull();
  });

  it('разбирает img: абсолютный src, alt с сущностями', () => {
    expect(extractImages('<p><img src="/travel-description-image/a.webp" alt="Замок &quot;Ойцув&quot;"></p><img src=\'http://metravel.by/x.webp\'>', ORIGIN))
      .toEqual([
        { src: 'https://metravel.by/travel-description-image/a.webp', alt: 'Замок "Ойцув"' },
        { src: 'https://metravel.by/x.webp', alt: '' },
      ]);
  });

  it('имена точек: адреса и коды дорог — дефект, описательное имя с кодом — норма', () => {
    expect(checkPointNames([
      { id: 1, address: '964' },
      { id: 2, address: 'S7' },
      { id: 3, address: 'Krakowska 149' },
      { id: 4, address: 'Парковка у трассы S7 (Pcim)' },
      { id: 5, address: 'Второе Рогачское озеро (Roháčske plesá)' },
      { id: 6, address: 'Rohacske plesa - Tri Kopy' },
      { id: 7, address: 'Rohacske plesa - Tri Kopy' },
    ])).toEqual([
      'точка 1: «964» — адрес/код вместо имени места',
      'точка 2: «S7» — адрес/код вместо имени места',
      'точка 3: «Krakowska 149» — адрес/код вместо имени места',
      '«rohacske plesa - tri kopy» ×2 — дубль имени точки',
    ]);
  });

  it('created_at обязан лежать в месяце поездки, month не пуст', () => {
    expect(checkCreatedAt({ year: 2026, month: [10], created_at: '2026-10-03T12:00:00Z' })).toEqual([]);
    expect(checkCreatedAt({ year: 2024, month: [5, 6], created_at: '2026-09-01T08:00:00Z' })).toEqual([
      'created_at 2026-09-01T08:00:00Z вне поездки (year 2024, month 5,6)',
    ]);
    expect(checkCreatedAt({ year: 2024, month: [], created_at: '2024-05-01T12:00:00Z' })).toEqual([
      'month пуст — восстановить по кадрам/тексту',
    ]);
  });

  it('sid=/checkin= — приватные данные, aid=/label= — партнёрка', () => {
    expect(findPrivateParams([
      'https://www.booking.com/hotel/pl/x.html?aid=123&label=metravel',
      'https://www.booking.com/hotel/pl/x.html?aid=1&sid=abc',
      'https://www.booking.com/searchresults.html?checkin=2026-01-01',
    ])).toEqual([
      'https://www.booking.com/hotel/pl/x.html?aid=1&sid=abc',
      'https://www.booking.com/searchresults.html?checkin=2026-01-01',
    ]);
  });

  it('маркеры: [уточнить], сентинел, Instagram-iframe', () => {
    expect(textMarkers({
      description: '<p>Высота 1200 м [уточнить]</p><iframe src="https://www.instagram.com/reel/abc/embed"></iframe>',
      plus: '__draft_placeholder__',
      minus: '<p>чисто</p>',
    })).toEqual([
      'description: [уточнить] ×1',
      'description: Instagram-iframe (в теле — только <p><a href=".../reel/<id>/">) ×1',
      'plus: __draft_placeholder__ ×1',
    ]);
  });

  it('жанр 2d: <h1>, эмодзи и разделы путеводителя — дефект, места и вопросы FAQ — норма', () => {
    expect(checkGenreHeadings([
      '<h1>Общий план маршрута</h1>',
      '<h2>Практическая информация</h2>',
      '<h2>Как добраться из Кракова</h2>',
      '<h2>🏔 Вершина Каспрового</h2>',
      '<h3>3) Итог:</h3>',
      '<h2>Если соберётесь</h2><h2>Если соберетесь</h2>',
      '<h3>1️⃣ Легенды и факты</h3>',
      '<h3>🚌 Как добраться до Закопане?</h3>',
    ].join(''))).toEqual([
      '<h1> в теле: 1',
      'раздел путеводителя «Практическая информация»',
      'раздел путеводителя «Как добраться из Кракова»',
      'эмодзи в заголовке «🏔 Вершина Каспрового»',
      'раздел путеводителя «3) Итог:»',
      'эмодзи в заголовке «1️⃣ Легенды и факты»',
      'раздел путеводителя «1️⃣ Легенды и факты»',
      'эмодзи в заголовке «🚌 Как добраться до Закопане?»',
      '«Если соберётесь» заголовком: 2',
    ]);
    expect(checkGenreHeadings([
      '<h2>Болото Ельня</h2>',
      '<h2>Подъём на Каспровый Верх</h2>',
      '<h3>Как добраться до Морского Ока зимой?</h3>',
      '<h2>Если соберётесь</h2>',
      '<h2>История Вавеля в двух легендах</h2>',
      '<h2>Что рядом</h2><h2>Квесты по городам рядом</h2>',
    ].join(''))).toEqual([]);
  });

  it('ссылки квестов сверяются с парой (city_id, quest_id) из API', () => {
    const quests = [{ quest_id: 'krakow-dragon', city_id: '1', city_alias: 'krakow', city_legacy_ids: [] }];
    const links = questLinks('<a href="/quests/1/krakow-dragon">a</a><a href="https://metravel.by/quests/krakow/krakow-dragon">b</a><a href="/quests/1/no-such">c</a><a href="/quests">все</a>');
    expect(checkQuestLinks(links, quests)).toEqual({
      problems: ['/quests/1/no-such: quest_id «no-such» нет в /api/quests/'],
      warnings: ['/quests/krakow/krakow-dragon: не канонический путь, нужен /quests/1/krakow-dragon'],
    });
  });

  it('dhash: одинаковая яркость — расстояние 0, инверсия — максимум', () => {
    const gray = Buffer.from(Array.from({ length: 17 * 16 }, (_, i) => (i * 37) % 256));
    const inverted = Buffer.from(gray.map((v) => 255 - v));
    expect(hamming(dhashFromGray(gray), dhashFromGray(gray))).toBe(0);
    expect(hamming(dhashFromGray(gray), dhashFromGray(inverted))).toBeGreaterThan(200);
    expect(findDuplicates([
      { where: 'тело #1', url: 'a', md5: 'x', dhash: null },
      { where: 'тело #2', url: 'b', md5: 'x', dhash: null },
      { where: 'тело #3', url: 'c', md5: 'y', dhash: dhashFromGray(gray) },
      { where: 'тело #4', url: 'd', md5: 'z', dhash: dhashFromGray(gray) },
    ]).map((p: { kind: string }) => p.kind)).toEqual(['md5', 'dhash 0']);
  });
});

describe('article-acceptance-check: прогон по статье', () => {
  const img = (name: string) => `${ORIGIN}/travel-description-image/${name}.jpg.webp`;
  const baseDetail = {
    id: 42,
    slug: 'test-trip',
    name: 'Поход к замку',
    userIds: '1',
    publish: true,
    moderation: true,
    year: 2025,
    month: [5],
    created_at: '2025-05-30T12:00:00Z',
    youtube_link: null,
    plus: null,
    minus: null,
    recommendation: null,
    coordsMeTravel: [{ id: 1, address: 'Замок в Ойцове' }],
    gallery: [{ id: 9, url: `${ORIGIN}/gallery/g1.webp`, caption: 'Руины замка в Ойцове' }],
    description: [
      '<p>Крючок.</p>',
      `<p><img src="${img('a')}" alt="Руины замка в Ойцове" /></p>`,
      `<p><img src="${img('b')}" alt="Тропа к замку" /></p>`,
      '<h2>Что рядом</h2><ul><li><a href="/travels/x">x</a></li></ul>',
      '<h2>Квесты по городам рядом</h2><ul><li><a href="/quests/1/krakow-dragon">Дракон</a></li></ul>',
    ].join(''),
  };
  const routes = (detail: object, imageBytes: Record<string, Buffer>, comments: object[]) => ({
    [`${ORIGIN}/api/travels/42/`]: { json: detail },
    [`${ORIGIN}/api/travel-comments/tree/?travel_id=42`]: { json: { top_level: comments } },
    [`${ORIGIN}/api/quests/?perPage=200`]: { json: { results: [{ quest_id: 'krakow-dragon', city_id: '1' }], next: null } },
    [img('a')]: { bytes: imageBytes.a },
    [img('b')]: { bytes: imageBytes.b },
    [`${ORIGIN}/gallery/g1.webp`]: { bytes: imageBytes.g },
  });
  const fail = (report: { results: { id: string; ok: boolean }[] }) => report.results.filter((r) => !r.ok).map((r) => r.id);

  it('чистая статья проходит все проверки', async () => {
    const report = await runChecks({
      id: 42,
      fetchImpl: stubFetch(routes(baseDetail, { a: Buffer.from('A'), b: Buffer.from('B'), g: Buffer.from('G') }, [{ id: 5, user: 120 }])),
      grayThumbnail: () => null,
    });
    expect(fail(report)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('ловит дубль кадра, address-image, людей в alt, пропавший комментарий редакции и sid=', async () => {
    const detail = {
      ...baseDetail,
      description: `${baseDetail.description}<h2>Практическая информация</h2><p><img src="${ORIGIN}/address-image/1/conversions/p.webp" alt="Мы на вершине" /></p><p><a href="https://booking.com/h?sid=1">жильё</a></p>`,
    };
    const routesWithPoint = {
      ...routes(detail, { a: Buffer.from('SAME'), b: Buffer.from('SAME'), g: Buffer.from('G') }, [{ id: 5, user: 104 }]),
      [`${ORIGIN}/address-image/1/conversions/p.webp`]: { status: 404 },
    };
    const report = await runChecks({ id: 42, fetchImpl: stubFetch(routesWithPoint), grayThumbnail: () => null });
    expect(fail(report)).toEqual(['img-family', 'captions-place', 'img-status', 'img-duplicates', 'genre-2d', 'editorial-comment', 'private-data']);
  });
});
