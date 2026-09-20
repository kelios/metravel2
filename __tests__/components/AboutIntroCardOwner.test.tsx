import { render } from '@testing-library/react-native'

import { AboutIntroCard } from '@/components/about/AboutIntroCard'
import { SITE_OWNER_LEGAL_NAME } from '@/constants/legal'
import { METRAVEL_SOCIAL_LINKS } from '@/constants/socialLinks'

// #1999: Meta Business Verification сверяет зарегистрированное имя владельца с
// текстом сайта. На mobile web футера нет, поэтому имя несут «Контакты» и
// «О проекте» через общую карточку AboutIntroCard — и попадают в статический HTML.
describe('AboutIntroCard site owner line', () => {
  it('shows the registered owner name exactly as filed with Meta', () => {
    const { getByTestId } = render(
      <AboutIntroCard
        email="metraveldev@gmail.com"
        onSendMail={jest.fn()}
        onOpenUrl={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenCookies={jest.fn()}
        socialLinks={METRAVEL_SOCIAL_LINKS}
      />,
    )

    expect(SITE_OWNER_LEGAL_NAME).toBe('Sauran Yuliya')
    expect(getByTestId('about-site-owner')).toHaveTextContent(`Владелец сайта: ${SITE_OWNER_LEGAL_NAME}`)
  })
})
