import zlib from 'zlib'

import { DEM_PRODUCTS, decodeFloatBlock, parseTiffLayout, tileName, tileUrl } from '@/scripts/ai-index/world/dem'
import { climb, mergeStats, profileStats, smoothProfile } from '@/scripts/ai-index/world/elevation'
import { boundsOf, haversineM, lineLengthM, type Point, resampleLine, stitchWays } from '@/scripts/ai-index/world/geo'
import { assembleRoute, overpassProblem, routeQuery, SIDE_ROLES, TAGGED_QUERY } from '@/scripts/ai-index/world/overpass'

import { ROUTE_ELEMENTS } from './world.fixture'

describe('внешний индекс маршрутов: длина по геометрии', () => {
  it('градус широты — около 111,2 км, сотая градуса — около 1,112 км', () => {
    expect(haversineM([46, 7], [47, 7]) / 1000).toBeCloseTo(111.195, 2)
    expect(lineLengthM([[46, 7], [46.01, 7], [46.02, 7]])).toBeCloseTo(2223.9, 0)
    expect(lineLengthM([[46, 7]])).toBe(0)
  })

  it('склеивает пути в одну цепочку, разворачивая нарисованные навстречу', () => {
    const a: Point[] = [[46, 7], [46.01, 7]]
    const b: Point[] = [[46.02, 7], [46.01, 7]]
    const c: Point[] = [[46.02, 7], [46.03, 7]]
    const chains = stitchWays([a, b, c])
    expect(chains).toHaveLength(1)
    expect(chains[0].map(([lat]) => lat)).toEqual([46, 46.01, 46.02, 46.03])
  })

  it('разворачивает первый путь, если продолжение стыкуется с его началом', () => {
    const chains = stitchWays([[[46.01, 7], [46, 7]], [[46.01, 7], [46.02, 7]]])
    expect(chains).toHaveLength(1)
    expect(chains[0].map(([lat]) => lat)).toEqual([46, 46.01, 46.02])
  })

  it('разрыв даёт вторую цепочку, каждый путь входит один раз', () => {
    const chains = stitchWays([[[46, 7], [46.01, 7]], [[46.5, 7], [46.51, 7]], [[46.01, 7], [46.02, 7]]])
    expect(chains).toHaveLength(2)
    expect(chains.reduce((sum, chain) => sum + lineLengthM(chain), 0)).toBeCloseTo(3 * 1111.95, 0)
  })

  it('расставляет точки с равным шагом и сохраняет концы линии', () => {
    const line: Point[] = [[46, 7], [46.01, 7], [46.02, 7]]
    const points = resampleLine(line, 100)
    expect(points[0]).toEqual(line[0])
    expect(points[points.length - 1]).toEqual(line[2])
    // 2224 м при шаге 100 м: начало, 22 шага и конец.
    expect(points).toHaveLength(24)
    for (let i = 1; i < points.length - 1; i += 1) expect(haversineM(points[i - 1], points[i])).toBeCloseTo(100, 0)
    expect(lineLengthM(points)).toBeCloseTo(lineLengthM(line), 1)
  })

  // #3431 А4: отрезок через линию перемены дат идёт коротким путём.
  it('линия перемены дат: точки остаются у 180-го меридиана, а не встают поперёк земного шара', () => {
    for (const line of [[[-16.8, 179.99], [-16.8, -179.99]], [[-16.8, -179.99], [-16.8, 179.99]]] as Point[][]) {
      const points = resampleLine(line, 100)
      expect(points[0]).toEqual(line[0])
      expect(points[points.length - 1]).toEqual(line[1])
      // 0,02° долготы на этой широте — около 2,1 км: два десятка шагов, а не сорок тысяч километров.
      expect(points.length).toBeGreaterThan(15)
      expect(points.length).toBeLessThan(30)
      for (const [lat, lon] of points) {
        expect(lat).toBeCloseTo(-16.8, 6)
        expect(Math.abs(lon)).toBeGreaterThanOrEqual(179.98)
        expect(Math.abs(lon)).toBeLessThanOrEqual(180)
      }
      for (let i = 1; i < points.length - 1; i += 1) expect(haversineM(points[i - 1], points[i])).toBeCloseTo(100, 0)
      expect(lineLengthM(points)).toBeCloseTo(lineLengthM(line), 1)
    }
    // Обычный отрезок правка не меняет.
    expect(resampleLine([[46, 7], [46, 7.001]], 30)[1][1]).toBeGreaterThan(7)
  })

  it('границы маршрута — по всем цепочкам', () => {
    expect(boundsOf([[[46, 7], [46.02, 7.1]], [[45.9, 6.9], [46, 7]]])).toEqual([45.9, 6.9, 46.02, 7.1])
    expect(boundsOf([])).toBeNull()
  })
})

describe('внешний индекс маршрутов: разбор отношения OSM', () => {
  it('запрос спускается по подотношениям и просит геометрию путей', () => {
    expect(routeQuery(124456)).toContain('rel(124456)->.r0')
    expect(routeQuery(124456)).toContain('out tags geom')
    expect(SIDE_ROLES.has('alternative')).toBe(true)
  })

  it('ответ с оборванным запросом, без геометрии путей или не JSON в кэш не идёт', () => {
    const body = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    expect(overpassProblem(body({ elements: ROUTE_ELEMENTS }))).toBeNull()
    expect(overpassProblem(body({ elements: [] }))).toBeNull()
    expect(overpassProblem(body('<html>504 Gateway Time-out</html>'))).toMatch(/не JSON/)
    expect(overpassProblem(body({ remark: 'runtime error: Query timed out in "query" at line 1 after 181 seconds.', elements: [] }))).toMatch(/timed out/)
    expect(overpassProblem(body({ elements: [{ type: 'way', id: 1, tags: {} }] }))).toMatch(/без геометрии/)
    expect(overpassProblem(body({ version: 0.6 }))).toMatch(/нет списка/)
  })

  it('запрос отношений с тегом wikidata берёт и superroute=hiking без тега route', () => {
    expect(TAGGED_QUERY).toContain('["route"~"^(hiking|foot)$"]["wikidata"]')
    expect(TAGGED_QUERY).toContain('["superroute"~"^(hiking|foot)$"]["wikidata"]')
  })

  it('основной маршрут — без варианта и радиального выхода; общий путь этапов считается один раз', () => {
    const route = assembleRoute(ROUTE_ELEMENTS, 1)
    expect(route).not.toBeNull()
    expect(route!.ways).toBe(4)
    expect(route!.chains).toHaveLength(1)
    expect(route!.continuity).toBe(1)
    // Четыре сотых градуса широты: 4 × 1,112 км.
    expect(route!.length_km).toBeCloseTo(4.4, 1)
    expect(route!.loop).toBe(false)
    expect(route!.tags.name).toBe('Fixture Trail')
    expect(route!.foot).toBe(true)
  })

  it('пеший маршрут узнаётся по тегу route, по тегу superroute и по подотношениям', () => {
    const retag = (tags: Record<string, string>, childRoute = 'hiking') =>
      ROUTE_ELEMENTS.map((element) => (element.id === 1 ? { ...element, tags } : element.type === 'relation' ? { ...element, tags: { ...element.tags, route: childRoute } } : element))
    // Тропы Гонконга: `type=superroute` и `superroute=hiking`, тега `route` нет.
    expect(assembleRoute(retag({ type: 'superroute', superroute: 'hiking' }), 1)!.foot).toBe(true)
    expect(assembleRoute(retag({ type: 'superroute' }), 1)!.foot).toBe(true)
    expect(assembleRoute(retag({ type: 'superroute' }, 'bicycle'), 1)!.foot).toBe(false)
    expect(assembleRoute(retag({ type: 'route', route: 'road' }), 1)!.foot).toBe(false)
    expect(assembleRoute(retag({ type: 'boundary' }), 1)!.foot).toBe(false)
  })

  it('этапы — прямые подотношения основного маршрута со своей длиной', () => {
    const route = assembleRoute(ROUTE_ELEMENTS, 1)!
    expect(route.stages.map((stage) => stage.relation)).toEqual([10, 11])
    expect(route.stages[0].length_km).toBeCloseTo(2.2, 1)
    expect(route.stages[1].length_km).toBeCloseTo(3.3, 1)
  })

  it('цикл отношений (этап содержит свой маршрут) не уводит разбор этапов в бесконечную рекурсию', () => {
    const cyclic = ROUTE_ELEMENTS.map((element) =>
      element.type === 'relation' && element.id === 10 ? { ...element, members: [...(element.members ?? []), { type: 'relation' as const, ref: 1, role: '' }] } : element,
    )
    const route = assembleRoute(cyclic, 1)!
    expect(route.stages.map((stage) => stage.relation)).toEqual([10, 11])
    expect(route.length_km).toBeCloseTo(4.4, 1)
  })

  it('классы sac_scale считаются по длине путей основного маршрута; вариант в них не входит', () => {
    const route = assembleRoute(ROUTE_ELEMENTS, 1)!
    expect(route.sac_km.hiking).toBeCloseTo(1.1, 1)
    expect(route.sac_km.mountain_hiking).toBeCloseTo(1.1, 1)
    expect(route.sac_km.alpine_hiking).toBeCloseTo(1.1, 1)
    expect(route.sac_km.difficult_alpine_hiking).toBeUndefined()
  })

  it('отношение-вариант разбирается само по себе; нет отношения или геометрии — null', () => {
    expect(assembleRoute(ROUTE_ELEMENTS, 12)!.length_km).toBeCloseTo(1.1, 1)
    expect(assembleRoute(ROUTE_ELEMENTS, 999)).toBeNull()
    expect(assembleRoute([{ type: 'relation', id: 5, members: [{ type: 'way', ref: 6, role: '' }] }], 5)).toBeNull()
  })
})

describe('внешний индекс маршрутов: набор высоты по профилю', () => {
  it('без порога считает каждый метр, с порогом шум в набор не идёт', () => {
    const noisy = [100, 104, 101, 105, 102, 106, 103, 107]
    expect(climb(noisy, 0)).toEqual({ ascent: 16, descent: 9 })
    // Общий ход вверх на 7 м меньше порога разворота — подъёма нет.
    expect(climb(noisy, 10)).toEqual({ ascent: 0, descent: 0 })
  })

  it('подъём продолжается после понижения меньше порога и считается от прежней вершины', () => {
    // 100 → 150, понижение на 5 м (шум), дальше до 200: набор 100, сброса нет.
    expect(climb([100, 150, 145, 200], 20)).toEqual({ ascent: 100, descent: 0 })
    // Понижение на 40 м — разворот: сброс 40, затем подъём с 110 до 200.
    expect(climb([100, 150, 110, 200], 20)).toEqual({ ascent: 140, descent: 40 })
  })

  it('пустой профиль и профиль из одной точки дают нули', () => {
    expect(climb([], 20)).toEqual({ ascent: 0, descent: 0 })
    expect(climb([500], 20)).toEqual({ ascent: 0, descent: 0 })
    expect(profileStats([], { stepM: 30, smoothM: 0, thresholdM: 20 })).toEqual({ ascent_m: 0, descent_m: 0, max_alt_m: 0, min_alt_m: 0 })
  })

  it('скользящее среднее сглаживает выброс и не меняет ровный профиль', () => {
    expect(smoothProfile([10, 10, 40, 10, 10], 3)).toEqual([10, 20, 20, 20, 10])
    expect(smoothProfile([5, 5, 5], 3)).toEqual([5, 5, 5])
    expect(smoothProfile([1, 2, 3], 1)).toEqual([1, 2, 3])
  })

  it('перевал 1000 → 2500 → 1200 м: набор, сброс и крайние высоты', () => {
    const up = Array.from({ length: 51 }, (_, i) => 1000 + i * 30)
    const down = Array.from({ length: 65 }, (_, i) => 2500 - (i + 1) * 20)
    const stats = profileStats([...up, ...down], { stepM: 30, smoothM: 0, thresholdM: 20 })
    expect(stats).toEqual({ ascent_m: 1500, descent_m: 1300, max_alt_m: 2500, min_alt_m: 1000 })
  })

  it('цепочки маршрута складываются: набор и сброс суммой, высоты — крайние', () => {
    expect(
      mergeStats([
        { ascent_m: 300, descent_m: 100, max_alt_m: 900, min_alt_m: 500 },
        { ascent_m: 200, descent_m: 400, max_alt_m: 1200, min_alt_m: 700 },
      ]),
    ).toEqual({ ascent_m: 500, descent_m: 500, max_alt_m: 1200, min_alt_m: 500 })
  })
})

/** Блок с предиктором 3 — тем же способом, каким его пишет GDAL: байты по старшинству и разность по строке. */
const encodeFloatBlock = (values: Float32Array, width: number, height: number): Buffer => {
  const raw = Buffer.alloc(width * height * 4)
  const view = new DataView(new ArrayBuffer(4))
  for (let row = 0; row < height; row += 1) {
    const start = row * width * 4
    for (let col = 0; col < width; col += 1) {
      view.setFloat32(0, values[row * width + col], false)
      for (let byte = 0; byte < 4; byte += 1) raw[start + byte * width + col] = view.getUint8(byte)
    }
    for (let i = start + width * 4 - 1; i > start; i -= 1) raw[i] = (raw[i] - raw[i - 1]) & 0xff
  }
  return zlib.deflateSync(raw)
}

/** Минимальный классический TIFF: один каталог с тегами плитки Copernicus DEM. */
const tiffHead = (rasterType: number | null): Buffer => {
  const entries: Array<[tag: number, type: number, values: number[]]> = [
    [256, 3, [4]],
    [257, 3, [2]],
    [258, 3, [32]],
    [259, 3, [8]],
    [317, 3, [3]],
    [322, 3, [4]],
    [323, 3, [2]],
    [324, 4, [1000]],
    [325, 4, [321]],
    [339, 3, [3]],
    [33550, 12, [0.25, 0.25, 0]],
    [33922, 12, [0, 0, 0, 9, 43, 0]],
    ...(rasterType === null ? [] : ([[34735, 3, [1, 1, 0, 1, 1025, 0, 1, rasterType]]] as Array<[number, number, number[]]>)),
  ]
  const size = { 3: 2, 4: 4, 12: 8 } as Record<number, number>
  const head = Buffer.alloc(8 + 2 + entries.length * 12 + 4 + 256)
  head.write('II', 0, 'latin1')
  head.writeUInt16LE(42, 2)
  head.writeUInt32LE(8, 4)
  head.writeUInt16LE(entries.length, 8)
  let data = 8 + 2 + entries.length * 12 + 4
  entries.forEach(([tag, type, values], index) => {
    const at = 10 + index * 12
    head.writeUInt16LE(tag, at)
    head.writeUInt16LE(type, at + 2)
    head.writeUInt32LE(values.length, at + 4)
    const inline = size[type] * values.length <= 4
    let position = inline ? at + 8 : data
    if (!inline) {
      head.writeUInt32LE(data, at + 8)
      data += size[type] * values.length
    }
    for (const value of values) {
      if (type === 3) head.writeUInt16LE(value, position)
      else if (type === 4) head.writeUInt32LE(value, position)
      else head.writeDoubleLE(value, position)
      position += size[type]
    }
  })
  return head
}

describe('внешний индекс маршрутов: чтение плитки рельефа', () => {
  it('имя плитки — по юго-западному углу, с полушариями', () => {
    expect(tileName(DEM_PRODUCTS.glo30, 45.83, 6.86)).toBe('Copernicus_DSM_COG_10_N45_00_E006_00_DEM')
    expect(tileName(DEM_PRODUCTS.glo90, 56.8, -5.1)).toBe('Copernicus_DSM_COG_30_N56_00_W006_00_DEM')
    expect(tileName(DEM_PRODUCTS.glo30, -41.3, 174.8)).toBe('Copernicus_DSM_COG_10_S42_00_E174_00_DEM')
    expect(tileUrl(DEM_PRODUCTS.glo30, 'T')).toBe('https://copernicus-dem-30m.s3.amazonaws.com/T/T.tif')
  })

  it('блок с предиктором плавающей точки разжимается в исходные высоты', () => {
    const values = Float32Array.from([0, 12.5, 640.468, 4805.19, -3.25, 1e-3, 2317.845, 8848.86])
    const decoded = decodeFloatBlock(encodeFloatBlock(values, 4, 2), 4, 2)
    expect(Array.from(decoded)).toEqual(Array.from(values))
  })

  it('короткий блок — ошибка, а не тихие нули', () => {
    expect(() => decodeFloatBlock(zlib.deflateSync(Buffer.alloc(8)), 4, 2)).toThrow(/блок рельефа/)
  })

  it('привязка центром точки сетки (так лежит Copernicus DEM): начало координат не сдвигается', () => {
    const layout = parseTiffLayout(tiffHead(2))!
    expect(layout).toMatchObject({ width: 4, height: 2, tileWidth: 4, tileHeight: 2, offsets: [1000], byteCounts: [321], originLon: 9, originLat: 43, pixelLon: 0.25, pixelLat: 0.25 })
  })

  it('привязка углом ячейки: центр первой точки на полшага правее и ниже', () => {
    const layout = parseTiffLayout(tiffHead(null))!
    expect(layout.originLon).toBeCloseTo(9.125, 6)
    expect(layout.originLat).toBeCloseTo(42.875, 6)
  })

  it('обрезанный заголовок — null (нужен кусок длиннее), чужой формат — ошибка', () => {
    expect(parseTiffLayout(tiffHead(2).subarray(0, 40))).toBeNull()
    expect(() => parseTiffLayout(Buffer.from('MM\0*\0\0\0\b', 'latin1'))).toThrow(/TIFF/)
  })
})
