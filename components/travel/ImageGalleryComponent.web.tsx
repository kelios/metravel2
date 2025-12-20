import React, { useState, useEffect, useCallback } from 'react';
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
    const [loading, setLoading] = useState<boolean[]>([]);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

    const theme = useColorScheme();
    const isDarkMode = theme === 'dark';

    useEffect(() => {
        if (initialImages?.length) {
            setImages(initialImages.map((img) => ({ ...img, url: ensureAbsoluteUrl(img.url) })));
            setLoading(initialImages.map(() => false));
        }
        setIsInitialLoading(false);
    }, [initialImages]);

    const handleUploadImages = useCallback(
        async (files: File[]) => {
            if (images.length + files.length > maxImages) return;
            setIsUploading(true);
            const baseLength = images.length;

            const uploads = files.map(async (file, index) => {
                const currentIndex = baseLength + index;
                const tempId = `temp-${Date.now()}-${index}`;
                const tempUrl = URL.createObjectURL(file);

                // optimistic preview
                setImages((prev) => [...prev, { id: tempId, url: tempUrl }]);
                setLoading((prev) => {
                    const next = [...prev];
                    next[currentIndex] = true;
                    return next;
                });

                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('collection', collection);
                    formData.append('id', idTravel);
                    const response = await uploadImage(formData);
                    if (response?.url) {
                        const finalUrl = ensureAbsoluteUrl(String(response.url));
                        setImages((prev) =>
                            prev.map((img) => (img.id === tempId ? { id: response.id, url: finalUrl } : img)),
                        );
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                } finally {
                    setLoading((prev) => {
                        const next = [...prev];
                        next[currentIndex] = false;
                        return next;
                    });
                }
            });

            await Promise.all(uploads);
            setIsUploading(false);
        },
        [images, loading, collection, idTravel, maxImages]
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
        try {
            await deleteImage(selectedImageId);
            setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
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

            {isInitialLoading ? (
                <ActivityIndicator size="large" color="#4b7c6f" style={styles.loader} />
            ) : images.length > 0 ? (
                <View style={styles.galleryGrid}>
                    {images.map((image, index) => (
                        <View key={image.id} style={styles.imageWrapper}>
                            {loading[index] ? (
                                <ActivityIndicator size="large" color="#ffffff" />
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

            {isUploading && (
                <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.uploadingText}>Загружаются изображения...</Text>
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
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.md,
    },
    imageWrapper: {
        width: '30%',
        aspectRatio: 1,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
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
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingText: {
        color: '#fff',
        marginTop: DESIGN_TOKENS.spacing.sm,
    },
});
