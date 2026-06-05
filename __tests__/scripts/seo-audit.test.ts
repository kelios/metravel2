/**
 * Unit tests for scripts/seo-audit.js pure analysis functions.
 * The CLI/main() I/O shell is intentionally not exercised here.
 */
const audit = require('../../scripts/seo-audit.js');

const {
  stripHtmlToText,
  countWords,
  analyzeTitle,
  analyzeMeta,
  analyzeContent,
  auditTravel,
  summarizeAudit,
  TITLE_MAX,
  TITLE_MIN,
} = audit;

describe('stripHtmlToText / countWords', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtmlToText('<p>Привет&nbsp;&amp; мир</p>')).toBe('Привет & мир');
  });

  it('drops script/style content', () => {
    expect(stripHtmlToText('<style>.x{}</style><p>текст</p><script>1</script>')).toBe('текст');
  });

  it('counts words across cyrillic and digits', () => {
    expect(countWords('<p>Озеро Глубокое 342 м</p>')).toBe(4);
  });

  it('returns 0 for empty/nullish', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(stripHtmlToText(undefined)).toBe('');
  });
});

describe('analyzeTitle', () => {
  it('flags titles longer than the SERP limit', () => {
    const long = 'А'.repeat(TITLE_MAX + 5);
    const r = analyzeTitle(long);
    expect(r.tooLong).toBe(true);
    expect(r.tooShort).toBe(false);
  });

  it('flags short keyword-poor titles', () => {
    const r = analyzeTitle('Баранья гора');
    expect(r.tooShort).toBe(true);
    expect(r.tooLong).toBe(false);
  });

  it('accepts a well-sized title', () => {
    const r = analyzeTitle('Что посмотреть в Ошмянах: костёлы и маршрут');
    expect(r.tooLong).toBe(false);
    expect(r.tooShort).toBe(false);
    expect(r.empty).toBe(false);
  });

  it('marks empty titles', () => {
    expect(analyzeTitle('').empty).toBe(true);
    expect(analyzeTitle('   ').empty).toBe(true);
  });

  it('boundary: exactly TITLE_MIN is not too short, exactly TITLE_MAX is not too long', () => {
    expect(analyzeTitle('x'.repeat(TITLE_MIN)).tooShort).toBe(false);
    expect(analyzeTitle('x'.repeat(TITLE_MAX)).tooLong).toBe(false);
  });
});

describe('analyzeMeta', () => {
  it('flags missing meta description', () => {
    expect(analyzeMeta(null).missing).toBe(true);
    expect(analyzeMeta('').missing).toBe(true);
    expect(analyzeMeta('   ').missing).toBe(true);
  });

  it('flags too-short meta description', () => {
    const r = analyzeMeta('Коротко');
    expect(r.missing).toBe(false);
    expect(r.tooShort).toBe(true);
  });

  it('accepts a full-length meta description', () => {
    const r = analyzeMeta('А'.repeat(120));
    expect(r.missing).toBe(false);
    expect(r.tooShort).toBe(false);
  });
});

describe('analyzeContent', () => {
  it('flags thin content and counts structure', () => {
    const html = '<h2>Раздел</h2><p>' + 'слово '.repeat(10) + '</p>';
    const r = analyzeContent(html);
    expect(r.thin).toBe(true);
    expect(r.headings).toBe(1);
    expect(r.noHeadings).toBe(false);
  });

  it('detects missing headings and internal links', () => {
    const html = '<p>' + 'слово '.repeat(20) + '</p>';
    const r = analyzeContent(html);
    expect(r.noHeadings).toBe(true);
    expect(r.noInternalLinks).toBe(true);
    expect(r.internalLinks).toBe(0);
  });

  it('counts internal travel links', () => {
    const html =
      '<p>см. <a href="https://metravel.by/travels/ozero-glubokoe">озеро</a> и ' +
      '<a href="/travels/lysaya-gora">гору</a></p>';
    expect(analyzeContent(html).internalLinks).toBe(2);
    expect(analyzeContent(html).noInternalLinks).toBe(false);
  });

  it('respects a custom minWords threshold', () => {
    const html = '<p>' + 'x '.repeat(500) + '</p>';
    expect(analyzeContent(html, 400).thin).toBe(false);
    expect(analyzeContent(html, 1000).thin).toBe(true);
  });

  it('treats empty description as thin with no structure', () => {
    const r = analyzeContent('');
    expect(r.words).toBe(0);
    expect(r.thin).toBe(true);
    expect(r.noHeadings).toBe(true);
  });
});

describe('auditTravel', () => {
  const richDetail = {
    meta_description: 'А'.repeat(120),
    description: '<h2>История</h2><p>' + 'слово '.repeat(450) +
      '</p><a href="/travels/x">см.</a>',
  };

  it('returns no issues for a well-optimized travel', () => {
    const r = auditTravel(
      { id: 1, name: 'Что посмотреть в Ошмянах: костёлы и маршрут', countUnicIpView: 100 },
      richDetail
    );
    expect(r.issues).toEqual([]);
    expect(r.metaPresent).toBe(true);
  });

  it('collects all problem types for a thin meta-less travel', () => {
    const r = auditTravel(
      { id: 2, name: 'Гора', countUnicIpView: 5000 },
      { meta_description: '', description: '<p>мало текста тут</p>' }
    );
    expect(r.issues).toEqual(
      expect.arrayContaining([
        'title-too-short',
        'meta-missing',
        'thin-content',
        'no-headings',
        'no-internal-links',
      ])
    );
  });

  it('weights priority higher for high-traffic pages with the same issues', () => {
    const base = { meta_description: '', description: '<p>short</p>' };
    const lowTraffic = auditTravel({ id: 3, name: 'Гора', countUnicIpView: 10 }, base);
    const highTraffic = auditTravel({ id: 4, name: 'Гора', countUnicIpView: 5000 }, base);
    expect(highTraffic.priority).toBeGreaterThan(lowTraffic.priority);
  });

  it('degrades gracefully when detail fetch failed (empty object)', () => {
    const r = auditTravel({ id: 5, name: 'Озеро Глубокое и его окрестности', countUnicIpView: 0 }, {});
    expect(r.issues).toEqual(
      expect.arrayContaining(['meta-missing', 'thin-content', 'no-headings', 'no-internal-links'])
    );
    expect(r.words).toBe(0);
  });
});

describe('summarizeAudit', () => {
  const rows = [
    auditTravel(
      { id: 1, name: 'Что посмотреть в Ошмянах: костёлы и маршрут', countUnicIpView: 100 },
      { meta_description: 'А'.repeat(120), description: '<h2>h</h2><p>' + 'w '.repeat(450) + '</p><a href="/travels/x">l</a>' }
    ),
    auditTravel({ id: 2, name: 'Гора', countUnicIpView: 3000 }, { meta_description: '', description: '<p>thin</p>' }),
    auditTravel({ id: 3, name: 'Озеро', countUnicIpView: 50 }, { meta_description: '', description: '<p>thin</p>' }),
  ];

  it('counts each problem category and clean pages', () => {
    const { counts } = summarizeAudit(rows);
    expect(counts.total).toBe(3);
    expect(counts.clean).toBe(1);
    expect(counts.metaMissing).toBe(2);
    expect(counts.thinContent).toBe(2);
    expect(counts.titleTooShort).toBe(2);
  });

  it('worklist excludes clean pages and is sorted by priority desc', () => {
    const { worklist } = summarizeAudit(rows);
    expect(worklist).toHaveLength(2);
    expect(worklist.every((r: { issues: string[] }) => r.issues.length > 0)).toBe(true);
    expect(worklist[0].priority).toBeGreaterThanOrEqual(worklist[1].priority);
    // highest-traffic problem page ranks first
    expect(worklist[0].id).toBe(2);
  });
});
