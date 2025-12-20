import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, useColorScheme, Platform } from 'react-native';
import { TravelFormData, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent';

interface GallerySectionProps {
    formData: TravelFormData | null;
    travelDataOld?: Travel | null;
}

const GallerySection: React.FC<GallerySectionProps> = ({ formData }) => {
    const theme = useColorScheme();
    const isDarkMode = theme === 'dark';

    if (!formData) {
        return (
            <View style={[styles.galleryContainer, isDarkMode && styles.darkBackground]}>
                <ActivityIndicator size="large" color="#6aaaaa" />
                <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
                    Загрузка данных...
                </Text>
            </View>
        );
    }

    // Без ID нельзя загрузить файлы (нужен travelId на бэке)
    if (!formData.id) {
        return (
            <View style={[styles.galleryContainer, isDarkMode && styles.darkBackground]}>
                <Text style={[styles.infoText, isDarkMode && styles.darkText]}>
                    Галерея станет доступна после сохранения путешествия.
                </Text>
            </View>
        );
    }

    const normalizedImages = useMemo(() => {
        const raw = Array.isArray(formData.gallery) ? formData.gallery : [];
        return raw
            .map((item, index) => {
                if (typeof item === 'string') {
                    return { id: `legacy-${index}`, url: item };
                }
                if (item && typeof item === 'object' && 'url' in item) {
                    return { id: String((item as any).id ?? `legacy-${index}`), url: (item as any).url as string };
                }
                return null;
            })
            .filter(Boolean) as { id: string; url: string }[];
    }, [formData.gallery]);

    // Для web используем галерею с дропзоной, для native — платформенный файл
    return (
        <View style={[styles.galleryContainer, isDarkMode && styles.darkBackground]}>
            <ImageGalleryComponent
                // Бэкенд коллекция галереи
                collection="gallery"
                idTravel={String(formData.id)}
                initialImages={normalizedImages}
                maxImages={10}
            />
            {Platform.OS !== 'web' && normalizedImages.length === 0 && (
                <Text style={[styles.infoText, isDarkMode && styles.darkText]}>
                    Нет загруженных изображений
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    galleryContainer: {
        marginTop: DESIGN_TOKENS.spacing.xxs,
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
    },
    darkBackground: { backgroundColor: '#222' },
    loadingText: { marginTop: DESIGN_TOKENS.spacing.sm, fontSize: DESIGN_TOKENS.typography.sizes.md, color: '#555', textAlign: 'center' },
    infoText: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '500', color: '#666', textAlign: 'center' },
    emptyText: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '500', color: '#888', textAlign: 'center', marginBottom: 8 },
    darkText: { color: '#ddd' },
});

export default React.memo(GallerySection);
