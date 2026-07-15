import { Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type PublishModerationAdminPanelProps = {
    colors: ThemedColors;
    styles: any;
    rejectionComment: string;
    onRejectionCommentChange: (value: string) => void;
    onApprove: () => void;
    onReject: () => void;
};

export default function PublishModerationAdminPanel({
    colors,
    styles,
    rejectionComment,
    onRejectionCommentChange,
    onApprove,
    onReject,
}: PublishModerationAdminPanelProps) {
    return (
        <View style={[styles.card, styles.adminCard]}>
            <Text style={styles.cardTitle}>{i18nT('travel:components.travel.PublishModerationAdminPanel.panel_moderatora_7edb00cf')}</Text>
            <Text style={styles.adminHint}>
                {i18nT('travel:components.travel.PublishModerationAdminPanel.marshrut_nahoditsya_na_moderatsii_vy_mozhete_542ba566')}</Text>
            <View style={styles.rejectionCommentContainer}>
                <Text style={styles.rejectionCommentLabel}>
                    {i18nT('travel:components.travel.PublishModerationAdminPanel.kommentariy_pri_otklonenii_budet_otpravlen_a_2b76b4a3')}</Text>
                <TextInput
                    style={[
                        styles.rejectionCommentInput,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            borderColor: colors.borderLight,
                        },
                    ]}
                    value={rejectionComment}
                    onChangeText={onRejectionCommentChange}
                    placeholder={i18nT('travel:components.travel.PublishModerationAdminPanel.ukazhite_prichinu_otkloneniya_c5c0761c')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={1000}
                    accessibilityLabel={i18nT('travel:components.travel.PublishModerationAdminPanel.kommentariy_pri_otklonenii_cbbe2068')}
                />
            </View>
            <View style={styles.adminButtons}>
                <Button
                    label={i18nT('travel:components.travel.PublishModerationAdminPanel.odobrit_moderatsiyu_9291f287')}
                    onPress={onApprove}
                    icon={<Feather name="check-circle" size={20} color={colors.textOnPrimary} />}
                    variant="primary"
                    size="md"
                    style={[styles.adminButton, styles.adminButtonApprove]}
                    labelStyle={styles.adminButtonText}
                    accessibilityLabel={i18nT('travel:components.travel.PublishModerationAdminPanel.odobrit_moderatsiyu_9291f287')}
                />
                <Button
                    label={i18nT('travel:components.travel.PublishModerationAdminPanel.otklonit_09b10036')}
                    onPress={onReject}
                    icon={<Feather name="x-circle" size={20} color={colors.textOnPrimary} />}
                    variant="danger"
                    size="md"
                    style={[styles.adminButton, styles.adminButtonReject]}
                    labelStyle={styles.adminButtonText}
                    accessibilityLabel={i18nT('travel:components.travel.PublishModerationAdminPanel.otklonit_moderatsiyu_bbccc89e')}
                />
            </View>
        </View>
    );
}
