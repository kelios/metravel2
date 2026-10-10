/**
 * Декор финальной страницы книги (#2368): эмблема-глобус с орбитой и самолётом,
 * рельеф фоном, маршрут талона, штемпель и кавычка.
 *
 * Всё рисуется линиями одного цвета — цвета текста обложки темы с альфой, —
 * поэтому страница читается и на тёмных обложках, и на светлой
 * («Иллюстрированная»). Однотонная `rgba` печатается в WebKit верно; альфа
 * теряется только у цветов внутри градиентов (#2275), поэтому градиентов здесь
 * нет. Текста в SVG тоже нет: проверка обрезки воркера книги меряет текстовые
 * узлы, а у `<svg>` по умолчанию `overflow: hidden`.
 */
import { renderPdfIcon } from '../pdfVisualHelpers'

/** `#rgb`/`#rrggbb` → `rgba(r,g,b,a)`; нераспознанный цвет — белый. */
export function inkWithAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const value = /^[0-9a-f]{6}$/i.test(full) ? parseInt(full, 16) : 0xffffff
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

const round = (value: number): number => Math.round(value * 10) / 10

/** Силуэт самолёта носом вверх, центр — (12, 12). */
const PLANE_PATH =
  'M12 2C12.8 2 13.3 2.9 13.3 4V9.2L21 13.6V15.6L13.3 13.3V18.6L15.4 20.2V21.8L12 20.9L8.6 21.8V20.2L10.7 18.6V13.3L3 15.6V13.6L10.7 9.2V4C10.7 2.9 11.2 2 12 2Z'

/**
 * Одна горизонталь рельефа: замкнутая кривая вокруг (cx, cy), радиус слегка
 * «дышит» по углу, фаза сдвигается от кольца к кольцу. Сглаживание —
 * квадратичные сегменты через середины соседних точек. Детерминированно:
 * эталоны книги не плавают.
 */
function contourRing(cx: number, cy: number, radius: number, ring: number): string {
  const steps = 28
  const points: Array<[number, number]> = []
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    const wobble = 1
      + 0.09 * Math.sin(3 * angle + ring * 0.38)
      + 0.05 * Math.sin(5 * angle + 1.3 + ring * 0.21)
      + 0.03 * Math.sin(2 * angle + ring * 0.55)
    points.push([cx + radius * wobble * Math.cos(angle), cy + radius * 0.82 * wobble * Math.sin(angle)])
  }
  const mid = (a: [number, number], b: [number, number]): string =>
    `${round((a[0] + b[0]) / 2)} ${round((a[1] + b[1]) / 2)}`
  let d = `M${mid(points[steps - 1], points[0])}`
  for (let i = 0; i < steps; i += 1) {
    const point = points[i]
    d += `Q${round(point[0])} ${round(point[1])} ${mid(point, points[(i + 1) % steps])}`
  }
  return `${d}Z`
}

/** Рельеф в двух углах страницы; координаты — миллиметры секции 210×285. */
export function buildContourLayer(ink: string): string {
  const cluster = (cx: number, cy: number, rings: number): string =>
    Array.from({ length: rings }, (_, ring) => contourRing(cx, cy, 12 + ring * 7.5, ring)).join('')
  return `
        <svg class="final-contours" viewBox="0 0 210 285" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        ">
          <path d="${cluster(-4, 34, 9)}" fill="none" stroke="${inkWithAlpha(ink, 0.1)}" stroke-width="0.3"/>
          <path d="${cluster(216, 252, 9)}" fill="none" stroke="${inkWithAlpha(ink, 0.1)}" stroke-width="0.3"/>
        </svg>`
}

/** Точка орбиты (эллипс с наклоном) и направление полёта при убывании параметра. */
function orbitPoint(t: number) {
  const [cx, cy, rx, ry, tilt] = [100, 60, 88, 24, (-16 * Math.PI) / 180]
  const [ex, ey] = [rx * Math.cos(t), ry * Math.sin(t)]
  const [hx, hy] = [rx * Math.sin(t), -ry * Math.cos(t)]
  return {
    x: cx + ex * Math.cos(tilt) - ey * Math.sin(tilt),
    y: cy + ex * Math.sin(tilt) + ey * Math.cos(tilt),
    heading: (Math.atan2(hx * Math.sin(tilt) + hy * Math.cos(tilt), hx * Math.cos(tilt) - hy * Math.sin(tilt)) * 180) / Math.PI,
  }
}

/** Дуга орбиты от параметра `from` к `to` (по убыванию параметра). */
function orbitArc(from: number, to: number): string {
  const start = orbitPoint(from)
  const end = orbitPoint(to)
  const large = Math.abs(from - to) > Math.PI ? 1 : 0
  return `M${round(start.x)} ${round(start.y)}A88 24 -16 ${large} 0 ${round(end.x)} ${round(end.y)}`
}

/**
 * Эмблема: глобус в сетке меридианов и параллелей, вокруг — орбита-маршрут.
 * Верхняя половина орбиты «за» глобусом и бледнее; по передней половине слева
 * направо летит самолёт: пройденный путь — штрихом, оставшийся — пунктиром.
 *
 * Эмблема — единственный сжимаемый элемент колонки страницы: длинная цитата,
 * заголовок в две строки и полный талон уменьшают её, а не выталкивают текст за
 * 285 мм (переполнение финала роняет сборку закреплённой книги в воркере).
 */
export function buildEmblemSvg(ink: string): string {
  const plane = orbitPoint(Math.PI * 0.3)
  const origin = orbitPoint(Math.PI)
  const line = inkWithAlpha(ink, 0.42)
  const sparkle = (x: number, y: number, size: number): string =>
    `<path d="M${x} ${y - size}L${round(x + size * 0.28)} ${round(y - size * 0.28)}L${x + size} ${y}L${round(x + size * 0.28)} ${round(y + size * 0.28)}L${x} ${y + size}L${round(x - size * 0.28)} ${round(y + size * 0.28)}L${x - size} ${y}L${round(x - size * 0.28)} ${round(y - size * 0.28)}Z" fill="${inkWithAlpha(ink, 0.55)}"/>`
  return `
        <svg class="final-emblem" viewBox="0 0 200 120" aria-hidden="true" style="
          position: relative;
          display: block;
          width: 96mm;
          height: 57.6mm;
          min-height: 0;
          flex-shrink: 1;
        ">
          <path d="${orbitArc(Math.PI * 2, Math.PI)}" fill="none" stroke="${inkWithAlpha(ink, 0.22)}" stroke-width="0.9" stroke-dasharray="2.5 3" stroke-linecap="round"/>
          <circle cx="100" cy="60" r="36" fill="none" stroke="${inkWithAlpha(ink, 0.7)}" stroke-width="1.2"/>
          <ellipse cx="100" cy="60" rx="18" ry="36" fill="none" stroke="${line}" stroke-width="0.8"/>
          <ellipse cx="100" cy="60" rx="31.2" ry="36" fill="none" stroke="${line}" stroke-width="0.8"/>
          <path d="M100 24V96M64 60H136M68.8 42H131.2M68.8 78H131.2M82 28.8H118M82 91.2H118" fill="none" stroke="${line}" stroke-width="0.8"/>
          <path d="${orbitArc(Math.PI, Math.PI * 0.3)}" fill="none" stroke="${inkWithAlpha(ink, 0.8)}" stroke-width="1.1" stroke-dasharray="5 3.5" stroke-linecap="round"/>
          <path d="${orbitArc(Math.PI * 0.3, 0)}" fill="none" stroke="${inkWithAlpha(ink, 0.4)}" stroke-width="1" stroke-dasharray="0.1 3.2" stroke-linecap="round"/>
          <circle cx="${round(origin.x)}" cy="${round(origin.y)}" r="2.6" fill="${ink}"/>
          <circle cx="${round(origin.x)}" cy="${round(origin.y)}" r="5" fill="none" stroke="${inkWithAlpha(ink, 0.45)}" stroke-width="0.8"/>
          <path d="${PLANE_PATH}" fill="${ink}" transform="translate(${round(plane.x)} ${round(plane.y)}) rotate(${round(plane.heading + 90)}) scale(0.62) translate(-12 -12)"/>
          ${sparkle(34, 22, 3.2)}
          ${sparkle(166, 98, 2.6)}
          ${sparkle(156, 18, 1.8)}
        </svg>`
}

/** Шапка талона: точка отправления — пунктир — точка назначения (булавка). */
export function buildTicketRoute(ink: string): string {
  return `
          <div class="final-route-line" aria-hidden="true" style="
            display: flex;
            align-items: center;
            gap: 2.5mm;
            padding: 4mm 7mm 3.5mm;
          ">
            <span style="
              width: 2.4mm;
              height: 2.4mm;
              border-radius: 50%;
              border: 1px solid ${inkWithAlpha(ink, 0.8)};
              flex-shrink: 0;
            "></span>
            <span style="
              flex: 1;
              height: 0;
              border-top: 1px dashed ${inkWithAlpha(ink, 0.45)};
            "></span>
            <svg viewBox="0 0 24 24" width="12" height="12" style="flex-shrink: 0;">
              <path d="${PLANE_PATH}" fill="${inkWithAlpha(ink, 0.85)}" transform="rotate(90 12 12)"/>
            </svg>
            <span style="
              flex: 1;
              height: 0;
              border-top: 1px dashed ${inkWithAlpha(ink, 0.45)};
            "></span>
            ${renderPdfIcon('map-pin', inkWithAlpha(ink, 0.85), 12, { wrapper: false })}
          </div>`
}

/** Декоративная открывающая кавычка над цитатой. */
export function buildQuoteMark(ink: string): string {
  return `
            <svg viewBox="0 0 40 28" aria-hidden="true" style="
              display: block;
              width: 8.5mm;
              height: 6mm;
              margin: 0 auto 3.5mm;
            ">
              <path d="M2 28V16.5C2 8.4 6.6 2.6 15 0.5L16.4 4C11.8 5.6 9.4 8.6 9.2 13H16V28ZM22 28V16.5C22 8.4 26.6 2.6 35 0.5L36.4 4C31.8 5.6 29.4 8.6 29.2 13H36V28Z" fill="${inkWithAlpha(ink, 0.38)}"/>
            </svg>`
}

/** Кольца штемпеля и волны гашения справа; надписи штемпеля — HTML поверх. */
export function buildPostmarkRings(ink: string): string {
  return `
            <svg viewBox="0 0 60 60" aria-hidden="true" style="
              position: absolute;
              top: 0; left: 0;
              width: 100%;
              height: 100%;
            ">
              <circle cx="30" cy="30" r="29" fill="none" stroke="${inkWithAlpha(ink, 0.6)}" stroke-width="0.9"/>
              <circle cx="30" cy="30" r="26.6" fill="none" stroke="${inkWithAlpha(ink, 0.45)}" stroke-width="0.5"/>
              <circle cx="30" cy="30" r="24.2" fill="none" stroke="${inkWithAlpha(ink, 0.55)}" stroke-width="1" stroke-dasharray="0.1 2.4" stroke-linecap="round"/>
            </svg>`
}

export function buildPostmarkWaves(ink: string): string {
  const waves = [4, 8.5, 13, 17.5]
    .map((y) => `M0 ${y}Q3.5 ${y - 2.6} 7 ${y}T14 ${y}T21 ${y}T28 ${y}T35 ${y}T42 ${y}T49 ${y}T56 ${y}`)
    .join('')
  return `
          <svg viewBox="0 0 56 21.5" aria-hidden="true" style="
            position: absolute;
            top: 50%;
            left: calc(50% + 17mm);
            width: 38mm;
            height: 14.6mm;
            margin-top: -7.3mm;
          ">
            <path d="${waves}" fill="none" stroke="${inkWithAlpha(ink, 0.38)}" stroke-width="0.8" stroke-linecap="round"/>
          </svg>`
}
