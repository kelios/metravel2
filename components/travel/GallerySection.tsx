import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { TravelFormData, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent';
import { useThemedColors } from '@/hooks/useTheme';

interface GallerySectionProps {
    formData: TravelFormData | null;
    travelDataOld?: Travel | null;
    onChange?: (urls: string[]) => void;
}

const GallerySection: React.FC<GallerySectionProps> = ({ formData, onChange }) => {
    const themedColors = useThemedColors();
    const gallerySource = formData?.gallery;

    const normalizedImages = useMemo(() => {
        const raw = Array.isArray(gallerySource) ? gallerySource : [];
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
    }, [gallerySource]);

    if (!formData) {
        return (
            <View style={[styles.galleryContainer, { backgroundColor: themedColors.surface }]}>
                <ActivityIndicator size="large" color={themedColors.primary} />
                <Text style={[styles.loadingText, { color: themedColors.textMuted }]}>
                    Загрузка данных...
                </Text>
            </View>
        );
    }

    // Без ID нельзя загрузить файлы (нужен travelId на бэке)
    if (!formData.id) {
        return (
            <View style={[styles.galleryContainer, { backgroundColor: themedColors.surface }]}>
                <Text style={[styles.infoText, { color: themedColors.textMuted }]}>
                    Галерея станет доступна после сохранения путешествия.
                </Text>
            </View>
        );
    }

    // Для web используем галерею с дропзоной, для native — платформенный файл
    return (
        <View style={[styles.galleryContainer, { backgroundColor: themedColors.surface }]}>
            <ImageGalleryComponent
                // Бэкенд коллекция галереи
                collection="gallery"
                idTravel={String(formData.id)}
                initialImages={normalizedImages}
                maxImages={10}
                onChange={onChange}
            />
            {Platform.OS !== 'web' && normalizedImages.length === 0 && (
                <Text style={[styles.infoText, { color: themedColors.textMuted }]}>
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
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
    },
    loadingText: { marginTop: DESIGN_TOKENS.spacing.sm, fontSize: DESIGN_TOKENS.typography.sizes.md, textAlign: 'center' },
    infoText: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '500', textAlign: 'center' },
    emptyText: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '500', textAlign: 'center', marginBottom: 8 },
});

export default React.memo(GallerySection);
