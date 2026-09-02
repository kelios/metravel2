const fs = require('fs');
const path = require('path');
const { makeTempDir } = require('./cli-test-utils');
const {
  assertTravelStaticPagesComplete,
  travelStaticPagePaths,
} = require('@/scripts/generate-seo-pages');
const { travelPageVariants } = require('@/scripts/verify-static-travel-seo');

describe('travel static output coverage', () => {
  const travels = [
    { id: 583, slug: 'olomouts-zamok-bouzov-i-peshchery-moravskogo-krasa-tri-dnia-po-moravii' },
    { id: 584, slug: 'shchavnitsa-zimoi-marshrut-na-dzwonkowke-cherez-sewerynowke-i-bacowke-pod-beresnikiem' },
  ];

  function writeTravelPage(distDir: string, routeKey: string) {
    const explicitFile = path.join(distDir, 'travels', `${routeKey}.html`);
    const directoryIndex = path.join(distDir, 'travels', routeKey, 'index.html');
    fs.mkdirSync(path.dirname(explicitFile), { recursive: true });
    fs.mkdirSync(path.dirname(directoryIndex), { recursive: true });
    fs.writeFileSync(explicitFile, '<html></html>', 'utf8');
    fs.writeFileSync(directoryIndex, '<html></html>', 'utf8');
  }

  it('accepts a snapshot that contains both static variants for every published travel', () => {
    const distDir = makeTempDir('travel-output-complete-');
    travels.forEach((travel) => writeTravelPage(distDir, travel.slug));

    expect(assertTravelStaticPagesComplete(travels, distDir)).toEqual({
      expected: 2,
      missing: 0,
    });
  });

  it('fails the build when a published travel page is artificially removed', () => {
    const distDir = makeTempDir('travel-output-incomplete-');
    travels.forEach((travel) => writeTravelPage(distDir, travel.slug));
    fs.unlinkSync(path.join(distDir, 'travels', `${travels[1].slug}.html`));

    expect(() => assertTravelStaticPagesComplete(travels, distDir)).toThrow(
      `id 584, slug ${travels[1].slug}: travels/${travels[1].slug}.html`,
    );
  });

  // Генерация пишет страницу по ключу `slug || String(id)` и пропускает запись
  // без обоих полей. Гейт обязан требовать ровно тот же набор: лишний ключ
  // уронил бы легитимную сборку, недостающий — вернул бы слепое пятно #1688.
  it('mirrors the generation loop route key: slug falls back to id, keyless travels are skipped', () => {
    const distDir = makeTempDir('travel-output-route-key-');
    writeTravelPage(distDir, '585');

    expect(
      assertTravelStaticPagesComplete(
        [{ id: 585 }, { id: null, slug: '' }, { id: 585, slug: '' }],
        distDir,
      ),
    ).toEqual({ expected: 1, missing: 0 });
  });

  // Два гейта на один инвариант живут в разных скриптах: writer'ы и обе проверки
  // обязаны описывать ОДИН layout. Разъехавшийся набор форм — это ровно та
  // конструкция, при которой проверка остаётся зелёной на неполном срезе.
  it('keeps the served page layout identical in the generator and the verifier', () => {
    expect(travelStaticPagePaths('dist/prod', 'my-slug')).toEqual(
      travelPageVariants('dist/prod', 'my-slug').map((variant: { filePath: string }) => variant.filePath),
    );
  });
});
