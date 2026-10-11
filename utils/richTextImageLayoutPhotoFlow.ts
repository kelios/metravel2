// Presentation-only associations for StableContent.web. Canonical article HTML,
// native rendering and the PDF typed-block flow never consume these wrappers.
export const INLINE_PHOTO_FLOW_CLASS = 'rich-inline-photo-flow';

type Block = { html: string; tag?: string };

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TAG = /<!--[\s\S]*?-->|<\/?[a-z][\w:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
const TEXT_TAGS = new Set(['p', 'a', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'br', 'sub', 'sup', 'code', 'mark', 'small', 'abbr', 'cite', 'time']);
const PHOTO_TAGS = new Set([...TEXT_TAGS, 'figure', 'figcaption', 'img', 'picture', 'source']);

// Scan balanced top-level blocks without parsing or rewriting their descendants.
// A malformed/unsupported boundary leaves the whole input untouched.
const splitBlocks = (html: string): Block[] | null => {
  const blocks: Block[] = [];
  const stack: string[] = [];
  const openParagraphsAndLinks = new Set<string>();
  let cursor = 0;
  let start = 0;
  let rootTag: string | undefined;
  for (const match of html.matchAll(TAG)) {
    const index = match.index!;
    if (html.slice(cursor, index).includes('<')) return null;
    if (!stack.length && index > cursor) blocks.push({ html: html.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith('<!--')) {
      if (!stack.length) blocks.push({ html: token });
      cursor = index + token.length;
      continue;
    }
    const tag = /^<\/?([\w:-]+)/.exec(token)![1].toLowerCase();
    if (token.startsWith('</')) {
      if (stack.pop() !== tag) return null;
      openParagraphsAndLinks.delete(tag);
      if (!stack.length) blocks.push({ html: html.slice(start, index + token.length), tag: rootTag });
    } else {
      const forbidsNesting = tag === 'p' || tag === 'a';
      if (forbidsNesting && openParagraphsAndLinks.has(tag)) return null;
      if (!stack.length) { start = index; rootTag = tag; }
      if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) {
        stack.push(tag);
        if (forbidsNesting) openParagraphsAndLinks.add(tag);
      } else if (!stack.length) blocks.push({ html: token, tag });
    }
    cursor = index + token.length;
  }
  if (stack.length || html.slice(cursor).includes('<')) return null;
  if (cursor < html.length) blocks.push({ html: html.slice(cursor) });
  return blocks;
};

const textLength = (html: string): number => html
  .replace(TAG, '')
  .replace(/&nbsp;|&#(?:0*(?:9|10|13|32|160)|x0*(?:9|a|d|20|a0));/gi, ' ')
  .replace(/\s+/g, ' ').trim().length;

const isTrivia = (block: Block): boolean => !block.tag && !block.html.replace(/<!--[\s\S]*?-->/g, '').trim();
const hasOnlyTags = (block: Block, allowed: ReadonlySet<string>): boolean => {
  for (const match of block.html.matchAll(TAG)) {
    if (!match[0].startsWith('<!--') && !allowed.has(/^<\/?([\w:-]+)/.exec(match[0])![1].toLowerCase())) return false;
  }
  return true;
};
const isText = (block: Block): boolean => block.tag === 'p' && hasOnlyTags(block, TEXT_TAGS);
const isEmptyText = (block: Block): boolean => isText(block) && textLength(block.html) === 0;
const classesFor = (block: Block): string => {
  const opening = block.html.matchAll(TAG).next().value?.[0] ?? '';
  // Consume attributes in order so data-class and quoted attribute contents
  // cannot impersonate the real class attribute.
  const attributes = opening.replace(/^<[\w:-]+/, '');
  for (const match of attributes.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    if (match[1].toLowerCase() === 'class') return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return '';
};
const isFloat = (block: Block): boolean =>
  (block.tag === 'p' || block.tag === 'figure') && /(?:^|\s)img-float-(?:left|right)(?:\s|$)/.test(classesFor(block));
const isPhoto = (block: Block): boolean => {
  if (!isFloat(block)) return false;
  const classNames = classesFor(block);
  if (/(?:^|\s)img-(?:single-wide|row-\d|grid|pair|stack|column|editorial|portrait)/.test(classNames)) return false;
  let imageCount = 0;
  for (const match of block.html.matchAll(TAG)) if (/^<img\b/i.test(match[0])) imageCount += 1;
  if (imageCount !== 1) return false;
  if (!hasOnlyTags(block, PHOTO_TAGS)) return false;
  // A paragraph photo has no caption/text; a figure retains its own caption.
  return block.tag === 'figure' || textLength(block.html) === 0;
};

const wrap = (html: string): Block => ({ html: `<div class="${INLINE_PHOTO_FLOW_CLASS}">${html}</div>`, tag: 'div' });

export const groupInlinePhotoFlow = (html: string): string => {
  if (!html || !/img-float-(?:left|right)/.test(html)) return html;
  const blocks = splitBlocks(html);
  if (!blocks) return html;
  // Ownership also matters for unsupported floated media, which retain their
  // existing CSS flow. A later orphan must not reclaim any of their paragraphs.
  const claimed = new Set<Block>();
  let activeFloat = false;
  for (const block of blocks) {
    if (isTrivia(block)) continue;
    if (isFloat(block)) activeFloat = true;
    else if (isText(block)) { if (activeFloat) claimed.add(block); }
    else activeFloat = false;
  }
  const output: Block[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const photo = blocks[index];
    if (!isPhoto(photo)) { output.push(photo); continue; }
    let end = index + 1;
    let hasText = false;
    while (end < blocks.length && (isTrivia(blocks[end]) || isText(blocks[end]))) {
      hasText ||= isText(blocks[end]) && textLength(blocks[end].html) > 0;
      end += 1;
    }
    if (hasText) {
      output.push(wrap(blocks.slice(index, end).map(block => block.html).join('')));
      index = end - 1;
      continue;
    }
    // An orphan figure can associate backwards, just like existing p > img
    // backward wrapping. Previously grouped text belongs to its earlier photo.
    let previous = output.length - 1;
    while (previous >= 0 && (isTrivia(output[previous]) || isEmptyText(output[previous]))) previous -= 1;
    if (previous >= 0 && isText(output[previous]) && !claimed.has(output[previous]) && textLength(output[previous].html) >= 60) {
      const paragraph = output[previous];
      const gap = output.slice(previous + 1).map(block => block.html).join('');
      output.splice(previous, output.length - previous, wrap(photo.html + gap + paragraph.html));
    } else output.push(photo);
  }
  return output.map(block => block.html).join('');
};
