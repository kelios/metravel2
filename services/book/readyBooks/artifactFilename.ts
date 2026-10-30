import type {PublishedBook,PublishedArtifact} from './publication';

/** The browser and the printed guide use exactly the same download names. */
export function bookArtifactFilename(book:Pick<PublishedBook,'slug'|'revision'>,file:Pick<PublishedArtifact,'id'>){
  return `${book.slug}-${book.revision}-${file.id}.pdf`;
}
