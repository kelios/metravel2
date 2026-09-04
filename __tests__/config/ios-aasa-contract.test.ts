const {
  EXPECTED,
  checkLiveProductionAasa,
  validateAppleAppSiteAssociationDocument,
  validateIosRelease,
} = require('../../scripts/ios-release-guard-lib');

const VALID_APP_ID = `ABCD123456.${EXPECTED.bundleIdentifier}`;

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
    const document = validDocument();
    expect(
      checkLiveProductionAasa({
        fetchAasaJson: () => document,
      })
    ).toEqual([]);
  });

  it('wires the live AASA check into validateIosRelease when requested', () => {
    const errors = validateIosRelease(undefined, {
      checkLiveAasa: true,
      fetchAasaJson: () => validDocument({ appID: VALID_APP_ID }),
    });
    expect(errors.map((error: { code: string }) => error.code)).toContain('IOS_AASA_MIXED_FORMAT');
  });
});
