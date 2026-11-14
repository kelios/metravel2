/**
 * Геометрия маршрута (#3357): длина по координатам, склейка путей OSM в непрерывные цепочки и
 * равномерная расстановка точек вдоль цепочки — вход расчёта рельефа. Чистые функции, без сети.
 */

/** `[широта, долгота]` в градусах. */
export type Point = readonly [number, number]

const EARTH_RADIUS_M = 6_371_008.8
const rad = (degrees: number): number => (degrees * Math.PI) / 180

/** Расстояние по большому кругу, м. */
export function haversineM(a: Point, b: Point): number {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function lineLengthM(line: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < line.length; i += 1) total += haversineM(line[i - 1], line[i])
  return total
}

/** Узел OSM в двух путях имеет одни и те же координаты: ключ — координаты до 1e-7 градуса. */
const nodeKey = (point: Point): string => `${Math.round(point[0] * 1e7)}:${Math.round(point[1] * 1e7)}`

/**
 * Склейка путей в цепочки в порядке членов отношения. Следующий путь присоединяется к концу текущей
 * цепочки общим узлом (при нужде разворачивается); первый путь цепочки разворачивается, если второй
 * стыкуется с его началом. Нет продолжения — разрыв: цепочка закрывается, начинается новая со
 * следующего по порядку пути. Каждый путь входит в результат один раз.
 */
export function stitchWays(ways: readonly (readonly Point[])[]): Point[][] {
  const usable = ways.filter((way) => way.length >= 2)
  const used = new Array<boolean>(usable.length).fill(false)
  const byEnd = new Map<string, number[]>()
  usable.forEach((way, index) => {
    for (const key of new Set([nodeKey(way[0]), nodeKey(way[way.length - 1])])) {
      const list = byEnd.get(key)
      if (list) list.push(index)
      else byEnd.set(key, [index])
    }
  })
  const nextAt = (point: Point): number | undefined => byEnd.get(nodeKey(point))?.find((index) => !used[index])
  const chains: Point[][] = []
  let cursor = 0
  for (;;) {
    while (cursor < usable.length && used[cursor]) cursor += 1
    if (cursor >= usable.length) break
    used[cursor] = true
    let chain: Point[] = [...usable[cursor]]
    // Первый путь мог быть нарисован «навстречу»: продолжение стыкуется с его началом.
    if (nextAt(chain[chain.length - 1]) === undefined && nextAt(chain[0]) !== undefined) chain = chain.reverse()
    for (;;) {
      const tail = chain[chain.length - 1]
      const index = nextAt(tail)
      if (index === undefined) break
      used[index] = true
      const way = usable[index]
      const forward = nodeKey(way[0]) === nodeKey(tail)
      const ordered = forward ? way : [...way].reverse()
      for (let i = 1; i < ordered.length; i += 1) chain.push(ordered[i])
    }
    chains.push(chain)
  }
  return chains
}

/**
 * Точки вдоль линии с равным шагом (линейная интерполяция по широте и долготе — на шаге в десятки
 * метров отличие от большого круга меньше сантиметра). Первая и последняя точки линии сохраняются.
 */
export function resampleLine(line: readonly Point[], stepM: number): Point[] {
  if (line.length < 2 || !(stepM > 0)) return [...line]
  const out: Point[] = [line[0]]
  let carried = 0
  for (let i = 1; i < line.length; i += 1) {
    const from = line[i - 1]
    const to = line[i]
    const segment = haversineM(from, to)
    if (segment === 0) continue
    let at = stepM - carried
    while (at <= segment) {
      const t = at / segment
      out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])
      at += stepM
    }
    carried = segment - (at - stepM)
  }
  const last = line[line.length - 1]
  const tail = out[out.length - 1]
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last)
  return out
}

/** Граница маршрута: `[южная широта, западная долгота, северная широта, восточная долгота]`. */
export function boundsOf(lines: readonly (readonly Point[])[]): [number, number, number, number] | null {
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const line of lines) {
    for (const [lat, lon] of line) {
      if (lat < south) south = lat
      if (lat > north) north = lat
      if (lon < west) west = lon
      if (lon > east) east = lon
    }
  }
  return Number.isFinite(south) ? [south, west, north, east] : null
}
