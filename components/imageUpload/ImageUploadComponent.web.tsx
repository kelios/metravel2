import React, { useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Pressable,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import { useDropzone } from 'react-dropzone';
import { uploadImage } from '@/src/api/misc';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ImageUploadComponentProps {
    collection: string;
    idTravel: string;
    oldImage?: string;
    onUpload?: (imageUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const ImageUploadComponent: React.FC<ImageUploadComponentProps> = ({
                                                                       collection,
                                                                       idTravel,
                                                                       oldImage,
                                                                       onUpload,
                                                                   }) => {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null); // ✅ УЛУЧШЕНИЕ: Превью перед загрузкой
    const [previewFile, setPreviewFile] = useState<File | null>(null); // ✅ УЛУЧШЕНИЕ: Сохраняем файл для загрузки
    const [uploadProgress, setUploadProgress] = useState(0); // ✅ УЛУЧШЕНИЕ: Прогресс загрузки
    const [error, setError] = useState<string | null>(null); // ✅ УЛУЧШЕНИЕ: Ошибки валидации

    // 👇 Добавляем флаг — была ли картинка выбрана пользователем вручную:
    const [isManuallySelected, setIsManuallySelected] = useState(false);

    useEffect(() => {
        // Если пользователь не выбрал картинку вручную → можно подгружать oldImage
        if (oldImage && !isManuallySelected) {
            setImageUri(oldImage);
        }
        // если oldImage сбросился (например, ''), тоже сбрасываем imageUri
        if (!oldImage && !isManuallySelected) {
            setImageUri(null);
        }
    }, [oldImage, isManuallySelected]);

    // ✅ УЛУЧШЕНИЕ: Валидация файла
    const validateFile = useCallback((file: File | { uri: string; name: string; type: string; size?: number }): string | null => {
        if (Platform.OS === 'web' && file instanceof File) {
            // Проверка размера
            if (file.size > MAX_FILE_SIZE) {
                return `Файл слишком большой. Максимальный размер: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`;
            }
            // Проверка типа
            if (!ALLOWED_TYPES.includes(file.type)) {
                return `Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WEBP`;
            }
        }
        return null;
    }, []);

    // ✅ УЛУЧШЕНИЕ: Создание превью
    const createPreview = useCallback((file: File | { uri: string; name: string; type: string }) => {
        if (Platform.OS === 'web' && file instanceof File) {
            setPreviewFile(file); // Сохраняем файл
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            const rnFile = file as { uri: string };
            setPreviewUrl(rnFile.uri);
        }
    }, []);

    const handleUploadImage = async (file: File | { uri: string; name: string; type: string }) => {
        try {
            setError(null);
            setUploadMessage(null);
            setUploadProgress(0);

            // ✅ ВАЖНО: Без валидного ID сервер вернёт "A valid integer is required"
            // Для новых точек маршрута idTravel ещё нет, поэтому блокируем загрузку
            const normalizedId = (idTravel ?? '').toString();
            if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
                setError('Сначала сохраните точку маршрута, затем попробуйте загрузить фото.');
                setPreviewUrl(null);
                setPreviewFile(null);
                return;
            }

            // ✅ УЛУЧШЕНИЕ: Валидация перед загрузкой
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                setPreviewUrl(null);
                return;
            }

            // ✅ УЛУЧШЕНИЕ: Показываем превью
            createPreview(file);

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

            // ✅ УЛУЧШЕНИЕ: Симуляция прогресса (можно заменить на реальный XMLHttpRequest с onprogress)
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

            if (response?.url) {
                setImageUri(response.url);
                setPreviewUrl(null); // Очищаем превью после успешной загрузки
                setPreviewFile(null); // Очищаем файл
                setUploadMessage('Фотография успешно загружена');
                onUpload?.(response.url);
                setIsManuallySelected(true);
            } else {
                setError('Ошибка при загрузке');
                setPreviewUrl(null);
                setPreviewFile(null);
            }
        } catch (error) {
            console.error('Ошибка при загрузке:', error);
            setError('Произошла ошибка при загрузке');
            setPreviewUrl(null);
            setPreviewFile(null);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const pickImage = () => {
        ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
            if (response.didCancel || response.errorCode) return;

            const asset = response.assets?.[0];
            if (!asset?.uri) return;

            await handleUploadImage({
                uri: asset.uri,
                name: asset.fileName || 'photo.jpg',
                type: asset.type || 'image/jpeg',
            });
        });
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: async (acceptedFiles, rejectedFiles) => {
            // Обработка отклоненных файлов
            if (rejectedFiles.length > 0) {
                const rejection = rejectedFiles[0];
                if (rejection.errors.some(e => e.code === 'file-too-large')) {
                    setError(`Файл слишком большой. Максимальный размер: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
                } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
                    setError('Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WEBP');
                } else {
                    setError('Не удалось загрузить файл');
                }
                return;
            }

            const file = acceptedFiles[0];
            if (file) {
                const validationError = validateFile(file);
                if (validationError) {
                    setError(validationError);
                    return;
                }

                setError(null);
                setUploadMessage(null);
                setUploadProgress(0);
                setPreviewFile(file);
                createPreview(file);
            }
        },
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif'] },
        maxSize: MAX_FILE_SIZE,
        multiple: false,
    });

    const handleRemovePreview = () => {
        setPreviewUrl(null);
        setPreviewFile(null);
        setError(null);
    };

    const handleConfirmUpload = () => {
        if (previewFile) {
            handleUploadImage(previewFile);
        }
    };

    return (
        <View style={styles.container}>
            {Platform.OS === 'web' ? (
                <div {...getRootProps()} style={isDragActive ? styles.dropzoneActive : styles.dropzone}>
                    <input {...getInputProps()} />
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
                            {/* ✅ УЛУЧШЕНИЕ: Прогресс загрузки */}
                            {uploadProgress > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                                    <Text style={styles.progressText}>{uploadProgress}%</Text>
                                </View>
                            )}
                        </View>
                    ) : previewUrl ? (
                        // ✅ УЛУЧШЕНИЕ: Превью перед загрузкой
                        <View style={styles.previewContainer}>
                            <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
                            <Pressable
                                style={styles.removePreviewButton}
                                onPress={handleRemovePreview}
                                accessibilityLabel="Удалить превью"
                            >
                                <Feather name="x" size={20} color="#fff" />
                            </Pressable>
                            <Pressable
                                style={styles.uploadConfirmButton}
                                onPress={handleConfirmUpload}
                                disabled={loading || !previewFile}
                            >
                                <Text style={styles.uploadConfirmText}>Загрузить</Text>
                            </Pressable>
                        </View>
                    ) : imageUri ? (
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                            <Pressable
                                style={styles.replaceButton}
                                onPress={() => {
                                    setImageUri(null);
                                    setIsManuallySelected(false);
                                }}
                            >
                                <Feather name="edit-2" size={16} color="#fff" />
                                <Text style={styles.replaceButtonText}>Заменить</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <FontAwesome name="cloud-upload" size={50} color={DESIGN_TOKENS.colors.primary} />
                            <Text style={styles.placeholderText}>Перетащите сюда изображение</Text>
                            <Text style={styles.placeholderSubtext}>или нажмите для выбора файла</Text>
                            <Text style={styles.placeholderHint}>
                                Макс. размер: {(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB
                            </Text>
                        </View>
                    )}
                </div>
            ) : (
                <>
                    <TouchableOpacity style={styles.uploadButton} onPress={pickImage} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <FontAwesome name="cloud-upload" size={18} color="#fff" />
                                <Text style={styles.uploadButtonText}>
                                    {imageUri ? 'Заменить фото' : 'Загрузить фото'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                    {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
                </>
            )}

            {/* ✅ УЛУЧШЕНИЕ: Отображение ошибок */}
            {error && (
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {uploadMessage && !error && (
                <View style={styles.successContainer}>
                    <Feather name="check-circle" size={16} color="#10b981" />
                    <Text style={styles.successText}>{uploadMessage}</Text>
                </View>
            )}
        </View>
    );
};

const palette = DESIGN_TOKENS.colors;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
    },
    dropzone: {
        width: '100%',
        height: 220,
        borderWidth: 2,
        borderColor: palette.primary,
        borderStyle: 'dashed',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: palette.primarySoft,
        overflow: 'hidden',
    },
    dropzoneActive: {
        backgroundColor: palette.primaryLight,
        borderColor: palette.primary,
        borderStyle: 'solid',
    },
    loadingContainer: {
        alignItems: 'center',
        gap: 12,
    },
    progressContainer: {
        width: '80%',
        height: 8,
        backgroundColor: palette.border,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    progressBar: {
        height: '100%',
        backgroundColor: palette.primary,
        borderRadius: 4,
    },
    progressText: {
        position: 'absolute',
        top: -20,
        fontSize: 12,
        color: palette.text,
        fontWeight: '600',
    },
    previewContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    removePreviewButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    uploadConfirmButton: {
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: [{ translateX: -50 }],
        backgroundColor: palette.primary,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        cursor: 'pointer',
    },
    uploadConfirmText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    replaceButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        cursor: 'pointer',
    },
    replaceButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    uploadButton: {
        backgroundColor: palette.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
    },
    uploadButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    placeholderContainer: {
        alignItems: 'center',
        gap: 8,
    },
    placeholderText: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.text,
    },
    placeholderSubtext: {
        fontSize: 14,
        color: palette.textMuted,
    },
    placeholderHint: {
        fontSize: 12,
        color: palette.textMuted,
        marginTop: 4,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        width: '100%',
    },
    errorText: {
        fontSize: 13,
        color: '#dc2626',
        flex: 1,
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#d1fae5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#a7f3d0',
        width: '100%',
    },
    successText: {
        fontSize: 13,
        color: '#059669',
        flex: 1,
    },
});

export default ImageUploadComponent;
