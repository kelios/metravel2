import { act, render, screen } from '@testing-library/react-native'
import SliderCaption from '@/components/travel/sliderParts/SliderCaption'
import i18n from '@/i18n/instance'

afterEach(async () => { await i18n.changeLanguage('ru') })

describe('SliderCaption', () => {
  it.each([undefined, '', '   '])('omits the whole footer when the photo has no caption (%s)', async caption => {
    await render(<SliderCaption caption={caption} currentIndex={2} total={12} />)
    expect(screen.queryByTestId('slider-caption')).toBeNull()
    expect(screen.queryByText('03')).toBeNull()
  })

  it('keeps the displayed caption and photo number in sync when the slide changes', async () => {
    const { rerender } = await render(<SliderCaption caption="Кружки-сапожки" currentIndex={2} total={12} />)
    expect(screen.getByText('03')).toBeTruthy()
    expect(screen.getByText('из 12', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByLabelText('Фотография путешествия 3 из 12')).toBeTruthy()

    await rerender(<SliderCaption caption="Площадь вечером" currentIndex={10} total={12} />)
    expect(screen.getByText('11')).toBeTruthy()
    expect(screen.getByText('Площадь вечером')).toBeTruthy()
    expect(screen.queryByText('03')).toBeNull()
    expect(screen.queryByText('Кружки-сапожки')).toBeNull()
  })

  it('supports albums beyond two-digit photo numbers', async () => {
    await render(<SliderCaption caption="Последнее фото" currentIndex={100} total={101} />)
    expect(screen.getByText('101')).toBeTruthy()
    expect(screen.getByText('из 101', { includeHiddenElements: true })).toBeTruthy()
  })

  it('updates the count language while preserving editorial content', async () => {
    const caption = 'Кружки-сапожки · Żółć · Браслаў'
    await render(<SliderCaption caption={caption} currentIndex={2} total={12} />)

    for (const [locale, total] of [['ru', 'из 12'], ['be', 'з 12'], ['uk', 'з 12'], ['pl', 'z 12'], ['en', 'of 12']] as const) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(screen.getByText(total, { includeHiddenElements: true })).toBeTruthy()
      expect(screen.getByText('03')).toBeTruthy()
      expect(screen.getByText(caption)).toBeTruthy()
    }
  })
})
