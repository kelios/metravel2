#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {validateBookMedia} from './media-validation.mjs';
import {loadSelectedBook} from './source-ready-book.mjs';

try {
  if(process.argv.includes('--legacy')) {
    const registry=JSON.parse(await readFile('data/travelBooks/rights.json','utf8'));
    const books=await Promise.all(['by','pl'].map(async country=>JSON.parse(await readFile(`data/travelBooks/${country}/editorial.json`,'utf8'))));
    const issues=await validateBookMedia(registry,books);if(issues.length)throw new Error(issues.join('\n'));
    console.log(`ARCHIVED PROTOTYPE MEDIA ONLY: ${registry.assets.length} images; ${books.reduce((n,book)=>n+book.stops.length,0)} stops + ${books.length} covers; not a current publishable edition`);
    process.exit(0);
  }
  let count=0;
  for (const country of ['by','pl']) {
    const {book,provenance}=await loadSelectedBook(country);
    count+=book.stops.length;
    console.log(`${country.toUpperCase()}: ${book.stops.length} selected author-1 places; original/photo/art SHA-256 association, native dimensions and print permission verified`);
    for (const asset of provenance.assets) console.log(`${asset.stopId}: native ${asset.nativeWidthPx}×${asset.nativeHeightPx} px; encoded ${asset.encodedBytes} bytes without resizing`);
  }
  console.log(`SOURCE MEDIA VERIFIED: ${count} places; actual placed ppi and physical print acceptance require PDF inspection`);
} catch(error) {console.error(error.message);process.exitCode=1;}
