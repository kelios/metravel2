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
import OptimizedImage from '@/components/ui/OptimizedImage';
import { useDropzone } from 'react-dropzone';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadImage, deleteImage } from '@/src/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const API_BASE_URL: string =
    process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');

const ensureAbsoluteUrl = (value: string): string => {
    if (!value) return value;

    try {
        return new URL(value).toString();
    } catch {
        const base = API_BASE_URL ? API_BASE_URL.replace(/\/api\/?$/, '') : undefined;
        if (!base) return value;
        try {
            return new URL(value, base).toString();
        } catch {
            return value;
        }
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
    const theme = useColorScheme();
    const isDarkMode = theme === 'dark';
    
    const uploadingCount = useMemo(() => images.filter(img => img.isUploading).length, [images]);
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
        return () => {
            blobUrlsRef.current.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    // Ignore errors
                }
            });
            blobUrlsRef.current.clear();
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
                    
                    if (response?.url) {
                        const finalUrl = ensureAbsoluteUrl(String(response.url));
                        
                        // Cleanup blob URL
                        if (blobUrlsRef.current.has(placeholder.url)) {
                            URL.revokeObjectURL(placeholder.url);
                            blobUrlsRef.current.delete(placeholder.url);
                        }
                        
                        setImages(prev =>
                            prev.map(img => 
                                img.id === placeholder.id 
                                    ? { id: response.id || placeholder.id, url: finalUrl, isUploading: false, uploadProgress: 100, error: null }
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
                                    <OptimizedImage
                                        source={{ uri: image.url }}
                                        style={styles.image}
                                        contentFit="cover"
                                        loading="eager"
                                        alt={`Uploading ${index + 1}`}
                                    />
                                    <View style={styles.uploadingOverlayImage}>
                                        <ActivityIndicator size="large" color="#ffffff" />
                                        <Text style={styles.uploadingImageText}>Загрузка...</Text>
                                    </View>
                                </View>
                            ) : image.error ? (
                                <View style={styles.errorImageContainer}>
                                    <OptimizedImage
                                        source={{ uri: image.url }}
                                        style={[styles.image, styles.errorImage]}
                                        contentFit="cover"
                                        loading="lazy"
                                        alt={`Error ${index + 1}`}
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
                                    <OptimizedImage
                                        source={{ uri: image.url }}
                                        style={styles.image}
                                        contentFit="cover"
                                        loading="lazy"
                                        alt={`Gallery image ${index + 1}`}
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
        top: 5,
        right: 5,
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        borderRadius: 12,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
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
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    errorImage: {
        opacity: 0.5,
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.xs,
    },
    errorOverlayText: {
        fontSize: 32,
        marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    errorOverlaySubtext: {
        color: '#fff',
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        textAlign: 'center',
        fontWeight: '600',
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
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorBannerText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#991b1b',
        textAlign: 'center',
    },
});
