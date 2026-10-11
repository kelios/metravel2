import type { ImageBlock, ParagraphBlock, ParsedContentBlock } from '@/services/pdf-export/parsers/ContentParser'

export type PhotoTextFlowItem =
  | { type: 'block'; block: ParsedContentBlock }
  | { type: 'photo-text'; image: ImageBlock; paragraph: ParagraphBlock }

const isFloat = (block: ParsedContentBlock): block is ImageBlock =>
  block.type === 'image' && (block.layout === 'float-left' || block.layout === 'float-right')

const isEmptyParagraph = (block: ParsedContentBlock): boolean =>
  block.type === 'paragraph' && block.text.trim().length === 0

/** Display-only association; the parser's blocks and stored source remain unchanged. */
export function resolvePhotoTextFlow(blocks: readonly ParsedContentBlock[]): PhotoTextFlowItem[] {
  const claimedParagraphs = new Set<number>()
  const previous = new Array<number>(blocks.length)
  const next = new Array<number>(blocks.length)
  let prior = -1
  let activeFloat = false

  blocks.forEach((block, index) => {
    previous[index] = prior
    if (isEmptyParagraph(block)) return
    prior = index
    if (isFloat(block)) activeFloat = true
    else if (block.type === 'paragraph') {
      if (activeFloat) claimedParagraphs.add(index)
    } else activeFloat = false
  })

  let following = -1
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    next[index] = following
    if (!isEmptyParagraph(blocks[index])) following = index
  }

  const pairs = new Map<number, ImageBlock>()
  const pairedImages = new Set<number>()
  blocks.forEach((block, index) => {
    if (!isFloat(block)) return
    const followingBlock = blocks[next[index]]
    if (followingBlock?.type === 'paragraph') return
    const paragraphIndex = previous[index]
    const paragraph = blocks[paragraphIndex]
    if (paragraph?.type !== 'paragraph' || paragraph.text.trim().length < 60 || claimedParagraphs.has(paragraphIndex)) return
    pairs.set(paragraphIndex, block)
    pairedImages.add(index)
  })

  return blocks.flatMap((block, index): PhotoTextFlowItem[] => {
    if (pairedImages.has(index)) return []
    const image = pairs.get(index)
    return image && block.type === 'paragraph'
      ? [{ type: 'photo-text', image, paragraph: block }]
      : [{ type: 'block', block }]
  })
}
