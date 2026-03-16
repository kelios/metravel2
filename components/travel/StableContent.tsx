// components/travel/StableContent.tsx
import React, { memo, Suspense, useEffect, useInsertionEffect, useMemo, useState } from "react";
import { View, StyleSheet, Platform, Text, Pressable } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";
import CustomImageRenderer from "@/components/ui/CustomImageRenderer";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
import { useThemedColors } from '@/hooks/useTheme';
import { openExternalUrl } from '@/utils/externalLinks';
import { groupConsecutiveImages } from '@/utils/richTextImageLayout';

type LazyInstagramProps = { url: string };
type LightboxImage = { src: string; alt: string };
type FullscreenGalleryProps = {
  visible: boolean;
  images: { url: string; thumbUrl?: string }[];
  initialIndex?: number;
  onClose: () => void;
};

const LazyRenderHTML = React.lazy(() =>
  import("react-native-render-html").then((m: any) => ({ default: m.default as React.ComponentType<any> }))
);
const LazyInstagram = React.lazy<React.ComponentType<LazyInstagramProps>>(() =>
  import("@/components/iframe/InstagramEmbed").then((m: any) => ({ default: m.default }))
);
const LazyFullscreenGallery = React.lazy<React.ComponentType<FullscreenGalleryProps>>(() =>
  import("@/components/travel/FullscreenGallery").then((m: any) => ({ default: m.default }))
);

interface StableContentProps {
  html: string;
  contentWidth: number;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html);
const isYouTube = (src: string) => /youtube\.com|youtu\.be/i.test(src);
const isInstagram = (src: string) => /instagram\.com/i.test(src);

const extractFirstImgSrc = (html: string): string | null => {
  const m = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
  return m?.[1] ?? null;
};

const OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr'];

const stripOptimizationParams = (urlStr: string): string => {
  try {
    const u = new URL(urlStr, 'https://metravel.by');
    let changed = false;
    for (const p of OPTIMIZATION_PARAMS) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p);
        changed = true;
      }
    }
    if (!changed) return urlStr;
    const clean = u.toString();
    return clean.endsWith('?') ? clean.slice(0, -1) : clean;
  } catch {
    return urlStr;
  }
};

const isPrivateOrLocalHost = (host: string): boolean => {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
};

const normalizeMetravelOwnImageUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr, 'https://metravel.by');
    const host = parsed.hostname.toLowerCase();
    if (host !== 'metravel.by' && host !== 'cdn.metravel.by' && host !== 'api.metravel.by') {
      return urlStr;
    }
    // Force secure scheme for first-party image routes to satisfy CSP on https pages.
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return urlStr;
  } catch {
    return urlStr;
  }
};

const buildWeservProxyUrl = (src: string) => {
  try {
    const trimmed = String(src || '').trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    // Normalize HTML entities often present in rich text src attributes.
    const normalized = trimmed.replace(/&amp;/g, '&');
    // Use smaller width on mobile to save bandwidth (~30-40% savings)
    const isMobileViewport = Platform.OS === 'web' && typeof window !== 'undefined' && (window.innerWidth || 0) <= 768;
    const targetW = isMobileViewport ? 600 : 800;
    // If already a weserv.nl URL, re-optimize params (backend may use w=1600 which is too large)
    if (/^https?:\/\/images\.weserv\.nl\//i.test(normalized)) {
      try {
        const u = new URL(normalized);
        // Strip optimization params from the inner url param — the origin server
        // doesn't understand them and returns 404 when weserv.nl forwards the request.
        const innerUrl = u.searchParams.get('url');
        if (innerUrl) {
          const cleanInner = stripOptimizationParams(
            innerUrl.startsWith('//') ? `https:${innerUrl}` : innerUrl.includes('://') ? innerUrl : `https://${innerUrl}`
          ).replace(/^https?:\/\//i, '');
          u.searchParams.set('url', cleanInner);
        }
        u.searchParams.set('w', String(targetW));
        u.searchParams.set('q', '60');
        if (!u.searchParams.has('output')) u.searchParams.set('output', 'webp');
        return u.toString();
      } catch { return normalized; }
    }
    // Check if host is private/local or metravel.by's own domain — don't proxy through weserv
    try {
      const parsed = new URL(normalized, 'https://metravel.by');
      const host = parsed.hostname.toLowerCase();
      if (isPrivateOrLocalHost(host)) {
        return normalized; // Return as-is for private hosts (local dev)
      }
      // Don't proxy metravel.by's own images — they are dynamic backend routes
      // (e.g. /travel-description-image/) that weserv.nl can't reach.
      if (host === 'metravel.by' || host === 'cdn.metravel.by' || host === 'api.metravel.by') {
        return normalizeMetravelOwnImageUrl(stripOptimizationParams(normalized));
      }
    } catch { /* continue with proxy */ }
    // Strip optimization params the origin server doesn't understand (w, h, q, f, fit, auto, etc.)
    // before proxying through weserv.nl — otherwise the origin returns 404.
    const cleaned = stripOptimizationParams(normalized);
    const withoutScheme = cleaned.replace(/^https?:\/\//i, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(withoutScheme)}&w=${targetW}&q=60&output=webp&fit=inside`;
  } catch {
    return null;
  }
};

const stripDangerousTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

const normalizeImgTags = (html: string): string => {
  let imgIdx = 0;
  return html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? "";
    const optimizedSrc = src ? buildWeservProxyUrl(src) || src : src;
    let w = tag.match(/\bwidth="(\d+)"/i)?.[1];
    let h = tag.match(/\bheight="(\d+)"/i)?.[1];
    if (!w || !h) {
      const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i);
      if (wh) {
        w = w || wh[1];
        h = h || wh[2];
      }
    }
    const styleMatch = tag.match(/\bstyle="([^"]*)"/i);
    const style = styleMatch?.[1] ?? "";
    const aspectRule = w && h ? `aspect-ratio:${w}/${h}` : "";
    const ensured = ["display:block", "height:auto", "margin:0 auto", aspectRule].filter(Boolean).reduce(
      (acc, rule) => (acc.includes(rule!) ? acc : acc ? `${acc};${rule}` : rule!),
      style
    );
    let out = tag.replace(styleMatch ? styleMatch[0] : "", "").replace(/>$/, ` style="${ensured}">`);
    out = out
      .replace(/\bsrc="[^"]*"/i, optimizedSrc ? `src="${optimizedSrc.replace(/"/g, '&quot;')}"` : '')
      .replace(/\bsrcset="[^"]*"/i, '')
      .replace(/\bsizes="[^"]*"/i, '');
    out = out.replace(/\bwidth="[^"]*"/i, "").replace(/\bheight="[^"]*"/i, "");
    // Always set width/height to prevent CLS; use 800x450 (16:9) as fallback
    const finalW = w || 800;
    const finalH = h || 450;
    out = out.replace(/>$/, ` width="${finalW}" height="${finalH}">`);
    out = out.replace(/\bdecoding="[^"]*"/i, "").replace(/\bfetchpriority="[^"]*"/i, "").replace(/\bloading="[^"]*"/i, "");
    const fallbackAlt = `Изображение маршрута ${imgIdx + 1}`;
    const altMatch = out.match(/\balt="([^"]*)"/i);
    if (!altMatch) {
      out = out.replace(/>$/, ` alt="${fallbackAlt}">`);
    } else if (!altMatch[1].trim()) {
      out = out.replace(/\balt="[^"]*"/i, `alt="${fallbackAlt}"`);
    }
    out = out.replace(/>$/, ` loading="lazy" decoding="async" fetchpriority="low">`);
    imgIdx += 1;
    return out;
  });
};

const replaceYouTubeIframes = (html: string): string =>
  html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src: string) => {
    if (!isYouTube(src)) return full;
    const id =
      src.match(/[?&]v=([a-z0-9_-]{6,})/i)?.[1] ||
      src.match(/youtu\.be\/([a-z0-9_-]{6,})/i)?.[1];
    if (!id) return full;
    return `
<div class="yt-lite" data-yt="${id}"
     style="position:relative;aspect-ratio:16/9;background:var(--color-backgroundTertiary);border-radius:12px;overflow:hidden;margin:16px 0">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
       width="1280" height="720"
       alt="YouTube preview" loading="lazy" decoding="async"
       style="width:100%;height:100%;object-fit:cover;display:block"/>
  <div role="button" tabindex="0" aria-label="Смотреть видео"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:var(--color-overlay);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </div>
</div>`;
  });

const appendClass = (attrs: string, className: string) => {
  if (!attrs) return ` class="${className}"`;
  if (/\bclass="/i.test(attrs)) {
    return attrs.replace(/class="([^"]*)"/i, (_, current) => `class="${`${current} ${className}`.trim()}"`);
  }
  return `${attrs} class="${className}"`;
};

const stripTags = (value: string) => value.replace(/<[^>]+>/g, "");

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");

const encodeEntities = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sliceText = (text: string, limit: number) => {
  const chars = Array.from(text);
  if (chars.length <= limit) {
    return { text, truncated: false };
  }
  return {
    text: chars.slice(0, limit).join("").trimEnd(),
    truncated: true,
  };
};

const truncateInstagramCaptions = (html: string) => {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs = "", inner = "") => {
    const plain = decodeEntities(stripTags(inner)).trim();
    if (!plain.startsWith("@") || plain.length <= 100) return match;

    const handleMatch = inner.match(/^(\s*@\s*(?:<a[\s\S]+?<\/a>|[\w.@]+))(.*)$/i);
    let nextInner = inner;
    if (handleMatch) {
      const handleHtml = handleMatch[1];
      const restHtml = handleMatch[2] || "";
      const handlePlain = decodeEntities(stripTags(handleHtml)).trim();
      const restPlain = decodeEntities(stripTags(restHtml)).trim();
      const remaining = Math.max(0, 100 - handlePlain.length - 1);
      const { text, truncated } = sliceText(restPlain, remaining);
      const spacer = text ? "&nbsp;" : "";
      nextInner = `${handleHtml}${spacer}<span class="instagram-caption-text">${encodeEntities(
        text
      )}${truncated ? "…" : ""}</span>`;
    } else {
      const { text, truncated } = sliceText(plain, 100);
      nextInner = `${encodeEntities(text)}${truncated ? "…" : ""}`;
    }

    return `<p${appendClass(attrs, "instagram-caption")}>${nextInner}</p>`;
  });
};

const prepareHtml = (html: string) => {
  const safe = sanitizeRichText(html);
  const normalized = replaceYouTubeIframes(normalizeImgTags(stripDangerousTags(safe)));
  const demoted = normalized
    .replace(/<\s*h1(\b[^>]*)>/gi, '<h2$1>')
    .replace(/<\s*\/\s*h1\s*>/gi, '</h2>');
  const truncated = truncateInstagramCaptions(demoted);
  return groupConsecutiveImages(truncated);
};

const WEB_RICH_TEXT_CLASS = "travel-rich-text";
const WEB_RICH_TEXT_STYLES_ID = "travel-rich-text-styles";

/* Apple-style Clean Color Palette */
const EDITORIAL_COLORS = {
  textPrimary: '#1d1d1f',
  textSecondary: '#424245',
  textMuted: '#86868b',
  accent: '#0071e3',
  accentLight: 'rgba(0, 113, 227, 0.08)',
};

const getWebRichTextStyles = (colors: ReturnType<typeof useThemedColors>) => `
.${WEB_RICH_TEXT_CLASS} {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 17px;
  line-height: 1.58;
  letter-spacing: -0.003em;
  color: ${EDITORIAL_COLORS.textSecondary};
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 0 ${DESIGN_TOKENS.spacing.md}px 48px;
}

/* ===== APPLE-STYLE PARAGRAPHS ===== */
.${WEB_RICH_TEXT_CLASS} p {
  margin: 0 0 1.4em;
}

/* ===== APPLE-STYLE HEADINGS ===== */
.${WEB_RICH_TEXT_CLASS} h1,
.${WEB_RICH_TEXT_CLASS} h2,
.${WEB_RICH_TEXT_CLASS} h3 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: ${EDITORIAL_COLORS.textPrimary};
  font-weight: 600;
  letter-spacing: -0.022em;
}
.${WEB_RICH_TEXT_CLASS} h2 {
  font-size: 28px;
  line-height: 1.14;
  margin: 1.8em 0 0.6em;
}
.${WEB_RICH_TEXT_CLASS} h3 {
  font-size: 21px;
  line-height: 1.19;
  margin: 1.6em 0 0.5em;
}

/* ===== BASE IMAGES ===== */
.${WEB_RICH_TEXT_CLASS} img {
  display: block;
  max-width: min(100%, 70vw);
  max-height: 70vh;
  height: auto;
  object-fit: contain;
  object-position: center;
  border-radius: 12px;
  background: #f5f5f7;
  cursor: zoom-in;
}

/* ===== SINGLE WIDE IMAGE (horizontal/landscape) ===== */
.${WEB_RICH_TEXT_CLASS} .img-single-wide {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0;
  clear: both;
  text-align: center;
}
.${WEB_RICH_TEXT_CLASS} .img-single-wide img {
  width: min(100%, 70vw);
  max-width: min(100%, 70vw);
  max-height: 70vh;
  height: auto;
  margin: 0 auto;
  border-radius: 12px;
  object-fit: contain;
}

/* ===== SINGLE IMAGE WITH FLOAT (desktop, vertical/square images only) ===== */
@media (min-width: 769px) {
  .${WEB_RICH_TEXT_CLASS} .img-float-right {
    float: right;
    max-width: 45%;
    margin: 0.5em 0 1em 1.5em;
    clear: right;
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-right img {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    margin: 0;
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-left {
    float: left;
    max-width: 45%;
    margin: 0.5em 1.5em 1em 0;
    clear: left;
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-left img {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    margin: 0;
  }
}

/* ===== TWO IMAGES SIDE BY SIDE ===== */
.${WEB_RICH_TEXT_CLASS} .img-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 1.75em 0;
  clear: both;
  align-items: stretch;
}
.${WEB_RICH_TEXT_CLASS} .img-row-2 p {
  margin: 0;
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
}
.${WEB_RICH_TEXT_CLASS} .img-row-2 img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  margin: 0;
  border-radius: 16px;
}

/* ===== TWO IMAGES ROW VARIANTS ===== */
/* Portrait pair - taller images */
.${WEB_RICH_TEXT_CLASS} .img-row-2-portrait img {
  height: 280px;
}
/* Mixed pair - portrait + landscape, auto height to respect aspect ratios */
.${WEB_RICH_TEXT_CLASS} .img-row-2-mixed {
  align-items: start;
}
.${WEB_RICH_TEXT_CLASS} .img-row-2-mixed img {
  height: auto;
  max-height: 300px;
  object-fit: contain;
}

/* ===== THREE+ IMAGES GRID ===== */
.${WEB_RICH_TEXT_CLASS} .img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 1.75em 0;
  clear: both;
  align-items: stretch;
}
.${WEB_RICH_TEXT_CLASS} .img-grid p {
  margin: 0;
  display: flex;
  align-items: stretch;
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
}
.${WEB_RICH_TEXT_CLASS} .img-grid img {
  width: 100%;
  height: 100%;
  min-height: 200px;
  max-height: 320px;
  object-fit: cover;
  object-position: center;
  margin: 0;
  border-radius: 16px;
  background: ${colors.backgroundSecondary};
}

/* ===== MIXED GRID: 2 landscape + 1 portrait ===== */
/* Layout: [landscape stack] [portrait] side by side */
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 1.75em 0;
  clear: both;
  align-items: stretch;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack p {
  margin: 0;
  flex: 1;
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack img {
  width: 100%;
  height: 100%;
  min-height: 154px;
  object-fit: cover;
  border-radius: 16px;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p {
  margin: 0;
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p img {
  width: 100%;
  height: 100%;
  min-height: 320px;
  object-fit: cover;
  border-radius: 16px;
}

/* ===== PORTRAIT-HEAVY GRID ===== */
/* Multiple portraits - use 2 columns with taller cells */
.${WEB_RICH_TEXT_CLASS} .img-grid-portrait {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.${WEB_RICH_TEXT_CLASS} .img-grid-portrait img {
  min-height: 240px;
  max-height: 360px;
}

/* ===== CLEARFIX ===== */
.${WEB_RICH_TEXT_CLASS}::after {
  content: "";
  display: block;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} h2,
.${WEB_RICH_TEXT_CLASS} h3 {
  clear: both;
}

/* ===== FIGURE IMAGES ===== */
.${WEB_RICH_TEXT_CLASS} figure img {
  float: none !important;
  max-width: 100%;
  width: 100%;
  margin: 0.5em auto;
}

/* ===== APPLE-STYLE LINKS ===== */
.${WEB_RICH_TEXT_CLASS} a {
  color: ${EDITORIAL_COLORS.accent};
  text-decoration: none;
  word-break: break-word;
  transition: opacity 0.2s;
}
.${WEB_RICH_TEXT_CLASS} a:hover {
  text-decoration: underline;
}
.${WEB_RICH_TEXT_CLASS} a img {
  cursor: pointer;
}
.${WEB_RICH_TEXT_CLASS} a:focus-visible {
  outline: 2px solid ${EDITORIAL_COLORS.accent};
  outline-offset: 2px;
  border-radius: 4px;
}

/* ===== LISTS ===== */
.${WEB_RICH_TEXT_CLASS} ul,
.${WEB_RICH_TEXT_CLASS} ol {
  margin: 1.2em 0 1.5em 2em;
  padding: 0;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} li {
  margin-bottom: 0.5em;
  line-height: 1.7;
}
.${WEB_RICH_TEXT_CLASS} li::marker {
  color: ${colors.primary};
}

/* ===== APPLE-STYLE BLOCKQUOTES ===== */
.${WEB_RICH_TEXT_CLASS} blockquote {
  margin: 1.8em 0;
  padding: 0 0 0 1.5em;
  border-left: 3px solid #d2d2d7;
  font-size: 17px;
  line-height: 1.58;
  color: ${EDITORIAL_COLORS.textMuted};
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} blockquote p {
  margin-bottom: 0.75em;
}
.${WEB_RICH_TEXT_CLASS} blockquote p:last-child {
  margin-bottom: 0;
}

/* ===== PREMIUM FIGURES & CAPTIONS ===== */
.${WEB_RICH_TEXT_CLASS} figure {
  margin: 2.5em 0;
  text-align: center;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} figure img {
  margin-bottom: 1em;
}
.${WEB_RICH_TEXT_CLASS} figcaption {
  text-align: center;
  font-size: 0.85rem;
  color: ${EDITORIAL_COLORS.textMuted};
  font-style: italic;
  margin-top: 0.75em;
  padding: 0 2em;
  line-height: 1.5;
}

/* ===== IMAGE STRIPS ===== */
.${WEB_RICH_TEXT_CLASS} .image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${DESIGN_TOKENS.spacing.sm}px;
  margin: 1.5em 0;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} .image-strip img {
  float: none;
  width: 100%;
  max-width: 100%;
  margin: 0;
  border-radius: 8px;
}

/* ===== MEDIA EMBEDS ===== */
.${WEB_RICH_TEXT_CLASS} iframe,
.${WEB_RICH_TEXT_CLASS} .yt-lite {
  display: block;
  max-width: 100%;
  border-radius: ${DESIGN_TOKENS.radii.md}px;
  padding: 0;
  overflow: hidden;
  margin: 1.5em 0;
  clear: both;
}

/* ===== CLEARFIX ===== */
.${WEB_RICH_TEXT_CLASS}::after {
  content: "";
  display: block;
  clear: both;
}
/* Instagram wrapper - обёртка для всех Instagram embed'ов */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper,
.${WEB_RICH_TEXT_CLASS} .instagram-media {
  width: min(100%, 360px) !important;
  max-width: 360px !important;
  min-width: 0 !important;
  margin: ${DESIGN_TOKENS.spacing.xs + 8}px 0 ${DESIGN_TOKENS.spacing.sm}px !important;
  border-radius: ${DESIGN_TOKENS.radii.md}px !important;
  overflow: hidden !important;
  position: relative;
  display: block;
}

/* Instagram iframe - занимает всю ширину, пропорциональная высота */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper iframe,
.${WEB_RICH_TEXT_CLASS} .instagram-embed,
.${WEB_RICH_TEXT_CLASS} .instagram-media iframe,
.${WEB_RICH_TEXT_CLASS} iframe.ql-video[src*="instagram.com"],
.${WEB_RICH_TEXT_CLASS} iframe[src*="instagram.com"] {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 4 / 5 !important;
  border: none !important;
  border-radius: 18px !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* Скрытие лишних элементов внутри Instagram embed через CSS */
/* Примечание: из-за CORS мы не можем напрямую изменять содержимое iframe,
   но можем использовать CSS для скрытия элементов, которые рендерятся поверх iframe */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper::before,
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper::after {
  display: none !important;
}

/* Попытка скрыть элементы, которые могут рендериться поверх iframe */
/* Эти стили применяются к элементам, которые Instagram может добавить в DOM */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper + *,
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper ~ * {
  /* Скрываем элементы после wrapper, которые могут быть добавлены Instagram скриптом */
}

/* Убираем лишние отступы и границы */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper {
  background: transparent !important;
  padding: 0 !important;
}

/* ===== MOBILE RESPONSIVE ===== */
@media (max-width: 768px) {
  .${WEB_RICH_TEXT_CLASS} {
    font-size: 17px;
    line-height: 1.52;
    padding: 0 ${DESIGN_TOKENS.spacing.sm}px 32px;
  }
  .${WEB_RICH_TEXT_CLASS} img {
    border-radius: 10px;
  }
  .${WEB_RICH_TEXT_CLASS} h2 {
    font-size: 24px;
    margin: 1.5em 0 0.5em;
  }
  .${WEB_RICH_TEXT_CLASS} h3 {
    font-size: 19px;
    margin: 1.4em 0 0.4em;
  }
  .${WEB_RICH_TEXT_CLASS} blockquote {
    margin: 1.5em 0;
    padding: 0 0 0 1em;
  }
  /* Mobile: no float, stack images */
  .${WEB_RICH_TEXT_CLASS} .img-float-right,
  .${WEB_RICH_TEXT_CLASS} .img-float-left {
    float: none;
    max-width: 100%;
    margin: 1em 0;
  }
  /* Mobile: 2 images still side by side but smaller */
  .${WEB_RICH_TEXT_CLASS} .img-row-2 {
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-row-2 img {
    height: 150px;
  }
  /* Mobile: grid becomes 2 columns */
  .${WEB_RICH_TEXT_CLASS} .img-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid img {
    min-height: 140px;
    max-height: 220px;
  }
  /* Mobile: mixed grid stacks vertically */
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack {
    flex-direction: row;
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack img {
    min-height: 120px;
    height: 120px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p img {
    min-height: 200px;
    max-height: 240px;
    object-fit: cover;
  }
  /* Mobile: portrait row heights */
  .${WEB_RICH_TEXT_CLASS} .img-row-2-portrait img {
    height: 210px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-portrait img {
    min-height: 180px;
    max-height: 240px;
  }
  .${WEB_RICH_TEXT_CLASS} .instagram-wrapper,
  .${WEB_RICH_TEXT_CLASS} .instagram-media {
    width: 100% !important;
    max-width: 100% !important;
  }
}

/* Стили для подписей Instagram */
.${WEB_RICH_TEXT_CLASS} .instagram-caption {
  font-size: 14px;
  color: ${colors.textMuted};
  line-height: 1.5;
  margin-top: 8px;
  margin-bottom: 20px;
  text-align: center;
}
.${WEB_RICH_TEXT_CLASS} .instagram-caption-text {
  display: inline;
}
`;

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webRichTextStyles = useMemo(() => getWebRichTextStyles(colors), [colors]);
  const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const prepared = useMemo(() => prepareHtml(html), [html]);

  const scrollToHashTarget = (hash: string) => {
    try {
      if (Platform.OS !== "web") return false;
      if (typeof document === "undefined") return false;
      const raw = String(hash || "");
      if (!raw.startsWith("#")) return false;
      const id = decodeURIComponent(raw.slice(1));
      if (!id) return false;
      const el =
        document.getElementById(id) ||
        (document.querySelector(`[name="${CSS?.escape ? CSS.escape(id) : id}"]`) as HTMLElement | null);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    } catch {
      return false;
    }
  };

  // базовая типографика — ПИКСЕЛИ, не коэффициент!
  const BASE_FONT_SIZE = Platform.select({ ios: 16, android: 16, default: 17 })!;
  const BASE_LINE_HEIGHT = Math.round(BASE_FONT_SIZE * 1.55); // ~1.55em

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const connection = (navigator as any)?.connection;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const saveData = Boolean(connection?.saveData);
    const isConstrained = saveData || effectiveType.includes('2g') || effectiveType.includes('slow-2g');
    if (isConstrained) return;

    const first = extractFirstImgSrc(prepared);
    if (!first) return;
    const safeHref = buildWeservProxyUrl(first) || first;
    try {
      const resolved = new URL(safeHref, window.location.origin);
      if (resolved.origin !== window.location.origin) return;
    } catch {
      return;
    }
    const linkId = `prefetch-stable-content-first-img-${encodeURIComponent(safeHref)}`;
    if (document.getElementById(linkId)) return;

    let link: HTMLLinkElement | null = null;
    let cancelled = false;

    const mount = () => {
      if (cancelled) return;
      if (document.getElementById(linkId)) return;
      link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = safeHref;
      link.id = linkId;
      document.head.appendChild(link);
    };

    const schedule = () => {
      try {
        if ((window as any).requestIdleCallback) {
          ;(window as any).requestIdleCallback(mount, { timeout: 1000 });
        } else {
          setTimeout(mount, 1000);
        }
      } catch {
        mount();
      }
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      cancelled = true;
      try {
        window.removeEventListener('load', schedule as any);
      } catch {
        void 0;
      }
      if (link?.parentNode) link.parentNode.removeChild(link);
    };
  }, [prepared]);

  useEffect(() => {
    let cancelled = false;
    if (hasIframe(prepared)) {
      import("@native-html/iframe-plugin")
        .then((m) => !cancelled && setIframeModel(m.iframeModel))
        .catch(() => setIframeModel(null));
    } else setIframeModel(null);
    return () => {
      cancelled = true;
    };
  }, [prepared]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onClick = (e: any) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const ytRoot = target.closest?.(".yt-lite") as HTMLElement | null;
      if (ytRoot) {
        const vid = ytRoot.getAttribute("data-yt");
        if (!vid) return;
        const iframe = document.createElement("iframe");
        iframe.width = "560";
        iframe.height = "315";
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`;
        iframe.title = "YouTube video";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.setAttribute('allowfullscreen', '');
        Object.assign(iframe.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          border: "0",
        });
        ytRoot.replaceChildren();
        ytRoot.appendChild(iframe);
        return;
      }

      const anchor = target.closest?.(`.${WEB_RICH_TEXT_CLASS} a[href^="#"]`) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const didScroll = scrollToHashTarget(href);
      if (didScroll) {
        e.preventDefault?.();
        try {
          window.history.pushState(window.history.state ?? {}, "", href);
        } catch {
          window.location.hash = href;
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick as any);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const image = target.closest?.(`.${WEB_RICH_TEXT_CLASS} img`) as HTMLImageElement | null;
      if (!image) return;
      const parentLink = image.closest('a[href]') as HTMLAnchorElement | null;
      const href = parentLink?.getAttribute('href') || '';
      if (href && !href.startsWith('#')) {
        return;
      }
      e.preventDefault();
      const src = image.currentSrc || image.getAttribute('src') || '';
      if (!src) return;
      setLightboxImage({
        src,
        alt: image.getAttribute('alt') || 'Изображение маршрута',
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    if (lightboxImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow || '';
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxImage]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    let cancelled = false;
    let tries = 0;
    const maxTries = 20;
    const intervalMs = 150;
    const tick = () => {
      if (cancelled) return;
      tries += 1;
      const done = scrollToHashTarget(hash);
      if (done || tries >= maxTries) {
        cancelled = true;
      }
    };
    const id = window.setInterval(tick, intervalMs);
    window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [prepared]);

  const renderers = useMemo(() => {
    return {
      img: (props: TDefaultRendererProps<any>) => {
        try {
          // @ts-expect-error CustomImageRenderer accepts extended props beyond TDefaultRendererProps
          return <CustomImageRenderer {...props} contentWidth={contentWidth} onPressImage={setLightboxImage} />;
        } catch {
          const DefaultRenderer = (props as any).TDefaultRenderer;
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null;
        }
      },
      iframe: (props: TDefaultRendererProps<any>) => {
        const attrs = (props.tnode?.attributes || {}) as any;
        const src: string = attrs.src || "";

        if (!src) {
          const DefaultRenderer = (props as any).TDefaultRenderer;
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null;
        }

        if (isInstagram(src)) {
          const url = src.replace("/embed/captioned/", "/").split("?")[0];
          const wrapperStyle = Platform.OS === "web" 
            ? [styles.instagramEmbedWrapper, styles.instagramEmbedWrapperWeb]
            : styles.instagramEmbedWrapper;
          return (
            <View style={wrapperStyle}>
              <Suspense fallback={<Text>Instagram…</Text>}>
                <LazyInstagram url={url} />
              </Suspense>
            </View>
          );
        }

        if (isYouTube(src)) {
          if (Platform.OS !== "web") {
            const open = () => {
              void openExternalUrl(src);
            };
            return (
              <Pressable onPress={open} style={styles.ytStub}>
                <Text style={styles.ytStubText}>Смотреть на YouTube</Text>
              </Pressable>
            );
          }
          const DefaultRenderer = (props as any).TDefaultRenderer;
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null;
        }

        const DefaultRenderer = (props as any).TDefaultRenderer;
        return DefaultRenderer ? <DefaultRenderer {...props} /> : null;
      },
    };
  }, [contentWidth, styles.instagramEmbedWrapper, styles.instagramEmbedWrapperWeb, styles.ytStub, styles.ytStubText]);

  // ВНИМАНИЕ: lineHeight задаём через baseStyle (px). В tagsStyles не переопределяем.
  const baseStyle = useMemo(
    () => ({
      color: colors.text,
      fontSize: BASE_FONT_SIZE,
      lineHeight: BASE_LINE_HEIGHT,
    }),
    [BASE_FONT_SIZE, BASE_LINE_HEIGHT, colors.text]
  );

  const tagsStyles = useMemo(
    () => ({
      // ✅ УЛУЧШЕНИЕ: Улучшенная типографика для читаемости
      p: { 
        marginTop: 12, 
        marginBottom: 12, 
        lineHeight: Math.round(BASE_FONT_SIZE * 1.6), // Межстрочный интервал 1.6
      },
      a: {
        color: colors.primaryText,
        textDecorationLine: 'underline',
      },
      strong: { fontWeight: "700" }, // ✅ Более жирный для выделения
      em: { fontStyle: "italic", color: colors.textMuted }, // ✅ Немного другой цвет для курсива

      // ✅ УЛУЧШЕНИЕ: Заголовки с улучшенной иерархией
      h1: { 
        fontSize: BASE_FONT_SIZE + 12, // ~28-29px
        lineHeight: Math.round((BASE_FONT_SIZE + 12) * 1.3), 
        fontWeight: "700", 
        marginTop: DESIGN_TOKENS.spacing.md,
        marginBottom: DESIGN_TOKENS.spacing.lg,
        color: colors.text, // ✅ Более темный цвет
      },
      h2: { 
        fontSize: BASE_FONT_SIZE + 8, // ~24-25px
        lineHeight: Math.round((BASE_FONT_SIZE + 8) * 1.34), 
        fontWeight: "700", 
        marginTop: DESIGN_TOKENS.spacing.xs,
        marginBottom: 12,
        color: colors.text,
      },
      h3: { 
        fontSize: BASE_FONT_SIZE + 4, // ~20-21px
        lineHeight: Math.round((BASE_FONT_SIZE + 4) * 1.38), 
        fontWeight: "700", 
        marginTop: 18,
        marginBottom: DESIGN_TOKENS.spacing.sm,
        color: colors.text,
      },

      // ✅ УЛУЧШЕНИЕ: Улучшенные списки
      ul: { 
        marginVertical: 12, 
        paddingLeft: DESIGN_TOKENS.spacing.md, // ✅ Увеличенный отступ
      },
      ol: {
        marginVertical: 12,
        paddingLeft: DESIGN_TOKENS.spacing.md,
      },
      li: { 
        marginVertical: DESIGN_TOKENS.spacing.xs, // ✅ Увеличенный отступ между элементами
        lineHeight: Math.round(BASE_FONT_SIZE * 1.6),
      },

      figure: {
        margin: 0,
        padding: 0,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        flexDirection: "column",
      },
      figcaption: {
        textAlign: "center",
        fontSize: BASE_FONT_SIZE - 2,
        opacity: 0.75,
        marginTop: DESIGN_TOKENS.spacing.xs,      // НЕ отрицательное значение — не накладывается на фото
        lineHeight: Math.round((BASE_FONT_SIZE - 2) * 1.4),
      },

      img: {
        maxWidth: "100%",
        width: "100%",
        height: "auto",
        borderRadius: DESIGN_TOKENS.radii.md,
        marginVertical: 12,
        display: "block",
        alignSelf: "stretch",
      },

      iframe: {
        width: "100%",
        height: Math.round(contentWidth * 0.5625),
        display: "block",
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: "hidden",
        marginVertical: 14,
      },
    }),
    [BASE_FONT_SIZE, contentWidth, colors]
  );

  const customHTMLElementModels = useMemo(
    () => (iframeModel ? { iframe: iframeModel } : undefined),
    [iframeModel]
  );

  const handleLinkPress = (_: any, href?: string) => {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      void openExternalUrl(href, {
        onError: (error) => {
          if (__DEV__) {
            console.warn('[StableContent] Не удалось открыть URL:', error);
          }
        },
      });
    } else if (href.startsWith("/") && Platform.OS === "web") {
      window.location.assign(href);
    }
  };

  useInsertionEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    const existing = document.getElementById(WEB_RICH_TEXT_STYLES_ID) as HTMLStyleElement | null;
    if (existing) {
      existing.textContent = webRichTextStyles;
      return;
    }
    const style = document.createElement("style");
    style.id = WEB_RICH_TEXT_STYLES_ID;
    style.textContent = webRichTextStyles;
    document.head.appendChild(style);
  }, [webRichTextStyles]);

  // Обработка Instagram iframe'ов, вставленных напрямую в HTML
  useEffect(() => {
    if (Platform.OS !== "web") return;

    let processing = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const processInstagramEmbeds = () => {
      // Предотвращаем параллельные вызовы
      if (processing) return;
      processing = true;

      try {
        const richTextContainer = document.querySelector(`.${WEB_RICH_TEXT_CLASS}`);
        if (!richTextContainer) {
          processing = false;
          return;
        }

        // Находим все iframe'ы с Instagram, которые ещё не обработаны
        const instagramIframes = richTextContainer.querySelectorAll(
          'iframe[src*="instagram.com"]:not(.instagram-processed), iframe.ql-video[src*="instagram.com"]:not(.instagram-processed)'
        );

        instagramIframes.forEach((iframe) => {
          // Проверяем, не обёрнут ли уже
          if (iframe.parentElement?.classList.contains('instagram-wrapper')) {
            iframe.classList.add('instagram-processed');
            return;
          }

          // Создаём обёртку
          const wrapper = document.createElement('div');
          wrapper.className = 'instagram-wrapper';
          
          // Перемещаем iframe в обёртку
          iframe.parentNode?.insertBefore(wrapper, iframe);
          wrapper.appendChild(iframe);
          
          // Добавляем классы к iframe
          iframe.classList.add('instagram-embed', 'instagram-processed');
        });

        // Обрабатываем blockquote.instagram-media (если есть)
        const instagramBlockquotes = richTextContainer.querySelectorAll(
          'blockquote.instagram-media:not(.instagram-processed)'
        );

        instagramBlockquotes.forEach((blockquote) => {
          // Убеждаемся, что у него правильные стили
          blockquote.classList.add('instagram-wrapper', 'instagram-processed');
        });
      } catch (error) {
        // Игнорируем ошибки обработки
        if (__DEV__) {
          console.warn('[StableContent] Error processing Instagram embeds:', error);
        }
      } finally {
        processing = false;
      }
    };

    // Debounced версия для MutationObserver
    const debouncedProcess = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        processInstagramEmbeds();
        timeoutId = null;
      }, 300);
    };

    // Выполняем сразу
    processInstagramEmbeds();

    // Используем MutationObserver для обработки динамически загруженных embed'ов
    // Но только для добавления новых элементов, не для изменений существующих
    const observer = new MutationObserver((mutations) => {
      // Проверяем, есть ли новые iframe'ы
      const hasNewIframes = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            return (
              el.tagName === 'IFRAME' && 
              (el.getAttribute('src')?.includes('instagram.com') || 
               el.classList.contains('ql-video'))
            ) || 
            el.querySelector?.('iframe[src*="instagram.com"]');
          }
          return false;
        });
      });

      if (hasNewIframes) {
        debouncedProcess();
      }
    });

    const richTextContainer = document.querySelector(`.${WEB_RICH_TEXT_CLASS}`);
    if (richTextContainer) {
      observer.observe(richTextContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Также обрабатываем после небольшой задержки (для асинхронно загружаемых embed'ов)
    const initialTimeoutId = setTimeout(processInstagramEmbeds, 1000);

    return () => {
      observer.disconnect();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearTimeout(initialTimeoutId);
    };
  }, [prepared]);

  const isWeb = (Platform.OS as string) === 'web';
  const webLightboxPortal =
    isWeb && lightboxImage && typeof document !== 'undefined'
      ? ((require('react-dom') as { createPortal: (node: React.ReactNode, container: Element | DocumentFragment) => React.ReactNode }).createPortal(
          <div
            data-testid="travel-rich-text-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={lightboxImage.alt}
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: DESIGN_TOKENS.colors.overlay,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 1000,
              cursor: 'zoom-out',
            }}
          >
            <button
              type="button"
              aria-label="Закрыть изображение"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxImage(null);
              }}
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                border: `1px solid ${DESIGN_TOKENS.colors.surfaceAlpha40}`,
                background: DESIGN_TOKENS.colors.overlayLight,
                color: DESIGN_TOKENS.colors.textOnDark,
                fontSize: '28px',
                lineHeight: '1',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              onClick={(event) => event.stopPropagation()}
              style={{
                maxWidth: '92vw',
                maxHeight: '92vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '16px',
                background: 'transparent',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.32)',
                cursor: 'default',
              }}
            />
          </div>,
          document.body
        ))
      : null;

  if (isWeb) {
    return (
      <>
        <div
          className={WEB_RICH_TEXT_CLASS}
          dangerouslySetInnerHTML={{ __html: prepared }}
        />
        {webLightboxPortal}
      </>
    )
  }

  return (
    <>
      <View style={isWeb ? [styles.htmlWrapper, styles.htmlWrapperWeb] : styles.htmlWrapper}>
        <Suspense fallback={null}>
          <LazyRenderHTML
            key={prepared.length}
            source={{ html: prepared }}
            contentWidth={contentWidth}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
            defaultTextProps={{ selectable: !isWeb }}
            onLinkPress={handleLinkPress}
            baseStyle={baseStyle as any}
            tagsStyles={tagsStyles as any}
            ignoredDomTags={['script', 'style']}
          />
        </Suspense>
      </View>
      {!isWeb && lightboxImage ? (
        <Suspense fallback={null}>
          <LazyFullscreenGallery
            visible={Boolean(lightboxImage)}
            images={[{ url: lightboxImage.src }]}
            initialIndex={0}
            onClose={() => setLightboxImage(null)}
          />
        </Suspense>
      ) : null}
    </>
  )
});

export default StableContent

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  htmlWrapper: {
    flexDirection: 'column',
    width: '100%',
    alignSelf: 'center'
  },
  htmlWrapperWeb: {
    width: '100%',
    minHeight: 320,
  },
  ytStub: {
    marginVertical: DESIGN_TOKENS.spacing.sm,
    aspectRatio: 16 / 9,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ytStubText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm
  },
  instagramEmbedWrapper: {
    marginVertical: 14,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'flex-start',
    overflow: 'hidden'
  },
  instagramEmbedWrapperWeb: {
    width: '100%',
    maxWidth: 360,
  }
})
