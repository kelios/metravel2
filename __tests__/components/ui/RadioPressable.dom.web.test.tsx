import type React from 'react';
import type { Root } from 'react-dom/client';

let act: typeof import('react').act;
let createElement: typeof import('react').createElement;
let createRoot: typeof import('react-dom/client').createRoot;
let Platform: typeof import('react-native').Platform;
let Pressable: typeof import('react-native').Pressable;
let Text: typeof import('react-native').Text;
let RadioPressable: typeof import('@/components/ui/RadioPressable').default;
let ThemeOptionGroup: typeof import('@/components/layout/ThemeOptionGroup').default;
let ThemeSection: typeof import('@/components/settings/ThemeSection').default;
let createSettingsStyles: typeof import('@/components/screens/settings/settings.styles').createSettingsStyles;
let getThemedColors: typeof import('@/constants/designSystem').getThemedColors;

beforeAll(() => {
  // Load real RNW into a fresh registry; setup.ts otherwise caches native mocks.
  jest.resetModules();
  jest.doMock('react-native', () => jest.requireActual('react-native-web'));
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }));
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }));
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }));
  ({ act, createElement } = require('react'));
  ({ createRoot } = require('react-dom/client'));
  ({ Platform, Pressable, Text } = require('react-native'));
  RadioPressable = require('@/components/ui/RadioPressable').default;
  ThemeOptionGroup = require('@/components/layout/ThemeOptionGroup').default;
  ThemeSection = require('@/components/settings/ThemeSection').default;
  ({ createSettingsStyles } = require('@/components/screens/settings/settings.styles'));
  ({ getThemedColors } = require('@/constants/designSystem'));
});

describe('radio activation in real React Native Web DOM', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (element: React.ReactElement) => {
    await act(async () => root.render(element));
    return container.querySelector<HTMLElement>('[role="radio"]')!;
  };
  const key = async (node: HTMLElement, value: string, type: 'keydown' | 'keyup' = 'keydown', repeat = false) => {
    const event = new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true, repeat });
    await act(async () => { node.dispatchEvent(event); });
    return event;
  };

  it.each([' ', 'Spacebar'])('selects a focused radio once with %j and prevents scrolling', async value => {
    const onSelect = jest.fn();
    const radio = await render(createElement(RadioPressable, { onSelect, accessibilityState: { checked: false } }));
    radio.focus();
    expect((await key(radio, value)).defaultPrevented).toBe(true);
    expect((await key(radio, value, 'keydown', true)).defaultPrevented).toBe(true);
    await key(radio, value, 'keyup');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(radio.getAttribute('aria-checked')).toBe('false');
  });

  it('leaves Enter to RNW and preserves pointer activation', async () => {
    const onSelect = jest.fn();
    const radio = await render(createElement(RadioPressable, { onSelect }));
    radio.focus();
    await key(radio, 'Enter');
    await key(radio, 'Enter', 'keyup');
    expect(onSelect).toHaveBeenCalledTimes(1);
    await act(async () => radio.click());
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('ignores unfocused, disabled and bubbled Space', async () => {
    const onSelect = jest.fn();
    let radio = await render(createElement(RadioPressable, { onSelect }, createElement(Text, { testID: 'nested' }, 'Label')));
    expect((await key(radio, ' ')).defaultPrevented).toBe(false);
    radio.focus();
    expect((await key(container.querySelector<HTMLElement>('[data-testid="nested"]')!, ' ')).defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    radio = await render(createElement(RadioPressable, { onSelect, disabled: true }));
    radio.focus();
    await key(radio, ' ');
    await act(async () => radio.click());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'] as const)('delegates native %s activation to Pressable without a web key handler', platform => {
    const originalPlatform = Platform.OS;
    const onSelect = jest.fn();
    try {
      Platform.OS = platform;
      const element = RadioPressable({ onSelect, accessibilityState: { checked: true } });
      expect(element.type).toBe(Pressable);
      expect(element.props.onKeyDown).toBeUndefined();
      expect(element.props.accessibilityRole).toBe('radio');
      expect(element.props.accessibilityState).toEqual({ checked: true });
      element.props.onPress();
      expect(onSelect).toHaveBeenCalledTimes(1);
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it.each(['menu', 'settings'] as const)('uses the shared Space selection in %s theme options', async location => {
    const onChange = jest.fn();
    const options = [{ value: 'easter', label: 'Easter', description: 'Spring celebration', renderIcon: () => null }];
    const colors = getThemedColors(false);
    const element = location === 'menu'
      ? createElement(ThemeOptionGroup, { options, value: 'auto', onChange, testID: 'themes', getAccessibilityLabel: option => option.label })
      : createElement(ThemeSection, { styles: createSettingsStyles(colors), colors, theme: 'auto', setTheme: onChange, themeOptions: options });
    const radio = await render(element);
    expect(radio.getAttribute('aria-checked')).toBe('false');
    radio.focus();
    await key(radio, ' ');
    await key(radio, ' ', 'keyup');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('easter');
  });
});
