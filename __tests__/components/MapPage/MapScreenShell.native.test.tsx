import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

import { MapScreenShell } from '@/components/MapPage/MapScreenParts/MapScreenShell';
import { getStyles } from '@/screens/tabs/map.styles';

// #2155 — on iPad (≥ 768pt) the desktop chrome must sit in ONE row with the
// map host; a column gave the host 0pt height and an empty screen.
describe('MapScreenShell on native tablet width (#2155)', () => {
  const originalOS = Platform.OS;
  const themedColors: any = {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f5',
    surfaceAlpha40: 'rgba(255,255,255,0.4)',
    borderLight: '#eeeeee',
    overlay: 'rgba(0,0,0,0.35)',
    shadows: {
      medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    },
    boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
  };

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  const renderShell = (isMobile: boolean) => {
    const styles = getStyles(isMobile, 0, themedColors);
    const utils = render(
      <MapScreenShell
        styles={styles}
        seoBlock={null}
        isMobile={isMobile}
        mapComponent={<View testID="map-canvas" />}
        chrome={
          <View testID="panel">
            <Text>panel</Text>
          </View>
        }
      />,
    );
    // The host node that holds the chrome as a DIRECT child is the shell row.
    const findParentOf = (node: any, testID: string): any => {
      if (!node || typeof node !== 'object') return null;
      const kids: any[] = node.children ?? [];
      if (kids.some((kid) => kid?.props?.testID === testID)) return node;
      for (const kid of kids) {
        const found = findParentOf(kid, testID);
        if (found) return found;
      }
      return null;
    };
    const row = findParentOf(utils.toJSON(), 'panel');
    return { ...utils, row };
  };
  const hasCanvas = (node: any): boolean =>
    node?.props?.testID === 'map-canvas' || (node?.children ?? []).some(hasCanvas);

  it('ios, isMobile=false: panel then map host in one row container', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { row } = renderShell(false);

    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    const siblings = row.children as any[];
    expect(siblings).toHaveLength(2);
    expect(siblings[0].props.testID).toBe('panel');
    expect(StyleSheet.flatten(siblings[1].props.style).flex).toBe(1);
    expect(hasCanvas(siblings[1])).toBe(true);
  });

  it('ios, isMobile=true: column container, chrome after the full-bleed host', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { row } = renderShell(true);

    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
    const siblings = row.children as any[];
    expect(hasCanvas(siblings[0])).toBe(true);
    expect(siblings[siblings.length - 1].props.testID).toBe('panel');
  });
});
