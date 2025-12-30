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
import Colors from '@/constants/Colors';
import { ThemeContext } from '@/hooks/useTheme';

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
    colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const themeContext = useContext(ThemeContext);
  const systemTheme = useColorScheme() ?? 'light';
  const theme = themeContext ? (themeContext.isDark ? 'dark' : 'light') : systemTheme;
  const colorFromProps = props[theme];
  return colorFromProps ?? Colors[theme][colorName];
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
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}

/**
 * Компонент Button с поддержкой темной и светлой темы.
 */
export function Button(props: ButtonProps) {
  const { lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');

  return <DefaultButton color={color} {...otherProps} />;
}
