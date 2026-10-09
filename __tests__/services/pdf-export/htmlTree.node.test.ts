/** @jest-environment node */
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser'
import { parseHtmlBody as parseNodeHtml } from '@/services/pdf-export/parsers/contentParser/htmlTree.parse5'
import { parseHtmlBody as parseNativeHtml } from '@/services/pdf-export/parsers/contentParser/htmlTree.native'
import {
  expectHermesLikeGlobals,
  installHermesLikeGlobals,
} from '../../helpers/hermesLikeGlobals'
import { loadParseCorpus } from '../../fixtures/pdfBook/corpus'

installHermesLikeGlobals()

describe('shared parse5 HTML-tree adapter in Node', () => {
  it('reuses the native parse5 algorithm without installing DOM globals', () => {
    expectHermesLikeGlobals()
    expect(parseNodeHtml).toBe(parseNativeHtml)
    const nodeParser = new ContentParser(parseNodeHtml)
    const nativeParser = new ContentParser(parseNativeHtml)
    for (const fixture of loadParseCorpus()) {
      expect(nodeParser.parse(fixture.html)).toEqual(nativeParser.parse(fixture.html))
    }
    expectHermesLikeGlobals()
  })
})
