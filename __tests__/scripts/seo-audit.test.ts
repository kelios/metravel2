/**
 * Unit tests for scripts/seo-audit.js analysis functions and its batch exit
 * contract. Network and production I/O remain dependency-injected.
 */
import fs from 'fs';
import path from 'path';

import { makeTempDir, removeDir } from './cli-test-utils';

const audit = require('../../scripts/seo-audit.js');

const {
  stripHtmlToText,
  countWords,
  analyzeTitle,
  titleKeywords,
  analyzeLead,
  analyzeLeadNoise,
  analyzeContent,
  analyzeFaqMarkup,
  auditTravel,
  main,
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

/**
 * Travel 443 shipped for months with its body starting at
 * "DUP found at: 3238 / Removed dup, new len: 50274" — stdout of a
 * de-duplication script written straight into the article. The SERP snippet led
 * with that line. `weak-lead` never fired, because the real title words still
 * appeared further inside the 160-char window, so the audit reported the page
 * as clean. Machine output in the body needs its own signal.
 */
describe('analyzeLeadNoise (script output leaked into the body)', () => {
  it('flags the exact leak found on travel 443', () => {
    const r = analyzeLeadNoise('DUP found at: 3238\nRemoved dup, new len: 50274\n<h2>Красивейшие долины рядом с Краковом</h2>');
    expect(r.noisy).toBe(true);
  });

  it('flags other machine output that has no place in an article', () => {
    for (const body of [
      '<p>undefined</p><p>Дальше нормальный текст.</p>',
      '<p>[object Object]</p>',
      '<p>Error: ENOENT no such file</p>',
      '<p>Traceback (most recent call last):</p>',
      '<p>{"id": 443, "slug": "krakovskie-dolinki"}</p>',
    ]) {
      expect(analyzeLeadNoise(body).noisy).toBe(true);
    }
  });

  it('leaves normal prose alone, including leads that merely contain digits', () => {
    for (const body of [
      '<p>На своем длинном и ветвистом пути через Беларусь Неман делает крутой поворот.</p>',
      '<p>1) Олюдениз (Ölüdeniz). В этот отпуск мы решили отправиться в Турцию.</p>',
      '<p>Краков - Скальное место (106 км ~2 часа). Одно из самых запоминающихся путешествий.</p>',
      '<p>Где находится: Варшава, Польша. Что это: дворцово-парковый комплекс.</p>',
    ]) {
      expect(analyzeLeadNoise(body).noisy).toBe(false);
    }
  });

  it('does not flag an empty body — that is weak-lead territory, not noise', () => {
    expect(analyzeLeadNoise('').noisy).toBe(false);
    expect(analyzeLeadNoise(null).noisy).toBe(false);
  });

  it('only looks at the start, so the word "error" mid-article is not noise', () => {
    expect(
      analyzeLeadNoise('<p>Мы долго искали дорогу и поняли, что error в навигаторе был наш.</p>').noisy,
    ).toBe(false);
  });

  it('surfaces as its own issue and counter, separate from weak-lead', () => {
    const rows = [
      auditTravel(
        { id: 443, name: 'Краковские долинки: что посмотреть рядом с Краковом', slug: 'krakovskie-dolinki' },
        { description: 'DUP found at: 3238 Removed dup, new len: 50274 <h2>Краковские долинки рядом с Краковом</h2>' + '<p>текст</p>'.repeat(250) + '<a href="/travels/other">ещё</a>' },
      ),
    ];

    expect(rows[0].issues).toContain('lead-noise');
    expect(rows[0].leadNoise).toBe(true);
    expect(summarizeAudit(rows).counts.leadNoise).toBe(1);
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

describe('analyzeFaqMarkup (FAQ block the SSG cannot read — #1761)', () => {
  const faqSection = (body: string) =>
    '<h2>Маршрут</h2><p>текст</p>' +
    '<section class="seo-faq" data-faq="metravel-seo" itemscope itemtype="https://schema.org/FAQPage">' +
    '<h2>Частые вопросы</h2>' + body +
    '</section>';

  const markedUpPair =
    '<details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">\n' +
    '<summary itemprop="name"><strong>Как доехать до озера?</strong></summary>\n' +
    '<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">\n' +
    '<p>Поездом до Катовице, дальше автобусом.</p>\n' +
    '</div></div>\n</details>';

  // Ровно та форма, в которой хранились статьи 134 и 554: секция на месте,
  // пары записаны плоско — на странице видно, в выдаче нет.
  const flatPair =
    '<strong>Как доехать до озера?</strong>\n<div><div>\n' +
    '<p>Поездом до Катовице, дальше автобусом.</p>\n</div></div>';

  it('accepts a FAQ section the generator can read', () => {
    const r = analyzeFaqMarkup(faqSection(markedUpPair));
    expect(r.hasFaqBlock).toBe(true);
    expect(r.entries).toBe(1);
    expect(r.markupLost).toBe(false);
  });

  it('flags a FAQ section whose pairs lost the details/summary markup', () => {
    const r = analyzeFaqMarkup(faqSection(flatPair));
    expect(r.hasFaqBlock).toBe(true);
    expect(r.entries).toBe(0);
    expect(r.markupLost).toBe(true);
  });

  // Вторая форма корпуса (scripts/seo-find-dupes.js → stripFaqSection): секции нет,
  // блок опознаётся только по заголовку. FAQPage теряется так же, значит и ловиться
  // должен так же — иначе аудит рапортует чистый ноль поверх целой семьи статей.
  it('flags a bare "Частые вопросы" heading whose pairs are flat', () => {
    const r = analyzeFaqMarkup('<h2>Маршрут</h2><p>текст</p><h2>Частые вопросы</h2>' + flatPair);
    expect(r.hasFaqBlock).toBe(true);
    expect(r.entries).toBe(0);
    expect(r.markupLost).toBe(true);
  });

  it('flags the two shapes the corpus actually stores the pairs in', () => {
    // 198/562 — <p><strong>Вопрос</strong>Ответ</p>; 682 — <h3>Вопрос</h3><p>Ответ</p>.
    expect(analyzeFaqMarkup('<h2>Частые вопросы: X</h2><p><strong>Вопрос?</strong>Ответ.</p>').markupLost).toBe(true);
    expect(analyzeFaqMarkup('<h2>Частые вопросы: X</h2><h3>Вопрос?</h3><p>Ответ.</p>').markupLost).toBe(true);
  });

  it('does not flag a heading with no pairs under it — there is nothing to fix', () => {
    // Иначе статья уезжает в worklist с поднятым priority и пустой находкой.
    const r = analyzeFaqMarkup('<h2>Частые вопросы</h2><p>Пишите в комментариях, отвечу каждому.</p>');
    expect(r.hasFaqBlock).toBe(false);
    expect(r.markupLost).toBe(false);
  });

  it('accepts details pairs the generator reads without any wrapper', () => {
    // Генератор берёт такие пары фолбэком по itemprop, FAQPage выходит —
    // значит и entries обязаны показывать реальное число, а не ноль «нет секции».
    const r = analyzeFaqMarkup('<h2>Маршрут</h2><p>текст</p>' + markedUpPair);
    expect(r.entries).toBe(1);
    expect(r.markupLost).toBe(false);
  });

  it('stays silent for a body with no FAQ block at all', () => {
    expect(analyzeFaqMarkup('<h2>Маршрут</h2><p>текст</p>').markupLost).toBe(false);
    expect(analyzeFaqMarkup('').markupLost).toBe(false);
    expect(analyzeFaqMarkup(null).markupLost).toBe(false);
    // Слово «вопрос» в прозе — не FAQ-блок.
    expect(analyzeFaqMarkup('<h2>Маршрут</h2><p>Частые вопросы читателей мы собрали ниже.</p>').markupLost).toBe(
      false,
    );
  });

  it('reaches auditTravel and the summary counts', () => {
    const body = '<p>' + 'слово '.repeat(450) + '</p><a href="/travels/x">см.</a>';
    const broken = auditTravel(
      { id: 554, name: 'Из Кракова к озеру Попроцаны и дворцу в Промницах', countUnicIpView: 300 },
      { description: body + faqSection(flatPair) },
    );
    const fixed = auditTravel(
      { id: 554, name: 'Из Кракова к озеру Попроцаны и дворцу в Промницах', countUnicIpView: 300 },
      { description: body + faqSection(markedUpPair) },
    );
    expect(broken.issues).toContain('faq-markup-lost');
    expect(broken.faqMarkupLost).toBe(true);
    expect(fixed.issues).not.toContain('faq-markup-lost');
    expect(fixed.faqEntries).toBe(1);
    expect(summarizeAudit([broken, fixed]).counts.faqMarkupLost).toBe(1);
  });

  it('does not flag a travel whose detail fetch failed', () => {
    const r = auditTravel({ id: 9, name: 'Озеро Глубокое и окрестности', countUnicIpView: 0 }, { __fetchFailed: true });
    expect(r.issues).not.toContain('faq-markup-lost');
    expect(r.faqMarkupLost).toBeNull();
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

describe('seo-audit batch exit contract', () => {
  it('writes the incomplete report before failing on caught detail fetches', async () => {
    const dir = makeTempDir('seo-audit-failures-');
    const reportPath = path.join(dir, 'report.json');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await expect(
        main(
          ['node', 'script', '--api', 'https://example.invalid', '--json', reportPath],
          {
            fetchJson: jest.fn().mockResolvedValue({
              count: 1,
              results: [{ id: 17, name: 'Статья с недоступной деталью', slug: 'failed-detail' }],
            }),
            fetchJsonRetry: jest.fn().mockRejectedValue(new Error('detail unavailable')),
          },
        ),
      ).rejects.toThrow('1 of 1 travel detail fetches failed')

      expect(fs.existsSync(reportPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(reportPath, 'utf8')).detailFetchFailures[0]).toMatchObject({
        id: 17,
        slug: 'failed-detail',
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Full report'));
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
      removeDir(dir);
    }
  });
});
