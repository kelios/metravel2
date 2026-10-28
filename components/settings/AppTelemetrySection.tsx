import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { Toggle } from '@/components/ui/Toggle';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n';
import { isAppTelemetryEnabled, setAppTelemetryEnabled } from '@/utils/appTelemetry';
// Регистрирует очистку очереди событий на тот же выключатель, что и падения.
import { installAppEventTelemetry } from '@/utils/appEventTelemetry';

type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface AppTelemetrySectionProps {
  styles: Styles;
  colors: Colors;
}

export default function AppTelemetrySection({ styles, colors }: AppTelemetrySectionProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const title = i18nT('common:appTelemetry.improveTitle');

  useEffect(() => {
    installAppEventTelemetry();
    let alive = true;
    void isAppTelemetryEnabled().then((value) => {
      if (alive) setEnabled(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.settingRow}>
        <View style={styles.settingTextBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="activity" size={16} color={colors.primaryDark} />
            <Text style={styles.settingTitle}>{title}</Text>
          </View>
          <Text style={styles.settingMeta}>{i18nT('common:appTelemetry.improveDescription')}</Text>
        </View>
        <Toggle
          value={enabled !== false}
          disabled={enabled === null}
          testID="app-telemetry-toggle"
          accessibilityLabel={title}
          onValueChange={(next) => {
            setEnabled(next);
            void setAppTelemetryEnabled(next);
          }}
        />
      </View>
    </View>
  );
}
