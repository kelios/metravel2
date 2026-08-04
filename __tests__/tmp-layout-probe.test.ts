import { applySmartImageLayout } from '@/utils/richTextImageLayout'

const RAW = `<p>(c)</p>
<p><a href="http://ketrzyn.libertas.pl/x.html">link</a></p>
<p><img src="https://metravel.by/travel-description-image/a.JPG.webp"></p>
<p><img src="https://metravel.by/travel-description-image/b.JPG.webp"></p>
<p><img src="https://metravel.by/travel-description-image/c.JPG.webp"></p>
<p><img src="https://metravel.by/travel-description-image/d.JPG.webp"></p>
<p><img src="https://metravel.by/travel-description-image/e.JPG.webp"></p>
<p>Текст между.</p>`

const WITH_ASPECT = RAW.replace(/<img([^>]*)>/g, '<img$1 style="aspect-ratio:800/450">')

describe('probe', () => {
  it('raw description (pdf path)', () => {
    const out = applySmartImageLayout(RAW)
    console.log('=== PDF PATH ===\n' + out.replace(/></g, '>\n<'))
    expect(out).toBeTruthy()
  })

  it('with aspect ratio (web path)', () => {
    const out = applySmartImageLayout(WITH_ASPECT)
    console.log('=== WEB PATH ===\n' + out.replace(/></g, '>\n<'))
    expect(out).toBeTruthy()
  })
})
