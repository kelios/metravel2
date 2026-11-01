import {createHash} from 'node:crypto';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {loadIllustratedEdition} from './load-illustrated-edition.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const root = process.cwd();
export const COVER_FONT_PATH = 'data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf';
export const COVER_LICENSE_PATH = 'data/travelBooks/assets/fonts/marckscript/OFL.txt';
const COVER_FONT_SHA = '504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b';
/** Photographic edition type: static Lora instances (SIL OFL 1.1) covering RU/BE/UK/PL/EN. */
export const PHOTO_FONTS = {
  text: {path: 'data/travelBooks/assets/fonts/lora/Lora-Italic.ttf', sha256: 'da0fa9ba7afc3f551dbe7ca4f50f08af63dbc76f78c71ee5776582e4fe75924e'},
  heading: {path: 'data/travelBooks/assets/fonts/lora/Lora-Medium.ttf', sha256: '61682cd2d2c6622c2e125bed0f9a3dfdd29087efa128087a8c4d88856ac8b785'},
  license: {path: 'data/travelBooks/assets/fonts/lora/OFL.txt'},
};
export const BOOK_IDENTITY = {
  watercolor: {by: {id: 'belarus-memory', slug: 'belarus', title: 'Беларусь. Книга воспоминаний'}, pl: {id: 'poland-memory', slug: 'poland', title: 'Польша. Книга воспоминаний'}},
  photo: {by: {id: 'belarus-photo-memory', slug: 'belarus-photo', title: 'Беларусь. Фотокнига воспоминаний'}, pl: {id: 'poland-photo-memory', slug: 'poland-photo', title: 'Польша. Фотокнига воспоминаний'}},
  fantasy: {by: {id: 'belarus-fantasy-memory', slug: 'belarus-fantasy', title: 'Беларусь. Книга воспоминаний'}, pl: {id: 'poland-fantasy-memory', slug: 'poland-fantasy', title: 'Польша. Книга воспоминаний'}},
};

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
const isSha = value => /^[a-f0-9]{64}$/.test(value ?? '');
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
const fontData = bytes => 'data:font/ttf;base64,' + bytes.toString('base64');

/** Convert the selected author-owned sources to the existing semantic book input. */
export async function loadSelectedBook(country, {sourcesRoot = 'data/travelBooks', registryPath = '.codex-temp/books-next/media-registry.json', style = 'watercolor', profileId, collageRegistryPath = '.codex-temp/books-photo/collage-registry.json', originalsIndexPath = '.codex-temp/books-photo/originals/index.json'} = {}) {
  if (!BOOK_IDENTITY[style]?.[country]) throw new Error(`No approved edition identity for ${country}/${style}`);
  if (style === 'photo' && !['pocket-150x100', 'album-a5'].includes(profileId)) throw new Error('The photographic edition composes its collages per physical profile');
  const selectionPath = path.join(sourcesRoot, country, 'selection.json');
  const recordsPath = path.join(sourcesRoot, country, 'source-records.json');
  const [selection, source] = await Promise.all([json(selectionPath), json(recordsPath)]);
  if (selection.country !== country.toUpperCase() || selection.authorId !== 1 || selection.rows.length < 30 || selection.count !== selection.rows.length) throw new Error('A selected book requires at least 30 author-1 places: ' + country);
  if (source.country !== selection.country || source.authorId !== 1 || source.compositionCount !== selection.rows.length) throw new Error('Source composition does not match selection');
  const seen = new Set(), assets = {}, provenance = [];
  const stops = [], sources = new Map();
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
    sources.set(id, {row, record, article, photo});
    const quest = record.quest?.status === 'associated' || record.quest?.status === 'verified-associated' ? record.quest : undefined;
    if (quest && (!ownUrl(quest.url) || !quest.id || !quest.evidence)) throw new Error('Quest needs exact-place association: ' + id);
    stops.push({id, title: record.printTitle, localName: record.localName || record.printTitle, lat: row.lat, lng: row.lng,
      entrance: 'Точка из авторского маршрута; отдельный вход не проверен.', coordinateAccuracy: 'site-center', coordinateSource: article.url,
      source: {kind: 'travel-address', id: String(row.pointId), url: article.url}, text: {compact: record.copyRu.trim(), album: record.copyRu.trim()},
      fact: record.sourceEvidence.excerpt || record.copyRu.trim(), observation: 'Сохраните своё впечатление об этом месте.',
      references: [{url: article.url, checkedAt: article.verifiedOn, claims: [record.sourceEvidence.excerpt || record.copyRu.trim()]}],
      imageBrief: style === 'photo' ? 'Коллаж из фотографий автора этого места из той же авторской статьи.' : style === 'fantasy' ? 'Утверждённая фэнтези-иллюстрация по фотографии этого места из той же авторской статьи.' : 'Утверждённая акварель по фотографии этого места из той же авторской статьи.',
      navigation: {authorId: 1, pointId: row.pointId, sourceTravelId: article.id, mapUrl: record.qr.map, articleUrl: article.url, verifiedAt: article.verifiedOn, ...(quest ? {quest: {url: quest.url, id: quest.id, evidence: typeof quest.evidence === 'string' ? quest.evidence : JSON.stringify(quest.evidence)}} : {})}});
  }
  const countryCode = selection.country;
  const identity = BOOK_IDENTITY[style][country];
  const coverPersonalization = await loadCoverPersonalizationSource();
  const edition = style === 'photo'
    ? await loadPhotoEdition({country, countryCode, profileId, stops, sources, sourcesRoot, collageRegistryPath, originalsIndexPath, assets, provenance})
    : style === 'fantasy'
      ? await loadIllustratedEdition({country, style, stops, sources, sourcesRoot, projectFile})
      : await loadWatercolorEdition({country, countryCode, registryPath, stops, sources, assets, provenance, coverPersonalization});
  if (edition.assets) {
    Object.assign(assets, edition.assets);
    provenance.push(...edition.assetsProvenance);
  }
  // The photographic edition hashes both physical profiles at once so that pocket and A5 share one revision.
  // The watercolor seed keeps its historical shape (`font`) so the accepted revisions stay reproducible.
  const revision = `${edition.revisionDate}.${style === 'photo' ? 'photo' : style === 'fantasy' ? 'fantasy' : 'collage'}.` + sha256(JSON.stringify(style === 'photo' || style === 'fantasy' ? {selection, source, ...edition.revisionSeed, fonts: edition.fontHashes} : {selection, source, provenance, cover: edition.cover.encodedSha256, font: edition.fontHashes})).slice(0, 12);
  const book = {schemaVersion: 1, status: 'editorial-draft', id: identity.id, slug: identity.slug, revision, country: countryCode, contentLocale: 'ru', title: identity.title, ...(style !== 'watercolor' ? {visualStyle: style} : {}), stops,
    miniTrips: [{id: 'selected-places', title: 'Самостоятельные поездки', stopIds: stops.map(stop => stop.id), note: 'Выбранные места не образуют один непрерывный маршрут.'}]};
  return {book, assets, cover: edition.cover.asset, coverPersonalization, fonts: edition.fonts, provenance: {style, selectionPath, recordsPath, ...edition.provenancePaths, assets: provenance, font: edition.fontProvenance, cover: edition.cover.provenance}, assetsHash: sha256(JSON.stringify(provenance))};
}

async function loadWatercolorEdition({country, countryCode, registryPath, stops, sources, assets, provenance, coverPersonalization}) {
  const registry = await json(registryPath);
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.assets)) throw new Error('Invalid approved-art registry');
  for (const stop of stops) {
    const id = stop.id;
    const {row, article, photo} = sources.get(id);
    const artMatches = registry.assets.filter(asset => asset.country === countryCode && asset.stopId === id);
    if (artMatches.length !== 1) throw new Error('Missing or duplicate approved artwork: ' + id);
    const asset = artMatches[0];
    if (asset.printAllowed !== true || asset.illustrated !== true || asset.sourceOriginalUri !== photo.originalUri || !asset.sourcePhotoLocalPath || !isSha(asset.sourcePhotoSha256)) throw new Error('Artwork/source association is incomplete: ' + id);
    const sourcePhotoBytes = await projectFile(asset.sourcePhotoLocalPath, asset.sourcePhotoSha256);
    const sourcePhotoMetadata = await sharp(sourcePhotoBytes).metadata();
    if (!sourcePhotoMetadata.width || !sourcePhotoMetadata.height) throw new Error('Original photo cannot be decoded: ' + id);
    if (typeof asset.tool !== 'string' || !asset.tool.trim() || !asset.styleReferencePath || !isSha(asset.styleReferenceSha256)) throw new Error('Missing reproducible artwork generation evidence: ' + id);
    await projectFile(asset.styleReferencePath, asset.styleReferenceSha256);
    const generation = {tool: asset.tool, styleReferencePath: path.relative(root, path.resolve(asset.styleReferencePath)), styleReferenceSha256: asset.styleReferenceSha256};
    if (asset.promptPath && isSha(asset.promptSha256)) {
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
  }
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
  if (sha256(fontBytes) !== coverPersonalization.font.sha256 || sha256(license) !== coverPersonalization.font.license.sha256) throw new Error('Body and personalized covers must use the same licensed full font');
  const data = fontData(fontBytes);
  return {revisionDate: '2026-10-30', fonts: {regular: data, bold: data, serif: data}, fontHashes: sha256(fontBytes),
    fontProvenance: {path: font.localPath, sha256: sha256(fontBytes), licensePath: font.licensePath, licenseSha256: sha256(license)},
    provenancePaths: {registryPath},
    cover: {asset: cover, encodedSha256: sha256(coverEncoded), provenance: {stopId: coverStop.id, sourceTravelId: coverStop.navigation.sourceTravelId, articleUrl: coverStop.navigation.articleUrl, sourceOriginalUri: coverAsset.sourceOriginalUri, sourcePhotoSha256: coverAsset.sourcePhotoSha256, path: coverSource.localPath, sha256: coverSource.sha256, encodedSha256: sha256(coverEncoded)}}};
}

/** Photographic edition: real author originals of the same article, composed without upscaling. */
async function loadPhotoEdition({country, countryCode, profileId, stops, sources, sourcesRoot, collageRegistryPath, originalsIndexPath, assets, provenance}) {
  const evidencePath = path.join(sourcesRoot, country, 'photo-evidence.json');
  const [evidence, registry, originals] = await Promise.all([json(evidencePath), json(collageRegistryPath), json(originalsIndexPath)]);
  if (evidence.schemaVersion !== 1 || evidence.country !== countryCode || evidence.authorId !== 1 || !Array.isArray(evidence.places)) throw new Error('Invalid photo evidence: ' + country);
  const countryRegistry = registry.countries?.[countryCode];
  if (registry.schemaVersion !== 1 || !countryRegistry || registry.composer?.script !== 'scripts/books/render-ready-book-collage.py' || !isSha(registry.composer.sha256)) throw new Error('Invalid collage registry: ' + country);
  const evidenceBytes = await projectFile(evidencePath);
  if (sha256(evidenceBytes) !== countryRegistry.evidenceSha256) throw new Error('Collages were composed from different photo evidence: ' + country);
  const composerSha = sha256(await projectFile(registry.composer.script));
  if (composerSha !== registry.composer.sha256) throw new Error('Collage composer changed after the collages were composed');
  const checkPhoto = async (id, article, photo, record) => {
    if (photo.pointId !== record.pointId || photo.articleId !== article.id || photo.authorId !== 1 || !ownUrl(photo.originalUri) || !isSha(photo.sha256) || !Number.isInteger(photo.widthPx) || !Number.isInteger(photo.heightPx) || photo.widthPx < 1 || photo.heightPx < 1 || !isDate(photo.verifiedOn) || typeof photo.observedContent !== 'string' || photo.observedContent.trim().length < 8) throw new Error('Incomplete photo evidence: ' + id);
    if (photo.rights?.basis !== 'owner-author-photo' || photo.rights.ownerUserId !== 1 || photo.rights.sourceTravelId !== article.id) throw new Error('Photo rights must name the same author-1 article: ' + id);
    const original = originals[photo.originalUri];
    if (!original || original.uri !== photo.originalUri || original.sha256 !== photo.sha256 || original.widthPx !== photo.widthPx || original.heightPx !== photo.heightPx) throw new Error('Photo evidence differs from the downloaded original: ' + id);
    await projectFile(original.localPath, photo.sha256);
    return original;
  };
  const embed = async (id, asset, usedShas, box) => {
    if (asset.box !== box || !isSha(asset.sha256) || !asset.photos?.length || asset.photos.length > 3) throw new Error('Invalid collage asset: ' + id);
    if (asset.photos.some(photo => !usedShas.has(photo.sha256) || photo.upscaled !== false || !(photo.embeddedPpi > 0) || !(photo.nativePpiAtPlacedSize >= photo.embeddedPpi - .05))) throw new Error('Collage uses a photo outside the verified evidence or upscales it: ' + id);
    const png = await projectFile(asset.path, asset.sha256);
    const metadata = await sharp(png).metadata();
    if (metadata.format !== 'png' || metadata.width !== asset.widthPx || metadata.height !== asset.heightPx) throw new Error('Collage dimensions differ from the registry: ' + id);
    const expectedPpi = Math.min(300, Math.floor(Math.min(...asset.photos.map(photo => photo.nativePpiAtPlacedSize))));
    if (Math.abs(asset.canvasPpi - expectedPpi) > 1 || Math.abs(asset.widthPx - asset.boxMm[0] * asset.canvasPpi / 25.4) > 1 || Math.abs(asset.heightPx - asset.boxMm[1] * asset.canvasPpi / 25.4) > 1) throw new Error('Collage resolution differs from its photographs: ' + id);
    return {png, metadata};
  };
  const box = `page-${profileId}`;
  for (const stop of stops) {
    const id = stop.id;
    const {row, record, article, photo: recordPhoto} = sources.get(id);
    const places = evidence.places.filter(place => place.stopId === id && place.pointId === row.pointId);
    if (places.length !== 1) throw new Error('Missing or duplicate photo evidence: ' + id);
    const place = places[0];
    const used = (place.photos ?? []).filter(photo => photo.status === 'used');
    if (used.length < 1 || used.length > 3 || used[0].role !== 'main' || place.articleId !== article.id) throw new Error('A place needs one main and up to two supporting verified photos: ' + id);
    if (used[0].originalUri !== recordPhoto.originalUri && !(typeof place.mainReplacementReason === 'string' && place.mainReplacementReason.trim())) throw new Error('The main photograph must be the verified article original unless a replacement reason is recorded: ' + id);
    const usedShas = new Set();
    const photoProvenance = [];
    for (const photo of used) {
      const original = await checkPhoto(id, article, photo, record);
      if (usedShas.has(photo.sha256)) throw new Error('Duplicate photo in one place: ' + id);
      usedShas.add(photo.sha256);
      photoProvenance.push({...photo, localPath: path.relative(root, path.resolve(original.localPath)), bytes: original.bytes});
    }
    const entries = countryRegistry.places.filter(entry => entry.stopId === id);
    if (entries.length !== 1 || !entries[0].assets?.[box]) throw new Error('Missing or duplicate collage: ' + id);
    const asset = entries[0].assets[box];
    const {png, metadata} = await embed(id, asset, usedShas, box);
    assets[id] = {dataUri: 'data:image/png;base64,' + png.toString('base64'), credit: 'MeTravel / автор 1', sourceUrl: article.url, rights: 'Авторские фотографии из той же статьи (user_id=1); без увеличения, стоков и AI', illustrated: false, artworkBounds: {left: 0, top: 0, width: 1, height: 1}, widthPx: metadata.width, heightPx: metadata.height};
    provenance.push({stopId: id, pointId: row.pointId, sourceTravelId: article.id, articleUrl: article.url, box, collagePath: asset.path, collageSha256: asset.sha256, nativeWidthPx: asset.widthPx, nativeHeightPx: asset.heightPx, canvasPpi: asset.canvasPpi, featherMm: asset.featherMm, encodedFormat: 'png', encodedSha256: asset.sha256, photos: photoProvenance, placements: asset.photos, ...(place.mainReplacementReason ? {mainReplacementReason: place.mainReplacementReason} : {})});
  }
  const coverEntry = countryRegistry.cover;
  const coverStop = stops.find(stop => stop.id === evidence.cover?.stopId && stop.id === coverEntry?.stopId);
  if (!coverStop) throw new Error('Cover must reuse the verified photographs of one place from this book: ' + country);
  const coverPlace = evidence.places.find(place => place.stopId === coverStop.id);
  const coverShas = new Set(coverPlace.photos.filter(photo => photo.status === 'used').map(photo => photo.sha256));
  const coverAsset = coverEntry.assets?.[`cover-${profileId}`];
  if (!coverAsset) throw new Error('Missing cover collage for ' + profileId);
  const {png: coverPng, metadata: coverMetadata} = await embed(coverStop.id, coverAsset, coverShas, `cover-${profileId}`);
  const cover = {dataUri: 'data:image/png;base64,' + coverPng.toString('base64'), credit: 'MeTravel / автор 1', sourceUrl: coverStop.source.url, rights: 'Авторские фотографии места из книги (user_id=1); без увеличения, стоков и AI', illustrated: false, artworkBounds: {left: 0, top: 0, width: 1, height: 1}, widthPx: coverMetadata.width, heightPx: coverMetadata.height};
  const textBytes = await projectFile(PHOTO_FONTS.text.path, PHOTO_FONTS.text.sha256), headingBytes = await projectFile(PHOTO_FONTS.heading.path, PHOTO_FONTS.heading.sha256), license = await projectFile(PHOTO_FONTS.license.path);
  if (!license.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1') || !license.toString('utf8').includes('Lora')) throw new Error('The full Lora OFL license is required');
  const text = fontData(textBytes);
  return {revisionDate: '2026-11-01', fonts: {regular: text, bold: text, serif: text, heading: fontData(headingBytes)}, fontHashes: {text: PHOTO_FONTS.text.sha256, heading: PHOTO_FONTS.heading.sha256},
    fontProvenance: {text: {path: PHOTO_FONTS.text.path, sha256: PHOTO_FONTS.text.sha256}, heading: {path: PHOTO_FONTS.heading.path, sha256: PHOTO_FONTS.heading.sha256}, licensePath: PHOTO_FONTS.license.path, licenseSha256: sha256(license), license: 'SIL Open Font License 1.1', family: 'Lora', coverEpigraph: 'Marck Script (coverPersonalization)'},
    provenancePaths: {evidencePath, collageRegistryPath, originalsIndexPath, composerSha256: composerSha, composerVersion: registry.composer.version},
    revisionSeed: {evidenceSha256: countryRegistry.evidenceSha256, composerSha256: composerSha, collages: countryRegistry},
    cover: {asset: cover, encodedSha256: coverAsset.sha256, provenance: {stopId: coverStop.id, sourceTravelId: coverStop.navigation.sourceTravelId, articleUrl: coverStop.navigation.articleUrl, box: `cover-${profileId}`, path: coverAsset.path, sha256: coverAsset.sha256, canvasPpi: coverAsset.canvasPpi, placements: coverAsset.photos, photos: coverPlace.photos.filter(photo => photo.status === 'used')}}};
}
