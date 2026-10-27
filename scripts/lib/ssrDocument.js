'use strict';

const { parseDocument, DomUtils } = require('htmlparser2');

/** Shared publication invariant for the live article and quest renderers. */
function assertSsrDocument(response, html, { sha, canonical, requireHit = false }) {
  if (response.status !== 200 || response.headers.get('x-metravel-ssr-source') !== sha) {
    throw new Error('Expected HTML from the activated renderer, not the static fallback');
  }
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Renderer response is not HTML');
  if (requireHit && response.headers.get('x-cache-status') !== 'HIT') throw new Error('Renderer HTML did not enter the guest cache');
  const document = parseDocument(html);
  const find = (predicate) => DomUtils.findAll(predicate, document.children);
  const headings = find((node) => node.name === 'h1');
  if (headings.length !== 1 || !DomUtils.textContent(headings[0]).trim()) throw new Error('Renderer needs one nonempty H1');
  const canonicals = find((node) => node.name === 'link' && node.attribs?.rel === 'canonical');
  if (canonicals.length !== 1 || canonicals[0].attribs.href !== canonical) throw new Error('Renderer canonical differs from its public route');
  return { document, find, headings };
}

module.exports = { assertSsrDocument };
