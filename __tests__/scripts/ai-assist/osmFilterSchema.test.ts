/**
 * @jest-environment node
 */
import path from 'path'

import { RADIUS_OPTIONS } from '@/constants/mapConfig'
import {
  extractJsonObject,
  OSM_FILTER_CATEGORIES,
  OSM_FILTER_CONSTRAINTS,
  OSM_FILTER_RADII,
  toOsmFilterIntent,
  validateOsmFilter,
} from '@/scripts/ai-assist/osmFilterSchema'
import { OSM_POI_CATEGORY_IDS } from '@/utils/overpass/buildOverpassQuery'

import { runCli } from '../cli-test-utils'

// #2887: TS-порт `validate_filter()`/`extract_json()` из scripts/ai-train/sets/osm_intents.py.
// Фикстуры — валидные и невалидные JSON по схеме; при наличии python3 те же фикстуры
// прогоняются через Python-валидатор, и списки ошибок обязаны совпасть до символа.
const AI_TRAIN_DIR = path.resolve(process.cwd(), 'scripts/ai-train')

const FIXTURES: Array<{ name: string; value: unknown }> = [
  { name: 'полный валидный фильтр', value: { categories: ['viewpoints', 'history'], radius_km: 50, center: { name: 'Несвиж' }, constraints: { camper: true } } },
  { name: 'center null без constraints', value: { categories: ['entertainment'], radius_km: 200, center: null } },
  { name: 'все категории, пустые constraints', value: { categories: [...OSM_FILTER_CATEGORIES], radius_km: 10, center: null, constraints: {} } },
  { name: 'лишнее поле', value: { categories: ['culture'], radius_km: 25, center: null, extra: 1 } },
  { name: 'неизвестная категория и повтор', value: { categories: ['culture', 'castles', 'culture'], radius_km: 25, center: null } },
  { name: 'категории не список', value: { categories: 'culture', radius_km: 25, center: null } },
  { name: 'пустой список категорий', value: { categories: [], radius_km: 25, center: null } },
  { name: 'радиус вне enum', value: { categories: ['history'], radius_km: 30, center: null } },
  { name: 'радиус строкой', value: { categories: ['history'], radius_km: '50', center: null } },
  { name: 'радиус bool', value: { categories: ['history'], radius_km: true, center: null } },
  { name: 'center не объект', value: { categories: ['history'], radius_km: 50, center: 'Гродно' } },
  { name: 'center с лишним ключом', value: { categories: ['history'], radius_km: 50, center: { name: 'Гродно', lat: 53.7 } } },
  { name: 'center с коротким именем', value: { categories: ['history'], radius_km: 50, center: { name: 'Г' } } },
  { name: 'constraints не объект', value: { categories: ['history'], radius_km: 50, center: null, constraints: ['dogs'] } },
  { name: 'constraint неизвестный и не bool', value: { categories: ['history'], radius_km: 50, center: null, constraints: { pets: true, kids: 'yes' } } },
  { name: 'нет обязательных полей', value: { constraints: { free: true } } },
  { name: 'не объект', value: ['history'] },
  { name: 'число вместо категории', value: { categories: ['history', 7], radius_km: 100, center: null } },
]

describe('osmFilterSchema: перечисления из scripts/ai-train/osm_filter_schema.json', () => {
  it('категории — категории слоя POI карты, радиусы — RADIUS_OPTIONS', () => {
    expect([...OSM_FILTER_CATEGORIES].sort()).toEqual([...OSM_POI_CATEGORY_IDS].sort())
    expect([...OSM_FILTER_RADII]).toEqual(RADIUS_OPTIONS.map((option) => Number(option.id)))
    expect([...OSM_FILTER_CONSTRAINTS]).toEqual(['dogs', 'camper', 'kids', 'free'])
  })
})

describe('validateOsmFilter', () => {
  it('валидные фикстуры проходят, невалидные — нет', () => {
    const verdicts = Object.fromEntries(FIXTURES.map(({ name, value }) => [name, validateOsmFilter(value)]))
    expect(verdicts['полный валидный фильтр']).toEqual([])
    expect(verdicts['center null без constraints']).toEqual([])
    expect(verdicts['все категории, пустые constraints']).toEqual([])
    expect(verdicts['лишнее поле']).toEqual(["unknown key 'extra'"])
    expect(verdicts['неизвестная категория и повтор']).toEqual(["unknown categories ['castles']", 'categories repeat'])
    expect(verdicts['радиус вне enum']).toEqual(['radius_km 30 not in [10, 25, 50, 100, 200]'])
    expect(verdicts['радиус строкой']).toEqual(["radius_km '50' not in [10, 25, 50, 100, 200]"])
    expect(verdicts['center не объект']).toEqual(['center must be null or {"name": str}'])
    expect(verdicts['constraint неизвестный и не bool']).toEqual(["unknown constraint 'pets'", "constraint 'kids' must be boolean"])
    expect(verdicts['нет обязательных полей']).toEqual(["missing 'categories'", "missing 'radius_km'", "missing 'center'"])
    expect(verdicts['не объект']).toEqual(['not an object'])
  })

  it('эквивалентен validate_filter() из sets/osm_intents.py на тех же фикстурах', () => {
    const probe = runCli('python3', ['-I', '-c', 'import sys; print(sys.version_info[0])'])
    if (probe.status !== 0) {
      console.warn('python3 недоступен — сверка с Python-валидатором пропущена')
      return
    }
    const code = [
      'import sys, json',
      'sys.path.insert(0, sys.argv[1])',
      'from sets.osm_intents import validate_filter',
      'fixtures = json.load(sys.stdin)',
      'print(json.dumps([validate_filter(f) for f in fixtures], ensure_ascii=False))',
    ].join('\n')
    const res = runCli('python3', ['-I', '-c', code, AI_TRAIN_DIR], { input: JSON.stringify(FIXTURES.map((f) => f.value)) })
    expect(res.stderr).toBe('')
    const python = JSON.parse(res.stdout) as string[][]
    const ts = FIXTURES.map((f) => validateOsmFilter(f.value))
    expect(ts).toEqual(python)
  })
})

describe('extractJsonObject', () => {
  it('берёт первый объект из ограды, из текста и с вложенными объектами', () => {
    const fenced = 'Вот фильтр:\n```json\n{"categories": ["history"], "radius_km": 50, "center": {"name": "Гродно"}}\n```\nГотово.'
    expect(extractJsonObject(fenced)).toEqual({ categories: ['history'], radius_km: 50, center: { name: 'Гродно' } })
    expect(extractJsonObject('ответ {"a": "скобка } в строке", "b": [1, {"c": 2}]} хвост')).toEqual({ a: 'скобка } в строке', b: [1, { c: 2 }] })
    expect(extractJsonObject('{сломано} потом {"ok": true}')).toEqual({ ok: true })
    expect(extractJsonObject('без объекта [1, 2]')).toBeNull()
    expect(extractJsonObject('{"незакрыто": 1')).toBeNull()
  })

  it('совпадает с extract_json() на ответах модели', () => {
    const probe = runCli('python3', ['-I', '-c', 'print(1)'])
    if (probe.status !== 0) return
    const samples = [
      '```json\n{"categories": ["viewpoints"], "radius_km": 25, "center": null, "constraints": {"dogs": true}}\n```',
      'Фильтр: {"categories": ["culture"], "radius_km": 10, "center": {"name": "Краков"}} — музеи.',
      '{не json} и {"ok": 1}',
      'ничего',
    ]
    const code = [
      'import sys, json',
      'sys.path.insert(0, sys.argv[1])',
      'from sets.osm_intents import extract_json',
      'print(json.dumps([extract_json(t) for t in json.load(sys.stdin)], ensure_ascii=False))',
    ].join('\n')
    const res = runCli('python3', ['-I', '-c', code, AI_TRAIN_DIR], { input: JSON.stringify(samples) })
    expect(res.stderr).toBe('')
    expect(samples.map(extractJsonObject)).toEqual(JSON.parse(res.stdout))
  })
})

describe('toOsmFilterIntent', () => {
  it('добавляет пустой constraints и копирует значения', () => {
    expect(toOsmFilterIntent({ categories: ['history'], radius_km: 50, center: null })).toEqual({ categories: ['history'], radius_km: 50, center: null, constraints: {} })
  })
})
