/**
 * Regression tests for scripts/lib/textIntegrity.js and seo-edit's
 * detectCorruption() — #1649.
 *
 * The existing post-write guards answer "did the article survive?": publish,
 * slug, gallery, points, and a description that did not shrink by more than a
 * fifth. Mangled UTF-8 passes every one of them — two U+FFFD replace one
 * Cyrillic letter and the length moves by a single character — so a batch that
 * reads and rewrites content would keep writing the same damage article after
 * article. Corruption therefore gets its own check with its own consequence:
 * stop the batch, not skip the article.
 */

const {
  countReplacementChars,
  detectEncodingCorruption,
  detectFieldMismatch,
  detectStoredTextCorruption,
  isTextCorruptionError,
  TextCorruptionError,
} = require('@/scripts/lib/textIntegrity')

const { detectCorruption, detectRegression } = require('@/scripts/seo-edit')

/** «Голубые озёра» with the ё mangled the way a split chunk mangles it */
const CLEAN = 'Голубые озёра: маршрут по Беларуси'
const MANGLED = 'Голубые оз��ра: маршрут по Беларуси'

describe('countReplacementChars', () => {
  it('counts U+FFFD and nothing else', () => {
    expect(countReplacementChars(CLEAN)).toBe(0)
    expect(countReplacementChars(MANGLED)).toBe(2)
    expect(countReplacementChars('')).toBe(0)
    expect(countReplacementChars(null)).toBe(0)
    expect(countReplacementChars(undefined)).toBe(0)
  })
})

describe('detectEncodingCorruption', () => {
  it('reports replacement characters the round trip introduced', () => {
    expect(detectEncodingCorruption(CLEAN, MANGLED, 'description')).toContain('2 new U+FFFD')
  })

  it('stays silent on an intact round trip', () => {
    expect(detectEncodingCorruption(CLEAN, CLEAN, 'description')).toBeNull()
    expect(detectEncodingCorruption(CLEAN, `${CLEAN} <p>sanitized</p>`, 'description')).toBeNull()
  })

  it('does not make historically damaged articles uneditable', () => {
    // The article already carried U+FFFD before we touched it: only NEW damage
    // is ours, otherwise every legacy article would be frozen forever.
    expect(detectEncodingCorruption(MANGLED, MANGLED, 'description')).toBeNull()
    expect(detectEncodingCorruption(MANGLED, `${MANGLED}�`, 'description')).toContain('1 new U+FFFD')
  })
})

describe('detectFieldMismatch', () => {
  it('compares verbatim but tolerates the API trimming the edges', () => {
    expect(detectFieldMismatch('Гродно', 'Гродно', 'name')).toBeNull()
    expect(detectFieldMismatch('  Гродно\n', 'Гродно', 'name')).toBeNull()
    expect(detectFieldMismatch('Гродно', 'Гродна', 'name')).toContain('was not stored as sent')
  })

  it('points at the first difference so a wrong field is readable in the log', () => {
    const problem = detectFieldMismatch('Замок в Мире', 'Замок в Миро', 'name')
    expect(problem).toContain('first difference at char 11')
  })

  it('skips a field we never sent', () => {
    expect(detectFieldMismatch(null, 'anything', 'meta_description')).toBeNull()
  })
})

describe('detectStoredTextCorruption', () => {
  it('byte-compares only the fields the backend stores verbatim', () => {
    // a rich-text body comes back normalised: a byte diff there is not corruption
    expect(
      detectStoredTextCorruption([
        { label: 'description', sent: '<p>Мир</p>', stored: '<p>Мир</p>\n' },
      ]),
    ).toEqual([])

    expect(
      detectStoredTextCorruption([
        { label: 'meta_description', sent: 'Мир', stored: 'Мiр', exact: true },
      ]),
    ).toHaveLength(1)
  })

  it('reports corruption once per field and ignores unsent fields', () => {
    const problems = detectStoredTextCorruption([
      { label: 'description', sent: CLEAN, stored: MANGLED },
      { label: 'meta_description', sent: null, stored: MANGLED, exact: true },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('description')
  })
})

describe('detectStoredTextCorruption — граница undefined/null', () => {
  it('отсутствующее в ответе поле не порча, а пустое — порча', () => {
    expect(
      detectStoredTextCorruption([
        { label: 'meta_description', sent: 'мета', stored: undefined, exact: true },
      ]),
    ).toEqual([])
    expect(
      detectStoredTextCorruption([
        { label: 'name', sent: 'имя', stored: null, exact: true },
      ]),
    ).toHaveLength(1)
  })
})

describe('TextCorruptionError', () => {
  it('is distinguishable from an ordinary failure so a batch can stop', () => {
    const error = new TextCorruptionError(['description came back mangled'], '#520')
    expect(isTextCorruptionError(error)).toBe(true)
    expect(isTextCorruptionError(new Error('description came back mangled'))).toBe(false)
    expect(error.message).toBe('#520: description came back mangled')
    expect(error.problems).toEqual(['description came back mangled'])
  })
})

describe('seo-edit detectCorruption', () => {
  // `id` is what tells "the API handed back the article" from "the re-read
  // failed": every travel detail carries one, an empty 200 or a proxy error
  // page does not.
  const after = (over: Record<string, unknown> = {}) => ({
    id: 520,
    description: CLEAN,
    meta_description: 'Маршрут по Беларуси',
    name: 'Голубые озёра',
    ...over,
  })

  it('catches what detectRegression cannot see', () => {
    const sent = { description: CLEAN }
    const stored = after({ description: MANGLED })

    // The length moved by one character: every existing guard is satisfied.
    expect(
      detectRegression({ description: 'старый текст', publish: true, moderation: true }, { ...stored, publish: true, moderation: true }, {
        expectChanged: true,
        newDescription: CLEAN,
      }),
    ).toEqual([])
    expect(detectCorruption(stored, sent)).toHaveLength(1)
  })

  it('verifies meta_description and name byte for byte', () => {
    expect(detectCorruption(after(), { description: CLEAN, meta: 'Маршрут по Беларуси' })).toEqual([])
    expect(detectCorruption(after(), { meta: 'Другое описание' })).toHaveLength(1)
    expect(detectCorruption(after(), { name: 'Другое имя' })).toHaveLength(1)
  })

  it('passes a body that came back with its HTML normalised', () => {
    const stored = after({ description: `${CLEAN}<section class="seo-faq"></section>` })
    expect(detectCorruption(stored, { description: `${CLEAN}<section class='seo-faq'></section>` })).toEqual([])
  })

  it('says nothing when the caller sent nothing', () => {
    expect(detectCorruption(after(), {})).toEqual([])
    expect(detectCorruption(null, {})).toEqual([])
  })

  // #1716. `GET /api/travels/<id>/` не сериализует `meta_description` ни у одной
  // статьи, хотя upsert поле принимает и хранит. Байт-сравнение с пустой строкой
  // объявляло порчей КАЖДУЮ запись меты, а откат уносил вместе с ней всё
  // описание — регламентная правка тела теряла тысячи символов при HTTP 200.
  it('не считает порчей поле, которого нет в ответе GET', () => {
    const stored = after()
    delete (stored as Record<string, unknown>).meta_description

    expect(detectCorruption(stored, { description: CLEAN, meta: 'Маршрут по Беларуси' })).toEqual([])
  })

  // Граница: `null` — это ответ «поле пустое», а не «поля нет». Расхождение с
  // отправленным текстом там настоящее и по-прежнему обязано ронять запись.
  it('null в ответе остаётся расхождением, а не непроверяемостью', () => {
    const stored = after({ meta_description: null })

    expect(detectCorruption(stored, { meta: 'Маршрут по Беларуси' })).toHaveLength(1)
  })

  it('поле, которого не отправляли, отсутствие в ответе не задевает', () => {
    const stored = after()
    delete (stored as Record<string, unknown>).meta_description

    expect(detectCorruption(stored, { description: CLEAN })).toEqual([])
  })

  // A failed re-read makes every field look missing, and the byte-exact
  // meta/name compare would call that corruption — which stops the whole batch
  // and blames UTF-8 for an empty 200. detectRegression owns this shape and
  // keeps it a per-article rollback.
  it('does not call a failed re-read corruption', () => {
    const sent = { description: CLEAN, meta: 'Маршрут по Беларуси', name: 'Голубые озёра' }
    // getJson() returns null on a body that did not parse
    expect(detectCorruption(null, sent)).toEqual([])
    // seo-mass-augment's fetchJson resolves the raw text when JSON.parse fails
    expect(detectCorruption('<html>502 Bad Gateway</html>', sent)).toEqual([])
    // seo-fix-links substitutes {} when the verification GET throws
    expect(detectCorruption({}, sent)).toEqual([])
    // a proxy error envelope parses into an object that is not an article
    expect(detectCorruption({ detail: 'Not found.' }, sent)).toEqual([])
    // …but a real article that came back mangled is still caught
    expect(detectCorruption(after({ description: MANGLED }), sent)).toHaveLength(1)
  })
})
