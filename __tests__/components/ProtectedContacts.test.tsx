import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: { radii: { sm: 8, md: 12, lg: 16, pill: 999 } },
}))

const mockOpenExternalUrl = jest.fn()
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const mockConfirm = jest.fn()
jest.mock('@/utils/confirmAction', () => ({
  confirmAction: (...args: unknown[]) => mockConfirm(...args),
}))

const mockShowToast = jest.fn()
jest.mock('@/utils/toast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }))

const mockRequestContactAccess = jest.fn()
jest.mock('@/api/privacy', () => ({
  requestContactAccess: (...args: unknown[]) => mockRequestContactAccess(...args),
}))

import ProtectedContacts from '@/components/profile/ProtectedContacts'

const socials = [
  { key: 'instagram', label: 'Instagram', value: 'https://instagram.com/x' },
  { key: 'youtube', label: 'YouTube', value: 'https://youtube.com/x' },
]

beforeEach(() => jest.clearAllMocks())

describe('ProtectedContacts gating', () => {
  it('shows contacts directly when protection is inactive', () => {
    const { getByText, queryByText } = render(
      <ProtectedContacts socials={socials} isOwnProfile={false} contactsHidden={false} targetUserId={42} />
    )
    expect(getByText('Instagram')).toBeTruthy()
    expect(queryByText('Контакты скрыты')).toBeNull()
  })

  it('shows contacts on own profile even when contactsHidden is true', () => {
    const { getByText, queryByText } = render(
      <ProtectedContacts socials={socials} isOwnProfile={true} contactsHidden={true} targetUserId={42} />
    )
    expect(getByText('Instagram')).toBeTruthy()
    expect(queryByText('Контакты скрыты')).toBeNull()
  })

  it('hides contacts behind a request gate when protected and access=none', () => {
    const { getByText, queryByText } = render(
      <ProtectedContacts
        socials={socials}
        isOwnProfile={false}
        contactsHidden={true}
        contactAccess="none"
        targetUserId={42}
      />
    )
    expect(getByText('Контакты скрыты')).toBeTruthy()
    expect(getByText('Запросить контакты')).toBeTruthy()
    expect(queryByText('Instagram')).toBeNull()
  })

  it('reveals contacts directly when access is already granted', () => {
    const { getByText, queryByText } = render(
      <ProtectedContacts
        socials={socials}
        isOwnProfile={false}
        contactsHidden={true}
        contactAccess="granted"
        targetUserId={42}
      />
    )
    expect(getByText('Instagram')).toBeTruthy()
    expect(queryByText('Контакты скрыты')).toBeNull()
  })

  it('shows a pending badge when a request is already pending', () => {
    const { getByText, queryByText } = render(
      <ProtectedContacts
        socials={socials}
        isOwnProfile={false}
        contactsHidden={true}
        contactAccess="pending"
        targetUserId={42}
      />
    )
    expect(getByText('Заявка отправлена')).toBeTruthy()
    expect(queryByText('Запросить контакты')).toBeNull()
  })

  it('requires consent before requesting and updates to pending on success', async () => {
    mockConfirm.mockResolvedValueOnce(true)
    mockRequestContactAccess.mockResolvedValueOnce({ status: 'pending' })

    const { getByText, queryByText } = render(
      <ProtectedContacts
        socials={socials}
        isOwnProfile={false}
        contactsHidden={true}
        contactAccess="none"
        targetUserId={42}
      />
    )

    fireEvent.press(getByText('Запросить контакты'))

    await waitFor(() => expect(mockRequestContactAccess).toHaveBeenCalledWith(42))
    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => expect(getByText('Заявка отправлена')).toBeTruthy())
    expect(queryByText('Запросить контакты')).toBeNull()
  })

  it('does not call the API when consent is declined', async () => {
    mockConfirm.mockResolvedValueOnce(false)
    const { getByText } = render(
      <ProtectedContacts
        socials={socials}
        isOwnProfile={false}
        contactsHidden={true}
        contactAccess="none"
        targetUserId={42}
      />
    )
    fireEvent.press(getByText('Запросить контакты'))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockRequestContactAccess).not.toHaveBeenCalled()
  })
})
