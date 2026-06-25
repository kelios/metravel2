import { render } from '@testing-library/react-native'

import VerifiedBadge from '@/components/profile/VerifiedBadge'

describe('VerifiedBadge', () => {
  it('renders the verified chip when is_verified', () => {
    const { getByText } = render(<VerifiedBadge isVerified />)
    expect(getByText('Проверенный')).toBeTruthy()
  })

  it('renders the experienced-organizer label', () => {
    const { getByText } = render(
      <VerifiedBadge isVerified organizerStatus="experienced" />,
    )
    expect(getByText('Проверенный')).toBeTruthy()
    expect(getByText('Организатор с опытом')).toBeTruthy()
  })

  it('renders nothing when neither flag is set', () => {
    const { toJSON } = render(<VerifiedBadge isVerified={false} organizerStatus={null} />)
    expect(toJSON()).toBeNull()
  })

  it('small size renders an icon-only badge (no label) when verified', () => {
    const { getByTestId, queryByText } = render(
      <VerifiedBadge isVerified size="small" testID="vb" />,
    )
    expect(getByTestId('vb')).toBeTruthy()
    expect(queryByText('Проверенный')).toBeNull()
  })

  it('small size renders nothing when not verified (organizer-only)', () => {
    const { toJSON } = render(
      <VerifiedBadge organizerStatus="experienced" size="small" />,
    )
    expect(toJSON()).toBeNull()
  })
})
