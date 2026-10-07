import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useWindowDimensions } from 'react-native'
import FullscreenGallery from '@/components/travel/FullscreenGallery.web'

jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/travel/ZoomableGalleryImage.web', () => ({
  __esModule: true,
  default: ({ src, resetKey, width, height }: { src: string; resetKey: string; width: number; height: number }) =>
    <div data-src={src} data-reset-key={resetKey} data-width={width} data-height={height} />,
}))
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: ({ width, height }: { width: number; height: number }) =>
    <div data-testid="gallery-sharp-media" data-width={width} data-height={height} />,
}))
jest.mock('@/components/safety/ContentSafetyActions', () => ({
  __esModule: true,
  default: () => require('react-dom').createPortal(
    <div role="dialog" aria-modal="true"><textarea data-testid="gallery-safety-input" /></div>,
    globalThis.document.body,
  ),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ overlay: 'rgba(0,0,0,0.8)', textOnDark: '#fff' }),
}))

describe('FullscreenGallery web navigation', () => {
  let container: HTMLDivElement
  let root: Root
  let widthSpy: jest.SpyInstance
  const onClose = jest.fn()
  const images = [{ url: 'one.jpg' }, { url: 'two.jpg' }, { url: 'three.jpg' }]
  const get = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement

  beforeEach(() => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 1000 })
    widthSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onClose.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    widthSpy.mockRestore()
  })

  it('opens the selected image, navigates with buttons and keyboard, and closes with Escape', () => {
    act(() => root.render(<FullscreenGallery visible images={images} initialIndex={1} onClose={onClose} />))
    const scroller = get('travel-fullscreen-gallery-scroller')
    expect(scroller.scrollLeft).toBe(500)
    Object.defineProperty(scroller, 'clientWidth', { value: 500 })
    scroller.scrollTo = jest.fn(({ left }: ScrollToOptions) => { scroller.scrollLeft = left ?? 0 })
    const gallery = get('travel-fullscreen-gallery')
    expect(document.activeElement).toBe(gallery)
    expect(get('travel-fullscreen-gallery-counter').textContent).toBe('2 / 3')
    act(() => get('travel-fullscreen-gallery-next').click())
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' })
    expect(get('travel-fullscreen-gallery-counter').textContent).toBe('3 / 3')
    act(() => gallery.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(get('travel-fullscreen-gallery-counter').textContent).toBe('1 / 3')
    act(() => get('travel-fullscreen-gallery-previous').click())
    expect(get('travel-fullscreen-gallery-counter').textContent).toBe('3 / 3')
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps keyboard focus inside and restores the opener without refocusing on callback changes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    act(() => root.render(<FullscreenGallery visible images={images} onClose={onClose} />))
    const gallery = get('travel-fullscreen-gallery')
    const first = get('travel-fullscreen-gallery-close')
    const last = get('travel-fullscreen-gallery-next')
    act(() => gallery.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(last)
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(first)
    act(() => root.render(<FullscreenGallery visible images={images} onClose={() => onClose()} />))
    expect(document.activeElement).toBe(first)
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(last)
    act(() => root.render(<FullscreenGallery visible={false} images={images} onClose={onClose} />))
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('does not navigate or close while a portal safety dialog handles keyboard input', async () => {
    await act(async () => root.render(<FullscreenGallery visible images={[{ id: 11, url: 'one.jpg' }, ...images]} onClose={onClose} />))
    const scroller = get('travel-fullscreen-gallery-scroller')
    scroller.scrollTo = jest.fn()
    act(() => get('gallery-safety-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(scroller.scrollTo).not.toHaveBeenCalled()
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' })))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns to an RN-web reviews modal on one Escape release without closing it', () => {
    const Modal = require('react-native-web/dist/cjs/exports/Modal').default || require('react-native-web/dist/cjs/exports/Modal')
    const onReviewsClose = jest.fn()
    function Reviews() {
      const [galleryVisible, setGalleryVisible] = useState(false)
      return galleryVisible ? (
        <FullscreenGallery visible images={images} onClose={() => setGalleryVisible(false)} />
      ) : (
        <Modal visible animationType="none" onRequestClose={onReviewsClose}>
          <button data-testid="open-review-photo" onClick={() => setGalleryVisible(true)}>Photo</button>
        </Modal>
      )
    }
    act(() => root.render(<Reviews />))
    act(() => get('open-review-photo').click())
    expect(document.activeElement).toBe(get('travel-fullscreen-gallery'))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(get('travel-fullscreen-gallery')).not.toBeNull()
    act(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })))
    expect(get('travel-fullscreen-gallery')).toBeNull()
    expect(get('open-review-photo')).not.toBeNull()
    expect(onReviewsClose).not.toHaveBeenCalled()
  })

  it('updates the counter on swipe and hides navigation for a single image', () => {
    act(() => root.render(<FullscreenGallery visible images={images} onClose={onClose} />))
    const scroller = get('travel-fullscreen-gallery-scroller')
    Object.defineProperty(scroller, 'clientWidth', { value: 500 })
    scroller.scrollLeft = 500
    act(() => scroller.dispatchEvent(new Event('scroll')))
    expect(get('travel-fullscreen-gallery-counter').textContent).toBe('2 / 3')
    act(() => root.render(<FullscreenGallery visible images={[images[0]]} onClose={onClose} />))
    expect(get('travel-fullscreen-gallery-next')).toBeNull()
    expect(get('travel-fullscreen-gallery-previous')).toBeNull()
    expect(get('travel-fullscreen-gallery-counter')).toBeNull()
  })

  it('caps review photos and gives media the actual viewport size instead of card defaults', () => {
    act(() => root.render(<FullscreenGallery visible images={images} maxImageSize={640} onClose={onClose} />))
    const photo = document.querySelector('[data-src="one.jpg"]') as HTMLElement
    expect(photo.dataset.width).toBe('640')
    expect(photo.dataset.height).toBe('640')
    act(() => root.render(<FullscreenGallery visible images={images} onClose={onClose} />))
    expect(photo.dataset.width).toBe('1440')
    expect(photo.dataset.height).toBe('1000')
    ;(useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844 })
    act(() => root.render(<FullscreenGallery visible images={images} maxImageSize={640} onClose={onClose} />))
    expect(photo.dataset.width).toBe('390')
    expect(photo.dataset.height).toBe('640')
  })

  it('passes numeric image dimensions to the media primitive for correctly sized sharp sources', () => {
    const ZoomableImage = jest.requireActual('@/components/travel/ZoomableGalleryImage.web').default
    act(() => root.render(<ZoomableImage src="one.jpg" alt="Photo" width={640} height={640} />))
    const media = get('gallery-sharp-media')
    expect(media.dataset.width).toBe('640')
    expect(media.dataset.height).toBe('640')
  })
})
