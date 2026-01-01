import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useDropzone } from 'react-dropzone';
import { uploadImage } from "@/src/api/misc";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

// Условный импорт для DocumentPicker, только если платформа не является вебом
let DocumentPicker: any;
if (Platform.OS !== 'web') {
    DocumentPicker = require('react-native-document-picker');
}

interface MapUploadComponentProps {
    collection: string;
    idTravel: string;
}

const MapUploadComponent: React.FC<MapUploadComponentProps> = ({ collection, idTravel }) => {
    // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
    const colors = useThemedColors();

    const [fileUri, setFileUri] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    // Поддерживаемые форматы карт
    const supportedFormats = ['.gpx', '.kml', '.kmz', '.geojson'];

    // Drag-and-Drop логика для веба
    const { getRootProps, getInputProps } = useDropzone({
        onDrop: async (acceptedFiles) => {
            const file = acceptedFiles[0];
            setFileName(file.name);
            const fileUri = URL.createObjectURL(file);
            setFileUri(fileUri);

            await handleUploadFile(file); // Загружаем файл на сервер
        },
        // Тип Accept в react-dropzone ожидает объект, но нам достаточно строкового списка расширений.
        // Для совместимости с типами приводим к any.
        accept: supportedFormats.map((format) => `.${format.split('.').pop()}`).join(',') as any,
    });

    // Функция для выбора файла для мобильных устройств
    const pickFile = async () => {
        if (Platform.OS !== 'web' && DocumentPicker) {
            try {
                const res = await DocumentPicker.pick({
                    type: [DocumentPicker.types.allFiles],
                });

                if (res && res[0]) {
                    const { name, uri, type } = res[0];
                    setFileUri(uri);
                    setFileName(name);

                    if (supportedFormats.some((format) => name.endsWith(format))) {
                        await handleUploadFile({
                            uri: uri,
                            name: name,
                            type: type || 'application/octet-stream',
                        });
                    } else {
                        setUploadMessage("Неподдерживаемый формат файла");
                    }
                }
            } catch (err) {
                if (DocumentPicker.isCancel(err)) {
                    console.info('User canceled the picker');
                } else {
                    throw err;
                }
            }
        }
    };

    // Функция для загрузки файла на сервер
    const handleUploadFile = async (file: any) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('collection', collection);
            formData.append('id', idTravel);

            const response = await uploadImage(formData);

            if (response?.data?.url) {
                setUploadMessage("Карта успешно загружена: " + response.data.url);
            } else {
                setUploadMessage("Ошибка при загрузке карты.");
            }
        } catch (error) {
            console.error(error);
            setUploadMessage("Произошла ошибка при загрузке.");
        }
    };

    return (
        <View style={styles.container}>
            {Platform.OS === 'web' ? (
                <div {...getRootProps({ className: 'dropzone' })} style={{
                    ...styles.dropzone,
                    backgroundColor: colors.primary,
                    borderColor: colors.primaryDark,
                }}>
                    <input {...getInputProps()} />
                    {fileUri ? (
                        <Text style={[styles.fileName, { color: colors.textInverse }]}>{fileName}</Text>
                    ) : (
                        <Text style={[styles.placeholderText, { color: colors.textInverse }]}>
                            Перетащите сюда файл карты (.gpx, .kml, .kmz, .geojson) или нажмите для выбора
                        </Text>
                    )}
                </div>
            ) : (
                <>
                    <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.primary }]} onPress={pickFile}>
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>Выбрать файл карты</Text>
                    </TouchableOpacity>
                    {fileUri ? (
                        <Text style={[styles.fileName, { color: colors.text }]}>{fileName}</Text>
                    ) : (
                        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Загрузите файл карты (.gpx, .kml, .kmz, .geojson)</Text>
                    )}
                </>
            )}
            {uploadMessage && <Text style={[styles.uploadMessage, { color: colors.primary }]}>{uploadMessage}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.xl,
    },
    dropzone: {
        width: 300,
        height: 200,
        borderWidth: 2,
        borderRadius: DESIGN_TOKENS.radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.xl,
        ...(Platform.select({
            web: {
                display: 'flex',
                boxShadow: DESIGN_TOKENS.shadows.medium,
                transition: 'background-color 0.3s ease',
            },
            default: {},
        }) as any),
    },
    fileName: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        textAlign: 'center',
        marginVertical: DESIGN_TOKENS.spacing.xl,
    },
    placeholderText: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        textAlign: 'center',
        marginTop: DESIGN_TOKENS.spacing.xl,
    },
    buttonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        textAlign: 'center',
    },
    uploadButton: {
        paddingVertical: DESIGN_TOKENS.spacing.lg,
        paddingHorizontal: DESIGN_TOKENS.spacing.xxl,
        borderRadius: DESIGN_TOKENS.radii.pill,
        ...DESIGN_TOKENS.shadowsNative.medium,
    },
    uploadMessage: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        textAlign: 'center',
        marginTop: DESIGN_TOKENS.spacing.md,
    },
});

export default MapUploadComponent;
