import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

const {
  ASC_LOCALES,
  FIELD_LIMITS,
  LISTING_PATH,
  MIN_SCREENSHOTS_PER_FAMILY,
  SCREENSHOT_SIZES,
  validateStoreListing,
} = require('../../scripts/ios-store-listing-guard-lib');

const root = path.resolve(__dirname, '../..');
const tempRoots: string[] = [];

type Failure = { code: string; detail: string };

function codes(errors: Failure[]): string[] {
  return errors.map((error) => error.code);
}

function makeRoot(mutate: (markdown: string) => string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-store-listing-'));
  tempRoots.push(dir);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  const source = fs.readFileSync(path.join(root, LISTING_PATH), 'utf8');
  fs.writeFileSync(path.join(dir, LISTING_PATH), mutate(source), 'utf8');
  fs.copyFileSync(path.join(root, 'app.json'), path.join(dir, 'app.json'));
  return dir;
}

function writePng(file: string, width: number, height: number): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : 0, 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([signature, chunk('IHDR', ihdr)]));
}

function screenshotDir(sizes: Array<[number, number]>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-store-shots-'));
  tempRoots.push(dir);
  sizes.forEach(([width, height], index) => {
    writePng(path.join(dir, `shot-${index}.png`), width, height);
  });
  return dir;
}

afterAll(() => {
  for (const dir of tempRoots) fs.rmSync(dir, { recursive: true, force: true });
});

describe('App Store listing guard', () => {
  it('принимает актуальную карточку репозитория', () => {
    expect(validateStoreListing(root)).toEqual([]);
  });

  it('держит все локали ASC в лимитах Apple', () => {
    const markdown = fs.readFileSync(path.join(root, LISTING_PATH), 'utf8');
    for (const locale of ASC_LOCALES) {
      expect(markdown).toContain(`## ${locale}`);
    }
    expect(FIELD_LIMITS).toMatchObject({
      name: 30,
      subtitle: 30,
      promotional: 170,
      description: 4000,
      keywords: 100,
    });
  });

  it('держит таблицу слотов скриншотов ASC', () => {
    // Обязательные слоты версии 1 и единственный необязательный. Размеры вроде
    // 1206×2622 (iPhone 16 Pro) ASC на загрузке отклоняет, в таблице их нет.
    const table = SCREENSHOT_SIZES.map(
      (size: { label: string; width: number; height: number; required: boolean }) =>
        `${size.label} ${size.width}x${size.height} ${size.required ? 'required' : 'optional'}`
    );
    expect(table).toEqual([
      'iPhone 6.9" 1290x2796 required',
      'iPhone 6.9" 1320x2868 required',
      'iPhone 6.5" 1242x2688 optional',
      'iPhone 6.5" 1284x2778 optional',
      'iPad 13" 2064x2752 required',
      'iPad 13" 2048x2732 required',
    ]);
  });

  it('ловит превышение лимита поля', () => {
    const dir = makeRoot((markdown) =>
      markdown.replace('**Subtitle (≤30):** `Маршруты и городские квесты`', `**Subtitle (≤30):** \`${'я'.repeat(31)}\``)
    );
    expect(codes(validateStoreListing(dir))).toContain('STORE_FIELD_TOO_LONG');
  });

  it('ловит потерянное поле внутри локали ASC', () => {
    const dir = makeRoot((markdown) =>
      markdown.replace('**Keywords:** `travel,map,quests,routes,tourism,belarus,hiking`', '')
    );
    const errors = validateStoreListing(dir);
    expect(codes(errors)).toContain('STORE_FIELD_MISSING');
    expect(errors.map((error: Failure) => error.detail).join(' ')).toContain('EN');
  });

  it('ловит потерянную локаль ASC', () => {
    const dir = makeRoot((markdown) => {
      const start = markdown.indexOf('## PL');
      const end = markdown.indexOf('## EN');
      return markdown.slice(0, start) + markdown.slice(end);
    });
    expect(codes(validateStoreListing(dir))).toContain('STORE_LOCALE_MISSING');
  });

  it('считает секцию с региональным кодом той же локалью ASC', () => {
    const dir = makeRoot((markdown) => markdown.replace('## EN', '## EN-US'));
    expect(codes(validateStoreListing(dir))).not.toContain('STORE_LOCALE_MISSING');
  });

  it('ловит пробел после запятой и дубли в keywords', () => {
    const dir = makeRoot((markdown) =>
      markdown.replace(
        '**Keywords:** `travel,map,quests,routes,tourism,belarus,hiking`',
        '**Keywords:** `travel, map,map`'
      )
    );
    expect(codes(validateStoreListing(dir))).toEqual(
      expect.arrayContaining(['STORE_KEYWORDS_FORMAT'])
    );
  });

  it('ловит заглушку и утечку демо-пароля', () => {
    const dir = makeRoot((markdown) => `${markdown}\n\nTODO дописать\n\npassword: hunter2\n`);
    const found = codes(validateStoreListing(dir));
    expect(found).toContain('STORE_PLACEHOLDER');
    expect(found).toContain('STORE_SECRET_LEAK');
  });

  it('ловит расхождение версии карточки с app.json', () => {
    const dir = makeRoot((markdown) => markdown.replace(/1\.0\.5/g, '1.0.4'));
    expect(codes(validateStoreListing(dir))).toContain('STORE_VERSION_MISMATCH');
  });

  it('ловит расхождение buildNumber, а не любую цифру 9 в тексте', () => {
    // `iPhone 6.9"` в этом же файле раньше закрывал проверку сам по себе.
    const dir = makeRoot((markdown) => markdown.replace(/(buildNumber`|билд[аеу]?|build)\s+9\b/g, '$1 8'));
    const mutated = fs.readFileSync(path.join(dir, LISTING_PATH), 'utf8');
    expect(mutated).toContain('iPhone 6.9"');
    const errors = validateStoreListing(dir);
    expect(codes(errors)).toContain('STORE_VERSION_MISMATCH');
    expect(errors.map((error: Failure) => error.detail).join(' ')).toContain('buildNumber 9');
  });

  it('требует обязательный размер iPhone и iPad для universal-сборки', () => {
    const supportsTablet = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.ios
      .supportsTablet;
    expect(supportsTablet).toBe(true);

    const onlyIphone = screenshotDir(Array(MIN_SCREENSHOTS_PER_FAMILY).fill([1290, 2796]));
    const errors = validateStoreListing(root, { screenshotsDir: onlyIphone });
    expect(codes(errors)).toContain('STORE_SCREENSHOT_SET_INCOMPLETE');
    expect(errors.map((error: Failure) => error.detail).join(' ')).toContain('ipad');
  });

  it('отклоняет размер, который App Store не принимает', () => {
    const dir = screenshotDir([[1080, 2340]]);
    expect(codes(validateStoreListing(root, { screenshotsDir: dir }))).toContain(
      'STORE_SCREENSHOT_SIZE'
    );
  });

  it('принимает полный набор iPhone 6.9" и iPad 13"', () => {
    const dir = screenshotDir([
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([1290, 2796]),
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([2064, 2752]),
    ] as Array<[number, number]>);
    expect(validateStoreListing(root, { screenshotsDir: dir })).toEqual([]);
  });

  it('принимает необязательный слот 6.5", но не засчитывает его в обязательный набор', () => {
    const withExtra = screenshotDir([
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([1290, 2796]),
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([2064, 2752]),
      [1242, 2688],
    ] as Array<[number, number]>);
    expect(validateStoreListing(root, { screenshotsDir: withExtra })).toEqual([]);

    const onlyOptional = screenshotDir([
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([1242, 2688]),
      ...Array(MIN_SCREENSHOTS_PER_FAMILY).fill([2064, 2752]),
    ] as Array<[number, number]>);
    const errors = validateStoreListing(root, { screenshotsDir: onlyOptional });
    expect(codes(errors)).toEqual(['STORE_SCREENSHOT_SET_INCOMPLETE']);
    expect(errors[0].detail).toContain('iphone');
  });

  it('сообщает об отсутствующем каталоге скриншотов', () => {
    expect(
      codes(validateStoreListing(root, { screenshotsDir: '.codex-temp/no-such-shots' }))
    ).toContain('STORE_SCREENSHOT_DIR_MISSING');
  });
});
