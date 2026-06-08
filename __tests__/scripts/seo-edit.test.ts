/**
 * Unit tests for scripts/seo-edit.js pure safety functions.
 * Network I/O (GET/PUT/backup files) is not exercised here.
 */
const editor = require('../../scripts/seo-edit.js');

const { composeDescription, buildUpsertPayload, detectRegression, backupFileName, SENTINEL } = editor;

describe('composeDescription', () => {
  it('prepends a lead before the body', () => {
    expect(composeDescription('<p>story</p>', { prepend: '<p>lead</p>' })).toBe('<p>lead</p>\n<p>story</p>');
  });

  it('appends blocks after the body', () => {
    expect(composeDescription('<p>story</p>', { append: '<h2>H</h2>' })).toBe('<p>story</p>\n<h2>H</h2>');
  });

  it('does both, preserving the original body in the middle', () => {
    const out = composeDescription('<p>story</p>', { prepend: '<p>lead</p>', append: '<h2>H</h2>' });
    expect(out).toBe('<p>lead</p>\n<p>story</p>\n<h2>H</h2>');
    expect(out).toContain('<p>story</p>');
  });

  it('replace wins over prepend/append', () => {
    expect(composeDescription('<p>old</p>', { prepend: 'x', append: 'y', replace: '<p>new</p>' })).toBe('<p>new</p>');
  });

  it('no-ops when nothing supplied', () => {
    expect(composeDescription('<p>same</p>', {})).toBe('<p>same</p>');
    expect(composeDescription('<p>same</p>')).toBe('<p>same</p>');
  });

  it('does not treat an unrelated body paragraph as a duplicate lead', () => {
    // body opens with real prose unrelated to the lead → lead is prepended, body kept
    const body = '<p>Найдя на карте водоём в жаркий день, мы поехали смотреть.</p>';
    const out = composeDescription(body, { prepend: '<p>Карьер Закшувек в Кракове — затопленный карьер с лазурной водой.</p>' });
    expect(out).toContain('Карьер Закшувек');
    expect(out).toContain('Найдя на карте водоём');
  });

  it('replaces an existing near-duplicate lead instead of stacking a second one', () => {
    // a prior pass already prepended a definitional lead; re-running with a fresh
    // (paraphrased) lead must NOT leave two intro paragraphs (the "double lead" bug)
    const already =
      '<p>Карьер Закшувек в Кракове — затопленный известняковый карьер с лазурной водой, бывшая промзона у Вавеля.</p>\n' +
      '<p>Найдя на карте водоём в жаркий день, мы поехали смотреть.</p>';
    const freshLead =
      '<p>Карьер Закшувек (Zakrzówek) в Кракове — затопленный известняковый карьер с бирюзовой водой, вход бесплатный.</p>';
    const out = composeDescription(already, { prepend: freshLead });
    // exactly one definitional "Карьер Закшувек … карьер" intro survives
    expect(out.match(/затопленный известняковый карьер/g)).toHaveLength(1);
    expect(out.startsWith(freshLead)).toBe(true);
    expect(out).toContain('Найдя на карте водоём');
  });

  it('is idempotent when the exact same lead is prepended twice', () => {
    const lead = '<p>Озеро Глубокое под Полоцком — самое прозрачное озеро Беларуси.</p>';
    const body = '<p>Мы приехали сюда летом и остались в восторге.</p>';
    const once = composeDescription(body, { prepend: lead });
    const twice = composeDescription(once, { prepend: lead });
    expect(twice).toBe(once);
  });
});

describe('leadIsDuplicate', () => {
  const { leadIsDuplicate } = editor;

  it('matches two paraphrased definitional leads about the same object', () => {
    expect(
      leadIsDuplicate(
        '<p>Карьер Закшувек в Кракове — затопленный известняковый карьер с лазурной водой.</p>',
        '<p>Карьер Закшувек (Zakrzówek) в Кракове — затопленный известняковый карьер с бирюзовой водой.</p>'
      )
    ).toBe(true);
  });

  it('does not match unrelated paragraphs', () => {
    expect(
      leadIsDuplicate(
        '<p>Карьер Закшувек в Кракове — затопленный известняковый карьер.</p>',
        '<p>Местные жители жарят шашлыки и встречают закаты над городом.</p>'
      )
    ).toBe(false);
  });
});

describe('buildUpsertPayload', () => {
  const live = {
    id: 169,
    name: 'Озеро Глубокое',
    slug: 'ozero-glubokoe',
    description: '<p>old</p>',
    year: 2020,
    categories: [6],
    countries: [3],
    coordsMeTravel: [{ id: 1, lat: 55.6, lng: 29.4, categories: [84] }],
    transports: [1],
    plus: '<p>чисто</p>',
    minus: '<p>дорога</p>',
    recommendation: null,
    youtube_link: null,
    publish: true,
    moderation: true,
    number_days: 1,
    gallery: [{ id: 450 }],
  };

  it('keeps the article published and moderated', () => {
    const p = buildUpsertPayload(live, { description: '<p>new</p>' });
    expect(p.publish).toBe(true);
    expect(p.moderation).toBe(true);
  });

  it('preserves points, categories, countries and pros/cons', () => {
    const p = buildUpsertPayload(live, { description: '<p>new</p>' });
    expect(p.coordsMeTravel).toHaveLength(1);
    expect(p.categories).toEqual([6]);
    expect(p.countries).toEqual([3]);
    expect(p.plus).toBe('<p>чисто</p>');
    expect(p.minus).toBe('<p>дорога</p>');
  });

  it('sends empty gallery/travelAddress (backend = "no change", photos kept)', () => {
    const p = buildUpsertPayload(live, { description: '<p>new</p>' });
    expect(p.gallery).toEqual([]);
    expect(p.travelAddress).toEqual([]);
  });

  it('falls back to the sentinel for blank text fields (API rejects blank)', () => {
    const p = buildUpsertPayload(live, { description: '<p>new</p>' });
    expect(p.recommendation).toBe(SENTINEL);
    expect(p.youtube_link).toBe(SENTINEL);
  });

  it('overrides description and meta when provided', () => {
    const p = buildUpsertPayload(live, { description: '<p>new</p>', meta: 'сниппет' });
    expect(p.description).toBe('<p>new</p>');
    expect(p.meta_description).toBe('сниппет');
  });

  it('falls back to safe defaults for missing categories/countries', () => {
    const p = buildUpsertPayload({ id: 1, name: 'x', publish: true }, { description: 'd' });
    expect(p.categories).toEqual([20]);
    expect(p.countries).toEqual([160]);
    expect(p.coordsMeTravel).toEqual([]);
  });
});

describe('detectRegression', () => {
  const before = {
    publish: true,
    moderation: true,
    slug: 's',
    gallery: [{}, {}],
    coordsMeTravel: [{}],
    description: '<p>old</p>',
  };

  it('returns no problems on a clean edit', () => {
    const after = { ...before, description: '<p>new</p>' };
    expect(detectRegression(before, after, { expectChanged: true, newDescription: '<p>new</p>' })).toEqual([]);
  });

  it('catches an unpublished article', () => {
    const after = { ...before, publish: false };
    expect(detectRegression(before, after)).toContain('publish flipped to false');
  });

  it('catches a shrunken gallery', () => {
    const after = { ...before, gallery: [{}] };
    expect(detectRegression(before, after)).toEqual(
      expect.arrayContaining([expect.stringContaining('gallery shrank')])
    );
  });

  it('catches a changed slug and shrunken points', () => {
    const after = { ...before, slug: 'other', coordsMeTravel: [] };
    const p = detectRegression(before, after);
    expect(p).toEqual(
      expect.arrayContaining([expect.stringContaining('slug changed'), expect.stringContaining('points shrank')])
    );
  });

  it('flags a silent no-op write (description did not persist)', () => {
    const after = { ...before }; // description still old
    expect(detectRegression(before, after, { expectChanged: true, newDescription: '<p>new</p>' })).toContain(
      'description did not persist as written'
    );
  });

  it('tolerates server-side trailing-whitespace normalisation (no false positive)', () => {
    const sent = '<p>new long enriched body</p>';
    const after = { ...before, description: `${sent}\n  ` };
    expect(detectRegression(before, after, { expectChanged: true, newDescription: sent })).toEqual([]);
  });

  it('flags an unexpectedly shrunken description (server dropped most content)', () => {
    const sent = '<p>' + 'enriched '.repeat(40) + '</p>'; // ~360 chars
    const after = { ...before, description: '<p>tiny</p>' };
    expect(detectRegression(before, after, { expectChanged: true, newDescription: sent })).toEqual(
      expect.arrayContaining([expect.stringContaining('description shrank unexpectedly')])
    );
  });
});

describe('backupFileName', () => {
  it('encodes id and timestamp', () => {
    expect(backupFileName(169, '2026-06-05T00-00-00-000Z')).toBe('169-2026-06-05T00-00-00-000Z.json');
  });
});
