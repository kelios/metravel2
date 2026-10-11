import { DOMParser as SafeXmlDomParser } from '@xmldom/xmldom';

/**
 * Parses a route file (GPX/KML) as XML. Returns null when the parser reports any
 * diagnostic, so a damaged file never yields a half-built document.
 * Native runtimes have no DOMParser, hence xmldom here; web uses the browser's own
 * parser (`routeFileXmlDocument.web.ts`) and keeps ~24 KB gzip of xmldom out of the
 * web bundle (#2389).
 */
export const parseRouteFileXml = (text: string): Document | null => {
  const diagnostics: string[] = [];
  try {
    const document = new SafeXmlDomParser({
      errorHandler: {
        warning: (message) => diagnostics.push(String(message)),
        error: (message) => diagnostics.push(String(message)),
        fatalError: (message) => diagnostics.push(String(message)),
      },
    }).parseFromString(text, 'application/xml');
    return diagnostics.length > 0 ? null : document;
  } catch {
    return null;
  }
};
