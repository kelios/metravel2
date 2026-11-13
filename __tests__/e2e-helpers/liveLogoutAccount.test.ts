import { requireLiveLogoutAccount } from '../../e2e/helpers/liveLogoutAccount';

const shared = {
  E2E_EMAIL: 'owner@example.test',
  E2E_PASSWORD: 'owner-password',
  E2E_EMAIL2: 'applicant@example.test',
  E2E_PASSWORD2: 'applicant-password',
  E2E_API_TOKEN: 'owner-api-token',
};

it.each([
  {},
  { E2E_LOGOUT_EMAIL: 'logout@example.test' },
  { E2E_LOGOUT_EMAIL: 'logout@example.test', E2E_LOGOUT_PASSWORD: '   ' },
  { E2E_LOGOUT_PASSWORD: 'logout-password' },
])('fails closed without complete dedicated logout credentials (variant %#)', (logout) => {
  expect(() => requireLiveLogoutAccount({ ...shared, ...logout })).toThrow(/requires dedicated/);
});

it.each([' OWNER@EXAMPLE.TEST ', 'Applicant@Example.Test'])('rejects a shared account identity (variant %#)', (email) => {
  const env = { ...shared, E2E_LOGOUT_EMAIL: email, E2E_LOGOUT_PASSWORD: 'different-password' };
  expect(() => requireLiveLogoutAccount(env)).toThrow(/distinct from primary A and applicant B/);
});

it('resolves actor C without rebinding owner, applicant or API-token environment', () => {
  const env = Object.freeze({
    ...shared,
    E2E_LOGOUT_EMAIL: ' logout@example.test ',
    E2E_LOGOUT_PASSWORD: ' dedicated-password ',
  });
  const before = { ...env };

  expect(requireLiveLogoutAccount(env)).toEqual({
    email: 'logout@example.test',
    password: ' dedicated-password ',
  });
  expect(env).toEqual(before);
});

it('does not disclose account identities or passwords in validation errors', () => {
  const env = { ...shared, E2E_LOGOUT_EMAIL: shared.E2E_EMAIL, E2E_LOGOUT_PASSWORD: 'private-logout-password' };
  try {
    requireLiveLogoutAccount(env);
    throw new Error('Dedicated-account guard should have rejected actor A');
  } catch (error) {
    const message = (error as Error).message;
    expect(message).toMatch(/distinct from primary A and applicant B/);
    for (const value of Object.values(env)) expect(message).not.toContain(value);
  }
});
