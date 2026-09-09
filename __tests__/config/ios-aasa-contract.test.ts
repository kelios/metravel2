const {
  EXPECTED,
  AASA_ROUTE_POLICY_CASES,
  checkLiveProductionAasa,
  runAppleAasaRouteMatcher,
  validateAppleAppSiteAssociationDocument,
  validateAppleAppSiteAssociationRoutePolicy,
  validateIosRelease,
} = require('../../scripts/ios-release-guard-lib');

const VALID_APP_ID = `ABCD123456.${EXPECTED.bundleIdentifier}`;

const CURRENT_LIVE_COMPONENTS = [
  { '/': '/travels/*/*', exclude: true, caseSensitive: true },
  { '/': '/travels/?*', caseSensitive: true },
  { '/': '/trips/plan/create', exclude: true, caseSensitive: true },
  { '/': '/trips/plan/*/*', exclude: true, caseSensitive: true },
  { '/': '/trips/plan/?*', caseSensitive: true },
  { '/': '/trips/*/*', exclude: true, caseSensitive: true },
  { '/': '/trips/?*', caseSensitive: true },
  { '/': '/trips', caseSensitive: true },
  { '/': '/article/*/*', exclude: true, caseSensitive: true },
  { '/': '/article/?*', caseSensitive: true },
  { '/': '/quests/*/*/*', exclude: true, caseSensitive: true },
  { '/': '/quests/?*/?*', caseSensitive: true },
  { '/': '/map/*', exclude: true, caseSensitive: true },
  { '/': '/map', caseSensitive: true },
  { '/': '/user/*/*', exclude: true, caseSensitive: true },
  { '/': '/user/?*', caseSensitive: true },
];

const CORRECTED_COMPONENTS = [
  { '/': '/travels/*/?*', exclude: true, caseSensitive: true },
  { '/': '/travels/?*', caseSensitive: true },
  { '/': '/trips/plan/create', exclude: true, caseSensitive: true },
  { '/': '/trips/plan/*/?*', exclude: true, caseSensitive: true },
  { '/': '/trips/plan/?*', caseSensitive: true },
  { '/': '/trips/*/?*', exclude: true, caseSensitive: true },
  { '/': '/trips/?*', caseSensitive: true },
  { '/': '/trips', caseSensitive: true },
  { '/': '/article/*/?*', exclude: true, caseSensitive: true },
  { '/': '/article/?*', caseSensitive: true },
  { '/': '/quests/*/*/?*', exclude: true, caseSensitive: true },
  { '/': '/quests/?*/?*', caseSensitive: true },
  { '/': '/map/?*', exclude: true, caseSensitive: true },
  { '/': '/map', caseSensitive: true },
  { '/': '/user/*/?*', exclude: true, caseSensitive: true },
  { '/': '/user/?*', caseSensitive: true },
];

function validDocument(overrides = {}) {
  return {
    applinks: {
      details: [
        {
          appIDs: [VALID_APP_ID],
          components: [{ '/': '/map' }, { '/': '/travels/?*' }],
          ...overrides,
        },
      ],
    },
  };
}

function documentWithComponents(components: Array<Record<string, unknown>>) {
  return validDocument({ components });
}

function expectedRouteMatcher(_components: unknown, urls: string[]) {
  const expectedByPath = new Map(
    AASA_ROUTE_POLICY_CASES.map((routeCase: { path: string; allowed: boolean }) => [
      routeCase.path,
      routeCase.allowed,
    ])
  );
  return urls.map(url => ({
    matched: expectedByPath.get(new URL(url).pathname) === true,
    excluded: false,
  }));
}

describe('production AASA schema (#1414)', () => {
  it('accepts modern appIDs + components without legacy keys', () => {
    expect(validateAppleAppSiteAssociationDocument(validDocument())).toEqual([]);
  });

  it('allows the documented empty applinks.apps array', () => {
    const document = validDocument();
    document.applinks.apps = [];
    expect(validateAppleAppSiteAssociationDocument(document)).toEqual([]);
  });

  it('rejects a non-empty applinks.apps substitution list', () => {
    const document = validDocument();
    document.applinks.apps = [VALID_APP_ID];
    const errors = validateAppleAppSiteAssociationDocument(document);
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_MIXED_FORMAT');
  });

  it('rejects mixed legacy appID with components — the #1414 recurrence', () => {
    const errors = validateAppleAppSiteAssociationDocument(
      validDocument({ appID: VALID_APP_ID })
    );
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_MIXED_FORMAT');
  });

  it('rejects mixed legacy paths with components', () => {
    const errors = validateAppleAppSiteAssociationDocument(
      validDocument({ paths: ['/map'] })
    );
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_MIXED_FORMAT');
  });

  it('rejects missing appIDs array', () => {
    const document = validDocument();
    delete document.applinks.details[0].appIDs;
    const errors = validateAppleAppSiteAssociationDocument(document);
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_APPIDS');
  });

  it('rejects appIDs that do not match the production bundle id', () => {
    const errors = validateAppleAppSiteAssociationDocument(
      validDocument({ appIDs: ['ABCD123456.com.example.app'] })
    );
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_APPIDS');
  });

  it('rejects empty components', () => {
    const errors = validateAppleAppSiteAssociationDocument(
      validDocument({ components: [] })
    );
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_COMPONENTS');
  });

  it('fails closed when origin and Apple CDN documents differ', () => {
    const origin = validDocument();
    const cdn = validDocument({ components: [{ '/': '/map' }] });
    const errors = checkLiveProductionAasa({
      fetchAasaJson: (url: string) => (url.includes('cdn-apple.com') ? cdn : origin),
    });
    expect(errors.map((error: { code: string }) => error.code)).toEqual(['IOS_AASA_CDN_MISMATCH']);
  });

  it('passes the live check when origin and CDN share a valid document', () => {
    const document = documentWithComponents(CORRECTED_COMPONENTS);
    expect(
      checkLiveProductionAasa({
        fetchAasaJson: () => document,
        runAasaRouteMatcher: expectedRouteMatcher,
      })
    ).toEqual([]);
  });

  it('fails closed when the Apple semantic matcher is unavailable', () => {
    const errors = validateAppleAppSiteAssociationRoutePolicy(
      documentWithComponents(CORRECTED_COMPONENTS),
      { platform: 'linux' }
    );

    expect(errors).toEqual([
      expect.objectContaining({ code: 'IOS_AASA_MATCHER_UNAVAILABLE' }),
    ]);
  });

  it('uses Apple semantics to reject the live shadowing policy and accept /*/?* boundaries', () => {
    if (process.platform !== 'darwin') {
      expect(
        validateAppleAppSiteAssociationRoutePolicy(
          documentWithComponents(CORRECTED_COMPONENTS),
          { platform: process.platform }
        )
      ).toEqual([expect.objectContaining({ code: 'IOS_AASA_MATCHER_UNAVAILABLE' })]);
      return;
    }

    const currentErrors = validateAppleAppSiteAssociationRoutePolicy(
      documentWithComponents(CURRENT_LIVE_COMPONENTS)
    );
    const correctedErrors = validateAppleAppSiteAssociationRoutePolicy(
      documentWithComponents(CORRECTED_COMPONENTS)
    );

    expect(currentErrors).toEqual([
      expect.objectContaining({ code: 'IOS_AASA_ROUTE_POLICY' }),
    ]);
    expect(correctedErrors).toEqual([]);
  }, 30000);

  it('treats /map and /map/ as the same Apple allow decision', () => {
    if (process.platform !== 'darwin') {
      expect(() => runAppleAasaRouteMatcher(CORRECTED_COMPONENTS, [], {
        platform: process.platform,
      })).toThrow('requires macOS');
      return;
    }

    const results = runAppleAasaRouteMatcher(CORRECTED_COMPONENTS, [
      'https://metravel.by/map',
      'https://metravel.by/map/',
    ]);
    expect(results).toEqual([
      expect.objectContaining({ matched: true, excluded: false }),
      expect.objectContaining({ matched: true, excluded: false }),
    ]);
  }, 30000);

  it('wires the live AASA check into validateIosRelease when requested', () => {
    const errors = validateIosRelease(undefined, {
      checkLiveAasa: true,
      fetchAasaJson: () => validDocument({ appID: VALID_APP_ID }),
    });
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_MIXED_FORMAT');
  });
});
