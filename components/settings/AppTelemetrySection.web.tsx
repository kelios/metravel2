import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';

type Props = {
  styles: ReturnType<typeof createSettingsStyles>;
  colors: ReturnType<typeof useThemedColors>;
};

/** На web сбор событий остаётся в gtag/Метрике, выключателя здесь нет. */
export default function AppTelemetrySection(_props: Props) {
  return null;
}
