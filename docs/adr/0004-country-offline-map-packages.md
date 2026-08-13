# 0004. Страновые offline-пакеты карты через raster PMTiles

- **Статус:** Proposed
- **Дата:** 2026-08-08
- **Авторы:** Codex architecture review для board #1307

## Контекст

Текущий `OfflineCatalog` умеет хранить `map-region`, а Android `/map` читает
отдельные raster XYZ-тайлы из `documentDirectory/map-tiles/` через WebView-мост
`TILE_REQ`. Остальные runtime-карты используют сетевой tile URL: travel detail,
quest и native route picker создают собственный `L.tileLayer`, web-поверхности
используют `TileLayer`/`MapCanvas`. Поэтому увеличение bbox региона до страны не
делает пакет общим для приложения.

Raster XYZ всей страны экспоненциально растёт с zoom. Верхняя bbox-оценка по
текущей slippy-map математике и 15–30 KiB на тайл:

| Страна | z0–12 | z0–13 | z0–14 |
| --- | ---: | ---: | ---: |
| Беларусь | 14 310 тайлов, 210–419 MiB | 55 920, 819–1 638 MiB | 221 922, 3 251–6 502 MiB |
| Польша | 16 833 тайла, 247–493 MiB | 66 526, 975–1 949 MiB | 263 950, 3 866–7 733 MiB |

Это sizing-оценка, не обещание размера: решение о публикации страны принимается
только по фактическому immutable-артефакту, checksum и реальным bytes.

Текущий `/proxy/tiles/osm/...` нельзя использовать для создания country pack.
Публичная OSM Tile Usage Policy прямо запрещает bulk/prefetch и offline download
стандартных raster tiles, даже через caching proxy. Нужен собственный pipeline
или поставщик с явным правом offline redistribution.

## Решение

1. Канонический пользовательский тип — `map-country` внутри `OfflineCatalog`.
   Экран, hook или renderer не создаёт отдельный manifest/cache. Физические
   tile stores допустимы только как приватные platform adapters каталога.
2. MVP сохраняет текущий Leaflet renderer и использует **raster PMTiles v3**:
   один заранее собранный immutable archive на страну. Клиент не строит архив и
   не обходит XYZ-прокси тысячами запросов.
3. Country pack — обзорный слой z0–12. Если фактический archive больше 300 MiB,
   его `maxZoom` снижается до z11; пакет, превышающий 300 MiB и после этого, не
   публикуется. Общий map-storage budget остаётся 500 MiB.
4. Детализация остаётся двухуровневой: country overview плюс лицензированные
   `map-region` detail packs z10–16, опубликованные тем же artifact pipeline.
   Прежний клиентский bulk стандартных OSM-тайлов удалён 2026-08-13 и не является
   допустимым источником detail packs. Описанная здесь замена остаётся отклонённой
   владельцем (`#1315/#1307` = `wont_do`) и может быть возвращена только новым
   решением по лицензии и бюджету. Приоритет resolver при таком решении: точный detail tile →
   country tile → network tile только online → overzoom последнего доступного
   country tile → явный missing tile.
5. Один `OfflineTileSource` владеет выбором источника и используется всеми
   runtime base maps: `/map`, travel detail, travel route picker, quest,
   trip-planner и общими web `MapCanvas` consumers. Прямой base `L.tileLayer`/
   `TileLayer` вне platform adapter запрещается guard'ом.
6. Android хранит archive в versioned `documentDirectory` через staging,
   SHA-256 verification и atomic rename. Web использует OPFS, а при отсутствии
   поддержки — IndexedDB Blob; перед загрузкой обязательны
   `navigator.storage.estimate()`, запас 15% и best-effort `persist()`.
   Service Worker не добавляется, поэтому web-гарантия остаётся loaded-shell.
7. Backend/ops публикует только артефакты из источника с явными правами на
   offline redistribution. Attribution/license входят в manifest и остаются
   видимыми на карте offline. `/proxy/tiles/osm` остаётся interactive-only.

Минимальный серверный manifest:

```ts
type CountryMapArtifact = {
  schema_version: 1
  id: string
  iso2: string
  format: 'pmtiles'
  tile_type: 'raster'
  min_zoom: number
  max_zoom: number
  bounds: [west: number, south: number, east: number, north: number]
  bytes: number
  sha256: string
  revision: string
  etag: string
  download_url: string
  attribution_html: string
  license_id: string
}
```

`download_url` не содержит долгоживущих секретов. Update сохраняет прежний ready
archive до успешной проверки нового. Manifest `ready` разрешён только когда
реальные file bytes и checksum совпали с серверным контрактом.

## Последствия

### Положительные

- один archive вместо десятков тысяч мелких файлов и клиентских HTTP-запросов;
- Leaflet и существующий UX сохраняются, MapLibre migration не попадает в MVP;
- country и detail coverage объединяются одним source policy;
- размер, лицензия, revision и целостность проверяемы до `ready`.

### Отрицательные / риски

- z12 — обзор, а не полноценная пешеходная детализация;
- чтение локального PMTiles требует нового native bridge и web adapter;
- mobile-web storage может быть best-effort/evicted;
- без лицензированного artifact pipeline реализация не может перейти в `todo`.

### Как мы живём с отрицательными

- deep zoom использует detail packs и честно показывает уровень детализации;
- BY и PL — обязательные pilot artifacts с фактическими bytes/startup latency;
- quota/eviction и corrupt-checksum — обязательные negative scenarios;
- provider/license/cost и backend distribution вынесены в отдельные linked tasks.

## Альтернативы, которые отвергли

- **Raster XYZ z0–16 по bbox** — десятки гигабайт и миллионы файлов/запросов.
- **Клиентский bulk через `/proxy/tiles/osm`** — нарушает upstream policy и
  создаёт неконтролируемую нагрузку; nginx rate zone этого не легализует.
- **MBTiles** — тоже single-file, но требует SQLite/native module и отдельного
  web reader; в текущем stack PMTiles дешевле интегрируется с Leaflet.
- **Vector PMTiles + MapLibre** — перспективно для street-level country packs,
  но означает отдельную renderer/style/glyph/sprite migration всех карт.
  `protomaps-leaflet` для vector layers находится в maintenance mode.

## Связанные

- board #1307 (umbrella), #1315 (owner gate), #1317 (artifact pipeline),
  #1316 (shared tile source), #1318 (catalog lifecycle), #1122, #1123, #1126,
  #1079, #909, #988
- `docs/features/offline.md`, `docs/features/map.md`
- [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [PMTiles v3 specification](https://github.com/protomaps/PMTiles/blob/master/spec/v3/spec.md)
- [PMTiles for Leaflet](https://docs.protomaps.com/pmtiles/leaflet)
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
