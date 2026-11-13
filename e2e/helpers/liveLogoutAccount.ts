type LogoutAccountEnvironment = Readonly<Record<string, string | undefined>>;

/** Logout revokes the entire account session, so it must never share actor A/B. */
export function requireLiveLogoutAccount(env: LogoutAccountEnvironment = process.env): {
  email: string;
  password: string;
} {
  const email = String(env.E2E_LOGOUT_EMAIL || '').trim();
  const password = String(env.E2E_LOGOUT_PASSWORD || '');
  if (!email || !password.trim()) {
    throw new Error('Auth logout E2E requires dedicated E2E_LOGOUT_EMAIL and E2E_LOGOUT_PASSWORD.');
  }

  const identity = email.toLowerCase();
  for (const key of ['E2E_EMAIL', 'E2E_EMAIL2'] as const) {
    if (identity === String(env[key] || '').trim().toLowerCase()) {
      throw new Error('E2E logout must use an account distinct from primary A and applicant B.');
    }
  }

  return { email, password };
}
