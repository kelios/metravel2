import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import type { TravelFormData } from '@/types/types'
import { normalizeTravelId } from '@/utils/travelFormUtils'
import {
  buildFinalInstagramText,
  buildInstagramPublicationDraft,
  clampInstagramCaption,
  getInstagramSourceImageUrls,
  INSTAGRAM_CAPTION_MAX_LENGTH,
  INSTAGRAM_HASHTAG_MAX_COUNT,
  INSTAGRAM_IMAGE_MAX_COUNT,
  parseInstagramHashtags,
  type InstagramPublicationDraft,
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

type EditableDraft = {
  recordId: number | null
  caption: string
  hashtags: string
  images: string[]
  sourceImages: string[]
  captionEdited: boolean
  hashtagsEdited: boolean
  imagesEdited: boolean
  removedImages: string[]
  draggedImageIndex: number | null
}

const createEditableDraft = (
  recordId: number | null,
  draft: InstagramPublicationDraft,
  sourceImages: string[],
): EditableDraft => ({
  recordId,
  caption: draft.caption,
  hashtags: draft.hashtags.join(' '),
  images: draft.imageUrls,
  sourceImages,
  captionEdited: false,
  hashtagsEdited: false,
  imagesEdited: false,
  removedImages: [],
  draggedImageIndex: null,
})

const sameImages = (first: string[], second: string[]) =>
  first.length === second.length && first.every((url, index) => url === second[index])

export function useInstagramPublishDraft({
  formData,
  countries,
}: UseInstagramPublishDraftArgs) {
  const instagramDraft = useMemo(
    () => buildInstagramPublicationDraft({ formData, countries }),
    [countries, formData]
  )
  const normalizedId = normalizeTravelId(formData.id)
  const recordId = normalizedId != null && normalizedId > 0 ? normalizedId : null
  const sourceImages = useMemo(() => getInstagramSourceImageUrls(formData.gallery), [formData.gallery])
  const [editableDraft, setEditableDraft] = useState(() => createEditableDraft(recordId, instagramDraft, sourceImages))
  const {
    caption: editableInstagramCaption,
    hashtags: editableInstagramHashtags,
    images: editableInstagramImages,
    draggedImageIndex: draggedInstagramImageIndex,
  } = editableDraft
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
    setEditableDraft((current) => {
      // The first save assigns an ID to the current new article.
      if (current.recordId !== recordId && current.recordId !== null) {
        return createEditableDraft(recordId, instagramDraft, sourceImages)
      }
      const generatedHashtags = [...instagramDraft.hashtags]
      if (current.captionEdited && !current.hashtagsEdited) {
        while (generatedHashtags.length > 1 &&
          buildFinalInstagramText(current.caption, generatedHashtags).length > INSTAGRAM_CAPTION_MAX_LENGTH) {
          generatedHashtags.pop()
        }
      }
      const hashtags = current.hashtagsEdited ? current.hashtags : generatedHashtags.join(' ')
      const caption = current.captionEdited ? current.caption
        : clampInstagramCaption(instagramDraft.caption, parseInstagramHashtags(hashtags))
      const sourceChanged = !sameImages(current.sourceImages, sourceImages)
      if (current.recordId === recordId && caption === current.caption && hashtags === current.hashtags && !sourceChanged) {
        return current
      }
      const images = !sourceChanged ? current.images : current.imagesEdited
        ? [
            ...current.images.filter((url) => sourceImages.includes(url)),
            ...sourceImages.filter((url) =>
              !current.sourceImages.includes(url) && !current.removedImages.includes(url)
            ),
          ].slice(0, INSTAGRAM_IMAGE_MAX_COUNT)
        : instagramDraft.imageUrls
      return {
        ...current,
        recordId,
        caption,
        hashtags,
        images,
        sourceImages,
        draggedImageIndex: sameImages(images, current.images) ? current.draggedImageIndex : null,
      }
    })
  }, [instagramDraft, recordId, sourceImages])

  const handleReorderInstagramImage = useCallback((fromIndex: number, toIndex: number) => {
    setEditableDraft((current) => {
      const currentImages = current.images
      if (fromIndex < 0 || fromIndex >= currentImages.length) return current
      if (toIndex < 0 || toIndex >= currentImages.length) return current
      if (fromIndex === toIndex) return current
      const nextImages = [...currentImages]
      const [movedImage] = nextImages.splice(fromIndex, 1)
      nextImages.splice(toIndex, 0, movedImage)
      return { ...current, images: nextImages, imagesEdited: true }
    })
  }, [])

  const handleMoveInstagramImage = useCallback((index: number, direction: -1 | 1) => {
    handleReorderInstagramImage(index, index + direction)
  }, [handleReorderInstagramImage])

  const handleRemoveInstagramImage = useCallback((index: number) => {
    setEditableDraft((current) => {
      const removedImage = current.images[index]
      if (!removedImage) return current
      const draggedIndex = current.draggedImageIndex
      return {
        ...current,
        images: current.images.filter((_, currentIndex) => currentIndex !== index),
        imagesEdited: true,
        removedImages: [...current.removedImages, removedImage],
        draggedImageIndex: draggedIndex == null || draggedIndex === index ? null
          : draggedIndex > index ? draggedIndex - 1 : draggedIndex,
      }
    })
  }, [])

  const handleInstagramDragStart = useCallback((index: number) => {
    if (Platform.OS !== 'web') return
    setEditableDraft((current) => ({ ...current, draggedImageIndex: index }))
  }, [])

  const handleInstagramDrop = useCallback((targetIndex: number) => {
    if (Platform.OS !== 'web') return
    if (draggedInstagramImageIndex == null) return
    handleReorderInstagramImage(draggedInstagramImageIndex, targetIndex)
    setEditableDraft((current) => ({ ...current, draggedImageIndex: null }))
  }, [draggedInstagramImageIndex, handleReorderInstagramImage])

  const handleInstagramDragEnd = useCallback(() => {
    if (Platform.OS !== 'web') return
    setEditableDraft((current) => ({ ...current, draggedImageIndex: null }))
  }, [])

  const handleInstagramCaptionChange = useCallback((nextValue: string) => {
    setEditableDraft((current) => ({
      ...current,
      caption: clampInstagramCaption(nextValue, parseInstagramHashtags(current.hashtags)),
      captionEdited: true,
    }))
  }, [])

  const handleInstagramHashtagsChange = useCallback((nextValue: string) => {
    const normalizedHashtags = parseInstagramHashtags(nextValue)
    setEditableDraft((current) => {
      const caption = clampInstagramCaption(current.caption, normalizedHashtags)
      return {
        ...current,
        hashtags: normalizedHashtags.join(' '),
        hashtagsEdited: true,
        caption,
      }
    })
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
