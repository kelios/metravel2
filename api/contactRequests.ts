// api/contactRequests.ts
// Слой заявок на раскрытие контактов (BE-contact-protection #446 база + #419 расширение).
// Контракт (тикет #419/#424), пути относительно apiClient.baseURL (`/api`):
//   POST  /user/{user_id}/contact-request/  → { status }   (уже live; обёртка в api/privacy.ts)
//   GET   /contact-requests/?direction=&status=
//   PATCH /contact-requests/{id}/  { status }
// Production contract verified by board #919; mock fallback is development-only.

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';
// POST-обёртка уже существует — переиспользуем, не дублируем.
import { requestContactAccess, type ContactAccessStatus } from '@/api/privacy';

export { requestContactAccess };
export type { ContactAccessStatus };

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

export type ContactRequestDirection = 'sent' | 'received';

/** Статус заявки на раскрытие контактов (BE StatusEnum #419). */
export type ContactRequestStatus = 'pending' | 'granted' | 'declined' | 'revoked';

/** Действие над заявкой (PATCH body.status). target → grant/decline, requester → revoke. */
export type ContactRequestDecision = 'granted' | 'declined' | 'revoked';

export interface ContactRequestParty {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface ContactAccessRequest {
  id: number;
  requester: ContactRequestParty;
  target: ContactRequestParty;
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt: string | null;
  decidedAt: string | null;
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface ProfileObject {
  id?: number;
  name?: string | null;
  avatar?: string | null;
}
type ProfileField = ProfileObject | string | null;

interface ContactAccessRequestDto {
  id: number;
  requester: number;
  requester_profile?: ProfileField;
  target: number;
  target_profile?: ProfileField;
  status: ContactRequestStatus;
  created_at: string;
  updated_at?: string | null;
  decided_at?: string | null;
}

// ── Хелперы маппинга ────────────────────────────────────────────────────────

const unwrap = <T>(res: Paginated<T> | T[] | null | undefined): T[] =>
  Array.isArray(res) ? res : (res?.results ?? []);

const isProfileObject = (p: ProfileField | undefined): p is ProfileObject =>
  typeof p === 'object' && p !== null;

const profileName = (p: ProfileField | undefined, fallbackId: number): string => {
  if (isProfileObject(p) && p.name?.trim()) return p.name.trim();
  if (typeof p === 'string' && p.trim()) return p.trim();
  return `#${fallbackId}`;
};

const profileAvatar = (p: ProfileField | undefined): string | null =>
  isProfileObject(p) ? (p.avatar ?? null) : null;

const profileId = (p: ProfileField | undefined, fallback: number): number =>
  isProfileObject(p) && typeof p.id === 'number' ? p.id : fallback;

const mapParty = (id: number, profile: ProfileField | undefined): ContactRequestParty => ({
  id: profileId(profile, id),
  name: profileName(profile, id),
  avatarUrl: profileAvatar(profile),
});

const mapRequest = (dto: ContactAccessRequestDto): ContactAccessRequest => ({
  id: dto.id,
  requester: mapParty(dto.requester, dto.requester_profile),
  target: mapParty(dto.target, dto.target_profile),
  status: dto.status,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at ?? null,
  decidedAt: dto.decided_at ?? null,
});

// ── Мок-фолбэк (FE-guard: снять после верификации BE #419 на проде + regression) ──

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_TRIPS_MOCK',
  value: process.env.EXPO_PUBLIC_TRIPS_MOCK,
});

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

const nowIso = () => new Date().toISOString();

// In-memory мок: пара входящих pending-заявок, чтобы grant/decline были видны в UI.
// Мутируется на месте (updateContactRequest), переживает между fetch'ами в рамках сессии.
const MOCK_RECEIVED: ContactAccessRequest[] = [
  {
    id: 7001,
    requester: { id: 501, name: 'Анна Петрова', avatarUrl: null },
    target: { id: 0, name: 'Вы', avatarUrl: null },
    status: 'pending',
    createdAt: '2026-06-19T10:15:00Z',
    updatedAt: null,
    decidedAt: null,
  },
  {
    id: 7002,
    requester: { id: 502, name: 'Игорь Соколов', avatarUrl: null },
    target: { id: 0, name: 'Вы', avatarUrl: null },
    status: 'pending',
    createdAt: '2026-06-20T08:40:00Z',
    updatedAt: null,
    decidedAt: null,
  },
];

const MOCK_SENT: ContactAccessRequest[] = [
  {
    id: 7101,
    requester: { id: 0, name: 'Вы', avatarUrl: null },
    target: { id: 601, name: 'Мария Климова', avatarUrl: null },
    status: 'pending',
    createdAt: '2026-06-18T19:05:00Z',
    updatedAt: null,
    decidedAt: null,
  },
];

const mockList = (
  direction: ContactRequestDirection,
  status?: ContactRequestStatus,
): ContactAccessRequest[] => {
  const source = direction === 'received' ? MOCK_RECEIVED : MOCK_SENT;
  return source.filter((r) => !status || r.status === status);
};

const applyMockDecision = (
  id: number,
  status: ContactRequestDecision,
): ContactAccessRequest => {
  const all = [...MOCK_RECEIVED, ...MOCK_SENT];
  const found = all.find((r) => r.id === id);
  if (!found) throw new ApiError(404, 'Contact request not found');
  found.status = status;
  found.updatedAt = nowIso();
  found.decidedAt = nowIso();
  return found;
};

// ── Публичные функции ───────────────────────────────────────────────────────

export async function fetchContactRequests(
  direction: ContactRequestDirection,
  status?: ContactRequestStatus,
): Promise<ContactAccessRequest[]> {
  if (USE_MOCK) return mockList(direction, status);
  const query = new URLSearchParams({ direction });
  if (status) query.set('status', status);
  try {
    const res = await apiClient.get<Paginated<ContactAccessRequestDto>>(
      `/contact-requests/?${query.toString()}`,
    );
    return unwrap(res).map(mapRequest);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[contact-requests] list → mock fallback');
      return mockList(direction, status);
    }
    throw error;
  }
}

export async function updateContactRequest(
  id: number,
  status: ContactRequestDecision,
): Promise<ContactAccessRequest> {
  if (USE_MOCK) return applyMockDecision(id, status);
  try {
    const dto = await apiClient.patch<ContactAccessRequestDto>(
      `/contact-requests/${id}/`,
      { status },
    );
    return mapRequest(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[contact-requests] update → mock fallback');
      return applyMockDecision(id, status);
    }
    throw error;
  }
}
