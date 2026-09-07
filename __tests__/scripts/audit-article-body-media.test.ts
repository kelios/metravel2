import path from 'path';

import { makeTempDir, removeDir, runNodeCli, startStubServer, type StubServer } from './cli-test-utils';

const SCRIPT = path.resolve(process.cwd(), 'scripts', 'audit-article-body-media.js');

const {
  RISKY_FAMILIES,
  collectPointIds,
  collectTravelTargets,
  pointIdOfUrl,
  toTargetUrl,
} = require('@/scripts/audit-article-body-media');

/**
 * Корпусный прогон медиа тел статей (#1834).
 *
 * Механизм дефекта — чужой владелец у кадра: `/address-image/<id точки>/…`
 * резолвится по строке `travel_address`, и точка уносит картинку с собой. Прогон
 * ловит это в двух состояниях: кадр уже не отдаётся (`broken`) и кадр ещё
 * отдаётся, но точки-владельца в маршруте уже нет (`dangling`).
 *
 * CLI проверяется процессом: код возврата — это и есть контракт гейта, из
 * вызова функции его не видно.
 */

/**
 * Стаб публичного API с одной статьёй.
 *
 * Тело несёт три кадра: живое фото точки 11, фото исчезнувшей точки 99 (её нет в
 * `travelAddress`) и картинку описания. Медиа-роут отдаёт 404 ровно на точку 99 —
 * так стаб воспроизводит прод, где ключ умирает вместе со строкой точки.
 */
const serverSource = (danglingPointId: number | null) => `
const http = require('http')

const DANGLING = ${JSON.stringify(danglingPointId)}

const json = (res, body) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const body = () => {
  const frames = ['<img src="/address-image/11/conversions/live.webp">',
    '<img src="/travel-description-image/1/description/own.webp">']
  if (DANGLING) frames.push('<img src="/address-image/' + DANGLING + '/conversions/dead.webp">')
  return '<p>' + frames.join('') + '</p>'
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')

  if (url.pathname === '/api/travels/') {
    return json(res, { count: 1, next: null, results: [{ id: 1 }] })
  }
  if (url.pathname === '/api/travels/1/') {
    return json(res, {
      id: 1,
      description: body(),
      travelAddress: [{ id: 11 }],
    })
  }
  if (DANGLING && url.pathname.startsWith('/address-image/' + DANGLING + '/')) {
    res.writeHead(404)
    return res.end()
  }

  res.writeHead(200, { 'content-type': 'image/webp' })
  res.end()
})

server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port))
`;

describe('audit-article-body-media: разбор целей', () => {
  it('видит id точки только у кадров её семейства', () => {
    expect(pointIdOfUrl('https://metravel.by/address-image/15188/conversions/x.webp')).toBe(15188);
    expect(pointIdOfUrl('https://metravel.by/travel-description-image/1/description/x.webp')).toBeNull();
    expect(pointIdOfUrl('не адрес')).toBeNull();
  });

  it('переносит свой путь на проверяемый origin и отбрасывает мусор', () => {
    expect(toTargetUrl('/address-image/1/x.webp')).toBe('https://metravel.by/address-image/1/x.webp');
    expect(toTargetUrl('https://metravel.by/gallery/1/g.jpg')).toBe('https://metravel.by/gallery/1/g.jpg');
    expect(toTargetUrl('data:image/png;base64,AAA')).toBeNull();
    expect(toTargetUrl('')).toBeNull();
  });

  // Перенос бакетного пути на наш origin выдумывал 404 там, где у читателя 200:
  // `/uploads/<key>` сайт не обслуживает, а бакет отдаёт файл.
  it('бакетную ссылку щупает как есть, а чужой хост не щупает вовсе', () => {
    expect(toTargetUrl('https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/a.JPG')).toBe(
      'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/a.JPG',
    );
    expect(toTargetUrl('https://images.weserv.nl/?url=metravel.by%2Fx.webp')).toBeNull();
  });

  it('читает точки из travelAddress и из coordsMeTravel', () => {
    expect([...collectPointIds({ travelAddress: [{ id: 11 }, { id: '12' }] })]).toEqual([11, 12]);
    expect([...collectPointIds({ coordsMeTravel: [{ id: 13 }] })]).toEqual([13]);
    expect([...collectPointIds({})]).toEqual([]);
  });

  it('помечает dangling кадр точки, которой в маршруте статьи нет', () => {
    const targets = collectTravelTargets(
      {
        description:
          '<img src="/address-image/11/conversions/live.webp">' +
          '<img src="/address-image/99/conversions/dead.webp">',
        travelAddress: [{ id: 11 }],
      },
      RISKY_FAMILIES,
    );

    expect(targets).toEqual([
      expect.objectContaining({ pointId: 11, dangling: false }),
      expect.objectContaining({ pointId: 99, dangling: true }),
    ]);
  });

  it('по умолчанию не щупает travel-description-image: у него владелец — сама статья', () => {
    const targets = collectTravelTargets(
      { description: '<img src="/travel-description-image/1/description/own.webp">' },
      RISKY_FAMILIES,
    );

    expect(targets).toEqual([]);
  });

  it('не повторяет один и тот же адрес дважды', () => {
    const targets = collectTravelTargets(
      {
        description: '<img src="/address-image/11/conversions/x.webp">',
        plus: '<img src="/address-image/11/conversions/x.webp">',
        travelAddress: [{ id: 11 }],
      },
      RISKY_FAMILIES,
    );

    expect(targets).toHaveLength(1);
  });
});

describe('audit-article-body-media: код возврата', () => {
  let brokenDir: string;
  let cleanDir: string;
  let broken: StubServer;
  let clean: StubServer;

  const run = (origin: string, ...flags: string[]) =>
    runNodeCli([SCRIPT, '--url', origin, ...flags]);

  beforeAll(async () => {
    brokenDir = makeTempDir('audit-article-body-media-broken-');
    cleanDir = makeTempDir('audit-article-body-media-clean-');
    broken = await startStubServer(serverSource(99), brokenDir);
    clean = await startStubServer(serverSource(null), cleanDir);
  });

  afterAll(() => {
    broken?.stop();
    clean?.stop();
    removeDir(brokenDir);
    removeDir(cleanDir);
  });

  it('чистый корпус — код 0 и пустые списки', () => {
    const result = run(clean.origin, '--json');
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(report.broken).toEqual([]);
    expect(report.dangling).toEqual([]);
    // Живой кадр точки прогон не валит, но и не прячет: это долг #1834 п.3.
    expect(report.fragile).toHaveLength(1);
  });

  it('мёртвая ссылка в теле — ненулевой код и обе улики в отчёте', () => {
    const result = run(broken.origin, '--json');
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.broken).toEqual([
      expect.objectContaining({ travelId: 1, status: 404, pointId: 99 }),
    ]);
    expect(report.dangling).toEqual([
      expect.objectContaining({ travelId: 1, pointId: 99 }),
    ]);
  });

  it('в --json печатает в stdout ровно отчёт и ничего кроме него', () => {
    const result = run(clean.origin, '--json');

    const report = JSON.parse(result.stdout);
    expect(result.stdout.trim()).toBe(JSON.stringify(report, null, 2));
  });
});
