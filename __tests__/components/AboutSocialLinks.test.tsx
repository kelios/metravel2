import { fireEvent, render } from '@testing-library/react-native'

import { AboutIntroCard } from '@/components/about/AboutIntroCard'
import { SocialSection } from '@/components/about/SocialSection'
import { METRAVEL_SOCIAL_LINKS } from '@/constants/socialLinks'

describe('official MeTravel social links', () => {
  it('opens the canonical Facebook Page from the About card', () => {
    const onOpenUrl = jest.fn()
    const { getByLabelText } = render(
      <AboutIntroCard
        email="metraveldev@gmail.com"
        onSendMail={jest.fn()}
        onOpenUrl={onOpenUrl}
        onOpenPrivacy={jest.fn()}
        onOpenCookies={jest.fn()}
        socialLinks={METRAVEL_SOCIAL_LINKS}
      />,
    )

    fireEvent.press(getByLabelText('MeTravel в Facebook'))

    expect(onOpenUrl).toHaveBeenCalledWith(
      'https://www.facebook.com/profile.php?id=61590753359050',
    )
  })

  it('exposes Facebook alongside Instagram in the social section', () => {
    const onOpenFacebook = jest.fn()
    const { getByLabelText } = render(
      <SocialSection onOpenFacebook={onOpenFacebook} onOpenInstagram={jest.fn()} />,
    )

    fireEvent.press(getByLabelText('MeTravel в Facebook'))

    expect(onOpenFacebook).toHaveBeenCalledTimes(1)
  })
})
