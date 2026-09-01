import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Угловой scrim под frost-чипами в правом верхнем углу обложки профиля.
 * Единственный источник для своего профиля (`ProfileHeader`) и чужого
 * (`PublicProfileHeader`): раньше стиль был скопирован в оба файла дословно.
 *
 * Native-ветка `Platform.select` держала там плоскую заливку вместо градиента,
 * и блок 132×60 читался на телефоне как тёмный прямоугольник с резкой границей
 * (#1670). Здесь один `LinearGradient` на все платформы.
 *
 * Геометрия важна и не произвольна. Ось градиента идёт из правого верхнего угла
 * блока в левый нижний, а `t` считается проекцией на неё в ПИКСЕЛЯХ — одинаково
 * у Android-шейдера (`android.graphics.LinearGradient`, TileMode.CLAMP) и iOS
 * (`CGContext.drawLinearGradient` по `start`/`end`, умноженным на размер слоя).
 * Web-обёртка берёт из `start`/`end` только УГОЛ, а длину градиентной линии CSS
 * считает сам по проекции бокса, поэтому ось обязана оставаться «из угла в
 * угол»: лишь тогда длина CSS-линии равна |end − start| и стопы значат на web
 * то же, что на native.
 *
 * Из пиксельной проекции следует: затемнение обязано погаснуть раньше, чем
 * дойдёт до кромки блока, иначе шов просто переедет на другую сторону:
 *
 *   t(левая кромка) = W²/(W²+H²),  t(нижняя кромка) = H²/(W²+H²)
 *
 * Отсюда `fadeStop` = min(W,H)²/(W²+H²) — на обеих кромках альфа ровно 0.
 * Высота блока равна высоте обложки, поэтому нижняя кромка совпадает с нижним
 * краем кадра, а единственная внутренняя граница — левая — полностью прозрачна.
 * Чипы меню читаются собственной подложкой, scrim даёт только глубину.
 */
const SCRIM_WIDTH = 200;
const DEFAULT_COVER_HEIGHT = 132;
const SCRIM_ALPHA = 0.42;

interface CoverScrimProps {
  /** Высота обложки: нижняя кромка scrim'а обязана совпадать с краем кадра. */
  coverHeight?: number;
}

export function CoverScrim({ coverHeight = DEFAULT_COVER_HEIGHT }: CoverScrimProps) {
  const { style, locations } = useMemo(() => {
    const w = SCRIM_WIDTH;
    const h = coverHeight;
    const fadeStop = Math.min(w, h) ** 2 / (w ** 2 + h ** 2);

    return {
      style: {
        position: 'absolute' as const,
        top: 0,
        right: 0,
        width: w,
        height: h,
        zIndex: 1,
      },
      locations: [0, fadeStop] as [number, number],
    };
  }, [coverHeight]);

  return (
    <LinearGradient
      colors={[`rgba(0,0,0,${SCRIM_ALPHA})`, 'rgba(0,0,0,0)']}
      locations={locations}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={style}
      pointerEvents="none"
    />
  );
}

export default CoverScrim;
