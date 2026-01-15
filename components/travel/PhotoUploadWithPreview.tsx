import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ActivityIndicator, Pressable, View, Text } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import { useDropzone } from 'react-dropzone';
import { uploadImage } from '@/src/api/misc';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

interface PhotoUploadWithPreviewProps {
    collection: string;
    idTravel?: string | null;
    oldImage?: string | null;
    onUpload?: (imageUrl: string) => void;
    onPreviewChange?: (previewUrl: string | null) => void;
    onRequestRemove?: () => void;
    disabled?: boolean;
    placeholder?: string;
    maxSizeMB?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const normalizeImageUrl = (url?: string | null) => normalizeMediaUrl(url);

const buildApiPrefixedUrl = (url: string): string | null => {
    try {
        const baseRaw =
            process.env.EXPO_PUBLIC_API_URL ||
            (typeof window !== 'undefined' ? window.location.origin : '');
        if (!/\/api\/?$/i.test(baseRaw)) return null;

        const parsed = new URL(url, baseRaw.replace(/\/api\/?$/, ''));
        if (parsed.pathname.startsWith('/api/')) return null;

        const apiOrigin = baseRaw.replace(/\/api\/?$/, '');
        return `${apiOrigin}/api${parsed.pathname}${parsed.search}`;
    } catch {
        return null;
    }
};

export const chooseFallbackUrl = (
    currentDisplayUrl: string,
    fallbackImageUrl: string | null,
    lastPreviewUrl: string | null,
    hasTriedFallback: boolean
) => {
    if (hasTriedFallback) return null;
    if (lastPreviewUrl && lastPreviewUrl !== currentDisplayUrl) return lastPreviewUrl;
    if (fallbackImageUrl && fallbackImageUrl !== currentDisplayUrl) return fallbackImageUrl;
    return null;
};

const PhotoUploadWithPreview: React.FC<PhotoUploadWithPreviewProps> = ({
    collection,
    idTravel,
    oldImage,
    onUpload,
    onPreviewChange,
    onRequestRemove,
    disabled = false,
    placeholder = 'Перетащите сюда изображение',
    maxSizeMB = 10,
}) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
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
    const lastNotifiedPreviewRef = useRef<string | null>(null);
    const pendingUploadRef = useRef<File | { uri: string; name: string; type: string } | null>(null);
    const hasValidImage = Boolean(previewUrl || imageUri);
    const currentDisplayUrl = previewUrl ?? imageUri ?? '';

    const applyFallback = useCallback((candidateFallback: string) => {
        setHasTriedFallback(true);
        setRemoteRetryAttempt(0);
        if (remoteRetryTimerRef.current) {
            clearTimeout(remoteRetryTimerRef.current);
            remoteRetryTimerRef.current = null;
        }

        // If fallback is a local preview (blob/data), treat it as a manual preview so that
        // oldImage sync effect does not overwrite it.
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
        setImageUri(null);
        setPreviewUrl(null);
        setFallbackImageUrl(null);
        setHasTriedFallback(false);
        setUploadMessage(null);
        setError(null);
        setIsManuallySelected(false);
        setRemoteRetryAttempt(0);
        pendingUploadRef.current = null;
        if (remoteRetryTimerRef.current) {
            clearTimeout(remoteRetryTimerRef.current);
            remoteRetryTimerRef.current = null;
        }
        onPreviewChange?.(null);
        onUpload?.('');
    }, [onPreviewChange, onUpload]);

    const uploadPendingIfPossible = useCallback(async () => {
        const normalizedId = (idTravel ?? '').toString();
        if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') return;
        if (!pendingUploadRef.current) return;
        if (loading) return;

        const file = pendingUploadRef.current;
        pendingUploadRef.current = null;

        try {
            setLoading(true);
            setError(null);
            setUploadMessage(null);

            const formData = new FormData();

            if (Platform.OS === 'web' && typeof File !== 'undefined' && file instanceof File) {
                formData.append('file', file);
            } else {
                const rnFile = file as { uri: string; name: string; type: string };
                formData.append('file', {
                    uri: rnFile.uri,
                    name: rnFile.name,
                    type: rnFile.type,
                } as any);
            }

            formData.append('collection', collection);
            formData.append('id', normalizedId);

            const response = await uploadImage(formData);
            const uploadedUrlRaw = response?.url || response?.data?.url || response?.path || response?.file_url;
            const uploadedUrl = uploadedUrlRaw ? normalizeImageUrl(uploadedUrlRaw) : null;

            if (uploadedUrl) {
                setImageUri(uploadedUrl);
                setPreviewUrl(null);
                setFallbackImageUrl(lastPreviewUrl || uploadedUrlRaw || uploadedUrl);
                setHasTriedFallback(false);
                setUploadMessage('Фотография успешно загружена');
                onUpload?.(uploadedUrl);
            }
        } catch (_e) {
            pendingUploadRef.current = file;
        } finally {
            setLoading(false);
        }
    }, [collection, idTravel, lastPreviewUrl, loading, onUpload]);

    useEffect(() => {
        void uploadPendingIfPossible();
    }, [uploadPendingIfPossible]);

    useEffect(() => {
        return () => {
            if (remoteRetryTimerRef.current) {
                clearTimeout(remoteRetryTimerRef.current);
                remoteRetryTimerRef.current = null;
            }
        };
    }, []);

    const scheduleRemoteRetry = useCallback((url: string) => {
        if (!url || /^(blob:|data:)/i.test(url)) return false;
        if (!/^https?:\/\//i.test(url)) return false;
        if (remoteRetryAttempt >= 6) return false;
        if (remoteRetryTimerRef.current) return true;

        const delays = [300, 600, 1200, 2000, 2500, 3000];
        const delayMs = delays[Math.min(remoteRetryAttempt, delays.length - 1)];

        remoteRetryTimerRef.current = setTimeout(() => {
            remoteRetryTimerRef.current = null;
            setRemoteRetryAttempt((prev) => prev + 1);

            const base = url.replace(/([?&])__retry=\d+(&)?/g, '$1').replace(/[?&]$/, '');
            const glue = base.includes('?') ? '&' : '?';
            // Keep remote URL but bust cache; backend conversions can appear with delay.
            setImageUri(`${base}${glue}__retry=${remoteRetryAttempt + 1}`);
            setPreviewUrl(null);
        }, delayMs);

        return true;
    }, [remoteRetryAttempt]);

    const handleRemovePress = useCallback(() => {
        if (disabled) return;
        if (onRequestRemove) {
            onRequestRemove();
            return;
        }
        handleRemoveImage();
    }, [disabled, handleRemoveImage, onRequestRemove]);

    // Синхронизация с oldImage
    // ✅ FIX: Используем ref для отслеживания предыдущего значения oldImage
    const prevOldImageRef = useRef<string | null | undefined>(undefined);
    
    useEffect(() => {
        // ✅ FIX: Пропускаем первый рендер если oldImage пустой (избегаем сброса превью)
        const isFirstRender = prevOldImageRef.current === undefined;
        const prevOldImage = prevOldImageRef.current;
        prevOldImageRef.current = oldImage;
        
        console.info('PhotoUploadWithPreview: oldImage changed', { oldImage, isManuallySelected, isFirstRender, prevOldImage });
        
        if (isManuallySelected) {
            return;
        }
        
        // ✅ FIX: Не сбрасываем превью если oldImage стал пустым после непустого значения
        // (это может произойти при переходах состояния формы)
        if (!oldImage || !oldImage.trim()) {
            // Только если это не первый рендер и раньше было значение - не сбрасываем
            if (!isFirstRender && prevOldImage && prevOldImage.trim()) {
                console.info('PhotoUploadWithPreview: oldImage became empty, keeping current state');
                return;
            }
            // Первый рендер с пустым oldImage - ничего не делаем
            if (isFirstRender) {
                console.info('PhotoUploadWithPreview: first render with empty oldImage, skipping');
                return;
            }
            console.info('PhotoUploadWithPreview: oldImage is empty, clearing image');
            setImageUri(null);
            setPreviewUrl(null);
            setFallbackImageUrl(null);
            setHasTriedFallback(false);
            return;
        }
        
        const normalized = normalizeImageUrl(oldImage);
        console.info('PhotoUploadWithPreview: normalized URL', normalized);
        if (normalized && normalized.length > 0) {
            setImageUri(normalized);
            setFallbackImageUrl(oldImage);
            setHasTriedFallback(false);
            setPreviewUrl(null);
        }
    }, [oldImage, isManuallySelected]);

    // Очистка ошибки при появлении изображения
    useEffect(() => {
        if (imageUri || previewUrl) {
            setError(null);
        }
    }, [imageUri, previewUrl]);

    // Уведомление родителя об изменении превью
    useEffect(() => {
        const nextValue = previewUrl || imageUri || null;

        if (lastNotifiedPreviewRef.current === nextValue) {
            return;
        }

        lastNotifiedPreviewRef.current = nextValue;
        onPreviewChange?.(nextValue);
    }, [previewUrl, imageUri, onPreviewChange]);

    const validateFile = useCallback((file: File | { uri: string; name: string; type: string; size?: number }): string | null => {
        const maxSize = maxSizeMB * 1024 * 1024;
        
        if (Platform.OS === 'web' && file instanceof File) {
            if (file.size > maxSize) {
                return `Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                return `Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WEBP`;
            }
        }
        return null;
    }, [maxSizeMB]);

    const handleUploadImage = async (file: File | { uri: string; name: string; type: string }) => {
        try {
            setError(null);
            setUploadMessage(null);
            setUploadProgress(0);
            setHasTriedFallback(false);

            // Валидация файла
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                setPreviewUrl(null);
                return;
            }

            // Создаем превью
            let previewCandidate: string;
            if (Platform.OS === 'web' && file instanceof File) {
                previewCandidate = URL.createObjectURL(file);
                console.info('Created blob URL:', previewCandidate);
            } else {
                previewCandidate = (file as { uri: string }).uri;
                console.info('Using file URI:', previewCandidate);
            }
            
            // Устанавливаем превью сразу
            setPreviewUrl(previewCandidate);
            setIsManuallySelected(true);
            setLastPreviewUrl(previewCandidate);

            // Если нет ID точки, показываем только превью без загрузки
            const normalizedId = (idTravel ?? '').toString();
            if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
                setUploadMessage('Превью готово. Сохраните точку для загрузки фото.');
                pendingUploadRef.current = file;
                
                // Отдаем локальный URL для временного хранения
                onUpload?.(previewCandidate);
                return;
            }

            setLoading(true);

            const formData = new FormData();

            if (Platform.OS === 'web' && file instanceof File) {
                formData.append('file', file);
            } else {
                const rnFile = file as { uri: string; name: string; type: string };
                formData.append('file', {
                    uri: rnFile.uri,
                    name: rnFile.name,
                    type: rnFile.type,
                } as any);
            }

            formData.append('collection', collection);
            formData.append('id', normalizedId);

            // Симуляция прогресса
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await uploadImage(formData);

            clearInterval(progressInterval);
            setUploadProgress(100);

            const uploadedUrlRaw = response?.url || response?.data?.url || response?.path || response?.file_url;
            const uploadedUrl = uploadedUrlRaw ? normalizeImageUrl(uploadedUrlRaw) : null;
            
            console.info('Upload response:', { uploadedUrlRaw, uploadedUrl });

            if (uploadedUrl) {
                // Успешная загрузка - показываем URL с сервера
                setImageUri(uploadedUrl);
                setPreviewUrl(null);
                setFallbackImageUrl(lastPreviewUrl || uploadedUrlRaw || uploadedUrl);
                setHasTriedFallback(false);
                setUploadMessage('Фотография успешно загружена');
                onUpload?.(uploadedUrl);
                setError(null);
            } else if (previewCandidate) {
                // Загрузка не удалась, но есть превью - оставляем его
                setImageUri(previewCandidate);
                setPreviewUrl(null);
                setUploadMessage('Превью сохранено. Попробуйте загрузить позже.');
                onUpload?.(previewCandidate);
                setFallbackImageUrl(null);
                setHasTriedFallback(false);
                setError(null);
            } else {
                setError('Ошибка при загрузке');
                setPreviewUrl(null);
            }
        } catch (error) {
            console.error('Ошибка при загрузке:', error);
            setError('Произошла ошибка при загрузке');
            setPreviewUrl(null);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const pickImageFromGallery = async () => {
        if (disabled) return;

        if (Platform.OS === 'web') {
            return; // На web используем dropzone
        }

        ImagePicker.launchImageLibrary(
            { mediaType: 'photo', quality: 0.8 },
            async (response) => {
                if (response.didCancel || response.errorCode) return;

                const asset = response.assets?.[0];
                if (!asset?.uri) return;

                await handleUploadImage({
                    uri: asset.uri,
                    name: asset.fileName || 'photo.jpg',
                    type: asset.type || 'image/jpeg',
                });
            }
        );
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: async (acceptedFiles, rejectedFiles) => {
            if (disabled) return;

            if (rejectedFiles.length > 0) {
                const rejection = rejectedFiles[0];
                if (rejection.errors.some(e => e.code === 'file-too-large')) {
                    setError(`Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`);
                } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
                    setError('Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WEBP');
                } else {
                    setError('Не удалось загрузить файл');
                }
                return;
            }

            const file = acceptedFiles[0];
            if (file) {
                console.info('File selected:', file.name, file.type, file.size);
                const validationError = validateFile(file);
                if (validationError) {
                    setError(validationError);
                    return;
                }

                setError(null);
                setUploadMessage(null);
                setUploadProgress(0);
                
                // Загружаем файл (превью создается внутри handleUploadImage)
                await handleUploadImage(file);
            }
        },
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif'] },
        maxSize: maxSizeMB * 1024 * 1024,
        multiple: false,
        disabled,
    });

    if (Platform.OS === 'web') {
        const { onBeforeInput, ...rootProps } = getRootProps();
        void onBeforeInput;
        return (
            <View style={styles.container as any}>
                <div
                    {...rootProps}
                    style={{
                        ...(styles.dropzone as any),
                        ...(isDragActive ? (styles.dropzoneActive as any) : {}),
                        ...(disabled ? (styles.dropzoneDisabled as any) : {}),
                    }}
                >
                    <input {...getInputProps()} />
                    {loading ? (
                        <View style={styles.loadingContainer as any}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            {uploadProgress > 0 && (
                                <View style={styles.progressContainer as any}>
                                    <View style={[styles.progressBar as any, { width: `${uploadProgress}%` } as any] as any} />
                                    <Text style={styles.progressText as any}>{uploadProgress}%</Text>
                                </View>
                            )}
                        </View>
                    ) : hasValidImage ? (
                        <View style={styles.previewContainer as any}>
                            <img
                                src={currentDisplayUrl}
                                alt=""
                                aria-hidden
                                referrerPolicy="no-referrer"
                                style={styles.previewBlur as any}
                            />
                            <img
                                src={currentDisplayUrl}
                                alt="Предпросмотр"
                                referrerPolicy="no-referrer"
                                style={styles.previewImage as any}
                                onLoad={(e) => {
                                    const imgEl = e.currentTarget as HTMLImageElement;
                                    const isDecoded = (imgEl?.naturalWidth ?? 0) > 0 && (imgEl?.naturalHeight ?? 0) > 0;
                                    console.info('Image loaded successfully:', currentDisplayUrl, {
                                        naturalWidth: imgEl?.naturalWidth,
                                        naturalHeight: imgEl?.naturalHeight,
                                        isDecoded,
                                    });

                                    if (isDecoded) return;

                                    const candidateFallback = chooseFallbackUrl(
                                        currentDisplayUrl,
                                        fallbackImageUrl,
                                        lastPreviewUrl,
                                        hasTriedFallback
                                    );
                                    console.error('Image decode failed:', currentDisplayUrl, 'fallback:', candidateFallback);
                                    if (candidateFallback) {
                                        applyFallback(candidateFallback);
                                        return;
                                    }

                                    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
                                    if (apiCandidate) {
                                        applyFallback(apiCandidate);
                                        return;
                                    }

                                    if (/^(blob:|data:)/i.test(currentDisplayUrl)) {
                                        // Blob/data previews can become invalid after unmount/navigation.
                                        // Clear them to avoid repeated ERR_FILE_NOT_FOUND spam.
                                        handleRemoveImage();
                                        return;
                                    }

                                    setImageUri(null);
                                    setPreviewUrl(null);
                                    setError('Изображение не найдено');
                                }}
                                onError={() => {
                                    // If this is a remote URL, retry for a short window (backend conversion may not be ready yet).
                                    if (scheduleRemoteRetry(currentDisplayUrl)) {
                                        return;
                                    }

                                    const candidateFallback = chooseFallbackUrl(
                                        currentDisplayUrl,
                                        fallbackImageUrl,
                                        lastPreviewUrl,
                                        hasTriedFallback
                                    );
                                    console.error('Image load error:', currentDisplayUrl, 'fallback:', candidateFallback);
                                    if (candidateFallback) {
                                        applyFallback(candidateFallback);
                                        return;
                                    }

                                    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
                                    if (apiCandidate) {
                                        applyFallback(apiCandidate);
                                        return;
                                    }

                                    if (/^(blob:|data:)/i.test(currentDisplayUrl)) {
                                        // Blob/data previews can become invalid after unmount/navigation.
                                        // Clear them to avoid repeated ERR_FILE_NOT_FOUND spam.
                                        handleRemoveImage();
                                        return;
                                    }
                                    // При повторной ошибке показываем placeholder
                                    setImageUri(null);
                                    setPreviewUrl(null);
                                    setError('Изображение не найдено');
                                }}
                            />
                            {!disabled && (
                                <Pressable
                                    style={styles.removeButton as any}
                                    onPress={handleRemovePress}
                                    accessibilityLabel="Удалить изображение"
                                >
                                    <Feather name="x" size={18} color={colors.textOnPrimary} />
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        <View style={styles.placeholderContainer as any}>
                            <Feather name="upload-cloud" size={40} color={colors.primary} />
                            <Text style={styles.placeholderText as any}>{placeholder}</Text>
                            <Text style={styles.placeholderSubtext as any}>или нажмите для выбора файла</Text>
                            <Text style={styles.placeholderHint as any}>
                                Макс. размер: {maxSizeMB}MB
                            </Text>
                        </View>
                    )}
                </div>

                {error && !currentDisplayUrl && (
                    <View style={styles.errorContainer as any}>
                        <Feather name="alert-circle" size={14} color={colors.danger} />
                        <Text style={styles.errorText as any}>{error}</Text>
                    </View>
                )}

                {uploadMessage && !error && (
                    <View style={styles.successContainer as any}>
                        <Feather name="check-circle" size={14} color={colors.success} />
                        <Text style={styles.successText as any}>{uploadMessage}</Text>
                    </View>
                )}
            </View>
        );
    }

    // Native (iOS/Android)
    return (
        <View style={styles.container}>
            <Pressable
                style={[styles.uploadButton, disabled && styles.uploadButtonDisabled]}
                onPress={pickImageFromGallery}
                disabled={loading || disabled}
            >
                {loading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                    <>
                        <Feather name="upload-cloud" size={16} color={colors.textOnPrimary} />
                        <Text style={styles.uploadButtonText}>
                            {currentDisplayUrl ? 'Заменить фото' : 'Загрузить фото'}
                        </Text>
                    </>
                )}
            </Pressable>

            {currentDisplayUrl ? (
                <View style={styles.nativePreviewContainer}>
                    <ImageCardMedia
                        src={currentDisplayUrl}
                        fit="contain"
                        blurBackground
                        loading="lazy"
                        priority="low"
                        style={styles.nativePreviewImage as any}
                    />
                    {!disabled && (
                        <Pressable style={styles.nativeRemoveButton} onPress={handleRemovePress}>
                            <Feather name="trash-2" size={14} color={colors.danger} />
                            <Text style={styles.nativeRemoveText}>Удалить</Text>
                        </Pressable>
                    )}
                </View>
            ) : null}

            {error && (
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {uploadMessage && !error && (
                <View style={styles.successContainer}>
                    <Feather name="check-circle" size={14} color={colors.success} />
                    <Text style={styles.successText}>{uploadMessage}</Text>
                </View>
            )}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>): any => ({
    container: {
        width: '100%',
    },
    dropzone: {
        border: `2px dashed ${colors.border}`,
        borderRadius: DESIGN_TOKENS.radii.md,
        padding: DESIGN_TOKENS.spacing.lg,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: colors.backgroundSecondary,
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropzoneActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    dropzoneDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.md,
    },
    progressContainer: {
        width: '100%',
        maxWidth: 200,
        height: 24,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.pill,
        overflow: 'hidden',
        position: 'relative',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
        transition: 'width 0.3s ease',
    },
    progressText: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: '600',
        color: colors.text,
    },
    previewContainer: {
        position: 'relative',
        width: '100%',
        height: 180,
        minHeight: 180,
        overflow: 'hidden',
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    previewBlur: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'blur(18px)',
        transform: 'scale(1.08)',
        pointerEvents: 'none',
    },
    previewImage: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        position: 'relative',
        zIndex: 1,
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: DESIGN_TOKENS.radii.pill,
        padding: 6,
        cursor: 'pointer',
    },
    placeholderContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    placeholderText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginTop: DESIGN_TOKENS.spacing.sm,
    },
    placeholderSubtext: {
        fontSize: 12,
        color: colors.textMuted,
    },
    placeholderHint: {
        fontSize: 11,
        color: colors.textTertiary,
        marginTop: DESIGN_TOKENS.spacing.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.dangerSoft,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: colors.dangerLight,
    },
    errorText: {
        fontSize: 12,
        color: colors.danger,
        flex: 1,
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.successSoft,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    successText: {
        fontSize: 12,
        color: colors.success,
        flex: 1,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        backgroundColor: colors.primary,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        minHeight: 44,
    },
    uploadButtonDisabled: {
        opacity: 0.5,
    },
    uploadButtonText: {
        color: colors.textOnPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    nativePreviewContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    nativePreviewImage: {
        width: '100%',
        height: 200,
        objectFit: 'contain',
    },
    nativeRemoveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    nativeRemoveText: {
        fontSize: 13,
        color: colors.danger,
        fontWeight: '500',
    },
});

export default PhotoUploadWithPreview;
