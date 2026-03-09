// hooks/usePhotoUpload.ts
// E5: Upload state + logic extracted from PhotoUploadWithPreview.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { uploadImage } from '@/api/misc';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const normalizeImageUrl = (url?: string | null) => normalizeMediaUrl(url);

const buildApiPrefixedUrl = (url: string): string | null => {
  try {
    const baseRaw = process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!/\/api\/?$/i.test(baseRaw)) return null;
    const parsed = new URL(url, baseRaw.replace(/\/api\/?$/, ''));
    if (parsed.pathname.startsWith('/api/')) return null;
    const apiOrigin = baseRaw.replace(/\/api\/?$/, '');
    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`;
  } catch { return null; }
};

export const chooseFallbackUrl = (
  currentDisplayUrl: string, fallbackImageUrl: string | null,
  lastPreviewUrl: string | null, hasTriedFallback: boolean
) => {
  if (hasTriedFallback) return null;
  if (lastPreviewUrl && lastPreviewUrl !== currentDisplayUrl) return lastPreviewUrl;
  if (fallbackImageUrl && fallbackImageUrl !== currentDisplayUrl) return fallbackImageUrl;
  return null;
};

export interface UsePhotoUploadOptions {
  collection: string;
  idTravel?: string | null;
  oldImage?: string | null;
  onUpload?: (imageUrl: string) => void;
  onPreviewChange?: (previewUrl: string | null) => void;
  onRequestRemove?: () => void;
  disabled?: boolean;
  maxSizeMB?: number;
}

export function usePhotoUpload(opts: UsePhotoUploadOptions) {
  const { collection, idTravel, oldImage, onUpload, onPreviewChange, onRequestRemove, disabled = false, maxSizeMB = 10 } = opts;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isManuallySelected, setIsManuallySelected] = useState(false);
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [remoteRetryAttempt, setRemoteRetryAttempt] = useState(0);

  const remoteRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoredOldImageRef = useRef<string | null>(null);
  const lastNotifiedPreviewRef = useRef<string | null>(null);
  const pendingUploadRef = useRef<File | { uri: string; name: string; type: string } | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOldImageRef = useRef<string | null | undefined>(undefined);

  const hasValidImage = Boolean(previewUrl || imageUri);
  const currentDisplayUrl = previewUrl ?? imageUri ?? '';

  // --- Internal helpers ---

  const applyFallback = useCallback((candidateFallback: string) => {
    setHasTriedFallback(true);
    setRemoteRetryAttempt(0);
    if (remoteRetryTimerRef.current) { clearTimeout(remoteRetryTimerRef.current); remoteRetryTimerRef.current = null; }

    if (/^(blob:|data:)/i.test(candidateFallback)) {
      setIsManuallySelected(true);
      setLastPreviewUrl(candidateFallback);
      setPreviewUrl(candidateFallback);
      setImageUri(null);
      setFallbackImageUrl(null);
    } else {
      setImageUri(candidateFallback);
      setPreviewUrl(null);
    }
    setError(null);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageUri(null); setPreviewUrl(null); setFallbackImageUrl(null);
    setHasTriedFallback(false); setUploadMessage(null); setError(null);
    setIsManuallySelected(false); setRemoteRetryAttempt(0);
    pendingUploadRef.current = null;
    if (remoteRetryTimerRef.current) { clearTimeout(remoteRetryTimerRef.current); remoteRetryTimerRef.current = null; }
    onPreviewChange?.(null);
    onUpload?.('');
  }, [onPreviewChange, onUpload]);

  const uploadPendingIfPossible = useCallback(async () => {
    const normalizedId = (idTravel ?? '').toString();
    if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') return;
    if (!pendingUploadRef.current || loading) return;

    const file = pendingUploadRef.current;
    pendingUploadRef.current = null;

    try {
      setLoading(true); setError(null); setUploadMessage(null);
      const formData = new FormData();
      if (Platform.OS === 'web' && typeof File !== 'undefined' && file instanceof File) {
        formData.append('file', file);
      } else {
        const rnFile = file as { uri: string; name: string; type: string };
        formData.append('file', { uri: rnFile.uri, name: rnFile.name, type: rnFile.type } as unknown as Blob);
      }
      formData.append('collection', collection);
      formData.append('id', normalizedId);

      const response = await uploadImage(formData) as Record<string, unknown> & { data?: Record<string, unknown> };
      const uploadedUrlRaw = (response?.url || response?.data?.url || response?.path || response?.file_url) as string | undefined;
      const uploadedUrl = uploadedUrlRaw ? normalizeImageUrl(uploadedUrlRaw) : null;

      if (uploadedUrl) {
        setImageUri(uploadedUrl); setPreviewUrl(null);
        setFallbackImageUrl(lastPreviewUrl || uploadedUrlRaw || uploadedUrl);
        setHasTriedFallback(false);
        setUploadMessage('Фотография успешно загружена');
        onUpload?.(uploadedUrl);
      }
    } catch {
      pendingUploadRef.current = file;
    } finally {
      setLoading(false);
    }
  }, [collection, idTravel, lastPreviewUrl, loading, onUpload]);

  // Auto-upload pending
  useEffect(() => { void uploadPendingIfPossible(); }, [uploadPendingIfPossible]);

  // Cleanup on unmount
  useEffect(() => {
    const currentBlobUrls = blobUrlsRef.current;
    return () => {
      if (remoteRetryTimerRef.current) { clearTimeout(remoteRetryTimerRef.current); remoteRetryTimerRef.current = null; }
      if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
      currentBlobUrls.forEach((url: string) => { try { URL.revokeObjectURL(url); } catch { /* noop */ } });
      currentBlobUrls.clear();
    };
  }, []);

  const scheduleRemoteRetry = useCallback((url: string) => {
    if (!url || /^(blob:|data:)/i.test(url) || !/^https?:\/\//i.test(url)) return false;
    if (remoteRetryAttempt >= 6 || remoteRetryTimerRef.current) return remoteRetryTimerRef.current !== null;
    const delays = [300, 600, 1200, 2000, 2500, 3000];
    const delayMs = delays[Math.min(remoteRetryAttempt, delays.length - 1)];
    remoteRetryTimerRef.current = setTimeout(() => {
      remoteRetryTimerRef.current = null;
      setRemoteRetryAttempt((prev) => prev + 1);
      const base = url.replace(/([?&])__retry=\d+(&)?/g, '$1').replace(/[?&]$/, '');
      const glue = base.includes('?') ? '&' : '?';
      setImageUri(`${base}${glue}__retry=${remoteRetryAttempt + 1}`);
      setPreviewUrl(null);
    }, delayMs);
    return true;
  }, [remoteRetryAttempt]);

  const handleRemovePress = useCallback(() => {
    if (disabled) return;
    if (onRequestRemove) { onRequestRemove(); return; }
    handleRemoveImage();
  }, [disabled, handleRemoveImage, onRequestRemove]);

  // Sync with oldImage
  useEffect(() => {
    const isFirstRender = prevOldImageRef.current === undefined;
    prevOldImageRef.current = oldImage;
    if (isManuallySelected) return;
    if (oldImage && ignoredOldImageRef.current && oldImage === ignoredOldImageRef.current && /^(blob:|data:)/i.test(oldImage)) return;
    if (!oldImage || !oldImage.trim()) {
      if (isFirstRender) return;
      setImageUri(null); setPreviewUrl(null); setFallbackImageUrl(null); setHasTriedFallback(false);
      return;
    }
    const normalized = normalizeImageUrl(oldImage);
    if (normalized && normalized.length > 0) {
      setImageUri(normalized); setFallbackImageUrl(oldImage); setHasTriedFallback(false); setPreviewUrl(null);
    }
  }, [oldImage, isManuallySelected]);

  // Clear error when image appears
  useEffect(() => { if (imageUri || previewUrl) setError(null); }, [imageUri, previewUrl]);

  // Notify parent of preview changes
  useEffect(() => {
    const nextValue = previewUrl || imageUri || null;
    if (lastNotifiedPreviewRef.current === nextValue) return;
    lastNotifiedPreviewRef.current = nextValue;
    onPreviewChange?.(nextValue);
  }, [previewUrl, imageUri, onPreviewChange]);

  const validateFile = useCallback((file: File | { uri: string; name: string; type: string; size?: number }): string | null => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (Platform.OS === 'web' && file instanceof File) {
      if (file.size > maxSize) return `Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`;
      if (!ALLOWED_TYPES.includes(file.type)) return `Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WEBP`;
    }
    return null;
  }, [maxSizeMB]);

  const handleUploadImage = useCallback(async (file: File | { uri: string; name: string; type: string }) => {
    try {
      setError(null); setUploadMessage(null); setUploadProgress(0); setHasTriedFallback(false);
      const validationError = validateFile(file);
      if (validationError) { setError(validationError); setPreviewUrl(null); return; }

      let previewCandidate: string;
      if (Platform.OS === 'web' && file instanceof File) {
        previewCandidate = URL.createObjectURL(file);
        blobUrlsRef.current.add(previewCandidate);
      } else {
        previewCandidate = (file as { uri: string }).uri;
      }
      setPreviewUrl(previewCandidate); setIsManuallySelected(true); setLastPreviewUrl(previewCandidate);

      const normalizedId = (idTravel ?? '').toString();
      if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
        setUploadMessage('Превью готово. Сохраните точку для загрузки фото.');
        pendingUploadRef.current = file;
        onUpload?.(previewCandidate);
        return;
      }

      setLoading(true);
      const formData = new FormData();
      if (Platform.OS === 'web' && file instanceof File) {
        formData.append('file', file);
      } else {
        const rnFile = file as { uri: string; name: string; type: string };
        formData.append('file', { uri: rnFile.uri, name: rnFile.name, type: rnFile.type } as unknown as Blob);
      }
      formData.append('collection', collection);
      formData.append('id', normalizedId);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; } return 90; }
          return prev + 10;
        });
      }, 200);

      const response = await uploadImage(formData) as Record<string, unknown> & { data?: Record<string, unknown> };
      if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
      setUploadProgress(100);

      const uploadedUrlRaw = (response?.url || response?.data?.url || response?.path || response?.file_url) as string | undefined;
      const uploadedUrl = uploadedUrlRaw ? normalizeImageUrl(uploadedUrlRaw) : null;

      if (uploadedUrl) {
        setImageUri(uploadedUrl); setPreviewUrl(null);
        setFallbackImageUrl(lastPreviewUrl || uploadedUrlRaw || uploadedUrl);
        setHasTriedFallback(false);
        setUploadMessage('Фотография успешно загружена');
        onUpload?.(uploadedUrl); setError(null);
      } else if (previewCandidate) {
        setImageUri(previewCandidate); setPreviewUrl(null);
        setUploadMessage('Превью сохранено. Попробуйте загрузить позже.');
        onUpload?.(previewCandidate); setFallbackImageUrl(null); setHasTriedFallback(false); setError(null);
      } else {
        setError('Ошибка при загрузке'); setPreviewUrl(null);
      }
    } catch (err) {
      console.error('Ошибка при загрузке:', err);
      setError('Произошла ошибка при загрузке'); setPreviewUrl(null);
    } finally {
      setLoading(false); setUploadProgress(0);
    }
  }, [collection, idTravel, lastPreviewUrl, onUpload, validateFile]);

  // Image error/load handlers for web
  const handleImageLoadCheck = useCallback((imgEl: HTMLImageElement) => {
    const isDecoded = (imgEl?.naturalWidth ?? 0) > 0 && (imgEl?.naturalHeight ?? 0) > 0;
    if (isDecoded) return;
    const candidateFallback = chooseFallbackUrl(currentDisplayUrl, fallbackImageUrl, lastPreviewUrl, hasTriedFallback);
    if (candidateFallback) { applyFallback(candidateFallback); return; }
    if (/^(blob:|data:)/i.test(currentDisplayUrl)) { ignoredOldImageRef.current = currentDisplayUrl; handleRemoveImage(); return; }
    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
    if (apiCandidate) { applyFallback(apiCandidate); return; }
    setImageUri(null); setPreviewUrl(null); setError('Изображение не найдено');
  }, [currentDisplayUrl, fallbackImageUrl, lastPreviewUrl, hasTriedFallback, applyFallback, handleRemoveImage]);

  const handleImageError = useCallback(() => {
    if (scheduleRemoteRetry(currentDisplayUrl)) return;
    const candidateFallback = chooseFallbackUrl(currentDisplayUrl, fallbackImageUrl, lastPreviewUrl, hasTriedFallback);
    if (candidateFallback) { applyFallback(candidateFallback); return; }
    if (/^(blob:|data:)/i.test(currentDisplayUrl)) { ignoredOldImageRef.current = currentDisplayUrl; handleRemoveImage(); return; }
    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
    if (apiCandidate) { applyFallback(apiCandidate); return; }
    setImageUri(null); setPreviewUrl(null); setError('Изображение не найдено');
  }, [currentDisplayUrl, fallbackImageUrl, lastPreviewUrl, hasTriedFallback, applyFallback, handleRemoveImage, scheduleRemoteRetry]);

  return {
    imageUri, previewUrl, loading, uploadProgress, error, uploadMessage,
    hasValidImage, currentDisplayUrl, fallbackImageUrl, lastPreviewUrl, hasTriedFallback,
    handleUploadImage, handleRemovePress, validateFile,
    handleImageLoadCheck, handleImageError, applyFallback,
    blobUrlsRef,
  };
}
