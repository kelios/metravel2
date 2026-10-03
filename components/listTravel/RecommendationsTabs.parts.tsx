import { Pressable, Text, View, type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import type { createRecommendationsTabsStyles } from './recommendationsTabsStyles';

type TabStyles = ReturnType<typeof createRecommendationsTabsStyles>;
type TabColors = ReturnType<typeof useThemedColors>;

const ARROW_ICON_STYLE: TextStyle = { marginLeft: 6 };

export const RecommendationsAuthGate = ({
  message,
  onLogin,
  styles,
  colors,
}: {
  message: string;
  onLogin: () => void;
  styles: TabStyles;
  colors: TabColors;
}) => (
  <View style={styles.gateContainer}>
    <View style={styles.gateCard}>
      <View style={styles.gateIcon}>
        <Feather name="lock" size={24} color={colors.primaryDark} />
      </View>
      <View style={styles.gateCopy}>
        <Text style={styles.gateText}>{message}</Text>
      </View>
      <Pressable style={styles.gateButton} onPress={onLogin} accessibilityRole="button">
        <Text style={styles.gateButtonText}>{i18nT('travel:components.listTravel.RecommendationsTabs.voyti_7f541279')}</Text>
        <Feather name="arrow-right" size={18} color={colors.primaryDark} style={ARROW_ICON_STYLE} />
      </Pressable>
    </View>
  </View>
);
