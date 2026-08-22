// #1491: регрессионный контроль общей таксономии транспорта.
//
// До этой задачи союз режимов маршрутизации был объявлен трижды — в
// `types/route.ts`, в `components/MapPage/transportModes.ts` и внутри
// `RoutingStatus.tsx`, — а планировщик поездки держал четвёртый, несовместимый
// набор. Тест ловит возврат к копипасте: объявление ровно одно, а решение «этот
// способ передвижения маршрутизируется» принимает ровно одна функция.
import fs from 'node:fs'
import path from 'node:path'

import { TRANSPORT_SPEED_KMH, getTransportModes, toTransportMode } from '@/components/MapPage/transportModes'
import { isRoutableTransport, ROUTE_TRANSPORTS } from '@/components/trips/planning/tripRoutePreview'
import type { TripTransport } from '@/api/plannedTrips'

const ROOT = path.join(__dirname, '..', '..', '..')
const UNION_DECLARATION = /type\s+TransportMode\s*=\s*'car'/

const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : []
  })
}

describe('taxonomy of transport modes', () => {
  it('объявляет союз режимов ровно один раз во всём исходнике', () => {
    const declarations = ['api', 'app', 'components', 'hooks', 'screens', 'stores', 'types', 'utils']
      .flatMap((root) => walk(path.join(ROOT, root)))
      .filter((file) => UNION_DECLARATION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file))

    expect(declarations).toEqual(['types/route.ts'])
  })

  it('покрывает каждый режим карты подписью и скоростью', () => {
    for (const option of getTransportModes()) {
      expect(toTransportMode(option.key)).toBe(option.key)
      expect(TRANSPORT_SPEED_KMH[option.key]).toBeGreaterThan(0)
      expect(option.label.trim()).not.toBe('')
    }
  })

  it('раскладывает весь набор планировщика на «строим по дорогам» и «схематично»', () => {
    const routable: TripTransport[] = ['car', 'bike', 'foot']
    const schematic: TripTransport[] = ['public', 'mixed']

    for (const transport of routable) {
      expect(toTransportMode(transport)).toBe(transport)
      expect(isRoutableTransport(transport)).toBe(true)
      expect(ROUTE_TRANSPORTS).toContain(transport)
    }

    for (const transport of schematic) {
      expect(toTransportMode(transport)).toBeNull()
      expect(isRoutableTransport(transport)).toBe(false)
      expect(ROUTE_TRANSPORTS).not.toContain(transport)
    }
  })

  it('не пропускает мусор за режим маршрутизации', () => {
    for (const value of ['', 'CAR', 'train', null, undefined, 0]) {
      expect(toTransportMode(value)).toBeNull()
    }
  })
})
