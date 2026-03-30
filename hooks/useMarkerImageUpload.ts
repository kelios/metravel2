import { useCallback, useRef } from 'react'
import { uploadImage } from '@/api/misc'
import { fetchTravel } from '@/api/travelsApi'
import { TravelFormData, MarkerData } from '@/types/types'
import {
  mergeMarkersPreserveImages,
  normalizeDraftPlaceholders,
  isLocalPreviewUrl,
} from '@/utils/travelFormNormalization'
import {
  transformTravelToFormData,
  normalizeTravelId,
} from '@/utils/travelFormUtils'
import { normalizeMediaUrl } from '@/utils/mediaUrl'
import { isRecord } from '@/utils/errorHelpers'
import {
  getPendingImageFile,
  removePendingImageFile,
} from '@/utils/pendingImageFiles'

type UploadImageResponse = Record<string, unknown> & {
  url?: unknown
  data?: Record<string, unknown>
  path?: unknown
  file_url?: unknown
}

const extractUploadUrl = (response: UploadImageResponse): string => {
  const nestedData = isRecord(response.data) ? response.data : null
  const uploadedUrlRaw =
    response.url ?? nestedData?.url ?? response.path ?? response.file_url
  return uploadedUrlRaw ? normalizeMediaUrl(String(uploadedUrlRaw)) : ''
}

interface UseMarkerImageUploadOptions {
  formDataRef: React.MutableRefObject<TravelFormData>
  updateFormMarkers: (markers: MarkerData[], formData: TravelFormData) => void
  updateBaseline: (data: TravelFormData) => void
}

export function useMarkerImageUpload({
  formDataRef,
  updateFormMarkers,
  updateBaseline,
}: UseMarkerImageUploadOptions) {
  const markerUploadStateRef = useRef(
    new Map<string, { inFlight: boolean; attempts: number }>(),
  )

  const applyUploadedMarkerImage = useCallback(
    (markerId: string, blobUrl: string, uploadedUrl: string) => {
      const currentMarkers = Array.isArray(formDataRef.current.coordsMeTravel)
        ? (formDataRef.current.coordsMeTravel as MarkerData[])
        : []

      const updatedMarkers = currentMarkers.map((marker) => {
        if (String(marker?.id ?? '') !== markerId) return marker
        if (String(marker?.image ?? '').trim() !== blobUrl) return marker
        return { ...marker, image: uploadedUrl }
      })

      const nextFormData = {
        ...(formDataRef.current as TravelFormData),
        coordsMeTravel:
          updatedMarkers as unknown as TravelFormData['coordsMeTravel'],
      }

      formDataRef.current = nextFormData
      updateFormMarkers(updatedMarkers, nextFormData)
      updateBaseline(nextFormData)
    },
    [formDataRef, updateFormMarkers, updateBaseline],
  )

  const rehydrateMarkerIdsFromServer = useCallback(
    async (
      travelIdValue: string | number | null | undefined,
      sourceMarkers: MarkerData[],
    ) => {
      const resolvedTravelId = normalizeTravelId(travelIdValue)
      if (resolvedTravelId == null) return null
      if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0)
        return null

      const needsMarkerIds = sourceMarkers.some((marker) => {
        const markerId = marker?.id
        const imageUrl =
          typeof marker?.image === 'string' ? marker.image.trim() : ''
        return (
          isLocalPreviewUrl(imageUrl) &&
          (markerId == null || String(markerId).trim() === '')
        )
      })
      if (!needsMarkerIds) return null

      try {
        const freshTravel = await fetchTravel(Number(resolvedTravelId))
        const transformed = normalizeDraftPlaceholders(
          transformTravelToFormData(freshTravel),
        )
        const serverMarkers = Array.isArray(transformed.coordsMeTravel)
          ? (transformed.coordsMeTravel as unknown as MarkerData[])
          : []
        if (serverMarkers.length === 0) return null

        const mergedMarkers = mergeMarkersPreserveImages(
          serverMarkers,
          sourceMarkers,
        ) as MarkerData[]
        const hasResolvedIds = mergedMarkers.some((marker) => {
          const imageUrl =
            typeof marker?.image === 'string' ? marker.image.trim() : ''
          return (
            isLocalPreviewUrl(imageUrl) &&
            marker?.id != null &&
            String(marker.id).trim() !== ''
          )
        })

        return hasResolvedIds ? mergedMarkers : null
      } catch {
        return null
      }
    },
    [],
  )

  const uploadPendingMarkerImages = useCallback(
    async (markersInput: unknown) => {
      if (!Array.isArray(markersInput) || markersInput.length === 0) return

      await Promise.all(
        markersInput.map(async (marker) => {
          const markerRecord =
            marker && typeof marker === 'object'
              ? (marker as Record<string, unknown>)
              : null
          const imageUrl =
            typeof markerRecord?.image === 'string'
              ? markerRecord.image.trim()
              : ''
          const markerId = markerRecord?.id
          if (!imageUrl || !/^(blob:)/i.test(imageUrl)) return
          if (markerId == null || String(markerId).trim() === '') return

          const state = markerUploadStateRef.current.get(imageUrl) ?? {
            inFlight: false,
            attempts: 0,
          }
          if (state.inFlight || state.attempts >= 3) return

          const file = getPendingImageFile(imageUrl)
          if (!file) return

          markerUploadStateRef.current.set(imageUrl, {
            inFlight: true,
            attempts: state.attempts + 1,
          })

          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('collection', 'travelImageAddress')
            formData.append('id', String(markerId))

            const response = (await uploadImage(formData)) as UploadImageResponse
            const uploadedUrl = extractUploadUrl(response)
            if (!uploadedUrl) {
              throw new Error('Upload did not return URL')
            }

            removePendingImageFile(imageUrl)
            applyUploadedMarkerImage(String(markerId), imageUrl, uploadedUrl)
          } catch {
            // Keep pending file for the next successful save/retry path.
          } finally {
            markerUploadStateRef.current.set(imageUrl, {
              inFlight: false,
              attempts: state.attempts + 1,
            })
          }
        }),
      )
    },
    [applyUploadedMarkerImage],
  )

  return {
    applyUploadedMarkerImage,
    rehydrateMarkerIdsFromServer,
    uploadPendingMarkerImages,
  }
}
