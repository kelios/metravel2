// Static companion document; the same semantic model also drives the PDF.
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paragraph=text=>`<p>${escape(text)}</p>`;
export function renderPrintGuideHtml(guide,{slug,artifacts}){
  if(!/^[a-z]+$/.test(slug))throw new Error('Invalid guide book slug');
  const files=artifacts.filter(file=>file.profileId===guide.bookProfileId);
  if(!files.length)throw new Error('HTML guide requires its exact files');
  const downloads=files.map(file=>{
    const url=new URL(file.uri);
    if(url.origin!=='https://metravel.by'||url.username||url.password||!url.pathname.startsWith(`/travel-books/${guide.bookId}/${guide.revision}/`)||url.search||url.hash||file.revision!==guide.revision||file.mime!=='application/pdf')throw new Error('HTML link differs from the guide revision');
    const name=`${slug}-${guide.revision}-${file.id}.pdf`;
    return `<li><a href="${escape(file.uri)}" download="${escape(name)}">${escape(name)}</a>${paragraph(`${file.pageCount} ${guide.labels.pagesSuffix} · ${file.bytes} ${guide.labels.bytesSuffix}`)}<code>SHA-256: ${escape(file.sha256)}</code></li>`;
  }).join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(guide.title)} · ${escape(guide.bookTitle)}</title><style>html{color-scheme:light dark}body{font:16px/1.6 system-ui,sans-serif;margin:0}main{max-width:76ch;margin:auto;padding:24px 16px 64px;overflow-wrap:anywhere}h1{font-size:1.8rem;line-height:1.25}h2{font-size:1.3rem;line-height:1.4;margin-top:2rem}a{display:inline-flex;align-items:center;min-height:44px;color:inherit}code{font-size:.85em;overflow-wrap:anywhere}li{margin:1rem 0}ul{padding-left:1.2rem}a:focus-visible{outline:3px solid currentColor;outline-offset:3px}@media print{nav{display:none}main{padding:0;max-width:none}body{font-size:10pt}a{min-height:0}}</style></head><body><main><nav><a href="https://metravel.by/books/${escape(slug)}">MeTravel</a></nav><h1>${escape(guide.title)}</h1><h2>${escape(guide.bookTitle)}</h2>${paragraph(guide.summary)}${paragraph(guide.assembly)}${paragraph(guide.sewnNote)}${guide.sections.map(section=>`<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(paragraph).join('')}</section>`).join('')}<section><h2>${escape(guide.labels.files)}</h2><ul>${downloads}</ul></section><section><h2>${escape(guide.labels.passport)}</h2>${paragraph(guide.passportSummary)}${guide.passport.files.map(file=>paragraph(file.name)+`<code>SHA-256: ${escape(file.sha256)}</code>`).join('')}</section><section><h2>${escape(guide.labels.polishNote)}</h2><p lang="pl">${escape(guide.polishNote)}</p></section><footer>${paragraph(guide.sourceNote)}${guide.sources.map(source=>paragraph(source.title)+`<p><code>${escape(source.url)}</code></p>`).join('')}<code>${escape(guide.revision)}</code></footer></main></body></html>\n`;
}
