import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

type Scenario = {
  id: string;
  route: string;
  expectedAny: string[];
};

type AuditIssue = {
  type:
    | 'navigation'
    | 'auth-redirect'
    | 'console-error'
    | 'page-error'
    | 'horizontal-overflow'
    | 'missing-signal';
  details: string;
};

type AuditEntry = {
  scope: 'public' | 'auth';
  id: string;
  route: string;
  finalUrl: string;
  screenshot: string;
  signalMatched: string | null;
  signalsChecked: string[];
  docScrollWidth: number;
  docClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  hasHorizontalOverflow: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  issues: AuditIssue[];
};

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ trace: 'off' });

const PUBLIC_SCENARIOS: Scenario[] = [
  { id: 'home', route: '/', expectedAny: ['text=MeTravel', 'text=Идеи поездок', '[data-testid="home-screen"]'] },
  {
    id: 'travelsby',
    route: getTravelsListPath(),
    expectedAny: [
      '#search-input',
      '[data-testid="travels-list"]',
      '[data-testid="results-count-wrapper"]',
      '[data-testid="results-count-text"]',
      'text=Результаты',
    ],
  },
  { id: 'search', route: '/search', expectedAny: ['#search-input', 'text=Поиск', '[data-testid="toggle-filters"]'] },
  { id: 'map', route: '/map', expectedAny: ['text=Карта', 'button:has-text("Показать")', '[data-testid="map-panel-open"]'] },
  { id: 'roulette', route: '/roulette', expectedAny: ['text=Не знаешь, куда поехать?', 'button:has-text("Подобрать")', '[data-testid="mobile-filters-button"]'] },
  {
    id: 'quests',
    route: '/quests',
    expectedAny: ['text=Квесты', '[data-testid^="quest-card-"]', '[aria-label*="Начать приключение"]'],
  },
  { id: 'about', route: '/about', expectedAny: ['text=О проекте', 'text=MeTravel'] },
  { id: 'privacy', route: '/privacy', expectedAny: ['text=Политика', 'text=конфиденциаль'] },
  { id: 'cookies', route: '/cookies', expectedAny: ['text=Cookies', 'text=cookie', 'text=Куки'] },
  { id: 'login', route: '/login', expectedAny: ['input[type="password"]', 'text=Войти'] },
  { id: 'registration', route: '/registration', expectedAny: ['text=Регистрация', 'button:has-text("Зарегистрироваться")'] },
];

const AUTH_SCENARIOS: Scenario[] = [
  { id: 'profile', route: '/profile', expectedAny: ['text=Профиль', 'text=Julia', 'text=Настройки'] },
  { id: 'favorites', route: '/favorites', expectedAny: ['text=Избран', 'text=Избранное'] },
  { id: 'history', route: '/history', expectedAny: ['text=История'] },
  { id: 'messages', route: '/messages', expectedAny: ['text=Сообщения', '[data-testid="messages-screen"]'] },
  { id: 'subscriptions', route: '/subscriptions', expectedAny: ['text=Подписк'] },
  { id: 'travel-new', route: '/travel/new', expectedAny: ['text=Новое путешествие', 'text=Название путешествия'] },
  { id: 'userpoints', route: '/userpoints', expectedAny: ['[data-testid="userpoints-screen"]', 'text=Мои точки'] },
  { id: 'export', route: '/export', expectedAny: ['text=Экспорт', 'text=Книга путешествий'] },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function maybeAcceptCookiesBanner(page: any) {
  const selectors = [
    'button:has-text("Принять")',
    'button:has-text("Accept")',
    'button:has-text("Соглас")',
  ];

  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if ((await btn.count().catch(() => 0)) === 0) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.click({ timeout: 2_000 }).catch(() => undefined);
    await wait(200);
    return;
  }
}

async function waitForScenarioSignal(page: any, scenario: Scenario, timeoutMs = 15_000): Promise<string | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const selector of scenario.expectedAny) {
      const node = page.locator(selector).first();
      const isVisible = await node.isVisible().catch(() => false);
      if (isVisible) return selector;
    }
    await wait(250);
  }
  return null;
}

async function collectLayoutMetrics(page: any) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const b = document.body;
    const docScrollWidth = d?.scrollWidth ?? 0;
    const docClientWidth = d?.clientWidth ?? 0;
    const bodyScrollWidth = b?.scrollWidth ?? 0;
    const bodyClientWidth = b?.clientWidth ?? 0;
    const hasHorizontalOverflow =
      docScrollWidth - docClientWidth > 1 || bodyScrollWidth - bodyClientWidth > 1;
    return { docScrollWidth, docClientWidth, bodyScrollWidth, bodyClientWidth, hasHorizontalOverflow };
  });
}

async function auditScenario(page: any, scenario: Scenario, scope: 'public' | 'auth', outDir: string): Promise<AuditEntry> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const issues: AuditIssue[] = [];

  const onConsole = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Benign in screenshot audit: missing optional media assets on list pages.
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) {
        return;
      }
      // Benign in local screenshot audit: the lightweight web proxy can emit transient 502s for
      // optional media/resources while the page shell and layout still render correctly.
      if (/Failed to load resource: the server responded with a status of 502 \(Bad Gateway\)/i.test(text)) {
        return;
      }
      // Benign in local screenshot audit: backend image hosts are cross-origin from the local web server
      // and can emit paired CORS/ERR_FAILED noise without breaking the page shell or layout.
      if (
        /Access to image at .* has been blocked by CORS policy/i.test(text) ||
        /Failed to load resource: net::ERR_FAILED/i.test(text)
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  };
  const onPageError = (err: any) => {
    pageErrors.push(String(err?.message || err));
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    await gotoWithRetry(page, scenario.route, { maxAttempts: 4, timeout: 90_000 });
  } catch (error: any) {
    issues.push({
      type: 'navigation',
      details: `Navigation failed for ${scenario.route}: ${String(error?.message || error)}`,
    });
  }

  await maybeAcceptCookiesBanner(page);
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(1200).catch(() => undefined);

  const signalMatched = await waitForScenarioSignal(page, scenario);
  if (!signalMatched) {
    issues.push({
      type: 'missing-signal',
      details: `No expected signal found for ${scenario.route}.`,
    });
  }

  const finalUrl = page.url();
  if (scope === 'auth' && /\/login(?:[/?#]|$)/.test(finalUrl)) {
    issues.push({
      type: 'auth-redirect',
      details: `Auth page ${scenario.route} redirected to login (${finalUrl}).`,
    });
  }

  const metrics = await collectLayoutMetrics(page);
  if (metrics.hasHorizontalOverflow) {
    issues.push({
      type: 'horizontal-overflow',
      details: `Overflow on ${scenario.route}: doc ${metrics.docScrollWidth}/${metrics.docClientWidth}, body ${metrics.bodyScrollWidth}/${metrics.bodyClientWidth}.`,
    });
  }

  if (consoleErrors.length > 0) {
    issues.push({
      type: 'console-error',
      details: `${consoleErrors.length} console error(s) on ${scenario.route}.`,
    });
  }
  if (pageErrors.length > 0) {
    issues.push({
      type: 'page-error',
      details: `${pageErrors.length} page error(s) on ${scenario.route}.`,
    });
  }

  const screenshot = path.join(outDir, `${scope}-${scenario.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);

  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  return {
    scope,
    id: scenario.id,
    route: scenario.route,
    finalUrl,
    screenshot,
    signalMatched,
    signalsChecked: scenario.expectedAny,
    docScrollWidth: metrics.docScrollWidth,
    docClientWidth: metrics.docClientWidth,
    bodyScrollWidth: metrics.bodyScrollWidth,
    bodyClientWidth: metrics.bodyClientWidth,
    hasHorizontalOverflow: metrics.hasHorizontalOverflow,
    consoleErrors,
    pageErrors,
    issues,
  };
}

function buildSummaryMarkdown(entries: AuditEntry[], reportPath: string): string {
  const issueCount = entries.reduce((sum, item) => sum + item.issues.length, 0);
  const failedRoutes = entries.filter((item) => item.issues.length > 0);

  const lines: string[] = [];
  lines.push('# Mobile Web Screenshot Audit');
  lines.push('');
  lines.push(`- Pages checked: ${entries.length}`);
  lines.push(`- Total issues: ${issueCount}`);
  lines.push(`- JSON report: ${reportPath}`);
  lines.push('');
  lines.push('| Scope | Route | Signal | Overflow | Console errors | Page errors | Issues |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  for (const item of entries) {
    lines.push(
      `| ${item.scope} | ${item.route} | ${item.signalMatched ? 'OK' : 'MISS'} | ${item.hasHorizontalOverflow ? 'YES' : 'NO'} | ${item.consoleErrors.length} | ${item.pageErrors.length} | ${item.issues.length} |`
    );
  }

  if (failedRoutes.length > 0) {
    lines.push('');
    lines.push('## Issues');
    lines.push('');
    for (const item of failedRoutes) {
      lines.push(`### ${item.scope.toUpperCase()} ${item.route}`);
      for (const issue of item.issues) {
        lines.push(`- [${issue.type}] ${issue.details}`);
      }
      lines.push(`- Screenshot: ${item.screenshot}`);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

test.describe('@smoke Manual QA: mobile web screenshots on each core page', () => {
  test('captures screenshots + analysis report for public/auth mobile pages', async ({ browser }, testInfo) => {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(process.cwd(), 'output', 'playwright', `mobile-web-audit-${now}`);
    fs.mkdirSync(outDir, { recursive: true });

    const allEntries: AuditEntry[] = [];

    const publicContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
      locale: 'ru-RU',
      deviceScaleFactor: 2,
    });
    const publicPage = await publicContext.newPage();
    await preacceptCookies(publicPage);

    for (const scenario of PUBLIC_SCENARIOS) {
      const entry = await auditScenario(publicPage, scenario, 'public', outDir);
      allEntries.push(entry);
    }
    await publicContext.close();

    const storageStatePath = path.join(process.cwd(), 'e2e', '.auth', 'storageState.json');
    const authContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
      locale: 'ru-RU',
      deviceScaleFactor: 2,
      ...(fs.existsSync(storageStatePath) ? { storageState: storageStatePath } : {}),
    });
    const authPage = await authContext.newPage();
    await preacceptCookies(authPage);

    for (const scenario of AUTH_SCENARIOS) {
      const entry = await auditScenario(authPage, scenario, 'auth', outDir);
      allEntries.push(entry);
    }
    await authContext.close();

    const reportPath = path.join(outDir, 'report.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(allEntries, null, 2)}\n`, 'utf8');

    const summaryPath = path.join(outDir, 'summary.md');
    fs.writeFileSync(summaryPath, buildSummaryMarkdown(allEntries, reportPath), 'utf8');

    testInfo.annotations.push({ type: 'report', description: reportPath });
    testInfo.annotations.push({ type: 'summary', description: summaryPath });

    const issues = allEntries.flatMap((entry) =>
      entry.issues.map((issue) => `${entry.scope}:${entry.route} [${issue.type}] ${issue.details}`)
    );

    expect(issues, `Mobile web audit found issues. Full report: ${reportPath}`).toEqual([]);
  });
});
