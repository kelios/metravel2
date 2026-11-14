/**
 * Высоты из Copernicus DEM (#3357, решение D): открытые корзины AWS S3 `copernicus-dem-30m` (GLO-30) и
 * `copernicus-dem-90m` (GLO-90), без учётной записи. Плитка — файл Cloud Optimized GeoTIFF на градус
 * широты и долготы: Float32, сжатие DEFLATE, предиктор 3 (плавающая точка).
 *
 * Отдельной библиотеки нет: читаются только заголовок файла и нужные блоки — запросами `Range`. У GLO-30
 * блок 1024×1024 точки (около 2,5 МБ сжатого в горах при 42 МБ на плитку), у GLO-90 плитка — один блок
 * (до 5 МБ). Сжатые блоки лежат на диске в кэше; повторный расчёт сеть не трогает. Кэш ограничивается
 * `pruneDemCache`: после расчёта маршрута его профиль уже сохранён, блоки можно удалять.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { fetchCached, type NetStats } from './net.ts'

export interface DemProduct {
  key: 'glo30' | 'glo90'
  label: string
  bucket: string
  /** Шаг сетки в угловых секундах — часть имени плитки. */
  arcsec: number
  /** Номинальный шаг на местности, м. */
  resolution_m: number
}

export const DEM_PRODUCTS: Record<DemProduct['key'], DemProduct> = {
  glo30: { key: 'glo30', label: 'Copernicus DEM GLO-30', bucket: 'copernicus-dem-30m', arcsec: 10, resolution_m: 30 },
  glo90: { key: 'glo90', label: 'Copernicus DEM GLO-90', bucket: 'copernicus-dem-90m', arcsec: 30, resolution_m: 90 },
}

const pad = (value: number, width: number): string => String(Math.abs(value)).padStart(width, '0')

/** Имя плитки по её юго-западному углу: `Copernicus_DSM_COG_10_N45_00_E006_00_DEM`. */
export function tileName(product: DemProduct, lat: number, lon: number): string {
  const south = Math.floor(lat)
  const west = Math.floor(lon)
  return `Copernicus_DSM_COG_${product.arcsec}_${south < 0 ? 'S' : 'N'}${pad(south, 2)}_00_${west < 0 ? 'W' : 'E'}${pad(west, 3)}_00_DEM`
}

export const tileUrl = (product: DemProduct, name: string): string => `https://${product.bucket}.s3.amazonaws.com/${name}/${name}.tif`

export interface TiffLayout {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  offsets: number[]
  byteCounts: number[]
  /** Долгота и широта ЦЕНТРА левой верхней точки сетки и шаг сетки в градусах. */
  originLon: number
  originLat: number
  pixelLon: number
  pixelLat: number
  nodata: number | null
}

const TYPE_BYTES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 }

/**
 * Первый каталог (полное разрешение) классического TIFF с порядком байт II. `null` — в переданном
 * куске нет всех значений каталога: нужно запросить заголовок длиннее.
 */
export function parseTiffLayout(head: Buffer): TiffLayout | null {
  if (head.length < 8 || head.toString('latin1', 0, 2) !== 'II' || head.readUInt16LE(2) !== 42) throw new Error('ожидался классический TIFF с порядком байт II')
  const ifd = head.readUInt32LE(4)
  if (ifd + 2 > head.length) return null
  const entries = head.readUInt16LE(ifd)
  if (ifd + 2 + entries * 12 > head.length) return null
  const tags = new Map<number, number[]>()
  let short = false
  for (let i = 0; i < entries; i += 1) {
    const at = ifd + 2 + i * 12
    const tag = head.readUInt16LE(at)
    const type = head.readUInt16LE(at + 2)
    const count = head.readUInt32LE(at + 4)
    const size = TYPE_BYTES[type]
    if (!size) continue
    const total = size * count
    const start = total <= 4 ? at + 8 : head.readUInt32LE(at + 8)
    if (start + total > head.length) {
      short = true
      continue
    }
    const values: number[] = []
    for (let k = 0; k < count; k += 1) {
      const p = start + k * size
      values.push(type === 3 ? head.readUInt16LE(p) : type === 4 ? head.readUInt32LE(p) : type === 12 ? head.readDoubleLE(p) : type === 11 ? head.readFloatLE(p) : type === 16 ? Number(head.readBigUInt64LE(p)) : head[p])
    }
    tags.set(tag, values)
  }
  if (short) return null
  const one = (tag: number): number => {
    const value = tags.get(tag)?.[0]
    if (value === undefined) throw new Error(`в TIFF нет тега ${tag}`)
    return value
  }
  if (one(259) !== 8 && one(259) !== 32946) throw new Error(`сжатие TIFF ${one(259)}: ожидался DEFLATE`)
  if (one(258) !== 32 || one(339) !== 3 || (tags.get(317)?.[0] ?? 1) !== 3) throw new Error('ожидался Float32 с предиктором 3')
  const scale = tags.get(33550)
  const tie = tags.get(33922)
  if (!scale || !tie) throw new Error('в TIFF нет привязки (ModelPixelScale, ModelTiepoint)')
  // Ключ GTRasterTypeGeoKey (1025): 2 — привязка задана центром точки сетки (так лежит Copernicus DEM),
  // 1 или нет ключа — её углом: тогда центр первой точки на полшага правее и ниже.
  const keys = tags.get(34735) ?? []
  let rasterType = 1
  for (let k = 4; k + 3 < keys.length; k += 4) if (keys[k] === 1025 && keys[k + 1] === 0) rasterType = keys[k + 3]
  const centerShift = rasterType === 2 ? 0 : 0.5
  const nodataText = tags.get(42113) ? Buffer.from(tags.get(42113)!).toString('latin1').replace(/\0/g, '').trim() : ''
  return {
    width: one(256),
    height: one(257),
    tileWidth: one(322),
    tileHeight: one(323),
    offsets: tags.get(324) ?? [],
    byteCounts: tags.get(325) ?? [],
    originLon: tie[3] - tie[0] * scale[0] + centerShift * scale[0],
    originLat: tie[4] + tie[1] * scale[1] - centerShift * scale[1],
    pixelLon: scale[0],
    pixelLat: scale[1],
    nodata: nodataText && Number.isFinite(Number(nodataText)) ? Number(nodataText) : null,
  }
}

/**
 * Блок TIFF → высоты. Предиктор 3: в строке сначала идут старшие байты всех точек, затем следующие по
 * старшинству; поверх — разность соседних байт. Обратно: накопленная сумма по строке, затем сборка
 * четырёх байт точки от старшего к младшему.
 */
export function decodeFloatBlock(compressed: Buffer, width: number, height: number): Float32Array {
  const raw = zlib.inflateSync(compressed)
  const rowBytes = width * 4
  if (raw.length < rowBytes * height) throw new Error(`блок рельефа: ${raw.length} байт, ожидалось ${rowBytes * height}`)
  const out = new Float32Array(width * height)
  const view = new DataView(new ArrayBuffer(4))
  for (let row = 0; row < height; row += 1) {
    const start = row * rowBytes
    for (let i = start + 1; i < start + rowBytes; i += 1) raw[i] = (raw[i] + raw[i - 1]) & 0xff
    for (let col = 0; col < width; col += 1) {
      view.setUint8(0, raw[start + col])
      view.setUint8(1, raw[start + width + col])
      view.setUint8(2, raw[start + 2 * width + col])
      view.setUint8(3, raw[start + 3 * width + col])
      out[row * width + col] = view.getFloat32(0, false)
    }
  }
  return out
}

export interface DemOptions {
  product: DemProduct
  rawDir: string
  stats?: NetStats
  log?: (line: string) => void
}

interface OpenTile {
  layout: TiffLayout | null
  url: string
  dir: string
  blocks: Map<number, Float32Array>
}

const HEAD_BYTES = 65_536
/** Столько разжатых блоков держится в памяти: блок GLO-30 — 4 МБ, плитка GLO-90 — до 16 МБ. */
const MAX_BLOCKS_IN_MEMORY = 48

/** Чтение высот по координатам с кэшем заголовков и блоков на диске. */
export class DemReader {
  readonly product: DemProduct
  private readonly options: DemOptions
  private readonly tiles = new Map<string, OpenTile>()
  private loaded = 0

  constructor(options: DemOptions) {
    this.options = options
    this.product = options.product
  }

  private async tile(lat: number, lon: number): Promise<OpenTile> {
    const name = tileName(this.product, lat, lon)
    const known = this.tiles.get(name)
    if (known) return known
    const dir = path.join(this.options.rawDir, 'dem', this.product.key, name)
    const url = tileUrl(this.product, name)
    let length = HEAD_BYTES
    let layout: TiffLayout | null = null
    for (;;) {
      const head = await fetchCached(url, {
        cacheFile: path.join(dir, `head-${length}.bin`),
        headers: { range: `bytes=0-${length - 1}` },
        // Плитки над морем в корзине нет: высота ноль.
        emptyOn: [404, 403],
        stats: this.options.stats,
        log: this.options.log,
      })
      if (!head) break
      layout = parseTiffLayout(head)
      if (layout || head.length < length) break
      length *= 4
    }
    const opened: OpenTile = { layout, url, dir, blocks: new Map() }
    this.tiles.set(name, opened)
    return opened
  }

  private async block(tile: OpenTile, index: number): Promise<Float32Array> {
    const cached = tile.blocks.get(index)
    if (cached) return cached
    const layout = tile.layout!
    // В кэше лежит сжатый блок, как его отдала корзина: разжатый вчетверо-вшестеро больше.
    const from = layout.offsets[index]
    const body = await fetchCached(tile.url, {
      cacheFile: path.join(tile.dir, `block-${index}.deflate`),
      headers: { range: `bytes=${from}-${from + layout.byteCounts[index] - 1}` },
      stats: this.options.stats,
      log: this.options.log,
    })
    const values = decodeFloatBlock(body!, layout.tileWidth, layout.tileHeight)
    if (this.loaded >= MAX_BLOCKS_IN_MEMORY) {
      for (const open of this.tiles.values()) open.blocks.clear()
      this.loaded = 0
    }
    tile.blocks.set(index, values)
    this.loaded += 1
    return values
  }

  private async pixel(tile: OpenTile, col: number, row: number): Promise<number> {
    const layout = tile.layout!
    const c = Math.min(layout.width - 1, Math.max(0, col))
    const r = Math.min(layout.height - 1, Math.max(0, row))
    const across = Math.ceil(layout.width / layout.tileWidth)
    const values = await this.block(tile, Math.floor(r / layout.tileHeight) * across + Math.floor(c / layout.tileWidth))
    const value = values[(r % layout.tileHeight) * layout.tileWidth + (c % layout.tileWidth)]
    return layout.nodata !== null && value === layout.nodata ? 0 : value
  }

  /** Высота над уровнем моря, м: билинейная интерполяция по четырём соседним точкам сетки своей плитки. */
  async elevation(lat: number, lon: number): Promise<number> {
    const tile = await this.tile(lat, lon)
    const layout = tile.layout
    if (!layout) return 0
    const x = (lon - layout.originLon) / layout.pixelLon
    const y = (layout.originLat - lat) / layout.pixelLat
    const col = Math.floor(x)
    const row = Math.floor(y)
    const fx = x - col
    const fy = y - row
    const [a, b, c, d] = [await this.pixel(tile, col, row), await this.pixel(tile, col + 1, row), await this.pixel(tile, col, row + 1), await this.pixel(tile, col + 1, row + 1)]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
  }

  async profile(points: ReadonlyArray<readonly [number, number]>): Promise<number[]> {
    const out: number[] = []
    for (const [lat, lon] of points) out.push(await this.elevation(lat, lon))
    return out
  }
}

/**
 * Предел кэша блоков на диске: пока суммарный размер больше `maxBytes`, удаляются самые давние по времени
 * записи файлы блоков (заголовки плиток остаются — они по 64 КБ). Возвращает число удалённых файлов.
 */
export function pruneDemCache(rawDir: string, product: DemProduct, maxBytes: number): number {
  const root = path.join(rawDir, 'dem', product.key)
  if (!fs.existsSync(root)) return 0
  const files: Array<{ file: string; size: number; mtime: number }> = []
  for (const tile of fs.readdirSync(root)) {
    const dir = path.join(root, tile)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('block-')) continue
      const stat = fs.statSync(path.join(dir, name))
      files.push({ file: path.join(dir, name), size: stat.size, mtime: stat.mtimeMs })
    }
  }
  let total = files.reduce((sum, entry) => sum + entry.size, 0)
  let removed = 0
  for (const entry of files.sort((a, b) => a.mtime - b.mtime)) {
    if (total <= maxBytes) break
    fs.rmSync(entry.file)
    total -= entry.size
    removed += 1
  }
  return removed
}
