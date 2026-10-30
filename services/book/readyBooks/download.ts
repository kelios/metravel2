import type {PublishedArtifact} from './publication';

export type VerifiedBookAsset = {uri:string;bytes:number;sha256:string;mime:string};

export async function fetchVerifiedBookAsset(file:VerifiedBookAsset,signal?:AbortSignal):Promise<ArrayBuffer>{
  const response=await fetch(file.uri,{credentials:'omit',signal});
  if(!response.ok) throw new Error('DOWNLOAD_HTTP_'+response.status);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==file.bytes) throw new Error('DOWNLOAD_SIZE');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==file.sha256) throw new Error('DOWNLOAD_HASH');
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  return bytes;
}

export async function fetchBookArtifact(file:PublishedArtifact,signal?:AbortSignal):Promise<Blob>{
  return new Blob([await fetchVerifiedBookAsset(file,signal)],{type:file.mime});
}
