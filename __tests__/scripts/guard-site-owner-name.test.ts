import fs from 'fs'
import os from 'os'
import path from 'path'

const {
  checkDist,
  REQUIRED_ROUTE_FILES,
  OPTIONAL_ROUTE_FILES,
} = require('../../scripts/guard-site-owner-name')
const legal = require('../../constants/legal.json')

// #1999: Meta Business Verification сверяет имя владельца с текстом сайта без
// JavaScript. Guard стоит в build-web-prod после генерации SEO-страниц и не
// пускает в прод dist, где главная или /contact имя потеряли.
describe('guard-site-owner-name', () => {
  let distDir: string

  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-site-owner-'))
  })

  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  const write = (file: string, html: string) => {
    const target = path.join(distDir, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, html, 'utf8')
  }

  it('contract: home and contact are required, about is checked when exported', () => {
    expect(REQUIRED_ROUTE_FILES).toEqual(['index.html', 'contact.html'])
    expect(OPTIONAL_ROUTE_FILES).toEqual(['about.html'])
    expect(legal.siteOwnerLegalName).toBe('Sauran Yuliya')
  })

  it('passes when every exported page carries the legal name', () => {
    write('index.html', `<html><body><footer class="ssg-home-legal">© MeTravel 2020–2026 · ${legal.siteOwnerLegalName}</footer></body></html>`)
    write('contact.html', `<html><body><div>Владелец сайта: ${legal.siteOwnerLegalName}</div></body></html>`)
    write('about.html', `<html><body><div>Site owner: ${legal.siteOwnerLegalName}</div></body></html>`)
    const result = checkDist(distDir)
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
    expect(result.checked).toEqual(['index.html', 'contact.html', 'about.html'])
    expect(result.skipped).toEqual([])
  })

  it('fails when the home page lost the name and names the file', () => {
    write('index.html', '<html><body><footer>© MeTravel 2020–2026</footer></body></html>')
    write('contact.html', `<html><body>${legal.siteOwnerLegalName}</body></html>`)
    const result = checkDist(distDir)
    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([`index.html: нет оболочки <footer class="ssg-home-legal"> с именем владельца`])
    expect(result.skipped).toEqual(['about.html'])
  })

  it('does not accept the name hidden in JSON-LD or meta when the home shell footer lost it', () => {
    write(
      'index.html',
      `<html><head><script type="application/ld+json">{"name":"${legal.siteOwnerLegalName}"}</script></head><body><footer class="ssg-home-legal">© MeTravel 2020–2026</footer>${legal.siteOwnerLegalName}</body></html>`,
    )
    write('contact.html', `<html><body>${legal.siteOwnerLegalName}</body></html>`)
    const result = checkDist(distDir)
    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([`index.html: в <footer class="ssg-home-legal"> нет имени владельца «${legal.siteOwnerLegalName}»`])
  })

  it('fails when a required page is missing, accepts the nested route layout for the rest', () => {
    write('index.html', `<html><body><footer class="ssg-home-legal">© MeTravel 2020–2026 · ${legal.siteOwnerLegalName}</footer></body></html>`)
    write('about/index.html', `<html><body>${legal.siteOwnerLegalName}</body></html>`)
    const result = checkDist(distDir)
    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([`contact.html: файл не найден в ${distDir}`])
    expect(result.checked).toEqual(['index.html', path.join('about', 'index.html')])
  })
})
