import React from 'react';
import { Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { ThemedColors } from '@/hooks/useTheme';

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
            <Text style={styles.cardTitle}>Панель модератора</Text>
            <Text style={styles.adminHint}>
                Маршрут находится на модерации. Вы можете одобрить или отклонить его.
            </Text>
            <View style={styles.rejectionCommentContainer}>
                <Text style={styles.rejectionCommentLabel}>
                    Комментарий при отклонении (будет отправлен автору):
                </Text>
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
                    placeholder="Укажите причину отклонения..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={1000}
                    accessibilityLabel="Комментарий при отклонении"
                />
            </View>
            <View style={styles.adminButtons}>
                <Button
                    label="Одобрить модерацию"
                    onPress={onApprove}
                    icon={<Feather name="check-circle" size={20} color={colors.textOnPrimary} />}
                    variant="primary"
                    size="md"
                    style={[styles.adminButton, styles.adminButtonApprove]}
                    labelStyle={styles.adminButtonText}
                    accessibilityLabel="Одобрить модерацию"
                />
                <Button
                    label="Отклонить"
                    onPress={onReject}
                    icon={<Feather name="x-circle" size={20} color={colors.textOnPrimary} />}
                    variant="danger"
                    size="md"
                    style={[styles.adminButton, styles.adminButtonReject]}
                    labelStyle={styles.adminButtonText}
                    accessibilityLabel="Отклонить модерацию"
                />
            </View>
        </View>
    );
}
