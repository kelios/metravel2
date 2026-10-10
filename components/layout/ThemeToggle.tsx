import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/hooks/useTheme';
import ThemeOptionGroup, { type ThemeOptionGroupOption } from '@/components/layout/ThemeOptionGroup';
import { translate as i18nT } from '@/i18n'


interface ThemeToggleProps {
  /** Компактный режим без рамки */
  compact?: boolean;
  /** Вертикальное расположение кнопок */
  layout?: 'horizontal' | 'vertical';
  /** Показывать подписи */
  showLabels?: boolean;
}

const renderFeather = (name: 'sun' | 'moon' | 'monitor') => (size: number, color: string) => (
  <Feather name={name} size={size} color={color} />
);

export default function ThemeToggle({
  compact = false,
  layout = 'horizontal',
  showLabels = true,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const themeOptions: Array<ThemeOptionGroupOption<Theme>> = [
    { value: 'light', renderIcon: renderFeather('sun'), label: i18nT('navigation:components.layout.ThemeToggle.svetlaya_246afe18') },
    { value: 'dark', renderIcon: renderFeather('moon'), label: i18nT('navigation:components.layout.ThemeToggle.temnaya_b882d236') },
    { value: 'auto', renderIcon: renderFeather('monitor'), label: i18nT('navigation:components.layout.ThemeToggle.avto_f4fd1de9') },
  ];

  return (
    <ThemeOptionGroup
      testID="theme-toggle"
      options={themeOptions}
      value={theme}
      onChange={setTheme}
      getAccessibilityLabel={(option) =>
        i18nT('navigation:components.layout.ThemeToggle.vybrat_temu_value1_2ab8849f', { value1: option.label })
      }
      compact={compact}
      layout={layout}
      showLabels={showLabels}
    />
  );
}
