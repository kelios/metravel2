import { memo, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import type { PeerBadgeReceived, PeerBadgeTarget } from '@/api/achievements';
import PeerBadgePickerSheet from '@/components/achievements/PeerBadgePickerSheet';
import Button from '@/components/ui/Button';
import { translate as i18nT } from '@/i18n'


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

  const text = label ?? (target === 'travel' ? i18nT('achievements:components.achievements.PeerBadgeGiveButton.nagradit_db0e2e3a') : i18nT('achievements:components.achievements.PeerBadgeGiveButton.nagradit_avtora_fac91397'));

  return (
    <>
      <Button
        variant="soft"
        label={text}
        icon={<Feather name="award" size={16} color={colors.primaryText} />}
        onPress={() => setOpen(true)}
        accessibilityLabel={text}
        testID={testID}
        style={style}
      />

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

export default memo(PeerBadgeGiveButton);
