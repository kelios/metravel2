import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useDropzone } from 'react-dropzone';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadImage, deleteImage } from '@/src/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

const API_BASE_URL: string =
    process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');

const safeEncodeUrl = (value: string): string => {
    try {
        // Avoid double-encoding: decode first, then encode
        return encodeURI(decodeURI(value));
    } catch {
        return encodeURI(value);
    }
};

const isBackendImageId = (value: string | null | undefined): boolean => {
    if (!value) return false;
    return /^\d+$/.test(String(value));
};

const canonicalizeUrlForDedupe = (value: string): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return raw;

    // Blob/data URLs are unique per upload and should not be normalized.
    if (/^(blob:|data:)/i.test(raw)) return raw;

    // Remove transient cache-busting params that can change across renders/retries.
    try {
        const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.test');
        parsed.searchParams.delete('__retry');
        parsed.hash = '';

        // For http(s) URLs, drop the origin to prevent duplicates between
        // absolute vs relative and localhost vs 127.0.0.1 representations.
        if (/^https?:$/i.test(parsed.protocol)) {
            const search = parsed.searchParams.toString();
            return `${parsed.pathname}${search ? `?${search}` : ''}`;
        }

        return parsed.toString();
    } catch {
        return raw.replace(/([?&])__retry=\d+(&)?/g, '$1').replace(/[?&]$/, '').split('#')[0];
    }
};

const dedupeGalleryItems = (items: GalleryItem[]): GalleryItem[] => {
    const map = new Map<string, GalleryItem>();
    const order: string[] = [];

    for (const item of items) {
        // Primary key: canonical URL.
        // This collapses:
        // - placeholder blob preview + final backend URL
        // - legacy items + backend items
        // - backend responses that return different ids but the same URL
        // If URL is missing, fall back to id.
        const canonicalUrl = canonicalizeUrlForDedupe(String(item.url || ''));
        const key = canonicalUrl ? `url:${canonicalUrl}` : `id:${String(item.id ?? '')}`;

        const existing = map.get(key);
        if (!existing) {
            map.set(key, item);
            order.push(key);
            continue;
        }

        // Prefer the more "final" item over placeholders, and prefer backend-id items over legacy.
        const existingBackend = isBackendImageId(existing.id);
        const nextBackend = isBackendImageId(item.id);
        if (!existingBackend && nextBackend) {
            map.set(key, item);
            continue;
        }

        const existingUploading = Boolean(existing.isUploading);
        const nextUploading = Boolean(item.isUploading);
        if (existingUploading && !nextUploading) {
            map.set(key, item);
        }
    }

    const snapshot = order.map((k) => map.get(k)!).filter(Boolean);

    // Safety net: if the same backend id appears multiple times (e.g. URL variations), keep the first.
    const seenBackendIds = new Set<string>();
    return snapshot.filter((item) => {
        if (!isBackendImageId(item.id)) return true;
        const id = String(item.id);
        if (seenBackendIds.has(id)) return false;
        seenBackendIds.add(id);
        return true;
    });
};

const ensureAbsoluteUrl = (value: string): string => {
    if (!value) return value;

    // Already absolute
    try {
        return safeEncodeUrl(new URL(value).toString());
    } catch {
        // continue to relative handling
    }

    const base =
        API_BASE_URL?.replace(/\/api\/?$/, '') ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);
    if (!base) return value;

    try {
        return safeEncodeUrl(new URL(value, base).toString());
    } catch {
        return value;
    }
};

const buildApiPrefixedUrl = (value: string): string | null => {
    try {
        const baseRaw =
            process.env.EXPO_PUBLIC_API_URL ||
            (typeof window !== 'undefined' ? window.location.origin : '');
        if (!/\/api\/?$/i.test(baseRaw)) return null;

        const apiOrigin = baseRaw.replace(/\/api\/?$/, '');
        const parsed = new URL(value, apiOrigin);
        if (parsed.pathname.startsWith('/api/')) return null;

        return `${apiOrigin}/api${parsed.pathname}${parsed.search}`;
    } catch {
        return null;
    }
};

const normalizeDisplayUrl = (value: string): string => {
    const absolute = ensureAbsoluteUrl(value);
    if (typeof window === 'undefined') return absolute;

    try {
        const parsed = new URL(absolute);
        const currentOrigin = window.location.origin;
        
        // ✅ Для URL с приватным IP - извлекаем путь для проксирования через localhost
        const isPrivateIp = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(absolute);
        const isOnLocalhost = /localhost|127\.0\.0\.1/i.test(currentOrigin);
        
        if (isPrivateIp && isOnLocalhost) {
            // In dev we often run the app on localhost while the backend is on a private IP.
            // Some backends expose media only via http; keep the absolute URL and force http
            // to avoid ERR_CONNECTION_REFUSED on https.
            if (parsed.protocol === 'https:') {
                parsed.protocol = 'http:';
            }
            return parsed.toString();
        }
        
        // Если страница открыта по HTTPS, а картинка с того же хоста по HTTP — переключаем на HTTPS
        if (window.location.protocol === 'https:' && parsed.protocol === 'http:' && parsed.hostname === window.location.hostname) {
            parsed.protocol = 'https:';
            return parsed.toString();
        }
        return parsed.toString();
    } catch {
        return absolute;
    }
};

interface GalleryItem {
    id: string;
    stableKey?: string;
    url: string;
    isUploading?: boolean;
    uploadProgress?: number;
    error?: string | null;
    hasLoaded?: boolean;
}

interface ImageGalleryComponentProps {
    collection: string;
    idTravel: string;
    initialImages: GalleryItem[];
    maxImages?: number;
    onChange?: (urls: string[]) => void;
}

const ImageGalleryComponent: React.FC<ImageGalleryComponentProps> = ({
    collection,
    idTravel,
    initialImages: initialImagesProp,
    maxImages = 10,
    onChange,
}) => {
    // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [images, setImages] = useState<GalleryItem[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number } | null>(null);
    
    const blobUrlsRef = useRef<Set<string>>(new Set());
    const retryRef = useRef<Set<string>>(new Set());
    const lastReportedUrlsRef = useRef<string>('');

    const hasErrors = useMemo(() => images.some(img => img.error), [images]);

    useEffect(() => {
        setImages((prev) => {
            const prevBackendByUrl = new Map<string, GalleryItem>();
            const prevLoadedByUrl = new Map<string, boolean>();
            for (const item of prev) {
                if (!item?.url) continue;
                const canonical = canonicalizeUrlForDedupe(item.url);
                if (item.hasLoaded) {
                    prevLoadedByUrl.set(canonical, true);
                }
                if (isBackendImageId(item.id)) {
                    prevBackendByUrl.set(canonical, item);
                }
            }

            const uploading = prev.filter((img) => img.isUploading);
            const nextFromProps = (initialImagesProp ?? []).map((img) => ({
                ...img,
                stableKey: (img as any).stableKey ?? String(img.id),
                url: normalizeDisplayUrl(img.url),
                isUploading: false,
                uploadProgress: 0,
                error: null,
                hasLoaded: prevLoadedByUrl.get(canonicalizeUrlForDedupe(normalizeDisplayUrl(img.url))) ?? false,
            }));

            // If parent passes only URLs (or legacy ids), preserve the backend id we already know.
            // This is important for delete API calls: we must delete by backend image id.
            const upgradedFromProps = nextFromProps.map((img) => {
                if (isBackendImageId(img.id)) return img;
                const known = prevBackendByUrl.get(canonicalizeUrlForDedupe(img.url));
                if (!known) return img;
                return {
                    ...img,
                    id: known.id,
                    stableKey: known.stableKey ?? known.id,
                };
            });

            // Preserve any in-flight uploads, but de-dupe if backend already returned the same URL.
            const propUrls = new Set(upgradedFromProps.map((img) => img.url));
            const preservedUploading = uploading.filter((img) => !propUrls.has(img.url));

            return dedupeGalleryItems([...upgradedFromProps, ...preservedUploading]);
        });
        setIsInitialLoading(false);
    }, [initialImagesProp]);
    
    // Cleanup blob URLs on unmount
    useEffect(() => {
        const urlsRefSnapshot = blobUrlsRef;
        return () => {
            const urlsSnapshot = Array.from(urlsRefSnapshot.current);
            urlsSnapshot.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch {
                    // Ignore errors
                }
            });
            urlsRefSnapshot.current.clear();
        };
    }, []);

    // Report image URLs to parent (without uploading placeholders)
    useEffect(() => {
        if (!onChange) return;
        const urls = images
            .filter(img => !img.isUploading)
            .map(img => img.url)
            .filter(Boolean);

        // Guard: avoid endless update loops when URLs haven't changed.
        const signature = urls.join('|');
        if (signature === lastReportedUrlsRef.current) return;
        lastReportedUrlsRef.current = signature;
        onChange(urls);
    }, [images, onChange]);

    const handleUploadImages = useCallback(
        async (files: File[]) => {
            if (images.length + files.length > maxImages) {
                alert(`Максимум ${maxImages} изображений`);
                return;
            }
            
            setBatchUploadProgress({ current: 0, total: files.length });
            
            // Create placeholders immediately
            const placeholders = files.map((file, index) => {
                const tempId = `temp-${Date.now()}-${index}`;
                
                return {
                    id: tempId,
                    stableKey: tempId,
                    url: '',
                    isUploading: true,
                    uploadProgress: 0,
                    error: null
                };
            });
            
            setImages(prev => dedupeGalleryItems([...prev, ...placeholders]));

            // Upload sequentially for better UX and error handling
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const placeholder = placeholders[i];
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('collection', collection);
                    formData.append('id', idTravel);
                    
                    const response = await uploadImage(formData);
                    const uploadedUrlRaw =
                        response?.url ||
                        (response as any)?.data?.url ||
                        (response as any)?.path ||
                        (response as any)?.file_url;
                    const uploadedId =
                        (response as any)?.id ||
                        (response as any)?.data?.id ||
                        placeholder.id;
                    if (uploadedUrlRaw) {
                        const finalUrl = normalizeDisplayUrl(String(uploadedUrlRaw));
                        
                        setImages(prev => {
                            const idx = prev.findIndex((img) => img.stableKey === placeholder.stableKey);
                            if (idx >= 0) {
                                return dedupeGalleryItems(
                                    prev.map((img) =>
                                        img.stableKey === placeholder.stableKey
                                            ? {
                                                  ...img,
                                                  id: String(uploadedId),
                                                  url: finalUrl,
                                                  isUploading: false,
                                                  uploadProgress: 100,
                                                  error: null,
                                                  hasLoaded: false,
                                              }
                                            : img,
                                    ),
                                );
                            }

                            // If placeholders were dropped due to prop sync/rerender, still add the uploaded item.
                            return dedupeGalleryItems([
                                ...prev,
                                {
                                    ...placeholder,
                                    id: String(uploadedId),
                                    url: finalUrl,
                                    isUploading: false,
                                    uploadProgress: 100,
                                    error: null,
                                    hasLoaded: false,
                                },
                            ]);
                        });
                    } else {
                        throw new Error('No URL in response');
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    setImages(prev =>
                        prev.map(img => 
                            img.stableKey === placeholder.stableKey
                                ? { ...img, isUploading: false, error: 'Ошибка загрузки' }
                                : img
                        )
                    );
                }
                
                setBatchUploadProgress({ current: i + 1, total: files.length });
            }
            
            setBatchUploadProgress(null);
        },
        [collection, idTravel, images.length, maxImages]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        multiple: true,
        disabled: Platform.OS !== 'web',
        onDrop: (acceptedFiles) => handleUploadImages(acceptedFiles),
    });

    const dropzoneRootProps = useCallback(() => {
        const props = getRootProps();
        // react-dropzone uses generic HTML props; RN-web View has stricter typing for tabIndex.
        const { tabIndex, ...rest } = props as any;
        return {
            rootProps: rest,
            tabIndex: tabIndex as 0 | -1 | undefined,
        };
    }, [getRootProps]);

    const handleDeleteImage = (stableKey: string) => {
        setSelectedImageId(stableKey);
        setDialogVisible(true);
    };

    const handleImageError = useCallback((stableKey: string, currentUrl: string) => {
        if (retryRef.current.has(stableKey)) {
            setImages(prev =>
                prev.map(img =>
                    (img.stableKey ?? img.id) === stableKey ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img
                )
            );
            return;
        }

        const fallback = buildApiPrefixedUrl(currentUrl);
        if (fallback) {
            retryRef.current.add(stableKey);
            setImages(prev =>
                prev.map(img =>
                    (img.stableKey ?? img.id) === stableKey ? { ...img, url: fallback, isUploading: false, error: null } : img
                )
            );
            return;
        }

        retryRef.current.add(stableKey);
        setImages(prev =>
            prev.map(img =>
                (img.stableKey ?? img.id) === stableKey ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img
            )
        );
    }, []);

    const handleImageLoad = useCallback((stableKey: string) => {
        retryRef.current.delete(stableKey);
        setImages(prev =>
            prev.map(img =>
                (img.stableKey ?? img.id) === stableKey ? { ...img, error: null, isUploading: false, hasLoaded: true } : img
            )
        );
    }, []);

    // Fallback: mark as error if image neither loads nor errors within timeout
    // ✅ FIX: Увеличен таймаут до 15 секунд и добавлена проверка на blob URLs
    useEffect(() => {
        const timers = images
            .filter(img => !img.isUploading && !img.error && !img.hasLoaded)
            .map(img => {
                // ✅ FIX: Для blob URLs используем больший таймаут, т.к. они загружаются локально
                const isBlobUrl = /^(blob:|data:)/i.test(img.url);
                const timeout = isBlobUrl ? 30000 : 15000;
                
                return setTimeout(() => {
                    const stableKey = img.stableKey ?? img.id;
                    setImages(prev =>
                        prev.map(item => {
                            if ((item.stableKey ?? item.id) !== stableKey) return item;
                            // ✅ FIX: Не помечаем как ошибку если изображение уже загрузилось
                            if (item.hasLoaded) return item;
                            return { ...item, error: 'Ошибка загрузки', isUploading: false };
                        })
                    );
                }, timeout);
            });
        return () => {
            timers.forEach(clearTimeout);
        };
    }, [images]);

    const confirmDeleteImage = async () => {
        if (!selectedImageId) return;
        
        const imageToDelete = images.find(img => (img.stableKey ?? img.id) === selectedImageId);
        
        try {
            // Only call API if it's a real backend id (digits). Legacy/client ids (e.g. legacy-*) must be removed locally.
            if (imageToDelete && !imageToDelete.error && isBackendImageId(imageToDelete.id)) {
                await deleteImage(imageToDelete.id);
            }
            
            // Cleanup blob URL if exists
            if (imageToDelete && blobUrlsRef.current.has(imageToDelete.url)) {
                URL.revokeObjectURL(imageToDelete.url);
                blobUrlsRef.current.delete(imageToDelete.url);
            }
            
            setImages(prev => prev.filter(img => (img.stableKey ?? img.id) !== selectedImageId));
        } catch (error) {
            console.error('Delete error:', error);
            alert('Не удалось удалить изображение');
        } finally {
            setDialogVisible(false);
            setSelectedImageId(null);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.headerContainer, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.titleRow}>
                    <MaterialIcons
                        name="photo-camera"
                        size={20}
                        color={colors.text}
                    />
                    <Text style={[styles.galleryTitle, { color: colors.text }]}>Галерея</Text>
                </View>
                <Text style={[styles.imageCount, { color: colors.textMuted }]}>
                    Загружено <Text style={[styles.highlight, { color: colors.primary }]}>{images.length}</Text> из {maxImages}
                </Text>
            </View>

            {Platform.OS === 'web' && (
                (() => {
                    const { rootProps, tabIndex } = dropzoneRootProps();
                    return (
                <View
                    {...(rootProps as any)}
                    tabIndex={tabIndex}
                    style={[
                        styles.dropzone,
                        isDragActive && styles.activeDropzone,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            borderColor: colors.primary
                        },
                    ]}
                >
                    <input {...getInputProps()} />
                    <Text style={[styles.dropzoneText, { color: colors.textMuted }]}>
                        {isDragActive ? 'Отпустите файлы...' : 'Перетащите сюда изображения'}
                    </Text>
                </View>
                    );
                })()
            )}

            {batchUploadProgress && (
                <View style={[styles.batchProgressContainer, {
                    backgroundColor: colors.infoSoft,
                    borderColor: colors.infoLight
                }]}>
                    <View style={[styles.batchProgressBar, { backgroundColor: colors.infoLight }]}>
                        <View
                            style={[
                                styles.batchProgressFill, 
                                {
                                    width: `${(batchUploadProgress.current / batchUploadProgress.total) * 100}%`,
                                    backgroundColor: colors.info
                                }
                            ]}
                        />
                    </View>
                    <Text style={[styles.batchProgressText, { color: colors.infoDark }]}>
                        Загрузка {batchUploadProgress.current} из {batchUploadProgress.total}
                    </Text>
                </View>
            )}

            {isInitialLoading ? (
                <View style={styles.galleryGrid}>
                    {[...Array(3)].map((_, i) => (
                        <View key={`skeleton-${i}`} style={styles.imageWrapper}>
                            <View style={[styles.skeleton, { backgroundColor: colors.surfaceMuted }]} />
                        </View>
                    ))}
                </View>
            ) : images.length > 0 ? (
                <View style={styles.galleryGrid}>
                    {images.map((image, index) => (
                        <View key={image.stableKey ?? image.id} style={styles.imageWrapper} testID="gallery-image">
                            {image.isUploading ? (
                                <View style={styles.uploadingImageContainer}>
                                    <View style={[styles.skeleton, { backgroundColor: colors.surfaceMuted }]} />
                                    <View style={styles.uploadingOverlayImage}>
                                        <ActivityIndicator size="large" color={colors.textInverse} />
                                        <Text style={[styles.uploadingImageText, { color: colors.textInverse }]}>Загрузка...</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.stableKey ?? image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={18} color={colors.textInverse} />
                                    </TouchableOpacity>
                                </View>
                            ) : image.error ? (
                                <View style={styles.errorImageContainer}>
                                    <ImageCardMedia
                                        src={image.url}
                                        fit="contain"
                                        blurBackground
                                        loading="lazy"
                                        alt={`Error ${index + 1}`}
                                        style={[styles.image, styles.errorImage]}
                                        onError={() => handleImageError(image.stableKey ?? image.id, image.url)}
                                        onLoad={() => handleImageLoad(image.stableKey ?? image.id)}
                                    />
                                    <View style={styles.errorOverlay}>
                                        <MaterialIcons name="warning-amber" size={24} color={colors.warningDark} />
                                        <Text style={[styles.errorOverlaySubtext, { color: colors.warningDark }]}>{image.error}</Text>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteImage(image.stableKey ?? image.id)}
                                            style={[styles.errorActionButton, { backgroundColor: colors.primary }]}
                                            testID="delete-image-button"
                                        >
                                            <Text style={[styles.errorActionText, { color: colors.textInverse }]}>Удалить</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.stableKey ?? image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={18} color={colors.textInverse} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    {!image.hasLoaded && (
                                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        </View>
                                    )}
                                    <ImageCardMedia
                                        src={image.url}
                                        fit="contain"
                                        blurBackground
                                        loading="lazy"
                                        alt={`Gallery image ${index + 1}`}
                                        style={[styles.image, !image.hasLoaded && { opacity: 0 } as any]}
                                        onError={() => handleImageError(image.stableKey ?? image.id, image.url)}
                                        onLoad={() => handleImageLoad(image.stableKey ?? image.id)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.stableKey ?? image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={18} color={colors.textInverse} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={[styles.noImagesText, { color: colors.textMuted }]}>
                    Нет загруженных изображений
                </Text>
            )}

            {hasErrors && (
                <View style={[styles.errorBanner, {
                    backgroundColor: colors.warningSoft,
                    borderColor: colors.warningLight
                }]}>
                    <MaterialIcons name="warning-amber" size={18} color={colors.warningDark} />
                    <Text style={[styles.errorBannerText, { color: colors.warningDark }]}>
                        Некоторые изображения не удалось загрузить. Удалите их и попробуйте снова.
                    </Text>
                </View>
            )}

            <ConfirmDialog
                visible={dialogVisible}
                onClose={() => setDialogVisible(false)}
                onConfirm={confirmDeleteImage}
                title="Удаление изображения"
                message="Вы уверены, что хотите удалить это изображение?"
                confirmText="Удалить"
                cancelText="Отмена"
            />
        </View>
    );
};

export default ImageGalleryComponent;

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        padding: DESIGN_TOKENS.spacing.xl,
        width: '100%',
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    galleryTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        fontWeight: 'bold',
    },
    imageCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    highlight: {
        fontWeight: 'bold',
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_TOKENS.spacing.md,
        justifyContent: 'flex-start',
    },
    imageWrapper: {
        flexBasis: '32%',
        maxWidth: '32%',
        minWidth: 220,
        flexGrow: 0,
        aspectRatio: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        elevation: 50,
    },
    dropzone: {
        width: '100%',
        padding: DESIGN_TOKENS.spacing.lg,
        borderWidth: 2,
        borderRadius: DESIGN_TOKENS.radii.md,
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    activeDropzone: {
        borderColor: colors.primaryDark,
        backgroundColor: colors.primarySoft,
    },
    dropzoneText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    noImagesText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        textAlign: 'center',
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    loader: {
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    skeleton: {
        width: '100%',
        height: '100%',
    },
    uploadingImageContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    uploadingOverlayImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingImageText: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
    },
    errorImageContainer: {
        backgroundColor: colors.warningSoft,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.warningLight,
        position: 'relative',
    },
    errorImage: {
        opacity: 0.08,
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.overlayLight,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    errorOverlaySubtext: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    errorActionButton: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.sm,
        shadowColor: 'transparent',
    },
    errorActionText: {
        fontWeight: '700',
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    batchProgressContainer: {
        marginBottom: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
    },
    batchProgressBar: {
        width: '100%',
        height: 8,
        borderRadius: DESIGN_TOKENS.radii.sm,
        overflow: 'hidden',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    batchProgressFill: {
        height: '100%',
    },
    batchProgressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        textAlign: 'center',
    },
    errorBanner: {
        marginTop: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorBannerText: {
        fontSize: 13,
        textAlign: 'left',
    },
});
