import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent';
import { useThemedColors } from '@/hooks/useTheme';

interface GallerySectionProps {
    images: any[] | null | undefined;
    travelId?: string | number | null;
    onChange?: (urls: string[]) => void;
    isLoading?: boolean;
}

const GallerySection: React.FC<GallerySectionProps> = ({ images, travelId, onChange, isLoading }) => {
    const colors = useThemedColors();

    const normalizedImages = useMemo(() => {
        const raw = Array.isArray(images) ? images : [];
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
    }, [images]);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (isLoading) {
        return (
            <View style={styles.galleryContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>
                    Загрузка данных...
                </Text>
            </View>
        );
    }

    // Без ID нельзя загрузить файлы (нужен travelId на бэке)
    if (!travelId) {
        return (
            <View style={styles.galleryContainer}>
                <Text style={styles.infoText}>
                    Галерея станет доступна после сохранения путешествия.
                </Text>
            </View>
        );
    }

    // Для web используем галерею с дропзоной, для native — платформенный файл
    return (
        <View style={styles.galleryContainer}>
            <ImageGalleryComponent
                // Бэкенд коллекция галереи
                collection="gallery"
                idTravel={String(travelId)}
                initialImages={normalizedImages}
                maxImages={10}
                onChange={onChange}
            />
            {Platform.OS !== 'web' && normalizedImages.length === 0 && (
                <Text style={styles.infoText}>
                    Нет загруженных изображений
                </Text>
            )}
        </View>
    );
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    galleryContainer: {
        marginTop: DESIGN_TOKENS.spacing.xxs,
        padding: 15,
        backgroundColor: colors.surface,
        borderRadius: 10,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        textAlign: 'center',
        color: colors.textMuted,
    },
    infoText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '500',
        textAlign: 'center',
        color: colors.textMuted,
    },
    emptyText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
        color: colors.textMuted,
    },
});

export default React.memo(GallerySection);
