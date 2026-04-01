import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import type { TravelFormData } from '@/types/types'
import {
  buildFinalInstagramText,
  buildInstagramPublicationDraft,
  clampInstagramCaption,
  INSTAGRAM_CAPTION_MAX_LENGTH,
  INSTAGRAM_HASHTAG_MAX_COUNT,
  parseInstagramHashtags,
} from '@/utils/instagramPublish'

type CountryOption = {
  country_id: string
  title_ru: string
  title_en?: string
  title?: string
  name?: string
}

type UseInstagramPublishDraftArgs = {
  formData: TravelFormData
  countries: CountryOption[]
}

export function useInstagramPublishDraft({
  formData,
  countries,
}: UseInstagramPublishDraftArgs) {
  const [editableInstagramCaption, setEditableInstagramCaption] = useState('')
  const [editableInstagramHashtags, setEditableInstagramHashtags] = useState('')
  const [editableInstagramImages, setEditableInstagramImages] = useState<string[]>([])
  const [draggedInstagramImageIndex, setDraggedInstagramImageIndex] = useState<number | null>(null)

  const instagramDraft = useMemo(
    () => buildInstagramPublicationDraft({ formData, countries }),
    [countries, formData]
  )
  const instagramDraftHashtagsText = useMemo(
    () => instagramDraft.hashtags.join(' '),
    [instagramDraft.hashtags]
  )
  const instagramDraftImagesKey = useMemo(
    () => instagramDraft.imageUrls.join('|'),
    [instagramDraft.imageUrls]
  )
  const parsedInstagramHashtags = useMemo(
    () => parseInstagramHashtags(editableInstagramHashtags),
    [editableInstagramHashtags]
  )
  const finalInstagramText = useMemo(
    () => buildFinalInstagramText(editableInstagramCaption, parsedInstagramHashtags),
    [editableInstagramCaption, parsedInstagramHashtags]
  )

  const instagramCaptionLength = editableInstagramCaption.length
  const instagramHashtagCount = parsedInstagramHashtags.length
  const instagramFinalLength = finalInstagramText.length
  const isInstagramCaptionTooLong = instagramFinalLength > INSTAGRAM_CAPTION_MAX_LENGTH
  const isInstagramHashtagCountTooHigh = instagramHashtagCount > INSTAGRAM_HASHTAG_MAX_COUNT

  useEffect(() => {
    setEditableInstagramCaption((currentValue) =>
      currentValue === instagramDraft.caption ? currentValue : instagramDraft.caption
    )
    setEditableInstagramHashtags((currentValue) =>
      currentValue === instagramDraftHashtagsText ? currentValue : instagramDraftHashtagsText
    )
    setEditableInstagramImages((currentValue) =>
      currentValue.join('|') === instagramDraftImagesKey ? currentValue : instagramDraft.imageUrls
    )
  }, [instagramDraft.caption, instagramDraftHashtagsText, instagramDraftImagesKey, instagramDraft.imageUrls])

  const handleReorderInstagramImage = useCallback((fromIndex: number, toIndex: number) => {
    setEditableInstagramImages((currentImages) => {
      if (fromIndex < 0 || fromIndex >= currentImages.length) return currentImages
      if (toIndex < 0 || toIndex >= currentImages.length) return currentImages
      if (fromIndex === toIndex) return currentImages
      const nextImages = [...currentImages]
      const [movedImage] = nextImages.splice(fromIndex, 1)
      nextImages.splice(toIndex, 0, movedImage)
      return nextImages
    })
  }, [])

  const handleMoveInstagramImage = useCallback((index: number, direction: -1 | 1) => {
    handleReorderInstagramImage(index, index + direction)
  }, [handleReorderInstagramImage])

  const handleRemoveInstagramImage = useCallback((index: number) => {
    setEditableInstagramImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index))
    setDraggedInstagramImageIndex((currentIndex) => {
      if (currentIndex == null) return currentIndex
      if (currentIndex === index) return null
      if (currentIndex > index) return currentIndex - 1
      return currentIndex
    })
  }, [])

  const handleInstagramDragStart = useCallback((index: number) => {
    if (Platform.OS !== 'web') return
    setDraggedInstagramImageIndex(index)
  }, [])

  const handleInstagramDrop = useCallback((targetIndex: number) => {
    if (Platform.OS !== 'web') return
    if (draggedInstagramImageIndex == null) return
    handleReorderInstagramImage(draggedInstagramImageIndex, targetIndex)
    setDraggedInstagramImageIndex(null)
  }, [draggedInstagramImageIndex, handleReorderInstagramImage])

  const handleInstagramDragEnd = useCallback(() => {
    if (Platform.OS !== 'web') return
    setDraggedInstagramImageIndex(null)
  }, [])

  const handleInstagramCaptionChange = useCallback((nextValue: string) => {
    setEditableInstagramCaption(clampInstagramCaption(nextValue, parsedInstagramHashtags))
  }, [parsedInstagramHashtags])

  const handleInstagramHashtagsChange = useCallback((nextValue: string) => {
    const normalizedHashtags = parseInstagramHashtags(nextValue)
    setEditableInstagramHashtags(normalizedHashtags.join(' '))
    setEditableInstagramCaption((currentCaption) => clampInstagramCaption(currentCaption, normalizedHashtags))
  }, [])

  return {
    editableInstagramCaption,
    editableInstagramHashtags,
    editableInstagramImages,
    draggedInstagramImageIndex,
    finalInstagramText,
    instagramCaptionLength,
    instagramHashtagCount,
    instagramFinalLength,
    isInstagramCaptionTooLong,
    isInstagramHashtagCountTooHigh,
    handleMoveInstagramImage,
    handleRemoveInstagramImage,
    handleInstagramDragStart,
    handleInstagramDrop,
    handleInstagramDragEnd,
    handleInstagramCaptionChange,
    handleInstagramHashtagsChange,
  }
}
