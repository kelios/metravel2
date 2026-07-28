import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { selectPlural } from '@/i18n/format';
import type { useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { globalFocusStyles } from '@/styles/globalFocus';

type Styles = ReturnType<typeof createSettingsStyles>;

export default function OfflineSettingsSection({
  styles,
  colors,
  userId,
}: {
  styles: Styles;
  colors: ReturnType<typeof useThemedColors>;
  userId?: string | number | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { summary } = useOfflineCatalog(userId);
  const objectLabel = selectPlural(summary.packageCount, {
    one: t('offline:objectOne'),
    few: t('offline:objectFew'),
    many: t('offline:objectMany'),
    other: t('offline:objectOther'),
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('offline:settingsTitle')}
      onPress={() => router.push('/offline')}
      style={[styles.card, styles.cardRow, globalFocusStyles.focusable]}
    >
      <View style={styles.cardIcon}>
        <Feather name="download-cloud" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{t('offline:settingsTitle')}</Text>
        <Text style={styles.cardMeta}>
          {t('offline:settingsDescription')} · {t('offline:itemCount', {
            count: summary.packageCount,
            objects: objectLabel,
          })}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
