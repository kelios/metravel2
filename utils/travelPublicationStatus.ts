import type { Travel } from '@/types/types';

type TravelPublicationFields = Pick<Travel, 'publication_status' | 'publish'>;

const isFalseFlag = (value: unknown) =>
  value === false ||
  value === 0 ||
  value === '0' ||
  String(value).toLowerCase() === 'false';

export const isTravelDraft = (travel: TravelPublicationFields): boolean => {
  const status = String(travel.publication_status ?? '').trim().toLowerCase();
  if (status === 'draft') return true;
  if (status === 'approved' || status === 'published') return false;
  return isFalseFlag(travel.publish);
};
