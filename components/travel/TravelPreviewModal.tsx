import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { TravelFormData } from '@/src/types/types';

interface TravelPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    formData: TravelFormData;
}

/**
 * ✅ ФАЗА 2: Модальное окно с превью карточки путешествия
 * Позволяет пользователям увидеть как будет выглядеть их путешествие
 */
const TravelPreviewModal: React.FC<TravelPreviewModalProps> = ({
    visible,
    onClose,
    formData,
}) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const coverImage = useMemo(() => {
        if ((formData as any).travel_image_thumb_url) {
            return (formData as any).travel_image_thumb_url;
        }
        if ((formData as any).travel_image_thumb_small_url) {
            return (formData as any).travel_image_thumb_small_url;
        }
        return null;
    }, [formData]);

    const description = useMemo(() => {
        const raw = formData.description || '';
        const stripped = String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (stripped.length > 150) {
            return `${stripped.substring(0, 150)}...`;
        }
        return stripped;
    }, [formData.description]);

    const stats = useMemo(() => {
        const result = [];

        if ((formData as any).number_days) {
            result.push(`${(formData as any).number_days} дн.`);
        }

        const markersCount = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length
            : 0;
        if (markersCount > 0) {
            result.push(`${markersCount} точек`);
        }

        const countriesCount = Array.isArray((formData as any).countries)
            ? ((formData as any).countries as string[]).length
            : 0;
        if (countriesCount > 0) {
            result.push(`${countriesCount} ${countriesCount === 1 ? 'страна' : 'страны'}`);
        }

        return result;
    }, [formData]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={styles.backdrop}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Закрыть превью"
                />
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Превью карточки</Text>
                        <Pressable
                            onPress={onClose}
                            style={styles.closeButton}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть превью"
                        >
                            <Feather name="x" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                        <View style={styles.previewCard}>
                            {coverImage ? (
                                <Image
                                    source={{ uri: coverImage }}
                                    style={styles.cardImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.cardImagePlaceholder}>
                                    <Feather name="image" size={48} color={colors.textMuted} />
                                    <Text style={styles.placeholderText}>Нет обложки</Text>
                                </View>
                            )}

                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle} numberOfLines={2}>
                                    {formData.name || 'Без названия'}
                                </Text>

                                {description && (
                                    <Text style={styles.cardDescription} numberOfLines={3}>
                                        {description}
                                    </Text>
                                )}

                                {stats.length > 0 && (
                                    <View style={styles.cardStats}>
                                        {stats.map((stat, index) => (
                                            <View key={index} style={styles.statItem}>
                                                <Feather name="info" size={14} color={colors.primary} />
                                                <Text style={styles.statText}>{stat}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {Array.isArray((formData as any).categories) &&
                                 ((formData as any).categories as any[]).length > 0 && (
                                    <View style={styles.cardTags}>
                                        {((formData as any).categories as any[]).slice(0, 3).map((cat: any, index: number) => (
                                            <View key={index} style={styles.tag}>
                                                <Text style={styles.tagText}>
                                                    {typeof cat === 'object' ? cat.name : cat}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={styles.hint}>
                            <Feather name="info" size={16} color={colors.primary} />
                            <Text style={styles.hintText}>
                                Так ваше путешествие будет выглядеть в списке после публикации
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.md,
        position: 'relative',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.modal } as any)
            : {}),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        padding: DESIGN_TOKENS.spacing.xs,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: DESIGN_TOKENS.spacing.lg,
    },
    previewCard: {
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : {}),
    },
    cardImage: {
        width: '100%',
        height: 200,
        backgroundColor: colors.surfaceMuted,
    },
    cardImagePlaceholder: {
        width: '100%',
        height: 200,
        backgroundColor: colors.surfaceMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
    },
    cardContent: {
        padding: DESIGN_TOKENS.spacing.md,
    },
    cardTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: '700',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    cardDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        lineHeight: 20,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    cardStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_TOKENS.spacing.sm,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xxs,
    },
    statText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    cardTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    tag: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        backgroundColor: colors.primarySoft,
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    tagText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primary,
        fontWeight: '600',
    },
    hint: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.primarySoft,
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    hintText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        lineHeight: 20,
    },
});

export default React.memo(TravelPreviewModal);
