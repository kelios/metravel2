import React from 'react';
import {translate} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';
import {buildPrintGuide} from '@/services/book/readyBooks/printingGuide';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';

export default function PrintingGuide({book,profileId}:{book:PublishedBook;profileId:PublishedArtifact['profileId']}){
  useLocaleRevision();
  const guide=buildPrintGuide(book,profileId);
  return <section aria-label={translate('books:guideTitle')}>
    <h2>{translate('books:guideTitle')}</h2><p>{translate('books:guideLanguage')}</p>
    <details><summary>{translate('books:guideOpen')}</summary><div lang="ru">
      <h3>{guide.bookTitle} · {guide.bookProfileId}</h3><p>{guide.summary}</p><p>{guide.assembly}</p><p>{guide.sewnNote}</p>
      {guide.sections.map(section=><section key={section.id}><h3>{section.title}</h3>{section.paragraphs.map(text=><p key={text}>{text}</p>)}</section>)}
      <h3>{guide.labels.files}</h3><ul>{guide.entries.map(file=><li key={file.id}><code>{file.name}</code> · {file.pageCount} {guide.labels.pagesSuffix}</li>)}</ul>
      <h3>{guide.labels.passport}</h3><p>{guide.passportSummary}</p>
      <ul>{guide.passport.files.map(file=><li key={file.name}><code>{file.name}</code><br/>SHA-256: <code>{file.sha256}</code> · {file.bytes} {guide.labels.bytesSuffix}</li>)}</ul>
      <h3>{guide.labels.polishNote}</h3><p lang="pl">{guide.polishNote}</p>
      <p>{guide.sourceNote}</p>
    </div></details>
  </section>;
}
