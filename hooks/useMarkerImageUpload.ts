import { useCallback, useEffect, useRef } from 'react'
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

const revokePreviewUrl = (url: string): void => {
  if (!/^blob:/i.test(url)) return
  const revoke = (
    globalThis as { URL?: { revokeObjectURL?: (u: string) => void } }
  ).URL?.revokeObjectURL
  if (typeof revoke === 'function') revoke(url)
}

/**
 * Замер в браузере (Chrome, локальный стек, 06.09.2026): апдейт стейта из
 * промиса `uploadImage` коммитится примерно через 160 мс, а `requestAnimationFrame`
 * успевает выполниться раньше — в момент revoke в DOM ещё стоит `<img src="blob:…">`.
 * Ревокнутый blob отдаёт `net::ERR_FILE_NOT_FOUND`, `ImageCardMedia` сжигает на нём
 * обе попытки (первую и retry) и уходит в терминальный `failed`: миниатюра точки
 * остаётся пустой до перезагрузки страницы. Поэтому blob живёт ещё несколько секунд
 * после подмены источника — освобождение памяти не стоит потерянного превью.
 */
const PREVIEW_REVOKE_DELAY_MS = 15_000

const schedulePreviewRevoke = (url: string): void => {
  if (!/^blob:/i.test(url)) return
  setTimeout(() => revokePreviewUrl(url), PREVIEW_REVOKE_DELAY_MS)
}

const extractUploadUrl = (response: UploadImageResponse): string => {
  const nestedData = isRecord(response.data) ? response.data : null
  const uploadedUrlRaw =
    response.url ?? nestedData?.url ?? response.path ?? response.file_url
  return uploadedUrlRaw ? normalizeMediaUrl(String(uploadedUrlRaw)) : ''
}

/**
 * `applied` — источник точки уже заменён на серверный url;
 * `pending` — точки с таким id в форме пока нет (id ещё не приехал с бэка),
 * превью и файл нужно сохранить до следующей попытки;
 * `obsolete` — превью уже не показывается (пользователь удалил или заменил фото),
 * подменять нечего.
 */
type MarkerImageSwapResult = 'applied' | 'pending' | 'obsolete'

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
  const latestMarkerUploadRef = useRef(new Map<string, string>())
  // Загрузка уже прошла, а подмена источника в форме — ещё нет (точка успела
  // потерять id или картинку в стейте). Держим готовый URL, чтобы следующий
  // сейв доклеил его без повторной заливки того же файла на сервер.
  const resolvedUploadsRef = useRef(new Map<string, string>())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const applyUploadedMarkerImage = useCallback(
    (
      markerId: string,
      blobUrl: string,
      uploadedUrl: string,
    ): MarkerImageSwapResult => {
      if (!mountedRef.current) return 'obsolete'
      const currentMarkers = Array.isArray(formDataRef.current.coordsMeTravel)
        ? (formDataRef.current.coordsMeTravel as MarkerData[])
        : []
      const latestBlobUrl = latestMarkerUploadRef.current.get(markerId)
      if (latestBlobUrl && latestBlobUrl !== blobUrl) return 'obsolete'

      let didApplyUpload = false
      let didFindMarker = false
      const updatedMarkers = currentMarkers.map((marker) => {
        if (String(marker?.id ?? '') !== markerId) return marker
        didFindMarker = true
        const currentImage = String(marker?.image ?? '').trim()
        if (!currentImage) return marker
        if (isLocalPreviewUrl(currentImage) && currentImage !== blobUrl) {
          return marker
        }
        didApplyUpload = true
        return { ...marker, image: uploadedUrl }
      })
      if (!didApplyUpload) return didFindMarker ? 'obsolete' : 'pending'

      const nextFormData = {
        ...(formDataRef.current as TravelFormData),
        coordsMeTravel:
          updatedMarkers as unknown as TravelFormData['coordsMeTravel'],
      }

      formDataRef.current = nextFormData
      updateFormMarkers(updatedMarkers, nextFormData)
      updateBaseline(nextFormData)
      return 'applied'
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

          const normalizedMarkerId = String(markerId)
          const finishPreview = (uploadedUrl: string): void => {
            const swap = applyUploadedMarkerImage(
              normalizedMarkerId,
              imageUrl,
              uploadedUrl,
            )
            if (swap === 'pending') {
              // Точка ещё показывает blob-превью, а подменить его не в чем.
              // Ревок здесь оставил бы миниатюру с мёртвым источником, поэтому
              // файл и превью живут до следующей попытки — уже без повторной
              // заливки того же файла.
              resolvedUploadsRef.current.set(imageUrl, uploadedUrl)
              return
            }
            resolvedUploadsRef.current.delete(imageUrl)
            removePendingImageFile(imageUrl)
            schedulePreviewRevoke(imageUrl)
          }

          const resolvedUrl = resolvedUploadsRef.current.get(imageUrl)
          if (resolvedUrl) {
            finishPreview(resolvedUrl)
            return
          }

          latestMarkerUploadRef.current.set(normalizedMarkerId, imageUrl)
          markerUploadStateRef.current.set(imageUrl, {
            inFlight: true,
            attempts: state.attempts + 1,
          })

          let succeeded = false
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

            finishPreview(uploadedUrl)
            succeeded = true
          } catch {
            // Keep pending file for the next successful save/retry path.
          } finally {
            if (succeeded) {
              // Файл уже на сервере: повторная заливка не нужна. Если подмена
              // источника не прошла, следующий сейв доклеит её из
              // resolvedUploadsRef без сетевого запроса.
              markerUploadStateRef.current.delete(imageUrl)
            } else {
              markerUploadStateRef.current.set(imageUrl, {
                inFlight: false,
                attempts: state.attempts + 1,
              })
            }
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
