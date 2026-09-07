import { toLegacyResizePath as toLegacyResizePathTs } from '@/utils/mediaUrl';
import { unwrapWeservImageUrl } from '@/utils/weservImageUrl';

const {
  toLegacyResizePath,
  toReaderMediaPath,
  toReaderMediaUrl,
  toSourceMediaUrl,
  unwrapWeservUrl,
} = require('@/scripts/lib/readerMediaUrl');

/**
 * Общий резолвер читательского адреса для гейтов (#1854).
 *
 * Между `src` в теле статьи и запросом браузера стоит переписывание роута, и
 * гейт, щупающий адрес из `src`, меряет доступность другого файла. Здесь два
 * разных вопроса и оба обязательны:
 *
 *   1. что резолвер отдаёт на каждом классе — таблица `describe('адрес…')`;
 *   2. что он НЕ разошёлся с фронтом — `describe('зеркало…')` гоняет тот же
 *      набор входов через TS-источник (`utils/mediaUrl.ts`) и сравнивает.
 *      Копия правила в CommonJS неизбежна (скрипты TS не импортируют), поэтому
 *      расхождение обязано валить тест, а не жить до следующего инцидента.
 */

const SITE = 'https://metravel.by';
const S3 = 'https://metravelprod.s3.eu-north-1.amazonaws.com';

/**
 * Входы для сверки с TS-источником: по одному на каждую ветку `toLegacyResizePath`.
 *
 * Набор общий у обоих `describe`: ветка, добавленная в резолвер без строки
 * здесь, останется несверенной, и зеркало разъедется молча — ровно так уже
 * разъехались три копии правила до этого модуля.
 */
const MIRROR_INPUTS = [
  // Класс `uploads/**`: бакет виртуальным хостом и path-style.
  `${S3}/uploads/1614096729IMG_6960.JPG`,
  'https://s3.eu-north-1.amazonaws.com/metravelprod/uploads/a.jpg',
  // Чужой бакет на том же S3 — не наш класс. Корень нашего — не кадр.
  'https://someoneelse.s3.eu-north-1.amazonaws.com/uploads/a.jpg',
  'https://s3.eu-north-1.amazonaws.com/metravelprod',
  'https://metravelprod.s3.eu-north-1.amazonaws.com/',
  // Conversion-ключ: бакетом и за каждым family-роутом, который знает фронт.
  `${S3}/15601/conversions/x.webp`,
  `${SITE}/address-image/15601/conversions/x.webp`,
  `${SITE}/gallery/355/conversions/x.webp`,
  `${SITE}/travel-image/682/conversions/abc.webp`,
  `${SITE}/travel-description-image/12/conversions/x.webp`,
  '/address-image/15188/conversions/ee55dead.webp',
  // Family-роут без conversion-ключа: у него legacy-роута нет.
  `${SITE}/travel-description-image/613eb392.jpg.webp?pv=2&w=1600`,
  `${SITE}/gallery/plain.webp`,
  // Роут, которого переписывание фронта не знает.
  `${SITE}/quest-cover/9/conversions/x.webp`,
  // Первопартийный `/uploads/` — не бакет и не family-роут.
  '/uploads/articles/legacy.jpg',
  // Подписанная ссылка: подпись после переписывания бессмысленна.
  `${S3}/uploads/a.jpg?X-Amz-Signature=deadbeef&X-Amz-Expires=900&w=800`,
  // Обёртки weserv, в том числе вложенные и с `&amp;`.
  `https://images.weserv.nl/?url=${encodeURIComponent('metravelprod.s3.eu-north-1.amazonaws.com/uploads/b.jpg')}`,
  `https://images.weserv.nl/?url=${encodeURIComponent(
    `https://images.weserv.nl/?url=${encodeURIComponent('metravelprod.s3.eu-north-1.amazonaws.com/uploads/c.jpg')}`,
  )}`,
  `https://images.weserv.nl/?url=${encodeURIComponent('metravelprod.s3.eu-north-1.amazonaws.com/uploads/d.jpg')}&amp;w=320`,
  'https://images.weserv.nl/?w=320',
  // Протокол-относительная форма и склеенный двойной хост.
  '//metravelprod.s3.eu-north-1.amazonaws.com/uploads/e.jpg',
  `//images.weserv.nl/?url=${encodeURIComponent('metravelprod.s3.eu-north-1.amazonaws.com/uploads/g.jpg')}`,
  `${SITE}/${S3}/uploads/f.jpg`,
  // Классы, которые legacy-роут не обслуживает.
  `${S3}/uploads/notes.pdf`,
  `${S3}/uploads/`,
  `${S3}/uploads/../secrets/key.jpg`,
  `${S3}/682/responsive-images/x.webp`,
  `${S3}/682/conversions/deep/conversions/x.webp`,
  // Не адреса вовсе.
  'data:image/png;base64,AAA',
  'blob:https://metravel.by/9f0c',
  'https://example.com/x.jpg',
  '',
  'не адрес',
];

beforeAll(() => {
  // `isFirstPartyMediaHost` в TS спрашивает про настроенный API-origin, а в
  // скрипте — про проверяемый `--url`. Сверять зеркало можно только когда обе
  // стороны считают своим один и тот же хост.
  process.env.EXPO_PUBLIC_API_URL = `${SITE}/api`;
});

describe('readerMediaUrl: адрес, который запрашивает читатель', () => {
  it('уводит бакетный `uploads/**` на первопартийный прокси', () => {
    // Замер прода 07.09.2026, travel 290: страница просит именно этот путь и НИ
    // ОДНОГО запроса к `*.amazonaws.com` не делает.
    expect(toReaderMediaPath(`${S3}/uploads/1614096729IMG_6960.JPG`)).toBe(
      '/media-resize/uploads/1614096729IMG_6960.JPG',
    );
  });

  it('уводит conversion-ключ на legacy-роут — и за family-роутом тоже', () => {
    expect(toReaderMediaPath('/address-image/15188/conversions/ee55.webp')).toBe(
      '/media-resize/legacy/15188/conversions/ee55.webp',
    );
    expect(toReaderMediaPath(`${SITE}/gallery/355/conversions/x.webp`)).toBe(
      '/media-resize/legacy/355/conversions/x.webp',
    );
  });

  it('остальной первопартийный путь отдаёт без изменений, вместе с query', () => {
    expect(toReaderMediaPath('/travel-description-image/1/description/own.webp')).toBe(
      '/travel-description-image/1/description/own.webp',
    );
    // Ширину из тела НЕ снимаем: гейт щупает по одному адресу на кадр, и после
    // схлопывания ступеней две записи одного ключа слились бы в одну пробу.
    expect(toReaderMediaPath(`${SITE}/travel-description-image/613eb392.jpg.webp?pv=2&w=1600`)).toBe(
      '/travel-description-image/613eb392.jpg.webp?pv=2&w=1600',
    );
  });

  it('чужой хост, `data:` и мусор целью не становятся', () => {
    expect(toReaderMediaPath('https://example.com/x.jpg')).toBeNull();
    expect(toReaderMediaPath('data:image/png;base64,AAA')).toBeNull();
    expect(toReaderMediaPath('blob:https://metravel.by/9f0c')).toBeNull();
    // Обёртка weserv без разбираемого `url=` разворачиваться не во что — это
    // просто чужой хост.
    expect(toReaderMediaPath('https://images.weserv.nl/?w=320')).toBeNull();
    expect(toReaderMediaPath('')).toBeNull();
  });

  it('разворачивает weserv до исходного адреса и уже его переписывает', () => {
    const wrapped = `https://images.weserv.nl/?url=${encodeURIComponent(
      'metravelprod.s3.eu-north-1.amazonaws.com/uploads/b.jpg',
    )}`;
    expect(toReaderMediaPath(wrapped)).toBe('/media-resize/uploads/b.jpg');
  });

  it('считает своим хост проверяемого origin, а не только прод', () => {
    // Прогон ходит и на дев, и на стаб в тестах: без этого его собственные
    // адреса выглядели бы чужими и класс молча выпадал бы из проверки.
    expect(toReaderMediaPath('http://127.0.0.1:8081/gallery/1/g.jpg', { site: 'http://127.0.0.1:8081' })).toBe(
      '/gallery/1/g.jpg',
    );
    expect(toReaderMediaPath('https://dev.example.org/gallery/1/g.jpg', { site: 'https://dev.example.org' })).toBe(
      '/gallery/1/g.jpg',
    );
    expect(toReaderMediaPath('https://dev.example.org/gallery/1/g.jpg')).toBeNull();
  });

  it('сводит `//` до разворота обёртки, иначе цепочка остаётся завёрнутой', () => {
    // `new URL('//host/…')` бросает, поэтому развернуть протокол-относительную
    // обёртку можно только после нормализации. Разошедшийся порядок уже стоил
    // пятнадцати фотографий статьи 175, когда недокручивался последний слой.
    const wrapped = `//images.weserv.nl/?url=${encodeURIComponent(
      'metravelprod.s3.eu-north-1.amazonaws.com/uploads/g.jpg',
    )}`;
    expect(toSourceMediaUrl(wrapped)).toBe(`${S3}/uploads/g.jpg`);
    expect(toReaderMediaPath(wrapped)).toBe('/media-resize/uploads/g.jpg');
  });

  it('склеивает абсолютный адрес пробы с проверяемым origin', () => {
    expect(toReaderMediaUrl(`${S3}/uploads/a.JPG`, SITE)).toBe(`${SITE}/media-resize/uploads/a.JPG`);
    expect(toReaderMediaUrl('/address-image/9/conversions/p.webp', 'https://dev.metravel.by/')).toBe(
      'https://dev.metravel.by/media-resize/legacy/9/conversions/p.webp',
    );
    expect(toReaderMediaUrl('https://example.com/x.jpg', SITE)).toBeNull();
  });

  // Ключ нашего бакета, который фронт НЕ переписывает (`toLegacyResizePath`
  // знает только `uploads/**` и conversion-ключи), читатель запрашивает прямо в
  // S3: `buildExternalImageUrl` отдаёт такой адрес как есть. Вернуть `null`
  // значило бы молча перестать щупать живой класс — то самое «ложное зелено».
  it('щупает свой бакет как есть, когда фронт адрес не переписывает', () => {
    expect(toReaderMediaUrl(`${S3}/uploads/logo.svg`, SITE)).toBe(`${S3}/uploads/logo.svg`);
    expect(toReaderMediaUrl(`${S3}/flat-root.jpg`, SITE)).toBe(`${S3}/flat-root.jpg`);
    expect(toReaderMediaUrl('https://s3.eu-north-1.amazonaws.com/metravelprod/uploads/p.svg', SITE)).toBe(
      'https://s3.eu-north-1.amazonaws.com/metravelprod/uploads/p.svg',
    );
    // Переписываемый класс по-прежнему уходит на прокси, а не в бакет.
    expect(toReaderMediaUrl(`${S3}/uploads/a.JPG`, SITE)).toBe(`${SITE}/media-resize/uploads/a.JPG`);
    // Чужой бакет остаётся чужим хостом: его доступность не наш контракт.
    expect(toReaderMediaUrl('https://someoneelse.s3.eu-north-1.amazonaws.com/uploads/a.svg', SITE)).toBeNull();
    // Корень бакета — не кадр, а листинг: ключа нет, целью пробы он быть не может.
    expect(toReaderMediaUrl('https://s3.eu-north-1.amazonaws.com/metravelprod', SITE)).toBeNull();
    // Страница отдаётся по https, и `http://`-кадр браузер заблокировал бы как
    // mixed content: читатель идёт по https, значит и проба тоже.
    expect(toReaderMediaUrl('http://metravelprod.s3.eu-north-1.amazonaws.com/uploads/logo.svg', SITE)).toBe(
      `${S3}/uploads/logo.svg`,
    );
  });
});

describe('readerMediaUrl: зеркало TS-источника', () => {
  it.each(MIRROR_INPUTS)('совпадает с toLegacyResizePath из utils/mediaUrl.ts: %s', (input) => {
    expect(toLegacyResizePath(input, { site: SITE })).toBe(toLegacyResizePathTs(input));
  });

  it.each(MIRROR_INPUTS)('совпадает с unwrapWeservImageUrl из utils/weservImageUrl.ts: %s', (input) => {
    expect(unwrapWeservUrl(input)).toBe(unwrapWeservImageUrl(input));
  });

  it('падает, если зеркало разойдётся с источником хотя бы на одном входе', () => {
    // Сам механизм сверки: без него `it.each` выше молчал бы на пустом наборе.
    const divergent = MIRROR_INPUTS.filter(
      (input) => toLegacyResizePath(input, { site: SITE }) !== toLegacyResizePathTs(input),
    );
    expect(divergent).toEqual([]);
    // И набор действительно покрывает обе ветки переписывания, а не только `null`.
    const rewritten = MIRROR_INPUTS.map((input) => toLegacyResizePathTs(input)).filter(Boolean);
    expect(rewritten.some((path) => path?.startsWith('/media-resize/uploads/'))).toBe(true);
    expect(rewritten.some((path) => path?.startsWith('/media-resize/legacy/'))).toBe(true);
  });
});
