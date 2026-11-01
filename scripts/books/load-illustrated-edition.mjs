import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {create as createFont} from '@cantoo/fontkit';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const isSha = value => /^[a-f0-9]{64}$/.test(value ?? '');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const fail = message => {throw new Error(`Illustrated edition: ${message}`);};
const requireThat = (value, message) => {if (!value) fail(message);};
const ownUrl = value => {try {const url = new URL(value);return url.origin === 'https://metravel.by' && !url.username && !url.password;}catch{return false;}};
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяІіЎўЇїЄєҐґĄąĆćĘęŁłŃńÓóŚśŹźŻż0123456789«»—–…’№';

/** Style assets only. Selection, copy, navigation, pagination and publishing stay in their existing owners. */
export async function loadIllustratedEdition({country, style, stops, sources, sourcesRoot = 'data/travelBooks', projectFile}) {
  requireThat(['by', 'pl'].includes(country) && ['graphic', 'fantasy'].includes(style), 'unsupported country/style');
  requireThat(typeof projectFile === 'function' && sources instanceof Map && Array.isArray(stops) && stops.length, 'selected sources and confined project reader are required');
  const countryCode = country.toUpperCase();
  const read = async (file, expectedSha, expectedBytes) => {
    requireThat(nonempty(file) && (!expectedSha || isSha(expectedSha)), 'invalid file descriptor');
    const bytes = await projectFile(file, expectedSha);
    requireThat(!expectedSha || sha(bytes) === expectedSha, `checksum mismatch: ${file}`);
    requireThat(expectedBytes === undefined || bytes.length === expectedBytes, `byte count mismatch: ${file}`);
    return bytes;
  };
  const described = async descriptor => {
    requireThat(descriptor && isSha(descriptor.sha256) && Number.isInteger(descriptor.bytes) && descriptor.bytes > 0, 'complete immutable file descriptor is required');
    return read(descriptor.path, descriptor.sha256, descriptor.bytes);
  };
  const inputsPath = path.join(sourcesRoot, 'styles', style, 'inputs.json');
  const inputs = JSON.parse((await read(inputsPath)).toString('utf8'));
  requireThat(inputs.schemaVersion === 1 && inputs.visualStyle === style && inputs.printReady === false && /^\d{4}-\d{2}-\d{2}$/.test(inputs.recordedOn), 'invalid style inputs');
  const approval = JSON.parse((await described(inputs.approval)).toString('utf8'));
  requireThat(approval.visualStyle === style && approval.approvedStage === 'visual-direction-and-series-continuation' && nonempty(approval.ownerCommand) && /^\d{4}-\d{2}-\d{2}$/.test(approval.ownerCommandDate), 'visual direction has not been approved');
  requireThat(inputs.styleReference?.sha256 === approval.styleReference?.sha256, 'style reference differs from the approved direction');
  await described(inputs.styleReference);
  requireThat(Array.isArray(inputs.countries), 'missing country evidence');
  const countryEntries = inputs.countries.filter(item => item.country === countryCode);
  requireThat(countryEntries.length === 1, 'missing or duplicate country evidence');
  const descriptor = countryEntries[0].evidence;
  const evidence = JSON.parse((await described(descriptor)).toString('utf8'));
  requireThat(evidence.schemaVersion === 1 && evidence.country === countryCode && evidence.visualStyle === style && evidence.authorId === 1 && evidence.printReady === false, 'country/style evidence mismatch');
  requireThat(evidence.approval?.sha256 === inputs.approval.sha256, 'country evidence has a different approval');
  const selectedIds = new Set(stops.map(stop => stop.id));
  const places = evidence.places;
  requireThat(selectedIds.size === stops.length && Array.isArray(places) && places.length === stops.length && evidence.placeCount === stops.length && countryEntries[0].placeCount === stops.length, 'selected composition is incomplete');
  const byId = new Map(places.map(place => [place.stopId, place]));
  requireThat(byId.size === places.length && places.every(place => selectedIds.has(place.stopId)), 'duplicate or extra artwork stop');
  requireThat(Array.isArray(evidence.sourceInputs) && evidence.sourceInputs.length, 'missing tracked source snapshots');
  const sourceProvenancePath = path.join(sourcesRoot, country, 'artwork-provenance.json');
  requireThat(evidence.sourceInputs.filter(snapshot => snapshot.path === sourceProvenancePath).length === 1, 'one canonical source-photo snapshot is required');
  let sourceProvenance;
  for (const snapshot of evidence.sourceInputs) {
    requireThat(isSha(snapshot.sha256), 'source snapshot SHA is required');
    const bytes = await read(snapshot.path, snapshot.sha256);
    if (snapshot.path === sourceProvenancePath) sourceProvenance = JSON.parse(bytes.toString('utf8'));
  }
  requireThat(sourceProvenance.schemaVersion === 1 && sourceProvenance.country === countryCode && sourceProvenance.stopCount === stops.length && Array.isArray(sourceProvenance.assets) && sourceProvenance.assets.length === stops.length, 'canonical source-photo composition differs');
  const canonicalSources = new Map(sourceProvenance.assets.map(asset => [asset.stopId, asset]));
  requireThat(canonicalSources.size === stops.length && sourceProvenance.assets.every(asset => selectedIds.has(asset.stopId)), 'duplicate or extra canonical source photo');

  const fontRecord = JSON.parse((await described(inputs.font)).toString('utf8'));
  const body = await described(fontRecord.font);
  const heading = fontRecord.headingFont ? await described(fontRecord.headingFont) : body;
  const license = await described(fontRecord.license);
  requireThat(license.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1'), 'full font license is required');
  const requiredCharacters = new Set(Array.from(alphabet + stops.map(stop => stop.title + stop.text.compact + stop.text.album).join('')).filter(char => !/\s/u.test(char)));
  for (const bytes of body === heading ? [body] : [body, heading]) {
    const face = createFont(bytes);
    requireThat(!Object.keys(face.variationAxes ?? {}).length, 'static TTF instance is required');
    requireThat([...requiredCharacters].every(char => face.hasGlyphForCodePoint(char.codePointAt(0))), 'font does not cover current copy and five alphabets');
  }

  const assets = {}, assetsProvenance = [];
  for (const stop of stops) {
    const place = byId.get(stop.id), selected = sources.get(stop.id);
    const article = selected?.article, photo = selected?.photo, source = place.sourcePhoto, art = place.artwork, generation = place.generation;
    const canonical = canonicalSources.get(stop.id);
    requireThat(article?.userId === 1 && article.publicationStatus === 'published' && article.pointIdVerified === true && place.article?.id === article.id && place.article.userId === 1 && place.article.url === article.url && place.article.publicationStatus === 'published' && place.article.pointIdVerified === true, `different author/article: ${stop.id}`);
    requireThat(place.pointId === stop.navigation?.pointId && place.article.id === stop.navigation?.sourceTravelId && source?.originalUri === photo?.originalUri && source.articleImageUri === photo.articleImageUri && ownUrl(source.originalUri) && ownUrl(source.articleImageUri) && nonempty(source.association?.evidence) && source.association.evidence === photo.association?.evidence, `different source-photo association: ${stop.id}`);
    requireThat(canonical.pointId === place.pointId && canonical.articleId === article.id && canonical.articleUrl === article.url && canonical.authorId === 1 && canonical.photo?.sha256 === source.sha256 && canonical.photo.originalUri === source.originalUri && canonical.photo.articleImageUri === source.articleImageUri && canonical.photo.widthPx === source.widthPx && canonical.photo.heightPx === source.heightPx, `different canonical source-photo bytes: ${stop.id}`);
    requireThat(source.rights?.basis === 'owner-author-photo' && source.rights.ownerUserId === 1 && source.rights.sourceTravelId === article.id && source.rights.permission === 'owner-commissioned-photo-diary', `missing same-article photo rights: ${stop.id}`);
    requireThat(place.navigation?.map === stop.navigation.mapUrl && place.navigation.article === stop.navigation.articleUrl, `different navigation: ${stop.id}`);
    requireThat(art?.derivedIllustration === true && art.originalPhoto === false && art.upscaled === false && isSha(art.sha256) && isSha(source.sha256), `invalid derivative identity: ${stop.id}`);
    requireThat(nonempty(generation?.exactPrompt) && sha(Buffer.from(generation.exactPrompt)) === generation.promptSha256 && generation.styleReference?.sha256 === inputs.styleReference.sha256 && nonempty(generation.tool) && (generation.modelIdentifier === null || nonempty(generation.modelIdentifier)) && nonempty(generation.modelDisclosure), `incomplete generation provenance: ${stop.id}`);
    requireThat(['pass', 'passed', 'existing-selected-sample'].includes(place.visualReview?.status), `artwork visual review is incomplete: ${stop.id}`);
    const originalBytes = await read(source.path, source.sha256, source.bytes);
    const native = await read(art.path, art.sha256, art.bytes);
    const originalSize = await sharp(originalBytes).metadata(), size = await sharp(native).metadata();
    requireThat(originalSize.width === source.widthPx && originalSize.height === source.heightPx && size.width === art.widthPx && size.height === art.heightPx, `native dimensions changed: ${stop.id}`);
    const bounds = art.artworkBounds;
    requireThat(bounds && [bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) && bounds.left >= 0 && bounds.top >= 0 && bounds.width > 0 && bounds.height > 0 && bounds.left + bounds.width <= 1 && bounds.top + bounds.height <= 1, `invalid artwork bounds: ${stop.id}`);
    // Encoding changes bytes but never the native dimensions or photographed subject.
    const encoded = await sharp(native).flatten({background: '#fffefa'}).jpeg({quality: 88, mozjpeg: true}).toBuffer();
    assets[stop.id] = {dataUri: 'data:image/jpeg;base64,' + encoded.toString('base64'), credit: 'MeTravel / автор 1', sourceUrl: article.url, rights: 'Авторская фотография; заказанная владельцем производная иллюстрация', illustrated: true, artworkBounds: bounds, widthPx: size.width, heightPx: size.height};
    assetsProvenance.push({stopId: stop.id, pointId: place.pointId, sourceTravelId: article.id, articleUrl: article.url, articleImageUri: source.articleImageUri, sourceOriginalUri: source.originalUri, sourcePhotoSha256: source.sha256, sourcePhotoLocalPath: source.path, sourcePhotoNativeWidthPx: source.widthPx, sourcePhotoNativeHeightPx: source.heightPx, artworkPath: art.path, artworkSha256: art.sha256, nativeWidthPx: size.width, nativeHeightPx: size.height, artworkBounds: bounds, encodedSha256: sha(encoded), encodedBytes: encoded.length, encodedFormat: 'jpeg', encodedQuality: 88, tool: generation.tool, generation, visualReview: place.visualReview});
  }
  const coverId = evidence.cover?.sourceStopId;
  requireThat(selectedIds.has(coverId) && evidence.cover.artworkSha256 === byId.get(coverId).artwork.sha256, 'cover must reuse one verified artwork from this selected style');
  const coverProvenance = assetsProvenance.find(item => item.stopId === coverId);
  const data = bytes => 'data:font/ttf;base64,' + bytes.toString('base64');
  const fontHashes = {regular: sha(body), heading: sha(heading), license: sha(license)};
  return {
    assets, assetsProvenance,
    revisionDate: inputs.recordedOn,
    fonts: {regular: data(body), bold: data(body), serif: data(body), heading: data(heading)},
    fontHashes, fontProvenance: fontRecord,
    provenancePaths: {inputsPath, evidencePath: descriptor.path, approvalPath: inputs.approval.path, fontProvenancePath: inputs.font.path},
    revisionSeed: {visualStyle: style, evidenceSha256: descriptor.sha256, approvalSha256: inputs.approval.sha256, styleReferenceSha256: inputs.styleReference.sha256, fonts: fontHashes},
    cover: {asset: assets[coverId], encodedSha256: coverProvenance.encodedSha256, provenance: coverProvenance},
  };
}
