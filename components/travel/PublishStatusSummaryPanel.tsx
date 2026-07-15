import React from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/ui/paper';

import CardActionPressable from '@/components/ui/CardActionPressable';
import { QualityIndicator } from '@/components/travel/ValidationFeedback';
import type { ThemedColors } from '@/hooks/useTheme';
import type { ModerationIssue } from '@/utils/formValidation';
import { translate as i18nT } from '@/i18n'


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
                <Text style={styles.cardTitle}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.tekuschiy_status_382752e0')}</Text>
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
                            ? i18nT('travel:components.travel.PublishStatusSummaryPanel.marshrut_otpravlen_na_moderatsiyu_ozhidaet_r_69b645e9')
                            : i18nT('travel:components.travel.PublishStatusSummaryPanel.eto_status_kotoryy_uzhe_sohranen_nizhe_vy_mo_eff24d3d')}
                    </Text>
                </View>
            </View>

            {!pendingModeration && (
                <View style={[styles.card, styles.statusCard]}>
                    <Text style={styles.cardTitle}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.status_publikatsii_1fc92ecd')}</Text>
                    <View style={styles.statusOptions}>
                        <CardActionPressable
                            style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                            onPress={() => onStatusChange('draft')}
                            disabled={userPendingModeration}
                            accessibilityLabel={i18nT('travel:components.travel.PublishStatusSummaryPanel.sohranit_kak_chernovik_1e0b8a83')}
                        >
                            <View style={styles.radioOuter}>
                                {status === 'draft' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.statusTextCol}>
                                <Text style={styles.statusLabel}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.sohranit_kak_chernovik_1e0b8a83')}</Text>
                                <Text style={styles.statusHint}>
                                    {i18nT('travel:components.travel.PublishStatusSummaryPanel.chernovik_viden_tolko_vam_ego_mozhno_dopolny_9ac19698')}</Text>
                            </View>
                        </CardActionPressable>

                        <View style={styles.divider} />

                        <CardActionPressable
                            style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                            onPress={() => onStatusChange('moderation')}
                            disabled={userPendingModeration}
                            accessibilityLabel={i18nT('travel:components.travel.PublishStatusSummaryPanel.otpravit_na_moderatsiyu_2f661fac')}
                        >
                            <View style={styles.radioOuter}>
                                {status === 'moderation' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.statusTextCol}>
                                <Text style={styles.statusLabel}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.otpravit_na_moderatsiyu_2f661fac')}</Text>
                                <Text style={styles.statusHint}>
                                    {i18nT('travel:components.travel.PublishStatusSummaryPanel.posle_odobreniya_marshrut_stanet_publichnym__f29685c4')}</Text>
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
                    <Text style={styles.bannerTitle}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.nuzhno_dopolnit_pered_moderatsiey_1285b2fa')}</Text>
                    <Text style={styles.bannerDescription}>
                        {i18nT('travel:components.travel.PublishStatusSummaryPanel.proverte_otmechennye_punkty_chek_lista_bez_n_484295dd')}</Text>
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
                <Text style={styles.cardTitle}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.kachestvo_zapolneniya_c17c9a41')}</Text>
                <QualityIndicator level={qualityScore.level} score={qualityScore.score} />
                {qualityScore.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsTitle}>{i18nT('travel:components.travel.PublishStatusSummaryPanel.rekomendatsii_dlya_uluchsheniya_59d39358')}</Text>
                        {qualityScore.suggestions.map((suggestion, idx) => (
                            <Text key={idx} style={styles.suggestionItem}>• {suggestion}</Text>
                        ))}
                    </View>
                )}
            </View>
        </>
    );
}
