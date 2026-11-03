import frameCopy from '../../../../data/travelBooks/frame-copy.json';
import {frameCopySourceSchema, type EditionFrameCopy} from '../../../../data/travelBooks/schema/editionCopy';

let parsed: ReturnType<typeof frameCopySourceSchema.parse> | undefined;

/** Approved per-edition frame texts (#2947); an edition without them is not rendered. */
export function bookFrameCopy(bookId: string): EditionFrameCopy {
  parsed ??= frameCopySourceSchema.parse(frameCopy);
  const copy = parsed.editions[bookId];
  if (!copy) throw new Error(`No approved frame copy for edition: ${bookId}`);
  return copy;
}
