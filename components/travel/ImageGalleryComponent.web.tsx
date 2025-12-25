import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    useColorScheme,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useDropzone } from 'react-dropzone';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadImage, deleteImage } from '@/src/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

    // Если страница открыта по HTTPS, а картинка с того же хоста по HTTP — переключаем на HTTPS, чтобы избежать mixed content.
    try {
        const parsed = new URL(absolute, window.location.origin);
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
}

const ImageGalleryComponent: React.FC<ImageGalleryComponentProps> = ({
                                                                         collection,
                                                                         idTravel,
                                                                         initialImages,
                                                                         maxImages = 10,
                                                                     }) => {
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number } | null>(null);
    
    const blobUrlsRef = useRef<Set<string>>(new Set());
    const retryRef = useRef<Set<string>>(new Set());
    const theme = useColorScheme();
    const isDarkMode = theme === 'dark';
    
    const _uploadingCount = useMemo(() => images.filter(img => img.isUploading).length, [images]);
    const hasErrors = useMemo(() => images.some(img => img.error), [images]);

    useEffect(() => {
        if (initialImages?.length) {
            setImages(initialImages.map((img) => ({ 
                ...img, 
                url: normalizeDisplayUrl(img.url),
                isUploading: false,
                uploadProgress: 0,
                error: null,
                hasLoaded: false,
            })));
        }
        setIsInitialLoading(false);
    }, [initialImages]);
    
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

    const handleUploadImages = useCallback(
        async (files: File[]) => {
            if (images.length + files.length > maxImages) {
                alert(`Максимум ${maxImages} изображений`);
                return;
            }
            
            setBatchUploadProgress({ current: 0, total: files.length });
            
            // Create placeholders immediately
            const placeholders: GalleryItem[] = files.map((file, index) => {
                const tempId = `temp-${Date.now()}-${index}`;
                const tempUrl = URL.createObjectURL(file);
                blobUrlsRef.current.add(tempUrl);
                
                return {
                    id: tempId,
                    url: tempUrl,
                    isUploading: true,
                    uploadProgress: 0,
                    error: null
                };
            });
            
            setImages(prev => [...prev, ...placeholders]);

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
                        
                        // Cleanup blob URL
                        if (blobUrlsRef.current.has(placeholder.url)) {
                            URL.revokeObjectURL(placeholder.url);
                            blobUrlsRef.current.delete(placeholder.url);
                        }
                        
                        setImages(prev =>
                            prev.map(img => 
                                img.id === placeholder.id 
                                    ? { id: String(uploadedId), url: finalUrl, isUploading: false, uploadProgress: 100, error: null }
                                    : img
                            )
                        );
                    } else {
                        throw new Error('No URL in response');
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    setImages(prev =>
                        prev.map(img => 
                            img.id === placeholder.id 
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

    const handleDeleteImage = (imageId: string) => {
        setSelectedImageId(imageId);
        setDialogVisible(true);
    };

    const handleImageError = useCallback((imageId: string, currentUrl: string) => {
        if (retryRef.current.has(imageId)) {
            setImages(prev =>
                prev.map(img =>
                    img.id === imageId ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img
                )
            );
            return;
        }

        const fallback = buildApiPrefixedUrl(currentUrl);
        if (fallback) {
            retryRef.current.add(imageId);
            setImages(prev =>
                prev.map(img =>
                    img.id === imageId ? { ...img, url: fallback, isUploading: false, error: null } : img
                )
            );
            return;
        }

        retryRef.current.add(imageId);
        setImages(prev =>
            prev.map(img =>
                img.id === imageId ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img
            )
        );
    }, []);

    const handleImageLoad = useCallback((imageId: string) => {
        retryRef.current.delete(imageId);
        setImages(prev =>
            prev.map(img =>
                img.id === imageId ? { ...img, error: null, isUploading: false, hasLoaded: true } : img
            )
        );
    }, []);

    // Fallback: mark as error if image neither loads nor errors within timeout
    useEffect(() => {
        const timers = images
            .filter(img => !img.isUploading && !img.error && !img.hasLoaded)
            .map(img =>
                setTimeout(() => {
                    setImages(prev =>
                        prev.map(item =>
                            item.id === img.id
                                ? { ...item, error: 'Ошибка загрузки', isUploading: false }
                                : item
                        )
                    );
                }, 5000)
            );
        return () => {
            timers.forEach(clearTimeout);
        };
    }, [images]);

    const confirmDeleteImage = async () => {
        if (!selectedImageId) return;
        
        const imageToDelete = images.find(img => img.id === selectedImageId);
        
        try {
            // Only call API if it's not a temp/failed upload
            if (imageToDelete && !imageToDelete.error && !selectedImageId.startsWith('temp-')) {
                await deleteImage(selectedImageId);
            }
            
            // Cleanup blob URL if exists
            if (imageToDelete && blobUrlsRef.current.has(imageToDelete.url)) {
                URL.revokeObjectURL(imageToDelete.url);
                blobUrlsRef.current.delete(imageToDelete.url);
            }
            
            setImages(prev => prev.filter(img => img.id !== selectedImageId));
        } catch (error) {
            console.error('Delete error:', error);
            alert('Не удалось удалить изображение');
        } finally {
            setDialogVisible(false);
            setSelectedImageId(null);
        }
    };

    return (
        <View style={[styles.container, isDarkMode && styles.darkContainer]}>
            <View style={styles.headerContainer}>
                <View style={styles.titleRow}>
                    <MaterialIcons
                        name="photo-camera"
                        size={20}
                        color={isDarkMode ? DESIGN_TOKENS.colors.textInverse : DESIGN_TOKENS.colors.text}
                    />
                    <Text style={[styles.galleryTitle, isDarkMode && styles.darkText]}>Галерея</Text>
                </View>
                <Text style={[styles.imageCount, isDarkMode && styles.darkText]}>
                    Загружено <Text style={styles.highlight}>{images.length}</Text> из {maxImages}
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
                        isDarkMode && styles.darkDropzone,
                    ]}
                >
                    <input {...getInputProps()} />
                    <Text style={[styles.dropzoneText, isDarkMode && styles.darkText]}>
                        {isDragActive ? 'Отпустите файлы...' : 'Перетащите сюда изображения'}
                    </Text>
                </View>
                    );
                })()
            )}

            {batchUploadProgress && (
                <View style={styles.batchProgressContainer}>
                    <View style={styles.batchProgressBar}>
                        <View 
                            style={[
                                styles.batchProgressFill, 
                                { width: `${(batchUploadProgress.current / batchUploadProgress.total) * 100}%` }
                            ]} 
                        />
                    </View>
                    <Text style={[styles.batchProgressText, isDarkMode && styles.darkText]}>
                        Загрузка {batchUploadProgress.current} из {batchUploadProgress.total}
                    </Text>
                </View>
            )}

            {isInitialLoading ? (
                <View style={styles.galleryGrid}>
                    {[...Array(3)].map((_, i) => (
                        <View key={`skeleton-${i}`} style={styles.imageWrapper}>
                            <View style={[styles.skeleton, isDarkMode && styles.skeletonDark]} />
                        </View>
                    ))}
                </View>
            ) : images.length > 0 ? (
                <View style={styles.galleryGrid}>
                    {images.map((image, index) => (
                        <View key={image.id} style={styles.imageWrapper} testID="gallery-image">
                            {image.isUploading ? (
                                <View style={styles.uploadingImageContainer}>
                                    <ImageCardMedia
                                        src={image.url}
                                        fit="contain"
                                        blurBackground
                                        loading="eager"
                                        alt={`Uploading ${index + 1}`}
                                        style={styles.image}
                                        onError={() => handleImageError(image.id, image.url)}
                                        onLoad={() => handleImageLoad(image.id)}
                                    />
                                    <View style={styles.uploadingOverlayImage}>
                                        <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.textInverse} />
                                        <Text style={styles.uploadingImageText}>Загрузка...</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={14} color={DESIGN_TOKENS.colors.textInverse} />
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
                                        onError={() => handleImageError(image.id, image.url)}
                                        onLoad={() => handleImageLoad(image.id)}
                                    />
                                    <View style={styles.errorOverlay}>
                                        <MaterialIcons name="warning-amber" size={24} color={DESIGN_TOKENS.colors.warningDark} />
                                        <Text style={styles.errorOverlaySubtext}>{image.error}</Text>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteImage(image.id)}
                                            style={styles.errorActionButton}
                                            testID="delete-image-button"
                                        >
                                            <Text style={styles.errorActionText}>Удалить</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={14} color={DESIGN_TOKENS.colors.textInverse} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <ImageCardMedia
                                        src={image.url}
                                        fit="contain"
                                        blurBackground
                                        loading="lazy"
                                        alt={`Gallery image ${index + 1}`}
                                        style={styles.image}
                                        onError={() => handleImageError(image.id, image.url)}
                                        onLoad={() => handleImageLoad(image.id)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.id)}
                                        style={styles.deleteButton}
                                        testID="delete-image-button"
                                    >
                                        <MaterialIcons name="close" size={14} color={DESIGN_TOKENS.colors.textInverse} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={[styles.noImagesText, isDarkMode && styles.darkText]}>
                    Нет загруженных изображений
                </Text>
            )}

            {hasErrors && (
                <View style={styles.errorBanner}>
                    <MaterialIcons name="warning-amber" size={18} color={DESIGN_TOKENS.colors.warningDark} />
                    <Text style={styles.errorBannerText}>
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

const styles = StyleSheet.create({
    container: {
        padding: DESIGN_TOKENS.spacing.xl,
        width: '100%',
    },
    darkContainer: {
        backgroundColor: DESIGN_TOKENS.colors.background,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.borderLight,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    galleryTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        fontWeight: 'bold',
        color: DESIGN_TOKENS.colors.text,
    },
    imageCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    highlight: {
        fontWeight: 'bold',
        color: DESIGN_TOKENS.colors.primary,
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_TOKENS.spacing.md,
        justifyContent: 'space-between',
    },
    imageWrapper: {
        flexBasis: '32%',
        maxWidth: '32%',
        minWidth: 220,
        flexGrow: 1,
        aspectRatio: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: DESIGN_TOKENS.colors.cardMuted,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
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
        backgroundColor: DESIGN_TOKENS.colors.overlay,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropzone: {
        width: '100%',
        padding: DESIGN_TOKENS.spacing.lg,
        borderWidth: 2,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderColor: DESIGN_TOKENS.colors.primary,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    activeDropzone: {
        borderColor: DESIGN_TOKENS.colors.primaryDark,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    darkDropzone: {
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    dropzoneText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    darkText: {
        color: DESIGN_TOKENS.colors.textInverse,
    },
    noImagesText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        textAlign: 'center',
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    loader: {
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    skeleton: {
        width: '100%',
        height: '100%',
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },
    skeletonDark: {
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
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
        backgroundColor: DESIGN_TOKENS.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingImageText: {
        color: DESIGN_TOKENS.colors.textInverse,
        marginTop: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
    },
    errorImageContainer: {
        backgroundColor: DESIGN_TOKENS.colors.warningSoft,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.warningLight,
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
        backgroundColor: DESIGN_TOKENS.colors.overlayLight,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    errorOverlaySubtext: {
        fontSize: 13,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.warningDark,
        textAlign: 'center',
    },
    errorActionButton: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        backgroundColor: DESIGN_TOKENS.colors.primary,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.sm,
        shadowColor: 'transparent',
    },
    errorActionText: {
        color: DESIGN_TOKENS.colors.textInverse,
        fontWeight: '700',
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    batchProgressContainer: {
        marginBottom: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: DESIGN_TOKENS.colors.infoSoft,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.infoLight,
    },
    batchProgressBar: {
        width: '100%',
        height: 8,
        backgroundColor: DESIGN_TOKENS.colors.infoLight,
        borderRadius: DESIGN_TOKENS.radii.sm,
        overflow: 'hidden',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    batchProgressFill: {
        height: '100%',
        backgroundColor: DESIGN_TOKENS.colors.info,
    },
    batchProgressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.infoDark,
        fontWeight: '600',
        textAlign: 'center',
    },
    errorBanner: {
        marginTop: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: DESIGN_TOKENS.colors.warningSoft,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.warningLight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorBannerText: {
        color: DESIGN_TOKENS.colors.warningDark,
        fontSize: 13,
        textAlign: 'left',
    },
});
