import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useInstagramPublishDraft } from '@/components/travel/useInstagramPublishDraft'
import { i18n } from '@/i18n'
import type { TravelFormData } from '@/types/types'
import { buildInstagramPublicationDraft, INSTAGRAM_CAPTION_MAX_LENGTH } from '@/utils/instagramPublish'
import { getEmptyFormData } from '@/utils/travelFormUtils'

const photo = (name: string) => `https://example.com/${name}.jpg`
const countries = [{ country_id: '1', title_ru: 'Польша', title_en: 'Poland' }]
const makeForm = (overrides: Partial<TravelFormData> = {}): TravelFormData => ({
  ...getEmptyFormData('841'),
  name: 'A walk through Krakow',
  description: '<p>Source article description.</p>',
  countries: ['1'],
  gallery: ['a', 'b', 'c'].map((name) => photo(name)),
  ...overrides,
})
const makeProps = (formData = makeForm(), countryOptions = countries) => ({
  formData,
  countries: countryOptions,
})

describe('useInstagramPublishDraft', () => {
  const originalPlatform = Platform.OS
  const originalLanguage = i18n.language

  beforeEach(async () => {
    Platform.OS = 'web'
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    Platform.OS = originalPlatform
    await i18n.changeLanguage(originalLanguage)
  })

  it('preserves caption, hashtags and image edits when a locale rebuilds the country array', async () => {
    const initial = makeProps()
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: initial })

    await act(() => {
      result.current.handleInstagramCaptionChange('Custom caption 841')
      result.current.handleInstagramHashtagsChange('#custom841 #weekend')
      result.current.handleMoveInstagramImage(2, -1)
      result.current.handleRemoveInstagramImage(0)
    })

    await act(async () => { await i18n.changeLanguage('pl') })
    await rerender({ ...initial, countries: initial.countries.map((country) => ({ ...country })) })

    expect(result.current.editableInstagramCaption).toBe('Custom caption 841')
    expect(result.current.editableInstagramHashtags).toBe('#metravelby #custom841 #weekend')
    expect(result.current.editableInstagramImages).toEqual([photo('c'), photo('b')])
    expect(result.current.finalInstagramText).toBe('Custom caption 841\n\n#metravelby #custom841 #weekend')

    await rerender({ ...initial, formData: { ...initial.formData, publish: true } })
    expect(result.current.editableInstagramCaption).toBe('Custom caption 841')
    expect(result.current.editableInstagramHashtags).toBe('#metravelby #custom841 #weekend')
    expect(result.current.editableInstagramImages).toEqual([photo('c'), photo('b')])
  })

  it('keeps deliberately empty caption, hashtags and gallery across source updates', async () => {
    const initial = makeProps()
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: initial })

    await act(() => {
      result.current.handleInstagramCaptionChange('')
      result.current.handleInstagramHashtagsChange('')
      for (let index = 0; index < 3; index += 1) result.current.handleRemoveInstagramImage(0)
    })
    await rerender(makeProps(makeForm({ description: '<p>Updated source text.</p>' })))

    expect(result.current.editableInstagramCaption).toBe('')
    expect(result.current.editableInstagramHashtags).toBe('#metravelby')
    expect(result.current.editableInstagramImages).toEqual([])
  })

  it('updates generated defaults for untouched fields as the article and dictionary change', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    const next = makeProps(makeForm({
      description: '<p>Updated source text.</p>',
      gallery: [photo('c'), photo('d')],
    }), [{ country_id: '1', title_ru: 'Беларусь', title_en: 'Belarus' }])
    const generated = buildInstagramPublicationDraft(next)

    await rerender(next)
    expect(result.current.editableInstagramCaption).toBe(generated.caption)
    expect(result.current.editableInstagramHashtags).toBe(generated.hashtags.join(' '))
    expect(result.current.editableInstagramImages).toEqual(generated.imageUrls)
    expect(result.current.editableInstagramHashtags).toContain('#беларусь')
  })

  it('tracks caption and hashtag ownership independently', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => result.current.handleInstagramCaptionChange('My caption'))
    const next = makeProps(makeForm({ description: 'Second description' }), [
      { country_id: '1', title_ru: 'Беларусь', title_en: 'Belarus' },
    ])
    await rerender(next)
    expect(result.current.editableInstagramCaption).toBe('My caption')
    expect(result.current.editableInstagramHashtags).toBe(buildInstagramPublicationDraft(next).hashtags.join(' '))

    const tagsOnly = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => tagsOnly.result.current.handleInstagramHashtagsChange('#custom'))
    await tagsOnly.rerender(next)
    expect(tagsOnly.result.current.editableInstagramCaption).toBe('Second description')
    expect(tagsOnly.result.current.editableInstagramHashtags).toBe('#metravelby #custom')
  })

  it('reconciles true additions and source removals without undoing image order or exclusions', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => {
      result.current.handleMoveInstagramImage(2, -1)
      result.current.handleRemoveInstagramImage(0)
      result.current.handleInstagramDragStart(1)
    })
    await rerender(makeProps(makeForm({ gallery: [photo('b'), photo('a'), photo('d')] })))
    expect(result.current.editableInstagramImages).toEqual([photo('b'), photo('d')])
    expect(result.current.draggedInstagramImageIndex).toBeNull()

    await rerender(makeProps(makeForm({ gallery: [photo('d'), photo('b')] })))
    expect(result.current.editableInstagramImages).toEqual([photo('b'), photo('d')])
    await rerender(makeProps(makeForm({ gallery: [photo('a'), photo('d'), photo('b'), photo('e')] })))
    expect(result.current.editableInstagramImages).toEqual([photo('b'), photo('d'), photo('e')])
  })

  it('resets edits and drag state on switching records, and then keeps defaults live', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => {
      result.current.handleInstagramCaptionChange('Custom caption')
      result.current.handleInstagramHashtagsChange('#custom')
      result.current.handleRemoveInstagramImage(0)
      result.current.handleInstagramDragStart(0)
    })
    const other = makeProps(makeForm({ id: '842', description: 'Other article' }))
    const generated = buildInstagramPublicationDraft(other)
    await rerender(other)
    expect(result.current.editableInstagramCaption).toBe(generated.caption)
    expect(result.current.editableInstagramHashtags).toBe(generated.hashtags.join(' '))
    expect(result.current.editableInstagramImages).toEqual(generated.imageUrls)
    expect(result.current.draggedInstagramImageIndex).toBeNull()

    await rerender(makeProps(makeForm({ id: '842', description: 'Other article updated', gallery: [photo('d')] })))
    expect(result.current.editableInstagramCaption).toBe('Other article updated')
    expect(result.current.editableInstagramImages).toEqual([photo('d')])
    await rerender(makeProps(makeForm({ id: null, description: 'New article' })))
    expect(result.current.editableInstagramCaption).toBe('New article')
  })

  it.each([null, '', '0'])('preserves the current new draft when its ID %s is assigned on first save', async (id) => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps(makeForm({ id })) })
    await act(() => {
      result.current.handleInstagramCaptionChange('Unsaved draft caption')
      result.current.handleInstagramHashtagsChange('#draft')
      result.current.handleRemoveInstagramImage(0)
    })
    await rerender(makeProps())
    expect(result.current.editableInstagramCaption).toBe('Unsaved draft caption')
    expect(result.current.editableInstagramHashtags).toBe('#metravelby #draft')
    expect(result.current.editableInstagramImages).toEqual([photo('b'), photo('c')])

    await rerender(makeProps(makeForm({ id: '842' })))
    expect(result.current.editableInstagramImages).toEqual([photo('a'), photo('b'), photo('c')])
  })

  it('keeps caption length limits correct when hashtags and caption are edited in one batch', async () => {
    const { result } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => {
      result.current.handleInstagramHashtagsChange('#longcustomhashtag')
      result.current.handleInstagramCaptionChange('a'.repeat(INSTAGRAM_CAPTION_MAX_LENGTH))
    })
    expect(result.current.instagramFinalLength).toBe(INSTAGRAM_CAPTION_MAX_LENGTH)
    expect(result.current.isInstagramCaptionTooLong).toBe(false)
  })

  it('retains edited photos outside the regenerated first-ten window and caps true additions', async () => {
    const gallery = Array.from({ length: 12 }, (_, index) => photo(String(index)))
    const { result, rerender } = await renderHook(useInstagramPublishDraft, {
      initialProps: makeProps(makeForm({ gallery })),
    })
    await act(() => result.current.handleMoveInstagramImage(9, -1))
    const selected = [...result.current.editableInstagramImages]

    await rerender(makeProps(makeForm({ gallery: [...gallery.slice(1), gallery[0]] })))
    expect(result.current.editableInstagramImages).toEqual(selected)

    await rerender(makeProps(makeForm({ gallery: [photo('new'), ...gallery] })))
    expect(result.current.editableInstagramImages).toEqual(selected)
    expect(result.current.editableInstagramImages).toHaveLength(10)

    await act(() => result.current.handleRemoveInstagramImage(0))
    await rerender(makeProps(makeForm({ gallery: [photo('next'), photo('new'), ...gallery] })))
    expect(result.current.editableInstagramImages).toEqual([...selected.slice(1), photo('next')])
    expect(result.current.editableInstagramImages).toHaveLength(10)
  })

  it('budgets regenerated caption against the edited hashtags', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => result.current.handleInstagramHashtagsChange(`#${'custom'.repeat(20)}`))
    const tags = result.current.editableInstagramHashtags
    await rerender(makeProps(makeForm({ description: 'a'.repeat(INSTAGRAM_CAPTION_MAX_LENGTH) })))
    expect(result.current.editableInstagramHashtags).toBe(tags)
    expect(result.current.instagramFinalLength).toBe(INSTAGRAM_CAPTION_MAX_LENGTH)
    expect(result.current.isInstagramCaptionTooLong).toBe(false)
  })

  it('keeps edited caption intact while fitting regenerated tags into the remaining budget', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, { initialProps: makeProps() })
    await act(() => result.current.handleInstagramCaptionChange('a'.repeat(INSTAGRAM_CAPTION_MAX_LENGTH)))
    const caption = result.current.editableInstagramCaption
    await rerender(makeProps(makeForm(), [{ country_id: '1', title_ru: 'Оченьдлинноеназваниестраны' }]))
    expect(result.current.editableInstagramCaption).toBe(caption)
    expect(result.current.editableInstagramHashtags).toBe('#metravelby')
    expect(result.current.isInstagramCaptionTooLong).toBe(false)
  })

  it('keeps a caption generated even when editing hashtags shortens it', async () => {
    const { result, rerender } = await renderHook(useInstagramPublishDraft, {
      initialProps: makeProps(makeForm({ description: 'a'.repeat(INSTAGRAM_CAPTION_MAX_LENGTH) })),
    })
    const initialCaption = result.current.editableInstagramCaption
    await act(() => result.current.handleInstagramHashtagsChange(`#${'custom'.repeat(30)}`))
    const tags = result.current.editableInstagramHashtags
    expect(result.current.editableInstagramCaption.length).toBeLessThan(initialCaption.length)
    expect(result.current.isInstagramCaptionTooLong).toBe(false)

    await rerender(makeProps(makeForm({ description: 'Updated source caption after editing tags' })))
    expect(result.current.editableInstagramCaption).toBe('Updated source caption after editing tags')
    expect(result.current.editableInstagramHashtags).toBe(tags)
    expect(result.current.isInstagramCaptionTooLong).toBe(false)
  })
})
