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

interface GalleryItem {
    id: string;
    url: string;
    isUploading?: boolean;
    uploadProgress?: number;
    error?: string | null;
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
                url: ensureAbsoluteUrl(img.url),
                isUploading: false,
                uploadProgress: 0,
                error: null
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
                        const finalUrl = ensureAbsoluteUrl(String(uploadedUrlRaw));
                        
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
                img.id === imageId ? { ...img, error: null, isUploading: false } : img
            )
        );
    }, []);

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
                <Text style={[styles.galleryTitle, isDarkMode && styles.darkText]}>📷 Галерея</Text>
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
                                        <ActivityIndicator size="large" color="#ffffff" />
                                        <Text style={styles.uploadingImageText}>Загрузка...</Text>
                                    </View>
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
                                        <Text style={styles.errorOverlayText}>⚠️</Text>
                                        <Text style={styles.errorOverlaySubtext}>{image.error}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteImage(image.id)}
                                        style={styles.deleteButton}
                                    >
                                        <Text style={styles.deleteButtonText}>✖</Text>
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
                                    >
                                        <Text style={styles.deleteButtonText}>✖</Text>
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
                    <Text style={styles.errorBannerText}>
                        ⚠️ Некоторые изображения не удалось загрузить. Удалите их и попробуйте снова.
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
        backgroundColor: '#222',
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    galleryTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        fontWeight: 'bold',
        color: '#333',
    },
    imageCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#666',
    },
    highlight: {
        fontWeight: 'bold',
        color: '#4b7c6f',
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_TOKENS.spacing.md,
    },
    imageWrapper: {
        width: '31.5%',
        aspectRatio: 1,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f0f0f0',
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.35)',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButtonText: {
        color: '#fff',
    },
    dropzone: {
        width: '100%',
        padding: DESIGN_TOKENS.spacing.lg,
        borderWidth: 2,
        borderRadius: 10,
        borderColor: '#4b7c6f',
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    activeDropzone: {
        borderColor: '#2b5c53',
        backgroundColor: '#e0f2f1',
    },
    darkDropzone: {
        backgroundColor: '#333',
        borderColor: '#888',
    },
    dropzoneText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#666',
    },
    darkText: {
        color: '#ddd',
    },
    noImagesText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        textAlign: 'center',
        color: '#888',
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    loader: {
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    skeleton: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e0e0e0',
    },
    skeletonDark: {
        backgroundColor: '#444',
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingImageText: {
        color: '#fff',
        marginTop: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
    },
    errorImageContainer: {
        backgroundColor: '#f9f4f0',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f0dbd6',
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
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    errorOverlayText: {
        fontSize: 28,
        color: '#cc8a45',
    },
    errorOverlaySubtext: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8a6b52',
        textAlign: 'center',
    },
    batchProgressContainer: {
        marginBottom: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    batchProgressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#e0f2fe',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    batchProgressFill: {
        height: '100%',
        backgroundColor: '#0ea5e9',
    },
    batchProgressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#0369a1',
        fontWeight: '600',
        textAlign: 'center',
    },
    errorBanner: {
        marginTop: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.sm,
        backgroundColor: '#f9f4f0',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#f0dbd6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorBannerText: {
        color: '#8a6b52',
        fontSize: 13,
        textAlign: 'left',
    },
});
