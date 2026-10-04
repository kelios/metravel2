// #2133: общие границы тестов поверхностей жалобы — вошедший пользователь id 1
// и API безопасности без сети. Подключается через `jest.mock(..., () => require(...))`.

export const mockAuthState = { isAuthenticated: true, userId: '1' }

export const authStoreMock = {
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}

export const userSafetyApiMock = {
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 5, due_at: '2026-10-05T10:00:00Z' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() => Promise.resolve([{ key: 'spam', label: 'Спам' }])),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}
