import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs as RawDefs, Ellipse, LinearGradient as SvgGrad, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const Defs = RawDefs as unknown as React.FC<{ children?: React.ReactNode }>;

type Props = {
  isWide: boolean;
};

const Cloud: React.FC<{ x: number; y: number; scale?: number; opacity?: number }> = ({ x, y, scale = 1, opacity = 0.95 }) => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: [{ scale }],
      opacity,
    }}
  >
    <Svg width={120} height={50} viewBox="0 0 120 50">
      <Path
        d="M20 35 Q5 35 5 22 Q5 10 20 12 Q22 0 38 4 Q50 -4 60 8 Q72 0 82 8 Q98 4 100 18 Q115 18 115 30 Q115 42 100 42 L20 42 Q10 42 20 35 Z"
        fill="#ffffff"
      />
    </Svg>
  </View>
);

export const HeroBanner: React.FC<Props> = ({ isWide }) => {
  const router = useRouter();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const mountainsW = width || (isWide ? 900 : 340);
  const mountainsH = Math.round(mountainsW / (800 / 220));
  const minTitleSpace = isWide ? 280 : 240;
  const height = Math.max(isWide ? 420 : 380, mountainsH + minTitleSpace * 0.6);

  return (
    <View onLayout={onLayout} style={[styles.wrap, { height, borderRadius: 24 }]}>
      <LinearGradient
        colors={['#67B5F5', '#9DD2F7', '#E8F4FD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Sun */}
      <View style={[styles.sun, { right: isWide ? 80 : 32, top: 36 }]}>
        <Svg width={90} height={90} viewBox="0 0 90 90">
          <Defs>
            <SvgGrad id="sun" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFE27A" />
              <Stop offset="1" stopColor="#FFB347" />
            </SvgGrad>
          </Defs>
          <Circle cx={45} cy={45} r={28} fill="url(#sun)" />
          <Circle cx={45} cy={45} r={40} fill="#FFE27A" opacity={0.18} />
        </Svg>
      </View>

      {/* Clouds */}
      <Cloud x={isWide ? 40 : 16} y={40} scale={1.1} />
      <Cloud x={isWide ? 280 : 140} y={20} scale={0.85} opacity={0.85} />
      <Cloud x={isWide ? 180 : 80} y={90} scale={0.75} opacity={0.75} />
      <Cloud x={isWide ? 520 : 220} y={60} scale={0.95} opacity={0.9} />

      {/* Mountains + castle + lake at bottom */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: mountainsH,
          overflow: 'hidden',
        }}
        pointerEvents="none"
      >
        <Svg width={mountainsW} height={mountainsH} viewBox="0 0 800 220">
          <Defs>
            <SvgGrad id="mtn1" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7BB07A" />
              <Stop offset="1" stopColor="#4F8F6E" />
            </SvgGrad>
            <SvgGrad id="mtn2" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#A8C8B0" />
              <Stop offset="1" stopColor="#7BAE93" />
            </SvgGrad>
            <SvgGrad id="lake" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#5BA8D6" />
              <Stop offset="1" stopColor="#2B6FA0" />
            </SvgGrad>
            <SvgGrad id="castle" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#D7C5A0" />
              <Stop offset="1" stopColor="#A48A5F" />
            </SvgGrad>
          </Defs>

          {/* far mountains */}
          <Path d="M0 130 L80 80 L160 110 L240 60 L340 100 L420 70 L520 110 L620 80 L720 120 L800 90 L800 220 L0 220 Z" fill="url(#mtn2)" opacity={0.85} />
          {/* near mountains */}
          <Path d="M0 170 L60 130 L140 160 L220 110 L300 150 L380 120 L460 160 L540 130 L640 165 L740 135 L800 160 L800 220 L0 220 Z" fill="url(#mtn1)" />

          {/* Castle on hill */}
          <Path d="M540 145 L640 145 L640 170 L540 170 Z" fill="url(#castle)" />
          {/* towers */}
          <Rect x={540} y={120} width={18} height={50} fill="url(#castle)" />
          <Rect x={622} y={120} width={18} height={50} fill="url(#castle)" />
          <Rect x={576} y={108} width={28} height={62} fill="url(#castle)" />
          {/* tower tops (crenellations) */}
          <Path d="M540 120 L545 115 L550 120 L555 115 L560 120 Z" fill="#8C6F44" />
          <Path d="M622 120 L627 115 L632 120 L637 115 L640 120 Z" fill="#8C6F44" />
          {/* roof */}
          <Path d="M576 108 L590 92 L604 108 Z" fill="#B0464A" />
          {/* flag */}
          <Rect x={589} y={78} width={2} height={16} fill="#5C3A1E" />
          <Path d="M591 78 L600 82 L591 86 Z" fill="#E55353" />
          {/* windows */}
          <Rect x={585} y={130} width={6} height={10} fill="#3E2E1B" />
          <Rect x={595} y={130} width={6} height={10} fill="#3E2E1B" />
          <Rect x={547} y={138} width={4} height={8} fill="#3E2E1B" />
          <Rect x={629} y={138} width={4} height={8} fill="#3E2E1B" />

          {/* Lake */}
          <Path d="M0 195 L800 195 L800 220 L0 220 Z" fill="url(#lake)" />
          {/* lake highlights */}
          <Ellipse cx={120} cy={205} rx={40} ry={2} fill="#ffffff" opacity={0.4} />
          <Ellipse cx={300} cy={210} rx={60} ry={2} fill="#ffffff" opacity={0.3} />
          <Ellipse cx={520} cy={205} rx={50} ry={2} fill="#ffffff" opacity={0.35} />
          <Ellipse cx={700} cy={212} rx={45} ry={2} fill="#ffffff" opacity={0.3} />

          {/* Trees */}
          <Path d="M80 178 L92 150 L104 178 Z" fill="#2F6B4E" />
          <Path d="M105 182 L115 158 L125 182 Z" fill="#3E7A5C" />
          <Path d="M380 180 L394 152 L408 180 Z" fill="#2F6B4E" />
          <Path d="M720 182 L732 156 L744 182 Z" fill="#3E7A5C" />
        </Svg>
      </View>

      {/* Title overlay */}
      <View style={[styles.titleWrap, isWide ? styles.titleWrapWide : styles.titleWrapNarrow]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>MeTravel.by</Text>
        </View>
        <Text
          style={[
            styles.title,
            { fontSize: isWide ? 44 : 26 },
            Platform.OS === 'web' ? ({ textShadow: '0 2px 8px rgba(0,0,0,0.25)' } as any) : null,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          Путешествуй вдохновлённо
        </Text>
        <Text style={[styles.subtitle, { fontSize: isWide ? 17 : 13 }]} numberOfLines={3}>
          Замки, озёра, природа и парки — реальные маршруты от живых людей
        </Text>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.push('/search' as any)}
            accessibilityRole="link"
            accessibilityLabel="Смотреть все маршруты"
            style={({ pressed, hovered }: any) => [
              styles.ctaPrimary,
              hovered && styles.ctaPrimaryHover,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaPrimaryText}>Смотреть маршруты →</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/map' as any)}
            accessibilityRole="link"
            accessibilityLabel="Открыть карту"
            style={({ pressed, hovered }: any) => [
              styles.ctaSecondary,
              hovered && styles.ctaSecondaryHover,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaSecondaryText}>Открыть карту</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: '#9DD2F7',
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(43,111,160,0.25)' },
      ios: {
        shadowColor: '#2B6FA0',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
    }),
  },
  sun: {
    position: 'absolute',
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  titleWrapWide: {
    top: 70,
    paddingHorizontal: 56,
  },
  titleWrapNarrow: {
    top: 36,
    paddingHorizontal: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#2B6FA0',
  },
  title: {
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
    marginBottom: 8,
    maxWidth: 560,
  },
  subtitle: {
    color: '#ffffff',
    fontWeight: '500',
    maxWidth: 520,
    ...Platform.select({
      web: { textShadow: '0 1px 4px rgba(0,0,0,0.2)' } as any,
    }),
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  ctaPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  ctaPrimaryHover: Platform.select({
    web: { transform: [{ translateY: -2 }], boxShadow: '0 10px 22px rgba(0,0,0,0.22)' } as any,
    default: {},
  }) as any,
  ctaPrimaryText: {
    color: '#1F5C8A',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  ctaSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'background-color 0.2s ease' } as any,
      default: {},
    }),
  },
  ctaSecondaryHover: Platform.select({
    web: { backgroundColor: 'rgba(255,255,255,0.32)' } as any,
    default: {},
  }) as any,
  ctaSecondaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});

export default HeroBanner;
