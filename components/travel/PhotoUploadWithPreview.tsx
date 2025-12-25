import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ActivityIndicator, Pressable, View, Text } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import { useDropzone } from 'react-dropzone';
import { uploadImage } from '@/src/api/misc';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

interface PhotoUploadWithPreviewProps {
    collection: string;
    idTravel?: string | null;
    oldImage?: string | null;
    onUpload?: (imageUrl: string) => void;
    onPreviewChange?: (previewUrl: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
    maxSizeMB?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const normalizeImageUrl = (url?: string | null) => {
    if (!url || !url.trim()) return '';
    const safeUrl = url.trim();

    // Data/blob stay as-is
    if (/^(data:|blob:)/i.test(safeUrl)) return safeUrl;

    // Absolute URL → keep as-is
    if (/^https?:\/\//i.test(safeUrl)) {
        return safeUrl;
    }

    // Try API host first, then fall back to current origin (useful in admin where env may be empty)
    const baseRaw =
        process.env.EXPO_PUBLIC_API_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '');
    const hostWithoutApi = baseRaw.replace(/\/+$/, '').replace(/\/api$/i, '');
    const prefix = hostWithoutApi || baseRaw.replace(/\/+$/, '');

    if (prefix) {
        return `${prefix}${safeUrl.startsWith('/') ? '' : '/'}${safeUrl}`;
    }

    // As a last resort, return original (will error gracefully if invalid)
    return safeUrl;
};

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
    disabled = false,
    placeholder = 'Перетащите сюда изображение',
    maxSizeMB = 10,
}) => {
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
    const hasValidImage = Boolean(previewUrl || imageUri);
    const currentDisplayUrl = previewUrl ?? imageUri ?? '';

    const handleRemoveImage = useCallback(() => {
        setImageUri(null);
        setPreviewUrl(null);
        setFallbackImageUrl(null);
        setHasTriedFallback(false);
        setUploadMessage(null);
        setError(null);
        setIsManuallySelected(false);
        onPreviewChange?.(null);
        onUpload?.('');
    }, [onPreviewChange, onUpload]);

    // Синхронизация с oldImage
    useEffect(() => {
        console.info('PhotoUploadWithPreview: oldImage changed', { oldImage, isManuallySelected });
        if (!isManuallySelected) {
            if (oldImage && oldImage.trim()) {
                const normalized = normalizeImageUrl(oldImage);
                console.info('PhotoUploadWithPreview: normalized URL', normalized);
                if (normalized && normalized.length > 0) {
                    setImageUri(normalized);
                    setFallbackImageUrl(oldImage);
                    setHasTriedFallback(false);
                    setPreviewUrl(null);
                } else {
                    console.info('PhotoUploadWithPreview: normalized URL is empty, clearing image');
                    setImageUri(null);
                    setPreviewUrl(null);
                    setFallbackImageUrl(null);
                    setHasTriedFallback(false);
                }
            } else {
                console.info('PhotoUploadWithPreview: oldImage is empty, clearing image');
                setImageUri(null);
                setPreviewUrl(null);
                setFallbackImageUrl(null);
                setHasTriedFallback(false);
            }
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
        onPreviewChange?.(previewUrl || imageUri);
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
        return (
            <View style={styles.container}>
                <div
                    {...getRootProps()}
                    style={{
                        ...(styles.dropzone as any),
                        ...(isDragActive ? (styles.dropzoneActive as any) : {}),
                        ...(disabled ? (styles.dropzoneDisabled as any) : {}),
                    }}
                >
                    <input {...getInputProps()} />
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
                            {uploadProgress > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                                    <Text style={styles.progressText}>{uploadProgress}%</Text>
                                </View>
                            )}
                        </View>
                    ) : hasValidImage ? (
                        <View style={styles.previewContainer}>
                            <img
                                src={currentDisplayUrl}
                                alt="Предпросмотр"
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
                                        setHasTriedFallback(true);
                                        setImageUri(candidateFallback);
                                        setPreviewUrl(null);
                                        setError(null);
                                        return;
                                    }

                                    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
                                    if (apiCandidate) {
                                        setHasTriedFallback(true);
                                        setImageUri(apiCandidate);
                                        setPreviewUrl(null);
                                        setError(null);
                                        return;
                                    }

                                    setImageUri(null);
                                    setPreviewUrl(null);
                                    setError('Изображение не найдено');
                                }}
                                onError={(_e) => {
                                    const candidateFallback = chooseFallbackUrl(
                                        currentDisplayUrl,
                                        fallbackImageUrl,
                                        lastPreviewUrl,
                                        hasTriedFallback
                                    );
                                    console.error('Image load error:', currentDisplayUrl, 'fallback:', candidateFallback);
                                    if (candidateFallback) {
                                        setHasTriedFallback(true);
                                        setImageUri(candidateFallback);
                                        setPreviewUrl(null);
                                        setError(null);
                                        return;
                                    }

                                    const apiCandidate = buildApiPrefixedUrl(currentDisplayUrl);
                                    if (apiCandidate) {
                                        setHasTriedFallback(true);
                                        setImageUri(apiCandidate);
                                        setPreviewUrl(null);
                                        setError(null);
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
                                    style={styles.removeButton}
                                    onPress={handleRemoveImage}
                                    accessibilityLabel="Удалить изображение"
                                >
                                    <Feather name="x" size={18} color="#fff" />
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <FontAwesome name="cloud-upload" size={40} color={DESIGN_TOKENS.colors.primary} />
                            <Text style={styles.placeholderText}>{placeholder}</Text>
                            <Text style={styles.placeholderSubtext}>или нажмите для выбора файла</Text>
                            <Text style={styles.placeholderHint}>
                                Макс. размер: {maxSizeMB}MB
                            </Text>
                        </View>
                    )}
                </div>

                {error && !currentDisplayUrl && (
                    <View style={styles.errorContainer}>
                        <Feather name="alert-circle" size={14} color="#ef4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {uploadMessage && !error && (
                    <View style={styles.successContainer}>
                        <Feather name="check-circle" size={14} color="#10b981" />
                        <Text style={styles.successText}>{uploadMessage}</Text>
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
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <FontAwesome name="cloud-upload" size={16} color="#fff" />
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
                        fit="cover"
                        blurBackground={false}
                        loading="lazy"
                        priority="low"
                        style={styles.nativePreviewImage as any}
                    />
                    {!disabled && (
                        <Pressable style={styles.nativeRemoveButton} onPress={handleRemoveImage}>
                            <Feather name="trash-2" size={14} color="#ef4444" />
                            <Text style={styles.nativeRemoveText}>Удалить</Text>
                        </Pressable>
                    )}
                </View>
            ) : null}

            {error && (
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={14} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {uploadMessage && !error && (
                <View style={styles.successContainer}>
                    <Feather name="check-circle" size={14} color="#10b981" />
                    <Text style={styles.successText}>{uploadMessage}</Text>
                </View>
            )}
        </View>
    );
};

const styles: any = {
    container: {
        width: '100%',
    },
    dropzone: {
        border: `2px dashed ${DESIGN_TOKENS.colors.border}`,
        borderRadius: DESIGN_TOKENS.radii.md,
        padding: DESIGN_TOKENS.spacing.lg,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropzoneActive: {
        borderColor: DESIGN_TOKENS.colors.primary,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
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
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.pill,
        overflow: 'hidden',
        position: 'relative',
    },
    progressBar: {
        height: '100%',
        backgroundColor: DESIGN_TOKENS.colors.primary,
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
        color: DESIGN_TOKENS.colors.text,
    },
    previewContainer: {
        position: 'relative',
        width: '100%',
        height: 180,
        minHeight: 180,
        overflow: 'hidden',
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    previewImage: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
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
        color: DESIGN_TOKENS.colors.text,
        marginTop: DESIGN_TOKENS.spacing.sm,
    },
    placeholderSubtext: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    placeholderHint: {
        fontSize: 11,
        color: DESIGN_TOKENS.colors.textSubtle,
        marginTop: DESIGN_TOKENS.spacing.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: '#fef2f2',
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        flex: 1,
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: '#f0fdf4',
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    successText: {
        fontSize: 12,
        color: '#10b981',
        flex: 1,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        backgroundColor: DESIGN_TOKENS.colors.primary,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        minHeight: 44,
    },
    uploadButtonDisabled: {
        opacity: 0.5,
    },
    uploadButtonText: {
        color: DESIGN_TOKENS.colors.textInverse,
        fontSize: 14,
        fontWeight: '600',
    },
    nativePreviewContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
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
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderTopWidth: 1,
        borderTopColor: DESIGN_TOKENS.colors.border,
    },
    nativeRemoveText: {
        fontSize: 13,
        color: '#ef4444',
        fontWeight: '500',
    },
};

export default PhotoUploadWithPreview;
