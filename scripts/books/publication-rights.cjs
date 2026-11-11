// Rights evidence is reviewed editorial input. This gate checks its coverage,
// exact files and source evidence without inferring rights from a public URL.
const fs = require('node:fs/promises');
const path = require('node:path');
// PDF целиком уходит в stdin `pdftotext`: синхронный pipe на большом входе виснет на macOS (#2844).
const {spawnSyncWithStdin} = require('../lib/runSyncWithStdin');
const {createHash} = require('node:crypto');
const audit = require('../../data/travelBooks/publication-rights-audit.json');

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const isSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isId = value => typeof value === 'string' && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const safeRelative = value => isText(value) && !value.includes('\\') && !value.includes('\0') && !path.isAbsolute(value) &&
  value.split('/').every(part => part && part !== '.' && part !== '..');
const kinds = new Set(['text', 'illustration', 'photograph', 'map', 'font']);
const bases = new Set(['original', 'license', 'public-domain', 'permission']);
const legacyTargets = new Set(audit.legacyTargetSha256);

function targetArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || !artifacts.length) throw new Error('Rights require exact publication artifacts');
  const sorted = artifacts.map(({id, sha256}) => ({id, sha256}));
  if (new Set(sorted.map(asset => asset.id)).size !== sorted.length || sorted.some(asset => !safeRelative(asset.id) || !isSha(asset.sha256))) {
    throw new Error('Invalid or duplicate rights artifact identity');
  }
  return sorted.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function publicationRightsTargetSha256({bookId, revision, artifacts}) {
  if (!isId(bookId) || !isId(revision)) throw new Error('Invalid rights edition identity');
  return digest(JSON.stringify({bookId, revision, artifacts: targetArtifacts(artifacts)}));
}

async function regularFile(root, relative) {
  if (!safeRelative(relative)) throw new Error('Rights evidence must be a relative file: ' + relative);
  const file = path.join(root, relative);
  if (await fs.realpath(file) !== file || !(await fs.lstat(file)).isFile()) {
    throw new Error('Rights evidence must be a regular file inside its root: ' + relative);
  }
  return fs.readFile(file);
}

async function readEditionRightsProof({source, bookId, revision}) {
  if (!isId(bookId) || !isId(revision)) throw new Error('Invalid rights edition identity');
  try {
    const bytes = await regularFile(await fs.realpath(source), `${bookId}/${revision}/rights.json`);
    if (bytes.length > 2 * 1024 * 1024) throw new Error('Edition rights proof is too large: ' + bookId);
    return JSON.parse(bytes);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Missing rights proof for ${bookId}/${revision}`);
    throw error;
  }
}

const normalText = value => value.normalize('NFC').replace(/\s+/g, ' ').trim();

async function readCreditText(artifactRoot, artifact) {
  if (!artifactRoot || !artifact.id.endsWith('.pdf')) throw new Error('Required attribution needs an exact published PDF: ' + artifact.id);
  const bytes = await regularFile(await fs.realpath(artifactRoot), artifact.id);
  if (digest(bytes) !== artifact.sha256) throw new Error('Attribution PDF differs from its publication checksum: ' + artifact.id);
  const text = spawnSyncWithStdin('pdftotext', ['-layout', '-', '-'], {input: bytes, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000});
  if (text.error || text.status !== 0) throw new Error('Could not inspect printed attribution: ' + artifact.id);
  return normalText(text.stdout);
}

async function assertEditionRights({root, bookId, revision, artifacts, proof, artifactRoot}) {
  const expected = targetArtifacts(artifacts);
  if (!isId(bookId) || !isId(revision) || proof?.schemaVersion !== 1 || proof.bookId !== bookId || proof.revision !== revision) {
    throw new Error('Rights proof does not match publication edition: ' + bookId);
  }
  if (JSON.stringify(expected) !== JSON.stringify(targetArtifacts(proof.artifacts))) {
    throw new Error('Rights proof does not match exact publication files: ' + bookId);
  }
  const materials = proof.materials;
  if (!Array.isArray(materials) || !materials.length || materials.some(material => !isId(material?.id)) ||
    new Set(materials.map(material => material.id)).size !== materials.length) {
    throw new Error('Missing or duplicate rights materials: ' + bookId);
  }
  const known = new Set(materials.map(material => material.id));
  const used = new Set();
  for (const artifact of proof.artifacts) {
    const ids = artifact.materialIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !known.has(id)) || new Set(ids).size !== ids.length) {
      throw new Error('Rights proof does not cover materials for ' + artifact.id);
    }
    ids.forEach(id => used.add(id));
  }
  if (used.size !== known.size) throw new Error('Unused rights materials in proof: ' + bookId);

  const evidenceRoot = await fs.realpath(root);
  const evidenceHashes = new Map();
  const creditTexts = new Map();
  for (const material of materials) {
    const {id, kind, basis, rightsHolder, source, evidencePath, evidenceSha256, permissions, royaltyStatus, attribution} = material;
    if (!kinds.has(kind) || !bases.has(basis) || !isText(rightsHolder) || !isText(source) || !isSha(evidenceSha256) ||
      !Array.isArray(permissions) || !permissions.includes('digital-distribution') || !permissions.includes('print') ||
      (material.derived !== undefined && typeof material.derived !== 'boolean') ||
      (material.derived === true && !permissions.includes('adaptation')) || !['none', 'settled'].includes(royaltyStatus)) {
      throw new Error(`Unresolved rights for ${bookId}/${id}`);
    }
    if (typeof attribution?.required !== 'boolean') {
      throw new Error(`Missing attribution evidence for ${bookId}/${id}`);
    }
    if (attribution.required) {
      const artifact = proof.artifacts.find(file => file.id === attribution.artifactId && file.materialIds.includes(id));
      if (!isText(attribution.text) || !artifact) throw new Error(`Missing attribution evidence for ${bookId}/${id}`);
      if (!creditTexts.has(artifact.id)) creditTexts.set(artifact.id, await readCreditText(artifactRoot, artifact));
      if (!creditTexts.get(artifact.id).includes(normalText(attribution.text))) throw new Error(`Printed attribution is absent for ${bookId}/${id}`);
    }
    if (!evidenceHashes.has(evidencePath)) evidenceHashes.set(evidencePath, digest(await regularFile(evidenceRoot, evidencePath)));
    if (evidenceHashes.get(evidencePath) !== evidenceSha256) throw new Error(`Rights source evidence changed for ${bookId}/${id}`);
  }
}

function targets(manifest, assets) {
  const published = [...manifest.books, ...(manifest.miniDiaries ?? [])];
  const editions = new Map(published.map(({id, revision}) => [`${id}/${revision}`, {bookId: id, revision, artifacts: []}]));
  if (editions.size !== published.length) throw new Error('Duplicate publication rights edition');
  for (const asset of assets) {
    const [bookId, revision, ...parts] = asset.relative.split('/');
    const edition = editions.get(`${bookId}/${revision}`);
    if (!edition) throw new Error('Publication artifact has no rights edition: ' + asset.relative);
    edition.artifacts.push({id: parts.join('/'), sha256: asset.sha256});
  }
  return [...editions.values()];
}

/** No new or changed file may inherit the rights status of an earlier revision. */
async function assertFullPublicationRights({root, manifest, assets, source, prior, priorAssets}) {
  const retained = new Set(prior ? targets(prior, priorAssets).map(publicationRightsTargetSha256) : []);
  const verified = [];
  for (const edition of targets(manifest, assets)) {
    const sha = publicationRightsTargetSha256(edition);
    if (legacyTargets.has(sha) || retained.has(sha)) continue;
    const proof = await readEditionRightsProof({source, bookId: edition.bookId, revision: edition.revision});
    await assertEditionRights({root, ...edition, proof, artifactRoot: path.join(source, edition.bookId, edition.revision)});
    verified.push(proof);
  }
  return verified;
}

module.exports = {assertEditionRights, assertFullPublicationRights, publicationRightsTargetSha256, readEditionRightsProof};
