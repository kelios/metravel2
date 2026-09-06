import type { Travel } from '@/types/types';

type TravelPublicationFields = Pick<Travel, 'publication_status' | 'publish'>;

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

export const isTravelDraft = (travel: TravelPublicationFields): boolean => {
  const status = String(travel.publication_status ?? '').trim().toLowerCase();
  if ((DRAFT_PUBLICATION_STATUSES as readonly string[]).includes(status)) return true;
  if ((PUBLISHED_PUBLICATION_STATUSES as readonly string[]).includes(status)) return false;
  return isFalseFlag(travel.publish);
};
