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
    const bodyIndex = result.indexOf('<body');

    const toolbarStyles = `\n<style>\n  @media print {\n    .no-print { display: none !important; }\n    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n  @page { margin: 0; }\n</style>\n`;

    const preloadScript = `\n<script>(function(){\n  function setStatus(text){\n    try {\n      var el = document.getElementById('print-status');\n      if (el) el.textContent = text;\n    } catch (e) {}\n  }\n\n  function getImages(){\n    try {\n      return Array.prototype.slice.call(document.images || []);\n    } catch (e) {\n      return [];\n    }\n  }\n\n  function waitForImages(timeoutMs){\n    var imgs = getImages();\n    var total = imgs.length;\n    if (!total) {\n      return Promise.resolve({ total: 0, loaded: 0, failed: 0, failedUrls: [] });\n    }\n\n    var failedUrls = [];\n    var start = Date.now();\n\n    var wrapped = imgs.map(function(img){\n      return new Promise(function(resolve){\n        function done(ok){\n          resolve({ ok: ok, src: (img && img.currentSrc) || (img && img.src) || '' });\n        }\n\n        if (img && img.complete) {\n          done(Boolean(img.naturalWidth && img.naturalHeight));\n          return;\n        }\n\n        var onLoad = function(){ cleanup(); done(true); };\n        var onError = function(){ cleanup(); done(false); };\n        var cleanup = function(){\n          try {\n            img.removeEventListener('load', onLoad);\n            img.removeEventListener('error', onError);\n          } catch (e) {}\n        };\n\n        try {\n          img.addEventListener('load', onLoad);\n          img.addEventListener('error', onError);\n        } catch (e) {\n          done(false);\n        }\n\n        setTimeout(function(){\n          cleanup();\n          if (img && img.complete) {\n            done(Boolean(img.naturalWidth && img.naturalHeight));\n          } else {\n            done(false);\n          }\n        }, Math.max(0, timeoutMs - (Date.now() - start)));\n      });\n    });\n\n    return Promise.all(wrapped).then(function(results){\n      var loaded = 0;\n      var failed = 0;\n      results.forEach(function(r){\n        if (r.ok) loaded++; else { failed++; if (r.src) failedUrls.push(r.src); }\n      });\n      return { total: total, loaded: loaded, failed: failed, failedUrls: failedUrls };\n    });\n  }\n\n  window.__metravelPrint = function(){\n    var btn = document.getElementById('print-btn');\n    if (btn) {\n      btn.disabled = true;\n      btn.style.opacity = '0.75';\n      btn.style.cursor = 'progress';\n    }\n\n    setStatus('Изображения: загрузка…');\n\n    return waitForImages(20000).then(function(res){\n      setStatus('Изображения: ' + res.loaded + '/' + res.total + (res.failed ? (' (ошибок: ' + res.failed + ')') : ''));\n      if (res.failed && res.failedUrls && res.failedUrls.length) {\n        try { console.warn('[print] failed images', res.failedUrls.slice(0, 20)); } catch (e) {}\n      }\n      setTimeout(function(){\n        try { window.print(); } finally {\n          if (btn) {\n            btn.disabled = false;\n            btn.style.opacity = '1';\n            btn.style.cursor = 'pointer';\n          }\n        }\n      }, 100);\n    });\n  };\n\n  try {\n    var imgs = getImages();\n    var total = imgs.length;\n    var complete = 0;\n    for (var i=0;i<imgs.length;i++) {\n      if (imgs[i].complete && imgs[i].naturalWidth) complete++;\n    }\n    setStatus('Изображения: ' + complete + '/' + total);\n  } catch (e) {}\n})();</script>\n`;

    if (headIndex !== -1) {
      result = result.slice(0, headIndex) + toolbarStyles + preloadScript + result.slice(headIndex);
    } else {
      result = toolbarStyles + preloadScript + result;
    }

    const bodyTagEnd = result.indexOf('>', bodyIndex >= 0 ? bodyIndex : 0);
    if (bodyIndex !== -1 && bodyTagEnd !== -1) {
      const insertPos = bodyTagEnd + 1;
      result = result.slice(0, insertPos) + toolbarHtml + result.slice(insertPos);
    } else {
      result = toolbarHtml + result;
    }

    return result;
  }
}
