import { isTestEnvironment } from './shared'

/**
 * Генерирует статичную карту через html2canvas (клиентский рендеринг)
 *
 * @param returnNullOnError — если true, возвращает null при ошибке html2canvas
 *   вместо серой заглушки
 */
export async function generateMapImageFromDOM(
  container: HTMLElement,
  width: number = 800,
  height: number = 600,
  returnNullOnError: boolean = false,
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    if (returnNullOnError) return null
    throw new Error('generateMapImageFromDOM can only be used in a browser environment')
  }

  const ensureHtml2Canvas = async (): Promise<any> => {
    const w = window as any
    if (w.html2canvas) {
      return w.html2canvas
    }

    if (!(ensureHtml2Canvas as any)._loader) {
      (ensureHtml2Canvas as any)._loader = (async () => {
        if (isTestEnvironment()) {
          try {
            const req = (0, eval)('require') as NodeRequire
            const html2canvasMod = req('html2canvas')
            w.html2canvas = html2canvasMod?.default ?? html2canvasMod
            if (w.html2canvas) return
          } catch (error) {
            void error
          }
        }

        try {
          const html2canvasMod = await import('html2canvas')
          w.html2canvas = html2canvasMod?.default ?? html2canvasMod
          if (w.html2canvas) {
            return
          }
        } catch (error) {
          void error
        }

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
          script.async = true
          script.onload = () => resolve()
          script.onerror = (err) => {
            (ensureHtml2Canvas as any)._loader = null
            reject(err)
          }
          document.body.appendChild(script)
        })
      })()
    }

    await (ensureHtml2Canvas as any)._loader

    if (!w.html2canvas) {
      throw new Error('html2canvas failed to load from CDN')
    }

    return w.html2canvas
  }

  const html2canvas = await ensureHtml2Canvas()

  try {
    const canvas = await html2canvas(container, {
      width,
      height,
      useCORS: true,
      allowTaint: false,
      backgroundColor: 'rgb(255, 255, 255)',
      scale: 2,
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('[MAP_SNAPSHOT_DOM] generateMapImageFromDOM error', error)
    }

    if (returnNullOnError) return null

    const fallbackCanvas = document.createElement('canvas')
    fallbackCanvas.width = width
    fallbackCanvas.height = height
    const ctx = fallbackCanvas.getContext('2d')

    if (ctx) {
      ctx.fillStyle = 'rgb(240, 240, 240)'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'rgb(102, 102, 102)'
      ctx.font = '20px Arial, sans-serif'
      const message = 'Карта не доступна для экспорта'
      const textWidth = ctx.measureText(message).width
      ctx.fillText(message, Math.max(10, (width - textWidth) / 2), height / 2)
    }

    return fallbackCanvas.toDataURL('image/png')
  }
}

/**
 * Проверяет, является ли data URL изображение почти полностью одноцветным (пустая карта).
 */
export async function isImageMostlyBlank(
  dataUrl: string,
  _origWidth: number,
  _origHeight: number,
): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (isTestEnvironment()) return false
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = dataUrl
    })

    const sampleSize = 100
    const canvas = document.createElement('canvas')
    canvas.width = sampleSize
    canvas.height = sampleSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
    const data = imageData.data

    const r0 = data[0],
      g0 = data[1],
      b0 = data[2]
    let sameCount = 0
    const totalPixels = sampleSize * sampleSize
    const threshold = 30

    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r0) < threshold &&
        Math.abs(data[i + 1] - g0) < threshold &&
        Math.abs(data[i + 2] - b0) < threshold
      ) {
        sameCount++
      }
    }

    return sameCount / totalPixels > 0.92
  } catch {
    return false
  }
}

/**
 * Загружает изображение по URL и конвертирует в data URI.
 */
export async function fetchImageAsDataUri(
  url: string,
  timeoutMs: number = 10000,
): Promise<string | null> {
  if (typeof document === 'undefined') return null
  if (!url || url.startsWith('data:')) return url || null

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
      img.onload = () => {
        window.clearTimeout(timer)
        resolve()
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('load failed'))
      }
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || 800
    canvas.height = img.naturalHeight || 600
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
