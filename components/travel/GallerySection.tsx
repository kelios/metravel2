import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent';
import { useThemedColors } from '@/hooks/useTheme';
import type { GalleryValueItem } from '@/components/travel/gallery/types';
import { translate as i18nT } from '@/i18n'


interface GallerySectionProps {
    images: any[] | null | undefined;
    travelId?: string | number | null;
    onChange?: (items: GalleryValueItem[]) => void;
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
                    return {
                        id: String((item as any).id ?? `legacy-${index}`),
                        url: (item as any).url as string,
                        caption: typeof (item as any).caption === 'string' ? (item as any).caption : '',
                    };
                }
                return null;
            })
            .filter(Boolean) as { id: string; url: string; caption?: string }[];
    }, [images]);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (isLoading) {
        return (
            <View style={styles.galleryContainer}>
                <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel={i18nT('travel:components.travel.GallerySection.zagruzka_galerei_8a152505')} />
                <Text style={styles.loadingText}>
                    {i18nT('travel:components.travel.GallerySection.zagruzka_galerei_8049b0b6')}</Text>
            </View>
        );
    }

    // Без ID нельзя загрузить файлы (нужен travelId на бэке)
    if (!travelId) {
        return (
            <View style={styles.galleryContainer}>
                <Text style={styles.infoText}>
                    {i18nT('travel:components.travel.GallerySection.galereya_stanet_dostupna_posle_sohraneniya_p_176414da')}</Text>
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
                    {i18nT('travel:components.travel.GallerySection.net_zagruzhennyh_izobrazheniy_c0e4d456')}</Text>
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
