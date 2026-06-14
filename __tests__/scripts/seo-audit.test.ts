/**
 * Unit tests for scripts/seo-audit.js pure analysis functions.
 * The CLI/main() I/O shell is intentionally not exercised here.
 */
const audit = require('../../scripts/seo-audit.js');

const {
  stripHtmlToText,
  countWords,
  analyzeTitle,
  titleKeywords,
  analyzeLead,
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
    const r = analyzeTitle('А'.repeat(TITLE_MAX + 5));
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

describe('titleKeywords', () => {
  it('keeps words >= 4 letters, drops short ones', () => {
    expect(titleKeywords('Озеро Глубокое в Беларуси')).toEqual(['озеро', 'глубокое', 'беларуси']);
  });
});

describe('analyzeLead (SERP snippet = first 160 chars of body)', () => {
  it('flags a lead that shares no keyword with the title', () => {
    const r = analyzeLead('Озеро Глубокое в Беларуси', '<p>Очередное обещание собаке свозить её гулять.</p>');
    expect(r.weak).toBe(true);
    expect(r.matched).toEqual([]);
  });

  it('accepts a lead that mentions the subject', () => {
    const r = analyzeLead(
      'Озеро Глубокое в Беларуси',
      '<p>Озеро Глубокое под Полоцком — самое прозрачное в Беларуси.</p>'
    );
    expect(r.weak).toBe(false);
    expect(r.matched.length).toBeGreaterThan(0);
  });

  it('matches inflected forms via stem (title «Ошмянах» vs lead «Ошмяны»)', () => {
    const r = analyzeLead(
      'Что посмотреть в Ошмянах: костёлы и синагога',
      '<p>Ошмяны — небольшой городок на западе Беларуси с костёлами и синагогой.</p>'
    );
    expect(r.weak).toBe(false);
  });

  it('flags an empty description as a weak lead', () => {
    expect(analyzeLead('Любой заголовок', '').weak).toBe(true);
  });

  it('only inspects the first 160 chars', () => {
    const filler = 'текст '.repeat(40); // > 160 chars, no keyword
    const r = analyzeLead('Озеро Глубокое', `<p>${filler} Глубокое</p>`);
    expect(r.weak).toBe(true);
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
    description:
      '<p>Озеро Глубокое под Полоцком — самое прозрачное в Беларуси.</p>' +
      '<h2>История</h2><p>' + 'слово '.repeat(450) + '</p><a href="/travels/x">см.</a>',
  };

  it('returns no issues for a well-optimized travel', () => {
    const r = auditTravel(
      { id: 1, name: 'Озеро Глубокое: самое прозрачное в Беларуси', countUnicIpView: 100 },
      richDetail
    );
    expect(r.issues).toEqual([]);
    expect(r.weakLead).toBe(false);
  });

  it('collects all problem types for a thin off-topic travel', () => {
    const r = auditTravel(
      { id: 2, name: 'Гора', countUnicIpView: 5000 },
      { description: '<p>Очередное обещание собаке гулять</p>' }
    );
    expect(r.issues).toEqual(
      expect.arrayContaining([
        'title-too-short',
        'weak-lead',
        'thin-content',
        'no-headings',
        'no-internal-links',
      ])
    );
  });

  it('weights priority higher for high-traffic pages with the same issues', () => {
    const base = { description: '<p>короткий текст не по теме</p>' };
    const low = auditTravel({ id: 3, name: 'Гора', countUnicIpView: 10 }, base);
    const high = auditTravel({ id: 4, name: 'Гора', countUnicIpView: 5000 }, base);
    expect(high.priority).toBeGreaterThan(low.priority);
  });

  it('flags content issues for a genuinely empty body (fetched, no description)', () => {
    const r = auditTravel({ id: 5, name: 'Озеро Глубокое и окрестности', countUnicIpView: 0 }, {});
    expect(r.issues).toEqual(
      expect.arrayContaining(['weak-lead', 'thin-content', 'no-headings', 'no-internal-links'])
    );
    expect(r.words).toBe(0);
  });

  it('does NOT flag content issues when the detail fetch failed (avoids false thin/weak)', () => {
    const r = auditTravel(
      { id: 6, name: 'Усадьба Тышкевичей и заброшенный санаторий', countUnicIpView: 1321, slug: 's' },
      { __fetchFailed: true },
    );
    expect(r.issues).not.toContain('weak-lead');
    expect(r.issues).not.toContain('thin-content');
    expect(r.issues).not.toContain('no-headings');
    expect(r.issues).not.toContain('no-internal-links');
    expect(r.detailFetchFailed).toBe(true);
    expect(r.words).toBeNull();
  });

  it('still flags a too-long title even when the detail fetch failed', () => {
    const longName = 'Маршрут на один день: ' + 'усадьба '.repeat(8);
    const r = auditTravel({ id: 7, name: longName, countUnicIpView: 0 }, { __fetchFailed: true });
    expect(r.issues).toContain('title-too-long');
  });
});

describe('summarizeAudit', () => {
  const rows = [
    auditTravel(
      { id: 1, name: 'Озеро Глубокое: самое прозрачное в Беларуси', countUnicIpView: 100 },
      {
        description:
          '<p>Озеро Глубокое под Полоцком — самое прозрачное в Беларуси.</p>' +
          '<h2>h</h2><p>' + 'слово '.repeat(450) + '</p><a href="/travels/x">l</a>',
      }
    ),
    auditTravel({ id: 2, name: 'Гора', countUnicIpView: 3000 }, { description: '<p>не по теме</p>' }),
    auditTravel({ id: 3, name: 'Озеро', countUnicIpView: 50 }, { description: '<p>не по теме</p>' }),
  ];

  it('counts each problem category and clean pages', () => {
    const { counts } = summarizeAudit(rows);
    expect(counts.total).toBe(3);
    expect(counts.clean).toBe(1);
    expect(counts.weakLead).toBe(2);
    expect(counts.thinContent).toBe(2);
    expect(counts.titleTooShort).toBe(2);
  });

  it('worklist excludes clean pages and is sorted by priority desc', () => {
    const { worklist } = summarizeAudit(rows);
    expect(worklist).toHaveLength(2);
    expect(worklist.every((r: { issues: string[] }) => r.issues.length > 0)).toBe(true);
    expect(worklist[0].priority).toBeGreaterThanOrEqual(worklist[1].priority);
    expect(worklist[0].id).toBe(2); // highest-traffic problem page first
  });
});
