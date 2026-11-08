import fs from 'fs'
import path from 'path'

// #3144: сайдбар статьи и виджет погоды набраны тем же sans, что и весь UI.
// Georgia/serif рядом с sans-чипами выглядела как сломанный шрифт.
const ROOT = path.resolve(__dirname, '../../..')
const SANS_ONLY_SOURCES = [
  'components/home/WeatherWidget.tsx',
  ...fs
    .readdirSync(path.join(ROOT, 'components/travel/compactSideBar'), { recursive: true })
    .map(String)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => `components/travel/compactSideBar/${file}`),
]

describe('travel sidebar fonts', () => {
  it.each(SANS_ONLY_SOURCES)('%s does not use a serif face', (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    expect(source).not.toMatch(/Georgia|['"]serif['"]|,\s*serif/)
  })
})
