import fs from 'fs';
import path from 'path';

import {
  ANDROID_APP_LINK_PATHS,
  classifyIncomingAppLink,
  isAndroidAppLinkPath,
  mapIncomingAppLinkToHref,
} from '@/utils/incomingAppLinks';

const { AASA_ROUTE_POLICY_CASES } = require('../../scripts/ios-release-guard-lib') as {
  AASA_ROUTE_POLICY_CASES: ReadonlyArray<{ id: string; path: string; allowed: boolean }>;
};

type IntentFilter = {
  action: string;
  autoVerify?: boolean;
  data: Array<{ scheme: string; host: string; path?: string; pathPrefix?: string; pathPattern?: string }>;
};

const appJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'app.json'), 'utf8'),
) as { expo: { android: { intentFilters: IntentFilter[] } } };

const SITE = 'https://metravel.by';

/**
 * #3104. Три списка описывают одно множество путей, которые ОС отдаёт приложению:
 * серверный AASA (ожидания в `AASA_ROUTE_POLICY_CASES`), Android-фильтр в
 * `app.json` и таблица политики `utils/incomingAppLinkPolicy.js`. Пока фильтр был
 * `pathPrefix: "/"`, любая страница сайта без экрана (`/places/help`) открывала
 * приложение и терялась на главной.
 */
describe('OS link route parity (#3104)', () => {
  const httpsFilters = appJson.expo.android.intentFilters.filter((filter) =>
    filter.data.some((entry) => entry.scheme === 'https'),
  );

  it('declares exactly one verified https App Links filter for metravel.by', () => {
    expect(httpsFilters).toHaveLength(1);
    const [filter] = httpsFilters;
    expect(filter.action).toBe('VIEW');
    expect(filter.autoVerify).toBe(true);
    for (const entry of filter.data) {
      expect(entry.scheme).toBe('https');
      expect(entry.host).toBe('metravel.by');
      expect(entry.pathPattern).toBeUndefined();
    }
  });

  it('keeps the Android intent filter equal to the policy path families', () => {
    const [filter] = httpsFilters;
    const declared = filter.data.map(({ path: exact, pathPrefix }) =>
      exact !== undefined ? { path: exact } : { pathPrefix },
    );
    expect(declared).toEqual(ANDROID_APP_LINK_PATHS.map((entry) => ({ ...entry })));
  });

  it('never claims the whole domain', () => {
    expect(ANDROID_APP_LINK_PATHS.some((entry) => entry.pathPrefix === '/' || entry.path === '/')).toBe(false);
    for (const unsupported of ['/places/help', '/become-author', '/accountconfirmation', '/books', '/']) {
      expect(isAndroidAppLinkPath(unsupported)).toBe(false);
    }
  });

  it.each(AASA_ROUTE_POLICY_CASES.map((routeCase) => [routeCase.id, routeCase.path, routeCase.allowed]))(
    'agrees with the AASA expectation %s',
    (_id, routePath, allowed) => {
      const href = mapIncomingAppLinkToHref(`${SITE}${routePath}`);
      if (allowed) {
        // SharedWebCredentials складывает `/map/` в `/map`; политика хранит точные
        // пути, поэтому трейлинг-слеш остаётся задокументированным исключением AASA.
        if (routePath === '/map/') {
          expect(href).toBeNull();
          return;
        }
        expect(href).toBe(routePath);
        expect(isAndroidAppLinkPath(routePath)).toBe(true);
      } else {
        expect(href).toBeNull();
      }
    },
  );

  it('routes a family path the policy rejects to the system browser instead of the home tab', () => {
    // Семейство `/trips/` поймано фильтром, но `/trips/plan/create` сознательно
    // не поддерживается — как и в AASA (`exclude`).
    expect(isAndroidAppLinkPath('/trips/plan/create')).toBe(true);
    expect(classifyIncomingAppLink(`${SITE}/trips/plan/create`)).toEqual({
      kind: 'external',
      url: `${SITE}/trips/plan/create`,
    });
  });

  it.each([
    [`${SITE}/places/help?utm_source=instagram&utm_campaign=belarus_place_stories`, `${SITE}/places/help?utm_source=instagram&utm_campaign=belarus_place_stories`],
    [`${SITE}/become-author`, `${SITE}/become-author`],
    [`${SITE}/places/help#top`, `${SITE}/places/help`],
  ])('classifies a safe unsupported site link %s as external', (url, expected) => {
    expect(classifyIncomingAppLink(url)).toEqual({ kind: 'external', url: expected });
    expect(mapIncomingAppLinkToHref(url)).toBeNull();
  });

  it.each([
    'metravel:///places/help',
    'https://evil.example/places/help',
    `${SITE}/../etc/passwd`,
    `${SITE}/places/%2e%2e/help`,
    `${SITE}:8443/places/help`,
    ` ${SITE}/places/help`,
    '',
    42,
    null,
  ])('ignores %s rather than opening it externally', (url) => {
    expect(classifyIncomingAppLink(url)).toEqual({ kind: 'ignore' });
  });
});
