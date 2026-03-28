import { Platform } from 'react-native';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { TravelDataTransformer } from '@/services/pdf-export/TravelDataTransformer';
import type { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator';

export class BookHtmlExportService {
  private dataTransformer: TravelDataTransformer | null = null;

  constructor() {
    this.dataTransformer = null;
  }

  async generateTravelsHtml(
    travels: Travel[],
    settings: BookSettings
  ): Promise<string> {
    if (Platform.OS !== 'web') {
      throw new Error('Book HTML preview is only available on web');
    }

    const transformer = await this.getTransformer();
    transformer.validate(travels);
    const travelsForBook = transformer.transform(travels);

    const html = await this.generateHtmlFromTravelsForBook(travelsForBook, settings);

    if (!html || html.trim().length === 0) {
      throw new Error('Сгенерированный HTML книги пуст');
    }

    // Дополнительная защита: убеждаемся, что в документе есть страницы книги
    const hasPages = /class=["'][^"']*pdf-page[^"']*["']/.test(html);
    if (!hasPages) {
      throw new Error('Книга не содержит ни одной страницы для печати. Попробуйте выбрать другие путешествия или изменить настройки.');
    }

    return this.enhanceHtmlForPrintPreview(html);
  }

  private async generateHtmlFromTravelsForBook(
    travelsForBook: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    const generator = await this.getGenerator(settings.template);
    return await generator.generate(travelsForBook, settings);
  }

  private async getTransformer(): Promise<TravelDataTransformer> {
    if (this.dataTransformer) return this.dataTransformer;
    const mod = await import('@/services/pdf-export/TravelDataTransformer');
    this.dataTransformer = new mod.TravelDataTransformer();
    return this.dataTransformer;
  }

  private async getGenerator(template?: BookSettings['template']): Promise<EnhancedPdfGenerator> {
    const mod = await import('@/services/pdf-export/generators/EnhancedPdfGenerator');
    return new mod.EnhancedPdfGenerator(template || 'minimal');
  }

  private enhanceHtmlForPrintPreview(html: string): string {
    // Если HTML уже дополнен тулбаром, не дублируем разметку и стили
    if (html.includes('print-toolbar no-print')) {
      return html;
    }

    let result = html;

    const toolbarHtml = `\n<div class="print-toolbar no-print" style="position:sticky;top:0;z-index:50;width:100%;background:rgba(15,23,42,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:rgb(229,231,235);padding:14px 28px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.08);">\n  <div style="display:flex;flex-direction:column;gap:5px;max-width:70%;">\n    <div style="display:flex;align-items:center;gap:8px;">\n      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgb(249,115,22)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>\n      <span>Для сохранения в PDF: <strong>Ctrl/Cmd+P</strong> → «Сохранить как PDF»</span>\n    </div>\n    <div id="print-status" style="font-size:12px;color:rgba(229,231,235,0.6);padding-left:24px;">\n      Изображения: подготовка…\n    </div>\n  </div>\n  <button id="print-btn" onclick="window.__metravelPrint && window.__metravelPrint()" style="background:rgb(249,115,22);border:none;border-radius:10px;color:rgb(255,255,255);padding:10px 20px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(249,115,22,0.3);font-size:14px;white-space:nowrap;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">\n    Печать / PDF\n  </button>\n</div>\n`;

    const headIndex = result.indexOf('</head>');

    const toolbarStyles = `\n<style>\n  @media print {\n    .no-print { display: none !important; }\n    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n  @page { margin: 0; }\n  img { content-visibility: auto; }\n</style>\n`;

    const preloadScript = `\n<script>(function(){\n  var PER_IMAGE_TIMEOUT = 30000;\n  var GLOBAL_TIMEOUT = 120000;\n  var MAX_RETRIES = 2;\n  var PRINT_DELAY = 500;\n\n  function setStatus(text){\n    try {\n      var el = document.getElementById('print-status');\n      if (el) el.textContent = text;\n    } catch (e) {}\n  }\n\n  function getImages(){\n    try {\n      return Array.prototype.slice.call(document.images || []);\n    } catch (e) {\n      return [];\n    }\n  }\n\n  function loadSingleImage(img, timeoutMs){\n    return new Promise(function(resolve){\n      function done(ok){\n        resolve({ ok: ok, src: (img && img.currentSrc) || (img && img.src) || '' });\n      }\n      if (img && img.complete && img.naturalWidth > 0) {\n        done(true);\n        return;\n      }\n      var settled = false;\n      var timer;\n      var onLoad = function(){\n        if (settled) return;\n        settled = true;\n        clearTimeout(timer);\n        cleanup();\n        done(true);\n      };\n      var onError = function(){\n        if (settled) return;\n        settled = true;\n        clearTimeout(timer);\n        cleanup();\n        done(false);\n      };\n      var cleanup = function(){\n        try {\n          img.removeEventListener('load', onLoad);\n          img.removeEventListener('error', onError);\n        } catch (e) {}\n      };\n      try {\n        img.addEventListener('load', onLoad);\n        img.addEventListener('error', onError);\n      } catch (e) {\n        done(false);\n        return;\n      }\n      timer = setTimeout(function(){\n        if (settled) return;\n        settled = true;\n        cleanup();\n        done(img.complete && img.naturalWidth > 0);\n      }, timeoutMs);\n    });\n  }\n\n  function retryImage(img){\n    return new Promise(function(resolve){\n      if (!img || !img.src) { resolve(false); return; }\n      var origSrc = img.src;\n      var settled = false;\n      var timer;\n      var onLoad = function(){\n        if (settled) return;\n        settled = true;\n        clearTimeout(timer);\n        cleanup();\n        resolve(true);\n      };\n      var onError = function(){\n        if (settled) return;\n        settled = true;\n        clearTimeout(timer);\n        cleanup();\n        resolve(false);\n      };\n      var cleanup = function(){\n        try {\n          img.removeEventListener('load', onLoad);\n          img.removeEventListener('error', onError);\n        } catch (e) {}\n      };\n      try {\n        img.addEventListener('load', onLoad);\n        img.addEventListener('error', onError);\n      } catch (e) {\n        resolve(false);\n        return;\n      }\n      timer = setTimeout(function(){\n        if (settled) return;\n        settled = true;\n        cleanup();\n        resolve(img.complete && img.naturalWidth > 0);\n      }, PER_IMAGE_TIMEOUT);\n      img.src = '';\n      img.src = origSrc;\n    });\n  }\n\n  function waitForImages(){\n    var imgs = getImages();\n    var total = imgs.length;\n    if (!total) {\n      return Promise.resolve({ total: 0, loaded: 0, failed: 0, failedUrls: [] });\n    }\n    var loaded = 0;\n    var globalStart = Date.now();\n\n    function updateProgress(extra){\n      setStatus('Загрузка изображений: ' + loaded + '/' + total + (extra || ''));\n    }\n    updateProgress();\n\n    var promises = imgs.map(function(img){\n      return loadSingleImage(img, PER_IMAGE_TIMEOUT).then(function(r){\n        if (r.ok) { loaded++; updateProgress(); }\n        return r;\n      });\n    });\n\n    return Promise.all(promises).then(function(firstPass){\n      var failedItems = [];\n      firstPass.forEach(function(r, i){\n        if (!r.ok && r.src) failedItems.push({ img: imgs[i], src: r.src });\n      });\n\n      if (!failedItems.length || (Date.now() - globalStart) > GLOBAL_TIMEOUT) {\n        return { total: total, loaded: loaded, failed: failedItems.length, failedUrls: failedItems.map(function(f){ return f.src; }) };\n      }\n\n      updateProgress(' • повтор ' + failedItems.length + ' изобр…');\n\n      var retryRound = function(items, attempt){\n        if (!items.length || attempt > MAX_RETRIES || (Date.now() - globalStart) > GLOBAL_TIMEOUT) {\n          return Promise.resolve(items);\n        }\n        var retryPromises = items.map(function(item){\n          return retryImage(item.img).then(function(ok){\n            if (ok) { loaded++; updateProgress(' • повтор ' + attempt + '/' + MAX_RETRIES); }\n            return { item: item, ok: ok };\n          });\n        });\n        return Promise.all(retryPromises).then(function(results){\n          var stillFailed = [];\n          results.forEach(function(r){\n            if (!r.ok) stillFailed.push(r.item);\n          });\n          if (stillFailed.length && attempt < MAX_RETRIES && (Date.now() - globalStart) < GLOBAL_TIMEOUT) {\n            return retryRound(stillFailed, attempt + 1);\n          }\n          return stillFailed;\n        });\n      };\n\n      return retryRound(failedItems, 1).then(function(remaining){\n        return { total: total, loaded: loaded, failed: remaining.length, failedUrls: remaining.map(function(f){ return f.src; }) };\n      });\n    });\n  }\n\n  window.__metravelPrint = function(){\n    var btn = document.getElementById('print-btn');\n    if (btn) {\n      btn.disabled = true;\n      btn.style.opacity = '0.75';\n      btn.style.cursor = 'progress';\n    }\n\n    setStatus('Загрузка шрифтов и изображений…');\n\n    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();\n    return Promise.all([waitForImages(), fontsReady]).then(function(results){\n      var res = results[0];\n      setStatus('Изображения: ' + res.loaded + '/' + res.total + (res.failed ? (' (не загружено: ' + res.failed + ')') : ' ✓'));\n      if (res.failed && res.failedUrls && res.failedUrls.length) {\n        try { console.warn('[print] failed images after retries', res.failedUrls.slice(0, 30)); } catch (e) {}\n      }\n      setTimeout(function(){\n        try { window.print(); } finally {\n          if (btn) {\n            btn.disabled = false;\n            btn.style.opacity = '1';\n            btn.style.cursor = 'pointer';\n          }\n        }\n      }, PRINT_DELAY);\n    });\n  };\n\n  try {\n    var imgs = getImages();\n    var total = imgs.length;\n    var complete = 0;\n    for (var i=0;i<imgs.length;i++) {\n      if (imgs[i].complete && imgs[i].naturalWidth) complete++;\n    }\n    setStatus('Изображения: ' + complete + '/' + total + ' • шрифты загружаются…');\n    if (document.fonts && document.fonts.ready) {\n      document.fonts.ready.then(function() {\n        var updated = getImages();\n        var done = 0;\n        for (var j=0;j<updated.length;j++) { if (updated[j].complete && updated[j].naturalWidth) done++; }\n        setStatus('Изображения: ' + done + '/' + updated.length + ' • шрифты ✓');\n      });\n    }\n  } catch (e) {}\n})();</script>\n`;

    if (headIndex !== -1) {
      result = result.slice(0, headIndex) + toolbarStyles + preloadScript + result.slice(headIndex);
    } else {
      result = toolbarStyles + preloadScript + result;
    }

    // Пересчитываем bodyIndex после вставки в head (старое значение стало невалидным)
    const actualBodyIndex = result.indexOf('<body');
    const bodyTagEnd = result.indexOf('>', actualBodyIndex >= 0 ? actualBodyIndex : 0);
    if (actualBodyIndex !== -1 && bodyTagEnd !== -1) {
      const insertPos = bodyTagEnd + 1;
      result = result.slice(0, insertPos) + toolbarHtml + result.slice(insertPos);
    } else {
      result = toolbarHtml + result;
    }

    return result;
  }
}
