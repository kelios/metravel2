import { memo, useMemo } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
} from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import {
  badgeMotif,
  categoryPalette,
  tierFrame,
  TIER_VISUALS,
  type MotifKey,
  type TierFrame,
} from '@/components/achievements/badgeVisuals';
import {
  lineFor,
  paperFor,
} from '@/components/achievements/engravingPaper';

interface Props {
  badge: Badge;
  /** Диаметр эмблемы в px. */
  size?: number;
}

// Внутренние координаты SVG — нормированный квадрат 100×100.
const VB = 100;
const C = VB / 2;

// ── Мотивы: тонкая гравюрная линия, без заливок-плашек ───────────────────────
// Каждый рисуется в зоне ~26..74 по обеим осям (центр диска).

function Motif({ motif, stroke }: { motif: MotifKey; stroke: string }) {
  const sw = 2;
  const common = {
    stroke,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  switch (motif) {
    case 'star':
      return (
        <Polygon
          {...common}
          points="50,30 56,44 71,44 59,53 63,68 50,59 37,68 41,53 29,44 44,44"
        />
      );
    case 'footprint':
      // Силуэт стопы: вытянутая пятка снизу + округлая подушечка сверху,
      // над ней — ряд из 4 пальцев. Узнаётся как след на 64px.
      return (
        <G {...common}>
          {/* подушечка стопы + свод + пятка (цельный контур) */}
          <Path d="M42 44 C40 50 40 58 43 64 C45 69 53 69 55 64 C58 58 58 50 56 44 C55 41 52 39 49 39 C46 39 43 41 42 44 Z" />
          {/* ряд пальцев над подушечкой */}
          <Circle cx={42} cy={36} r={2.6} fill={stroke} stroke="none" />
          <Circle cx={47} cy={33} r={2.8} fill={stroke} stroke="none" />
          <Circle cx={52} cy={33} r={2.8} fill={stroke} stroke="none" />
          <Circle cx={57} cy={36} r={2.6} fill={stroke} stroke="none" />
        </G>
      );
    case 'profile':
      return (
        <G {...common}>
          <Circle cx={50} cy={43} r={8} />
          <Path d="M36 66 C36 56 44 52 50 52 C56 52 64 56 64 66" />
          <Polyline points="58,46 62,50 70,40" />
        </G>
      );
    case 'quill':
      return (
        <G {...common}>
          <Path d="M64 32 C52 38 42 50 38 64 L46 60 C50 50 58 42 66 36 Z" />
          <Line x1={38} y1={64} x2={46} y2={60} />
          <Line x1={34} y1={68} x2={42} y2={62} />
        </G>
      );
    case 'book':
      return (
        <G {...common}>
          <Path d="M30 38 C38 34 46 34 50 38 C54 34 62 34 70 38 L70 64 C62 60 54 60 50 64 C46 60 38 60 30 64 Z" />
          <Line x1={50} y1={38} x2={50} y2={64} />
        </G>
      );
    case 'mountain':
      return (
        <G {...common}>
          <Polyline points="28,66 42,44 50,55 60,36 72,66" />
          <Polyline points="36,55 42,44 47,52" />
          <Circle cx={65} cy={34} r={5} />
          <Line x1={65} y1={29} x2={65} y2={26} />
          <Line x1={65} y1={39} x2={65} y2={42} />
          <Line x1={60} y1={34} x2={57} y2={34} />
          <Line x1={70} y1={34} x2={73} y2={34} />
        </G>
      );
    case 'bicycle':
      return (
        <G {...common}>
          <Circle cx={36} cy={58} r={10} />
          <Circle cx={64} cy={58} r={10} />
          <Polyline points="36,58 48,42 60,42" />
          <Line x1={48} y1={42} x2={64} y2={58} />
          <Line x1={50} y1={58} x2={64} y2={58} />
          <Line x1={56} y1={42} x2={59} y2={37} />
        </G>
      );
    case 'car':
      return (
        <G {...common}>
          <Path d="M28 56 L34 56 L40 46 L60 46 L66 56 L72 56 L72 62 L28 62 Z" />
          <Circle cx={40} cy={62} r={4} />
          <Circle cx={60} cy={62} r={4} />
          <Polyline points="30,40 38,36 50,36" />
        </G>
      );
    case 'wave':
      return (
        <G {...common}>
          <Path d="M28 44 C34 38 40 38 46 44 C52 50 58 50 64 44 C68 40 70 40 72 42" />
          <Line x1={50} y1={50} x2={50} y2={66} />
          <Path d="M42 60 C42 67 50 70 50 70 C50 70 58 67 58 60" />
          <Line x1={45} y1={54} x2={55} y2={54} />
        </G>
      );
    case 'city':
      return (
        <G {...common}>
          <Polyline points="28,66 28,52 36,52 36,42 46,42 46,56 56,56 56,38 66,38 66,52 72,52 72,66" />
          <Line x1={40} y1={48} x2={40} y2={52} />
          <Line x1={60} y1={44} x2={60} y2={48} />
        </G>
      );
    case 'flag':
      return (
        <G {...common}>
          <Line x1={40} y1={30} x2={40} y2={70} />
          <Path d="M40 32 L66 38 L40 48 Z" />
          <Polyline points="34,70 46,70" />
        </G>
      );
    case 'route':
      return (
        <G {...common}>
          <Path
            d="M34 64 C34 56 46 56 46 48 C46 40 58 40 60 34"
            strokeDasharray="3 4"
          />
          <Circle cx={34} cy={64} r={3} />
          <Path d="M60 30 C66 30 66 38 60 44 C54 38 54 30 60 30 Z" />
          <Circle cx={60} cy={35} r={1.6} />
        </G>
      );
    case 'heart':
      return (
        <G {...common}>
          <Path d="M50 66 C36 56 30 48 30 42 C30 35 38 33 44 38 C46 40 48 42 50 45 C52 42 54 40 56 38 C62 33 70 35 70 42 C70 48 64 56 50 66 Z" />
          <Line x1={26} y1={36} x2={22} y2={34} />
          <Line x1={74} y1={36} x2={78} y2={34} />
        </G>
      );
    case 'globe':
      return (
        <G {...common}>
          <Circle cx={50} cy={50} r={18} />
          <Line x1={32} y1={50} x2={68} y2={50} />
          <Path d="M50 32 C40 38 40 62 50 68" />
          <Path d="M50 32 C60 38 60 62 50 68" />
          <Circle cx={42} cy={44} r={1.8} fill={stroke} />
          <Circle cx={58} cy={56} r={1.8} fill={stroke} />
        </G>
      );
    case 'calendar':
      return (
        <G {...common}>
          <Path d="M32 38 L68 38 L68 68 L32 68 Z" />
          <Line x1={32} y1={46} x2={68} y2={46} />
          <Line x1={40} y1={34} x2={40} y2={40} />
          <Line x1={60} y1={34} x2={60} y2={40} />
          <Polyline points="42,60 50,52 58,60" />
          <Line x1={50} y1={52} x2={50} y2={64} />
        </G>
      );
    case 'laurel':
    default:
      return (
        <G {...common}>
          <Path d="M40 68 C32 58 32 44 40 34" />
          <Path d="M60 68 C68 58 68 44 60 34" />
          <Line x1={40} y1={42} x2={34} y2={40} />
          <Line x1={40} y1={50} x2={33} y2={49} />
          <Line x1={40} y1={58} x2={34} y2={58} />
          <Line x1={60} y1={42} x2={66} y2={40} />
          <Line x1={60} y1={50} x2={67} y2={49} />
          <Line x1={60} y1={58} x2={66} y2={58} />
          <Circle cx={50} cy={40} r={4} />
        </G>
      );
  }
}

// ── Рамка тира ───────────────────────────────────────────────────────────────

function laurelBranch(side: 'l' | 'r'): string {
  const x = side === 'l' ? 22 : 78;
  const dir = side === 'l' ? 1 : -1;
  // Дуга ветви снизу-сбоку к низу.
  return `M${x} 70 C${x + dir * 2} 58 ${x + dir * 2} 44 ${x + dir * 8} 36`;
}

function TierFrameLayer({
  frame,
  ring,
  highlight,
}: {
  frame: TierFrame;
  ring: string;
  highlight: string;
}) {
  const sw = 2.5;
  const ringR = 46;
  const base = (
    <Circle cx={C} cy={C} r={ringR} stroke={ring} strokeWidth={sw} fill="none" />
  );

  if (frame === 'plain') return base;

  if (frame === 'double') {
    return (
      <G>
        {base}
        <Circle cx={C} cy={C} r={ringR - 4} stroke={highlight} strokeWidth={1.4} fill="none" />
      </G>
    );
  }

  if (frame === 'laurel') {
    return (
      <G>
        {base}
        <Circle cx={C} cy={C} r={ringR - 4} stroke={highlight} strokeWidth={1.2} fill="none" />
        <G stroke={ring} strokeWidth={2} fill="none" strokeLinecap="round">
          <Path d={laurelBranch('l')} />
          <Path d={laurelBranch('r')} />
          <Line x1={22} y1={56} x2={17} y2={54} />
          <Line x1={24} y1={48} x2={19} y2={45} />
          <Line x1={78} y1={56} x2={83} y2={54} />
          <Line x1={76} y1={48} x2={81} y2={45} />
        </G>
      </G>
    );
  }

  if (frame === 'ornate') {
    // Орнамент-зубцы по кольцу.
    const teeth = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x1 = C + Math.cos(a) * ringR;
      const y1 = C + Math.sin(a) * ringR;
      const x2 = C + Math.cos(a) * (ringR + 3.5);
      const y2 = C + Math.sin(a) * (ringR + 3.5);
      teeth.push(
        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ring} strokeWidth={1.6} />,
      );
    }
    return (
      <G>
        {base}
        <Circle cx={C} cy={C} r={ringR - 4} stroke={highlight} strokeWidth={1.2} fill="none" />
        {teeth}
      </G>
    );
  }

  // rays — лучи + звёзды по краю (legendary, явный топ-тир: толстые длинные
  // лучи двух длин, двойное свечение-кольцо, крупные яркие звёзды + highlight-блик).
  const rays = [];
  const stars = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const outer = long ? ringR + 8.5 : ringR + 5;
    const x1 = C + Math.cos(a) * (ringR + 1.5);
    const y1 = C + Math.sin(a) * (ringR + 1.5);
    const x2 = C + Math.cos(a) * outer;
    const y2 = C + Math.sin(a) * outer;
    rays.push(
      <Line
        key={`r${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={ring}
        strokeWidth={long ? 3 : 2.2}
        strokeLinecap="round"
      />,
    );
    if (i % 3 === 0) {
      const sx = C + Math.cos(a) * (ringR - 1);
      const sy = C + Math.sin(a) * (ringR - 1);
      const r = 4.2;
      const inner = r * 0.42;
      const pts: string[] = [];
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 === 0 ? r : inner;
        const aa = (k / 10) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${(sx + Math.cos(aa) * rr).toFixed(2)},${(sy + Math.sin(aa) * rr).toFixed(2)}`);
      }
      stars.push(<Polygon key={`s${i}`} points={pts.join(' ')} fill={highlight} />);
      // яркий центральный блик звезды
      stars.push(<Circle key={`sc${i}`} cx={sx} cy={sy} r={1.1} fill="#FFFFFF" opacity={0.9} />);
    }
  }
  return (
    <G>
      {/* внешнее свечение-кольцо */}
      <Circle cx={C} cy={C} r={ringR + 2.5} stroke={highlight} strokeWidth={1.4} fill="none" opacity={0.6} />
      {base}
      <Circle cx={C} cy={C} r={ringR - 4} stroke={highlight} strokeWidth={1.6} fill="none" />
      {/* верхний highlight-блик на кольце */}
      <Path
        d={`M${C - 26} ${C - 38} A ${ringR} ${ringR} 0 0 1 ${C + 26} ${C - 38}`}
        stroke="#FFFFFF"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      {rays}
      {stars}
    </G>
  );
}

// ── Лента-баннер снизу ───────────────────────────────────────────────────────

function Banner({ ring, shade }: { ring: string; shade: string }) {
  return (
    <G>
      {/* хвосты ленты */}
      <Polygon points="18,76 30,72 30,82 22,86" fill={shade} />
      <Polygon points="82,76 70,72 70,82 78,86" fill={shade} />
      {/* основное тело */}
      <Polygon points="28,72 72,72 76,80 72,88 28,88 24,80" fill={ring} />
      <Polyline
        points="30,75 70,75"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
        fill="none"
      />
    </G>
  );
}

function BadgeEmblem({ badge, size = 72 }: Props) {
  const { isDark } = useTheme();

  const data = useMemo(() => {
    const tier = TIER_VISUALS[badge.tier];
    const pal = categoryPalette(badge.categorySlug);
    return {
      paper: paperFor(pal.paper, isDark),
      line: lineFor(pal.line, isDark),
      ring: tier.ring,
      highlight: tier.highlight,
      shade: tier.shade,
      frame: tierFrame(badge.tier),
      motif: badgeMotif(badge.categorySlug, badge.slug),
    };
  }, [badge.categorySlug, badge.slug, badge.tier, isDark]);

  const a11y =
    Platform.OS === 'web'
      ? ({ 'aria-hidden': true, focusable: false } as Record<string, unknown>)
      : ({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        } as const);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} {...a11y}>
      {/* диск состаренной бумаги */}
      <Circle cx={C} cy={C} r={48} fill={data.paper} />
      {/* внутренняя engraving-обводка */}
      <Circle cx={C} cy={C} r={41} stroke={data.line} strokeWidth={1} fill="none" opacity={0.55} />
      {/* центральный мотив */}
      <Motif motif={data.motif} stroke={data.line} />
      {/* рамка-индикатор тира */}
      <TierFrameLayer frame={data.frame} ring={data.ring} highlight={data.highlight} />
      {/* лента-баннер снизу */}
      <Banner ring={data.ring} shade={data.shade} />
    </Svg>
  );
}

export default memo(BadgeEmblem);
