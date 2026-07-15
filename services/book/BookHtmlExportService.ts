import { Platform } from 'react-native';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { TravelDataTransformer } from '@/services/pdf-export/TravelDataTransformer';
import type { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator';
import { translate as i18nT } from '@/i18n'


export interface BookHtmlExportOptions {
  isPremium: boolean;
}

export class BookHtmlExportService {
  private dataTransformer: TravelDataTransformer | null = null;

  constructor() {
    this.dataTransformer = null;
  }

  async generateTravelsHtml(
    travels: Travel[],
    settings: BookSettings,
    options: BookHtmlExportOptions = { isPremium: true }
  ): Promise<string> {
    if (Platform.OS !== 'web') {
      throw new Error(i18nT('export:services.book.BookHtmlExportService.webOnly'));
    }

    const transformer = await this.getTransformer();
    transformer.validate(travels);
    const travelsForBook = transformer.transform(travels);

    const html = await this.generateHtmlFromTravelsForBook(travelsForBook, settings, options);

    if (!html || html.trim().length === 0) {
      throw new Error(i18nT('export:services.book.BookHtmlExportService.sgenerirovannyy_html_knigi_pust_d0ce29f7'));
    }

    // Дополнительная защита: убеждаемся, что в документе есть страницы книги
    const hasPages = /class=["'][^"']*pdf-page[^"']*["']/.test(html);
    if (!hasPages) {
      throw new Error(i18nT('export:services.book.BookHtmlExportService.kniga_ne_soderzhit_ni_odnoy_stranitsy_dlya_p_3d57cec2'));
    }

    return this.enhanceHtmlForPrintPreview(html);
  }

  private async generateHtmlFromTravelsForBook(
    travelsForBook: TravelForBook[],
    settings: BookSettings,
    options: BookHtmlExportOptions
  ): Promise<string> {
    const generator = await this.getGenerator(settings.template);
    return await generator.generate(travelsForBook, settings, options);
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

    const toolbarHtml = `
<div class="print-toolbar no-print" style="position:sticky;top:0;z-index:50;width:100%;background:rgba(15,23,42,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:rgb(229,231,235);padding:14px 28px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.08);">
  <div style="display:flex;flex-direction:column;gap:5px;max-width:70%;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgb(249,115,22)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      <span>${i18nT('export:services.book.BookHtmlExportService.toolbar.instruction')}</span>
    </div>
    <div id="print-status" style="font-size:12px;color:rgba(229,231,235,0.6);padding-left:24px;">
      ${i18nT('export:services.book.BookHtmlExportService.toolbar.preparingImages')}
    </div>
  </div>
  <button id="print-btn" onclick="window.__metravelPrint && window.__metravelPrint()" style="background:rgb(249,115,22);border:none;border-radius:10px;color:rgb(255,255,255);padding:10px 20px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(249,115,22,0.3);font-size:14px;white-space:nowrap;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
    ${i18nT('export:services.book.BookHtmlExportService.toolbar.print')}
  </button>
</div>
`;

    const headIndex = result.indexOf('</head>');

    const toolbarStyles = `\n<style>\n  @media print {\n    .no-print { display: none !important; }\n    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n  img { content-visibility: auto; }\n</style>\n`;

    const preloadScript = `
<script>(function(){
  var PER_IMAGE_TIMEOUT = 30000;
  var GLOBAL_TIMEOUT = 120000;
  var MAX_RETRIES = 2;
  var PRINT_DELAY = 500;

  function setStatus(text){
    try {
      var el = document.getElementById('print-status');
      if (el) el.textContent = text;
    } catch (e) {}
  }

  function getImages(){
    try {
      return Array.prototype.slice.call(document.images || []);
    } catch (e) {
      return [];
    }
  }

  function loadSingleImage(img, timeoutMs){
    return new Promise(function(resolve){
      function done(ok){
        resolve({ ok: ok, src: (img && img.currentSrc) || (img && img.src) || '' });
      }
      if (img && img.complete && img.naturalWidth > 0) {
        done(true);
        return;
      }
      var settled = false;
      var timer;
      var onLoad = function(){
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        done(true);
      };
      var onError = function(){
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        done(false);
      };
      var cleanup = function(){
        try {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        } catch (e) {}
      };
      try {
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
      } catch (e) {
        done(false);
        return;
      }
      timer = setTimeout(function(){
        if (settled) return;
        settled = true;
        cleanup();
        done(img.complete && img.naturalWidth > 0);
      }, timeoutMs);
    });
  }

  function retryImage(img){
    return new Promise(function(resolve){
      if (!img || !img.src) { resolve(false); return; }
      var origSrc = img.src;
      var settled = false;
      var timer;
      var onLoad = function(){
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(true);
      };
      var onError = function(){
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(false);
      };
      var cleanup = function(){
        try {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        } catch (e) {}
      };
      try {
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
      } catch (e) {
        resolve(false);
        return;
      }
      timer = setTimeout(function(){
        if (settled) return;
        settled = true;
        cleanup();
        resolve(img.complete && img.naturalWidth > 0);
      }, PER_IMAGE_TIMEOUT);
      img.src = '';
      img.src = origSrc;
    });
  }

  function waitForImages(){
    var imgs = getImages();
    var total = imgs.length;
    if (!total) {
      return Promise.resolve({ total: 0, loaded: 0, failed: 0, failedUrls: [] });
    }
    var loaded = 0;
    var globalStart = Date.now();

    function updateProgress(extra){
      setStatus(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.loadingImages'))} + loaded + '/' + total + (extra || ''));
    }
    updateProgress();

    var promises = imgs.map(function(img){
      return loadSingleImage(img, PER_IMAGE_TIMEOUT).then(function(r){
        if (r.ok) { loaded++; updateProgress(); }
        return r;
      });
    });

    return Promise.all(promises).then(function(firstPass){
      var failedItems = [];
      firstPass.forEach(function(r, i){
        if (!r.ok && r.src) failedItems.push({ img: imgs[i], src: r.src });
      });

      if (!failedItems.length || (Date.now() - globalStart) > GLOBAL_TIMEOUT) {
        return { total: total, loaded: loaded, failed: failedItems.length, failedUrls: failedItems.map(function(f){ return f.src; }) };
      }

      updateProgress(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.retry'))} + failedItems.length + ${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.imagesShort'))});

      var retryRound = function(items, attempt){
        if (!items.length || attempt > MAX_RETRIES || (Date.now() - globalStart) > GLOBAL_TIMEOUT) {
          return Promise.resolve(items);
        }
        var retryPromises = items.map(function(item){
          return retryImage(item.img).then(function(ok){
            if (ok) { loaded++; updateProgress(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.retry'))} + attempt + '/' + MAX_RETRIES); }
            return { item: item, ok: ok };
          });
        });
        return Promise.all(retryPromises).then(function(results){
          var stillFailed = [];
          results.forEach(function(r){
            if (!r.ok) stillFailed.push(r.item);
          });
          if (stillFailed.length && attempt < MAX_RETRIES && (Date.now() - globalStart) < GLOBAL_TIMEOUT) {
            return retryRound(stillFailed, attempt + 1);
          }
          return stillFailed;
        });
      };

      return retryRound(failedItems, 1).then(function(remaining){
        return { total: total, loaded: loaded, failed: remaining.length, failedUrls: remaining.map(function(f){ return f.src; }) };
      });
    });
  }

  window.__metravelPrint = function(){
    var btn = document.getElementById('print-btn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.75';
      btn.style.cursor = 'progress';
    }

    setStatus(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.loadingFontsAndImages'))});

    var FONTS_TIMEOUT = 8000;
    var fontsBase = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var fontsReady = Promise.race([
      fontsBase,
      new Promise(function(resolve){ setTimeout(resolve, FONTS_TIMEOUT); })
    ]);
    return Promise.all([waitForImages(), fontsReady]).then(function(results){
      var res = results[0];
      setStatus(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.images'))} + res.loaded + '/' + res.total + (res.failed ? (${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.notLoaded'))} + res.failed + ')') : ' ✓'));
      if (res.failed && res.failedUrls && res.failedUrls.length) {
        try { console.warn('[print] failed images after retries', res.failedUrls.slice(0, 30)); } catch (e) {}
      }
      setTimeout(function(){
        try { window.print(); } finally {
          if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
          }
        }
      }, PRINT_DELAY);
    });
  };

  try {
    var imgs = getImages();
    var total = imgs.length;
    var complete = 0;
    for (var i=0;i<imgs.length;i++) {
      if (imgs[i].complete && imgs[i].naturalWidth) complete++;
    }
    setStatus(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.images'))} + complete + '/' + total + ${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.fontsLoading'))});
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() {
        var updated = getImages();
        var done = 0;
        for (var j=0;j<updated.length;j++) { if (updated[j].complete && updated[j].naturalWidth) done++; }
        setStatus(${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.images'))} + done + '/' + updated.length + ${JSON.stringify(i18nT('export:services.book.BookHtmlExportService.progress.fontsReady'))});
      });
    }
  } catch (e) {}
})();</script>
`;

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
