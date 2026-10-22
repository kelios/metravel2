import type { Travel, TravelModerationMetadata, TravelPublicationStatus } from '@/types/types';
import { translate as i18nT } from '@/i18n';

type TravelDraftFields = Pick<Travel, 'publication_status' | 'publish'>;

// Черновиковые и опубликованные статусы держим здесь же, где и предикат: тем же
// набором фильтруется серверный счётчик черновиков (`where.publication_status`),
// и разъехаться с локальной классификацией списка он не может.
export const DRAFT_PUBLICATION_STATUSES = ['draft', 'pending_review'] as const;
export const PUBLISHED_PUBLICATION_STATUSES = ['approved', 'published'] as const;

const isFalseFlag = (value: unknown) =>
  value === false ||
  value === 0 ||
  value === '0' ||
  String(value).toLowerCase() === 'false';

export const isTravelDraft = (travel: TravelDraftFields): boolean => {
  const status = String(travel.publication_status ?? '').trim().toLowerCase();
  if ((DRAFT_PUBLICATION_STATUSES as readonly string[]).includes(status)) return true;
  if ((PUBLISHED_PUBLICATION_STATUSES as readonly string[]).includes(status)) return false;
  return isFalseFlag(travel.publish);
};


export type TravelPublicationFields = {
  publication_status?: string | null;
  publish?: unknown;
  moderation?: unknown;
};

export type TravelPublicationCommand = 'save' | 'submit' | 'approve' | 'reject';

type ModerationReadFields = {
  moderation_decision?: unknown;
  moderation_decision_reason?: unknown;
  moderation_decided_at?: unknown;
};

/** Full server snapshots own these fields, including their absence. */
export function readTravelModerationMetadata(source: ModerationReadFields): Required<TravelModerationMetadata> {
  return {
    moderation_decision: source.moderation_decision === 'approved' || source.moderation_decision === 'rejected'
      ? source.moderation_decision : null,
    moderation_decision_reason: typeof source.moderation_decision_reason === 'string'
      ? source.moderation_decision_reason : '',
    moderation_decided_at: typeof source.moderation_decided_at === 'string'
      ? source.moderation_decided_at : null,
  };
}

export type TravelDisplayStatus = TravelPublicationStatus | 'rejected' | null;

export function resolveTravelModerationFeedback(travel: TravelPublicationFields & ModerationReadFields) {
  const publicationStatus = resolveTravelPublicationStatus(travel);
  const metadata = readTravelModerationMetadata(travel);
  const rejected = publicationStatus === 'draft' && metadata.moderation_decision === 'rejected';
  const status: TravelDisplayStatus = rejected ? 'rejected' : publicationStatus;
  const hasCurrentDecision = rejected || (publicationStatus === 'published' && metadata.moderation_decision === 'approved');
  const timestamp = metadata.moderation_decided_at;
  return {
    status,
    reason: rejected && metadata.moderation_decision_reason.trim() ? metadata.moderation_decision_reason : '',
    decidedAt: hasCurrentDecision && timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : null,
  };
}

const PUBLICATION_STATUSES: readonly TravelPublicationStatus[] = [
  'draft', 'pending_review', 'approved', 'published',
];

const isTrueFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 'true';

/** Canonical values are authoritative, including invalid values. Only absence permits legacy fallback. */
export function resolveTravelPublicationStatus(travel: TravelPublicationFields): TravelPublicationStatus | null {
  if (travel.publication_status !== undefined) {
    return PUBLICATION_STATUSES.includes(travel.publication_status as TravelPublicationStatus)
      ? travel.publication_status as TravelPublicationStatus
      : null;
  }
  const publish = isTrueFlag(travel.publish);
  const moderation = isTrueFlag(travel.moderation);
  if (publish) return moderation ? 'published' : 'pending_review';
  return moderation ? 'approved' : 'draft';
}

export function requireTravelPublicationStatus(travel: TravelPublicationFields): TravelPublicationStatus {
  const status = resolveTravelPublicationStatus(travel);
  if (!status) throw new Error(i18nT('errorsStatic:api.misc.unsupportedPublicationStatus'));
  return status;
}

/** Status is server state. Commands travel separately and never become legacy flag writes. */
export function buildTravelPublicationWrite<T extends TravelPublicationFields>(
  data: T,
  command: TravelPublicationCommand = 'save',
  rejectionReason?: string,
): Omit<T, 'publish' | 'moderation' | 'publication_status' | 'moderation_decision_reason' | 'moderation_decision' | 'moderation_decided_at'> & {
  publication_status: TravelPublicationStatus;
  enforce_moderation_validation: boolean;
  moderation_decision_reason?: string;
} {
  const status = requireTravelPublicationStatus(data);
  const payload = { ...data } as Record<string, unknown>;
  for (const field of ['publish', 'moderation', 'publication_status', 'moderation_decision_reason', 'moderation_decision', 'moderation_decided_at', 'enforce_moderation_validation']) {
    delete payload[field];
  }
  const reason = rejectionReason?.trim();
  if (command === 'reject' && (!reason || reason.length > 2000)) {
    throw new Error(i18nT('errorsStatic:api.misc.rejectionReasonRequired'));
  }
  return {
    ...payload,
    publication_status: command === 'save' ? status : command === 'submit' ? 'pending_review' : command === 'approve' ? 'published' : 'draft',
    enforce_moderation_validation: command === 'submit',
    ...(command === 'reject' ? { moderation_decision_reason: reason } : {}),
  } as ReturnType<typeof buildTravelPublicationWrite<T>>;
}
