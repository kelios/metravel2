/**
 * INV2-07: streamlined registration collects only email + password. The backend
 * `RegisterSerializer` still requires a `username` (used as the account display
 * name), so we derive it from the email local part instead of asking the user
 * for a third field. Social sign-in supplies its own name via the provider flow.
 */
const MAX_USERNAME_LENGTH = 50
const FALLBACK_USERNAME = 'traveler'

export const deriveUsernameFromEmail = (email: string | null | undefined): string => {
  const localPart = String(email ?? '')
    .trim()
    .split('@')[0]
    // Collapse internal whitespace so a display name never carries stray gaps.
    .replace(/\s+/g, ' ')
    .trim()

  const base = localPart.length > 0 ? localPart : FALLBACK_USERNAME
  return base.slice(0, MAX_USERNAME_LENGTH)
}
