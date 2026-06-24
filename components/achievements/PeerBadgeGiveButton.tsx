import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import type { PeerBadgeReceived, PeerBadgeTarget } from '@/api/achievements';
import PeerBadgePickerSheet from '@/components/achievements/PeerBadgePickerSheet';

interface Props {
  target: PeerBadgeTarget;
  recipientId?: string | number;
  travelId?: string | number;
  received: PeerBadgeReceived[];
  label?: string;
  pickerTitle?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function PeerBadgeGiveButton({
  target,
  recipientId,
  travelId,
  received,
  label,
  pickerTitle,
  testID,
  style,
}: Props) {
  const colors = useThemedColors();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);

  // Выдавать значки могут только авторизованные. Свою цель прячет родитель.
  if (!isAuthenticated) return null;

  const text = label ?? (target === 'travel' ? 'Наградить' : 'Наградить автора');
  const styles = getStyles(colors);

  return (
    <>
      <Pressable
        style={[styles.button, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={text}
        testID={testID}
      >
        <Feather name="award" size={16} color={colors.primary} />
        <Text style={styles.label}>{text}</Text>
      </Pressable>

      <PeerBadgePickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        target={target}
        recipientId={recipientId}
        travelId={travelId}
        received={received}
        title={pickerTitle}
      />
    </>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
    },
    label: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  });

export default memo(PeerBadgeGiveButton);
