import path from 'path'
import { runCli } from './cli-test-utils'

// Движок черновиков статей — Python. Сеть, токен и время подменяются внутри
// процесса: проверяется, ЧТО движок отправил бы в прод, без единого запроса.
const runEngine = (directory: string, body: string) => {
  const file = path.resolve(directory, 'skills/metravel-travel-article/scripts/metravel_publish.py')
  const result = runCli('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('engine', ${JSON.stringify(file)})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
calls = []
${body}
print(json.dumps(calls, ensure_ascii=False))
`])
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout.trim().split('\n').pop() as string)
}

describe.each(['.claude', '.agents'])('metravel_publish.py (%s)', (directory) => {
  it('upsert берёт year/month/created_at из date: и не пишет сентинел и month: []', () => {
    const calls = runEngine(directory, `
import tempfile, os
draft = os.path.join(tempfile.mkdtemp(), 'd.md')
open(draft, 'w').write('---\\ntitle: "Поход"\\ncountry: Польша\\ndate: 2025-05-30..2025-06-01\\n---\\n# Поход\\nКрючок.\\n---\\n## Фото\\n## Точки для карты\\n| Замок в Ойцове | 50.21, 19.82 |\\n')
m.req = lambda method, path, data=None: (calls.append(data), (200, '{"id": 7}'))[1]
m.upsert(draft)
`)
    // первый вызов может быть чтением справочника категорий — payload в последнем
    const payload = calls[calls.length - 1]
    expect(payload).toMatchObject({
      id: null, year: 2025, month: [5, 6], created_at: '2025-05-30T12:00:00Z',
      plus: null, minus: null, recommendation: null, youtube_link: null, publish: false, moderation: false,
    })
    expect(JSON.stringify(payload)).not.toContain('__draft_placeholder__')
    expect(payload.coordsMeTravel[0]).toMatchObject({ address: 'Замок в Ойцове', categories: [43] })
  })

  it('upsert новой статьи без date: отказывает и ничего не отправляет', () => {
    const calls = runEngine(directory, `
import tempfile, os
draft = os.path.join(tempfile.mkdtemp(), 'd.md')
open(draft, 'w').write('---\\ntitle: "Поход"\\n---\\nТекст.\\n')
m.req = lambda method, path, data=None: (calls.append(data), (200, '{}'))[1]
calls.append(m.upsert(draft))
`)
    expect(calls).toEqual([null])
  })

  it('descimg перезаливает фото точки в description, alt = имя точки, publish и month эхом', () => {
    const calls = runEngine(directory, `
detail = {"id": 5, "name": "Статья", "publish": True, "moderation": True, "year": 2024, "month": [7],
  "plus": "__draft_placeholder__", "youtube_link": None, "countries": [160], "categories": [2],
  "description": "<p>Крючок.</p><h2>Замок в Ойцове</h2><p>Текст.</p>",
  "coordsMeTravel": [{"id": 11, "lat": 50.2, "lng": 19.8, "address": "Замок в Ойцове", "categories": [43], "image": "https://metravel.by/address-image/11/conversions/p.webp"}],
  "travelAddress": [{"id": 11, "address": "Замок в Ойцове", "travelImageThumbUrl": "https://metravel.by/address-image/11/conversions/p.webp"}]}
def req(method, path, data=None):
    if method == "GET": return 200, json.dumps(detail)
    calls.append({"put": data}); return 200, "{}"
m.req = req
m._fetch_as_jpeg = lambda url: (calls.append({"fetch": url}), ("/tmp/x.jpg", (1200, 900)))[1]
m.upload_image = lambda file, collection, id_: (calls.append({"upload": [collection, id_]}), ("200", "http://metravel.by/travel-description-image/new.jpg.webp"))[1]
m.desc_images(5)
`)
    expect(calls.slice(0, 2)).toEqual([
      { fetch: 'https://metravel.by/address-image/11/conversions/p.webp' },
      { upload: ['description', 5] },
    ])
    const payload = calls[2].put
    expect(payload.description).toContain('<h2>Замок в Ойцове</h2><p><img src="https://metravel.by/travel-description-image/new.jpg.webp" width="1200" height="900" alt="Замок в Ойцове" /></p>')
    expect(payload.description).not.toContain('address-image')
    expect(payload).toMatchObject({ publish: true, moderation: true, month: [7], plus: null, youtube_link: null })
    expect(payload.coordsMeTravel[0]).toMatchObject({ id: 11, categories: [43] })
  })

  it('заливки идут с паузой не меньше max(длительность запроса, 10 с)', () => {
    const calls = runEngine(directory, `
clock = [100.0]
m.time.monotonic = lambda: clock[0]
m.time.sleep = lambda s: (calls.append(round(s, 3)), clock.__setitem__(0, clock[0] + s))
m._resize = lambda src: m.__file__
def post(method, endpoint, body, content_type):
    clock[0] += 3.0 if len(calls) == 0 else 14.0
    return 200, '{"url": "https://metravel.by/x.webp"}'
m._authenticated = post
for _ in range(3): m.upload_image("x.jpg", "gallery", 1)
`)
    expect(calls).toEqual([10, 14])
  })
})
