import { useContext } from 'react';
import {
  Button as DefaultButton,
  ButtonProps as RNButtonProps,
  Text as DefaultText,
  TextProps as RNTextProps,
  useColorScheme,
  View as DefaultView,
  ViewProps as RNViewProps,
} from 'react-native';
import { ThemeContext, useThemedColors } from '@/hooks/useTheme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & RNTextProps;
export type ViewProps = ThemeProps & RNViewProps;
export type ButtonProps = ThemeProps & RNButtonProps;

/**
 * Возвращает цвет на основе текущей темы.
 */
export function useThemeColor(
    props: { light?: string; dark?: string },
    colorName: 'text' | 'background' | 'tint'
) {
  const themeContext = useContext(ThemeContext);
  const systemTheme = useColorScheme() ?? 'light';
  const theme = themeContext ? (themeContext.isDark ? 'dark' : 'light') : systemTheme;
  const colorFromProps = props[theme];
  const colors = useThemedColors();

  if (colorFromProps) return colorFromProps;
  if (colorName === 'tint') return colors.primary;
  if (colorName === 'background') return colors.background;
  return colors.text;
}

/**
 * Компонент Text с поддержкой темной и светлой темы.
 */
export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

/**
 * Компонент View с поддержкой темной и светлой темы.
 */
export function View(props: ViewProps) {
  const { style, lightColor, darkColor, pointerEvents, ...otherProps } = props as any;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  const pointerEventsStyle = pointerEvents ? ({ pointerEvents } as any) : null;

  return <DefaultView style={[{ backgroundColor }, pointerEventsStyle, style]} {...otherProps} />;
}

/**
 * Компонент Button с поддержкой темной и светлой темы.
 */
export function Button(props: ButtonProps) {
  const { lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');

  return <DefaultButton color={color} {...otherProps} />;
}
