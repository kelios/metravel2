import {createHash} from 'node:crypto';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const root = process.cwd();
export const COVER_FONT_PATH = 'data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf';
export const COVER_LICENSE_PATH = 'data/travelBooks/assets/fonts/marckscript/OFL.txt';
const COVER_FONT_SHA = '504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b';

export async function loadCoverPersonalizationSource() {
  const copy = await json('data/travelBooks/cover-copy.json');
  if (copy.schemaVersion !== 1 || copy.maxCharacters !== 120 || copy.defaultPresetId !== 'home-memories' || copy.presets?.length !== 2 || new Set(copy.presets.map(p => p.id)).size !== 2 || !copy.presets.some(p => p.id === copy.defaultPresetId) || copy.presets.some(p => !['home-memories','world-memories'].includes(p.id) || p.text !== p.text.normalize('NFC').trim() || !p.text || Array.from(p.text).length > copy.maxCharacters)) throw new Error('Invalid canonical cover copy');
  const font = await projectFile(COVER_FONT_PATH, COVER_FONT_SHA);
  const license = await projectFile(COVER_LICENSE_PATH);
  if (!license.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error('The full Marck Script OFL license is required');
  return {...copy, copySha256: sha256(JSON.stringify(copy)), font: {path: path.resolve(COVER_FONT_PATH), sha256: sha256(font), bytes: font.length, mime: 'font/ttf', license: {path: path.resolve(COVER_LICENSE_PATH), sha256: sha256(license), bytes: license.length, mime: 'text/plain'}}};
}
export async function projectFile(file, expectedSha) {
  const resolved = await realpath(path.resolve(file));
  if (!resolved.startsWith(root + path.sep)) throw new Error('Asset escapes project: ' + file);
  const bytes = await readFile(resolved);
  if (expectedSha && sha256(bytes) !== expectedSha) throw new Error('Asset checksum mismatch: ' + file);
  return bytes;
}
const ownUrl = value => {try {const url = new URL(value); return url.origin === 'https://metravel.by' && !url.username && !url.password;} catch {return false;}};

/** Convert the selected author-owned sources to the existing semantic book input. */
export async function loadSelectedBook(country, {sourcesRoot = 'data/travelBooks', registryPath = '.codex-temp/books-next/media-registry.json'} = {}) {
  const selectionPath = path.join(sourcesRoot, country, 'selection.json');
  const recordsPath = path.join(sourcesRoot, country, 'source-records.json');
  const [selection, source, registry] = await Promise.all([json(selectionPath), json(recordsPath), json(registryPath)]);
  if (selection.country !== country.toUpperCase() || selection.authorId !== 1 || selection.rows.length < 30 || selection.count !== selection.rows.length) throw new Error('A selected book requires at least 30 author-1 places: ' + country);
  if (source.country !== selection.country || source.authorId !== 1 || source.compositionCount !== selection.rows.length) throw new Error('Source composition does not match selection');
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.assets)) throw new Error('Invalid approved-art registry');
  const seen = new Set(), assets = {}, provenance = [];
  const stops = [];
  for (const row of selection.rows) {
    const id = 'point-' + row.pointId;
    if (seen.has(id)) throw new Error('Duplicate selected point: ' + id);
    seen.add(id);
    const matches = source.records.filter(record => record.id === id && record.pointId === row.pointId);
    if (matches.length !== 1) throw new Error('Missing or duplicate verified source: ' + id);
    const record = matches[0], article = record.article, photo = record.photo;
    if (record.country !== selection.country || Math.abs(record.coordinates.lat - row.lat) > .000001 || Math.abs(record.coordinates.lng - row.lng) > .000001) throw new Error('Source coordinates differ from selected point: ' + id);
    if (article.userId !== 1 || article.publicationStatus !== 'published' || article.pointIdVerified !== true || article.id !== row.travelId || article.url !== row.travelUrl || !ownUrl(article.url)) throw new Error('Source must be the selected published author-1 article: ' + id);
    if (!photo?.association?.evidence || photo.rights?.ownerUserId !== 1 || photo.rights.sourceTravelId !== article.id || photo.rights.permission !== 'owner-commissioned-photo-diary') throw new Error('Missing same-article photo association or rights: ' + id);
    if (!ownUrl(record.qr?.map) || record.qr?.article !== article.url) throw new Error('QR targets differ from verified sources: ' + id);
    const map = new URL(record.qr.map);
    if (map.pathname !== '/map' || map.searchParams.get('focusPlace') !== '1' || map.searchParams.get('placeId') !== String(row.pointId) || !map.searchParams.get('placeTitle') || Math.abs(Number(map.searchParams.get('lat')) - row.lat) > 0.000001 || Math.abs(Number(map.searchParams.get('lng')) - row.lng) > 0.000001) throw new Error('Map QR does not identify selected point: ' + id);
    if (typeof record.copyRu !== 'string' || record.copyRu.trim().length < 160 || record.copyRu.length > 280) throw new Error('Missing physically sized sourced copy: ' + id);
    const artMatches = registry.assets.filter(asset => asset.country === selection.country && asset.stopId === id);
    if (artMatches.length !== 1) throw new Error('Missing or duplicate approved artwork: ' + id);
    const asset = artMatches[0];
    if (asset.printAllowed !== true || asset.illustrated !== true || asset.sourceOriginalUri !== photo.originalUri || !asset.sourcePhotoLocalPath || !/^[a-f0-9]{64}$/.test(asset.sourcePhotoSha256 ?? '')) throw new Error('Artwork/source association is incomplete: ' + id);
    const sourcePhotoBytes = await projectFile(asset.sourcePhotoLocalPath, asset.sourcePhotoSha256);
    const sourcePhotoMetadata = await sharp(sourcePhotoBytes).metadata();
    if (!sourcePhotoMetadata.width || !sourcePhotoMetadata.height) throw new Error('Original photo cannot be decoded: ' + id);
    if (typeof asset.tool !== 'string' || !asset.tool.trim() || !asset.styleReferencePath || !/^[a-f0-9]{64}$/.test(asset.styleReferenceSha256 ?? '')) throw new Error('Missing reproducible artwork generation evidence: ' + id);
    await projectFile(asset.styleReferencePath, asset.styleReferenceSha256);
    const generation = {tool: asset.tool, styleReferencePath: path.relative(root, path.resolve(asset.styleReferencePath)), styleReferenceSha256: asset.styleReferenceSha256};
    if (asset.promptPath && /^[a-f0-9]{64}$/.test(asset.promptSha256 ?? '')) {
      const prompt = await projectFile(asset.promptPath, asset.promptSha256);
      if (!prompt.toString('utf8').trim()) throw new Error('Empty artwork prompt: ' + id);
      Object.assign(generation, {promptStatus: 'exact-prompt-recorded', exactPrompt: prompt.toString('utf8'), promptSha256: asset.promptSha256});
    } else if (asset.promptStatus === 'historical-exact-prompt-unavailable' && asset.historicalProvenancePath) {
      const historical = await projectFile(asset.historicalProvenancePath);
      Object.assign(generation, {promptStatus: asset.promptStatus, historicalProvenance: JSON.parse(historical.toString('utf8')), historicalProvenanceSha256: sha256(historical)});
    } else throw new Error('Missing reproducible artwork prompt: ' + id);
    const native = await projectFile(asset.localPath, asset.sha256);
    const metadata = await sharp(native).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Artwork has no native dimensions: ' + id);
    // Encoding changes bytes, never dimensions. Native pixels remain explicit evidence.
    const encoded = await sharp(native).flatten({background: '#fffefa'}).jpeg({quality: 88, mozjpeg: true}).toBuffer();
    const bounds = asset.artworkBounds ?? {left: 0, top: .04, width: 1, height: .65};
    if (![bounds.left,bounds.top,bounds.width,bounds.height].every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 || bounds.width <= 0 || bounds.height <= 0 || bounds.left + bounds.width > 1 || bounds.top + bounds.height > 1) throw new Error('Invalid inspected artwork bounds: ' + id);
    assets[id] = {dataUri: 'data:image/jpeg;base64,' + encoded.toString('base64'), credit: 'MeTravel / автор 1', sourceUrl: article.url, rights: 'Авторская фотография; заказанная владельцем AI-акварель', illustrated: true, artworkBounds: bounds, widthPx: metadata.width, heightPx: metadata.height};
    provenance.push({stopId: id, pointId: row.pointId, sourceTravelId: article.id, articleUrl: article.url, articleImageUri: photo.articleImageUri, sourceOriginalUri: photo.originalUri, sourcePhotoSha256: asset.sourcePhotoSha256, sourcePhotoLocalPath: path.relative(root, path.resolve(asset.sourcePhotoLocalPath)), sourcePhotoNativeWidthPx: sourcePhotoMetadata.width, sourcePhotoNativeHeightPx: sourcePhotoMetadata.height, artworkPath: path.relative(root, path.resolve(asset.localPath)), artworkSha256: asset.sha256, nativeWidthPx: metadata.width, nativeHeightPx: metadata.height, encodedSha256: sha256(encoded), encodedBytes: encoded.length, encodedFormat: 'jpeg', encodedQuality: 88, artworkBounds: bounds, tool: asset.tool, generation});
    const quest = record.quest?.status === 'associated' || record.quest?.status === 'verified-associated' ? record.quest : undefined;
    if (quest && (!ownUrl(quest.url) || !quest.id || !quest.evidence)) throw new Error('Quest needs exact-place association: ' + id);
    stops.push({id, title: record.printTitle, localName: record.localName || record.printTitle, lat: row.lat, lng: row.lng,
      entrance: 'Точка из авторского маршрута; отдельный вход не проверен.', coordinateAccuracy: 'site-center', coordinateSource: article.url,
      source: {kind: 'travel-address', id: String(row.pointId), url: article.url}, text: {compact: record.copyRu.trim(), album: record.copyRu.trim()},
      fact: record.sourceEvidence.excerpt || record.copyRu.trim(), observation: 'Сохраните своё впечатление об этом месте.',
      references: [{url: article.url, checkedAt: article.verifiedOn, claims: [record.sourceEvidence.excerpt || record.copyRu.trim()]}], imageBrief: 'Утверждённая акварель по фотографии этого места из той же авторской статьи.',
      navigation: {authorId: 1, pointId: row.pointId, sourceTravelId: article.id, mapUrl: record.qr.map, articleUrl: article.url, verifiedAt: article.verifiedOn, ...(quest ? {quest: {url: quest.url, id: quest.id, evidence: typeof quest.evidence === 'string' ? quest.evidence : JSON.stringify(quest.evidence)}} : {})}});
  }
  const countryCode = selection.country;
  const coverMatches = registry.covers?.filter(cover => cover.country === countryCode);
  if (coverMatches?.length !== 1) throw new Error('Exactly one explicit cover source is required: ' + country);
  const coverSource = coverMatches[0];
  const coverAsset = registry.assets.find(asset => asset.country === countryCode && asset.stopId === coverSource.sourceStopId && asset.localPath === coverSource.localPath && asset.sha256 === coverSource.sha256);
  const coverStop = stops.find(stop => stop.id === coverSource.sourceStopId);
  if (!coverAsset || !coverStop) throw new Error('Cover must explicitly reuse a verified artwork from this book');
  const coverBytes = await projectFile(coverSource.localPath, coverSource.sha256);
  const coverMetadata = await sharp(coverBytes).metadata();
  if (!coverMetadata.width || !coverMetadata.height) throw new Error('Cover artwork cannot be decoded');
  const coverEncoded = await sharp(coverBytes).flatten({background: '#fffefa'}).jpeg({quality: 88, mozjpeg: true}).toBuffer();
  const cover = {dataUri: 'data:image/jpeg;base64,' + coverEncoded.toString('base64'), credit: 'MeTravel / автор 1', sourceUrl: coverStop.source.url, rights: 'Акварель по авторской фотографии места из книги', illustrated: true, widthPx: coverMetadata.width, heightPx: coverMetadata.height};
  const font = registry.fonts?.find(item => item.role === 'handwritten');
  if (!font?.licensePath) throw new Error('Approved handwritten font and license are required');
  const fontBytes = await projectFile(font.localPath, font.sha256), license = await projectFile(font.licensePath);
  const coverPersonalization = await loadCoverPersonalizationSource();
  if (sha256(fontBytes) !== coverPersonalization.font.sha256 || sha256(license) !== coverPersonalization.font.license.sha256) throw new Error('Body and personalized covers must use the same licensed full font');
  const fontData = 'data:font/ttf;base64,' + fontBytes.toString('base64');
  const revision = '2026-10-30.collage.' + sha256(JSON.stringify({selection, source, provenance, cover: sha256(coverEncoded), font: sha256(fontBytes)})).slice(0, 12);
  const book = {schemaVersion: 1, status: 'editorial-draft', id: country === 'by' ? 'belarus-memory' : 'poland-memory', slug: country === 'by' ? 'belarus' : 'poland', revision, country: countryCode, contentLocale: 'ru', title: country === 'by' ? 'Беларусь. Книга воспоминаний' : 'Польша. Книга воспоминаний', stops,
    miniTrips: [{id: 'selected-places', title: 'Самостоятельные поездки', stopIds: stops.map(stop => stop.id), note: 'Выбранные места не образуют один непрерывный маршрут.'}]};
  return {book, assets, cover, coverPersonalization, fonts: {regular: fontData, bold: fontData, serif: fontData}, provenance: {selectionPath, recordsPath, registryPath, assets: provenance, font: {path: font.localPath, sha256: sha256(fontBytes), licensePath: font.licensePath, licenseSha256: sha256(license)}, cover: {stopId: coverStop.id, sourceTravelId: coverStop.navigation.sourceTravelId, articleUrl: coverStop.navigation.articleUrl, sourceOriginalUri: coverAsset.sourceOriginalUri, sourcePhotoSha256: coverAsset.sourcePhotoSha256, path: coverSource.localPath, sha256: coverSource.sha256, encodedSha256: sha256(coverEncoded)}}, assetsHash: sha256(JSON.stringify(provenance))};
}
