/**
 * Web variant of `routeFileXmlDocument.ts`: the browser's DOMParser. A malformed
 * document does not throw here — the parser returns a document containing a
 * `<parsererror>` element (as the root in Firefox, as a child in Chromium/WebKit),
 * which maps to the same "damaged" result as an xmldom diagnostic. DOCTYPE/ENTITY
 * input is rejected by the caller before parsing on both platforms.
 * The browser is stricter than xmldom on non-well-formed input (bare `&`, unbound
 * namespace prefix, text after the root): such files are rejected here exactly as
 * the backend's expat check rejects them on upload.
 */
export const parseRouteFileXml = (text: string): Document | null => {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const document = new DOMParser().parseFromString(text, 'application/xml');
    return document.getElementsByTagName('parsererror').length > 0 ? null : document;
  } catch {
    return null;
  }
};
