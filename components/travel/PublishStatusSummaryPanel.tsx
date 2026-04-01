import React from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/ui/paper';

import CardActionPressable from '@/components/ui/CardActionPressable';
import { QualityIndicator } from '@/components/travel/ValidationFeedback';
import type { ThemedColors } from '@/hooks/useTheme';
import type { ModerationIssue } from '@/utils/formValidation';

type BackendStatusTone = 'success' | 'warning' | 'muted';

type PublishStatusSummaryPanelProps = {
    colors: ThemedColors;
    styles: any;
    currentBackendStatus: {
        label: string;
        tone: BackendStatusTone;
    };
    pendingModeration: boolean;
    userPendingModeration: boolean;
    status: 'draft' | 'moderation';
    missingForModeration: ModerationIssue[];
    qualityScore: {
        level: 'excellent' | 'good' | 'fair' | 'poor';
        score: number;
        suggestions: string[];
    };
    onStatusChange: (status: 'draft' | 'moderation') => void;
    onNavigateToIssue?: (issue: ModerationIssue) => void;
    missingBannerAnchor?: React.Ref<View>;
};

export default function PublishStatusSummaryPanel({
    colors,
    styles,
    currentBackendStatus,
    pendingModeration,
    userPendingModeration,
    status,
    missingForModeration,
    qualityScore,
    onStatusChange,
    onNavigateToIssue,
    missingBannerAnchor,
}: PublishStatusSummaryPanelProps) {
    return (
        <>
            <View style={[styles.card, styles.statusChipCard]}>
                <Text style={styles.cardTitle}>Текущий статус</Text>
                <View style={styles.statusChipRow}>
                    <View
                        style={[
                            styles.statusChip,
                            currentBackendStatus.tone === 'success' && styles.statusChipSuccess,
                            currentBackendStatus.tone === 'warning' && styles.statusChipWarning,
                            currentBackendStatus.tone === 'muted' && styles.statusChipMuted,
                        ]}
                    >
                        <Text style={styles.statusChipText}>{currentBackendStatus.label}</Text>
                    </View>
                    <Text style={styles.statusChipHint}>
                        {pendingModeration
                            ? 'Маршрут отправлен на модерацию, ожидает решения администратора.'
                            : 'Это статус, который уже сохранён. Ниже вы можете выбрать новый (черновик или модерация).'}
                    </Text>
                </View>
            </View>

            {!pendingModeration && (
                <View style={[styles.card, styles.statusCard]}>
                    <Text style={styles.cardTitle}>Статус публикации</Text>
                    <View style={styles.statusOptions}>
                        <CardActionPressable
                            style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                            onPress={() => onStatusChange('draft')}
                            disabled={userPendingModeration}
                            accessibilityLabel="Сохранить как черновик"
                        >
                            <View style={styles.radioOuter}>
                                {status === 'draft' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.statusTextCol}>
                                <Text style={styles.statusLabel}>Сохранить как черновик</Text>
                                <Text style={styles.statusHint}>
                                    Черновик виден только вам. Его можно дополнять и отправить на модерацию позже.
                                </Text>
                            </View>
                        </CardActionPressable>

                        <View style={styles.divider} />

                        <CardActionPressable
                            style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                            onPress={() => onStatusChange('moderation')}
                            disabled={userPendingModeration}
                            accessibilityLabel="Отправить на модерацию"
                        >
                            <View style={styles.radioOuter}>
                                {status === 'moderation' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.statusTextCol}>
                                <Text style={styles.statusLabel}>Отправить на модерацию</Text>
                                <Text style={styles.statusHint}>
                                    После одобрения маршрут станет публичным и появится в списке путешествий.
                                </Text>
                            </View>
                        </CardActionPressable>
                    </View>
                </View>
            )}

            {status === 'moderation' && missingForModeration.length > 0 && (
                <View ref={missingBannerAnchor} nativeID="travelwizard-publish-missing-banner" />
            )}

            {status === 'moderation' && missingForModeration.length > 0 && (
                <View style={[styles.card, styles.bannerError]}>
                    <Text style={styles.bannerTitle}>Нужно дополнить перед модерацией</Text>
                    <Text style={styles.bannerDescription}>
                        Проверьте отмеченные пункты чек-листа. Без них мы не сможем отправить маршрут на модерацию.
                    </Text>
                    {missingForModeration.map(issue => {
                        const isClickable = !!onNavigateToIssue;

                        const rowContent = (
                            <>
                                <View style={[styles.checkBadge, styles.checkBadgeMissing]}>
                                    <Icon source="alert" size={14} color={colors.dangerDark} />
                                </View>
                                <Text
                                    style={[
                                        styles.checklistLabel,
                                        isClickable && styles.checklistLabelClickable,
                                    ]}
                                >
                                    {issue.label}
                                </Text>
                            </>
                        );

                        const rowStyle = [
                            styles.checklistRow,
                            isClickable && styles.checklistRowClickable,
                        ];

                        if (isClickable) {
                            return (
                                <CardActionPressable
                                    key={issue.key}
                                    style={rowStyle}
                                    onPress={() => onNavigateToIssue?.(issue)}
                                    accessibilityLabel={issue.label}
                                >
                                    {rowContent}
                                </CardActionPressable>
                            );
                        }

                        return (
                            <View key={issue.key} style={rowStyle}>
                                {rowContent}
                            </View>
                        );
                    })}
                </View>
            )}

            <View style={[styles.card, styles.qualityCard]}>
                <Text style={styles.cardTitle}>Качество заполнения</Text>
                <QualityIndicator level={qualityScore.level} score={qualityScore.score} />
                {qualityScore.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsTitle}>Рекомендации для улучшения:</Text>
                        {qualityScore.suggestions.map((suggestion, idx) => (
                            <Text key={idx} style={styles.suggestionItem}>• {suggestion}</Text>
                        ))}
                    </View>
                )}
            </View>
        </>
    );
}
