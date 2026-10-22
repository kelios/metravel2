import type { Travel, TravelPublicationStatus } from '@/types/types';
import { saveFormData } from '@/api/misc';
import { translate as i18nT } from '@/i18n';
import { ensureRequiredDraftFields } from '@/utils/travelFormNormalization';
import { getEmptyFormData, transformTravelToFormData } from '@/utils/travelFormUtils';
import {
  buildTravelPublicationWrite,
  requireTravelPublicationStatus,
  resolveTravelPublicationStatus,
  type TravelPublicationCommand,
} from '@/utils/travelPublicationStatus';

const mockApiRequest = jest.fn(async (_endpoint: string, options: { body: string }) => JSON.parse(options.body));

jest.mock('@/api/client', () => ({
  apiClient: { request: (endpoint: string, options: { body: string }) => mockApiRequest(endpoint, options) },
  ApiError: class ApiError extends Error {},
}));
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn(async () => 'test-credential') }));
jest.mock('@/utils/authPlatform', () => ({
  ACCESS_TOKEN_STORAGE_KEY: 'test-credential-key',
  shouldUseStoredAuthToken: () => true,
  hasUsableAuthCredential: (token: string | null) => Boolean(token),
}));

const statuses: TravelPublicationStatus[] = ['draft', 'pending_review', 'approved', 'published'];
const legacyStates = [
  { publish: false, moderation: false, status: 'draft' },
  { publish: true, moderation: false, status: 'pending_review' },
  { publish: false, moderation: true, status: 'approved' },
  { publish: true, moderation: true, status: 'published' },
] as const;

describe('travel publication status contract', () => {
  describe.each(statuses)('canonical %s', (publication_status) => {
    it.each(legacyStates)('wins over legacy $publish/$moderation', ({ publish, moderation }) => {
      const article = { publication_status, publish, moderation };
      expect(resolveTravelPublicationStatus(article)).toBe(publication_status);
      expect(requireTravelPublicationStatus(article)).toBe(publication_status);
    });

    it('preserves the state on an ordinary save without replaying a previous decision', () => {
      const article = {
        id: 42,
        name: 'Edited article',
        publication_status,
        publish: true,
        moderation: true,
        enforce_moderation_validation: true,
        moderation_decision_reason: 'A reason read from GET',
        moderation_decision: { decision: 'rejected', reason: 'A previous decision' },
      };
      const original = { ...article };

      expect(buildTravelPublicationWrite(article)).toEqual({
        id: 42,
        name: 'Edited article',
        publication_status,
        enforce_moderation_validation: false,
      });
      expect(article).toEqual(original);
    });
  });

  it.each(legacyStates)('uses the documented absent-field legacy mapping $status', ({ publish, moderation, status }) => {
    expect(resolveTravelPublicationStatus({ publish, moderation })).toBe(status);
    expect(resolveTravelPublicationStatus({ publication_status: undefined, publish, moderation })).toBe(status);
  });

  it.each([
    { publish: 0, moderation: 0, status: 'draft' },
    { publish: '1', moderation: '0', status: 'pending_review' },
    { publish: 'false', moderation: 'true', status: 'approved' },
    { publish: 1, moderation: 1, status: 'published' },
  ])('retains legacy transport compatibility for $status', ({ publish, moderation, status }) => {
    expect(resolveTravelPublicationStatus({ publish, moderation })).toBe(status);
  });

  it('starts a new article without status or flags as draft', () => {
    expect(resolveTravelPublicationStatus({})).toBe('draft');
  });

  it.each([null, '', ' ', 'unsupported', 'PUBLISHED', ' pending_review '])(
    'does not silently recover invalid canonical %p from healthy legacy flags',
    (publication_status) => {
      const article = { publication_status, publish: true, moderation: true };
      expect(resolveTravelPublicationStatus(article)).toBeNull();
      expect(() => requireTravelPublicationStatus(article)).toThrow(i18nT('errorsStatic:api.misc.unsupportedPublicationStatus'));
      for (const command of ['save', 'submit', 'approve', 'reject'] as TravelPublicationCommand[]) {
        expect(() => buildTravelPublicationWrite(article, command, 'A valid reason')).toThrow(i18nT('errorsStatic:api.misc.unsupportedPublicationStatus'));
      }
    },
  );

  it.each([
    { command: 'submit', target: 'pending_review', validate: true },
    { command: 'approve', target: 'published', validate: false },
  ] as const)('writes an explicit $command command without legacy or old rejection fields', ({ command, target, validate }) => {
    expect(buildTravelPublicationWrite({
      publication_status: 'pending_review',
      publish: false,
      moderation: false,
      moderation_decision_reason: 'Old reason from GET',
      moderation_decision: { decision: 'rejected' },
    }, command, 'An unrelated option')).toEqual({
      publication_status: target,
      enforce_moderation_validation: validate,
    });
  });

  it('sends a trimmed rejection reason only on the explicit reject command', () => {
    const article = { id: 42, publication_status: 'pending_review', publish: false, moderation: false };
    expect(buildTravelPublicationWrite(article, 'reject', '  Explain what to fix\n')).toEqual({
      id: 42,
      publication_status: 'draft',
      enforce_moderation_validation: false,
      moderation_decision_reason: 'Explain what to fix',
    });
    expect(buildTravelPublicationWrite(article, 'save', 'Not a rejection')).not.toHaveProperty('moderation_decision_reason');
  });

  it.each([
    { label: 'absent', reason: undefined },
    { label: 'empty', reason: '' },
    { label: 'whitespace', reason: ' \n\t ' },
    { label: 'over 2000 characters', reason: 'x'.repeat(2001) },
  ])('blocks invalid rejection reason: $label', ({ reason }) => {
    expect(() => buildTravelPublicationWrite({ publication_status: 'pending_review' }, 'reject', reason))
      .toThrow(i18nT('errorsStatic:api.misc.rejectionReasonRequired'));
  });

  it('accepts the 2000-character trimmed reason boundary', () => {
    const reason = 'x'.repeat(2000);
    expect(buildTravelPublicationWrite({ publication_status: 'pending_review' }, 'reject', ` ${reason} `))
      .toHaveProperty('moderation_decision_reason', reason);
  });
});

describe('real GET → form normalization → full-save publication contract', () => {
  beforeEach(() => mockApiRequest.mockClear());

  const apiArticle = (publication_status: string | null | undefined) => ({
    ...getEmptyFormData('42'),
    id: 42,
    name: 'An article with a route',
    description: '<p>A complete description of the route with practical travel details for moderation.</p>',
    coordsMeTravel: [{ id: 7, lat: '53.9', lng: '27.56', address: 'A route point', categories: ['1'] }],
    countries: ['1'],
    categories: ['1'],
    publication_status,
    publish: false,
    moderation: false,
    moderation_decision_reason: 'Previous reason returned by GET',
    moderation_decision: { decision: 'rejected', reason: 'A past decision' },
  } as unknown as Travel);

  it.each(statuses)('keeps %s through the real mapper, normalizer and JSON serializer', async (status) => {
    const form = ensureRequiredDraftFields(transformTravelToFormData(apiArticle(status)));
    form.name = 'Content edited without moderation';
    await saveFormData(form);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest.mock.calls[0][0]).toBe('/travels/upsert/');
    const payload = JSON.parse(mockApiRequest.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      name: 'Content edited without moderation',
      publication_status: status,
      enforce_moderation_validation: false,
    });
    expect(String(payload.id)).toBe('42');
    for (const field of ['publish', 'moderation', 'moderation_decision', 'moderation_decision_reason']) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it.each([
    { command: 'submit', status: 'pending_review', enforce: true },
    { command: 'approve', status: 'published', enforce: false },
    { command: 'reject', status: 'draft', enforce: false },
  ] as const)('serializes the explicit $command separately from hydrated state', async ({ command, status, enforce }) => {
    const form = ensureRequiredDraftFields(transformTravelToFormData(apiArticle('pending_review')));
    await saveFormData(form, undefined, { intent: command, moderationDecisionReason: '  Fix the route details  ' });
    const payload = JSON.parse(mockApiRequest.mock.calls[0][1].body);
    expect(payload).toMatchObject({ publication_status: status, enforce_moderation_validation: enforce });
    expect(payload).not.toHaveProperty('publish');
    expect(payload).not.toHaveProperty('moderation');
    if (command === 'reject') expect(payload.moderation_decision_reason).toBe('Fix the route details');
    else expect(payload).not.toHaveProperty('moderation_decision_reason');
    expect(form.publication_status).toBe('pending_review');
  });

  it('keeps an invalid canonical value observable through hydration and prevents the request', async () => {
    const form = ensureRequiredDraftFields(transformTravelToFormData(apiArticle('unknown-state')));
    expect(form.publication_status).toBe('unknown-state');
    await expect(saveFormData(form)).rejects.toThrow(i18nT('errorsStatic:api.misc.unsupportedPublicationStatus'));
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(form.description).toContain('complete description');
  });

  it('normalizes an absent canonical legacy response before saving without legacy flags', async () => {
    const article = apiArticle(undefined);
    article.publish = true;
    const form = ensureRequiredDraftFields(transformTravelToFormData(article));
    expect(form.publication_status).toBe('pending_review');
    await saveFormData(form);
    const payload = JSON.parse(mockApiRequest.mock.calls[0][1].body);
    expect(payload.publication_status).toBe('pending_review');
    expect(payload).not.toHaveProperty('publish');
    expect(payload).not.toHaveProperty('moderation');
  });
});
