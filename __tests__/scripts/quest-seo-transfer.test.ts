/** @jest-environment node */
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const transport = path.resolve('scripts/quest-seo-transport.py')
const setup = `
import contextlib, fcntl, gzip, hashlib, importlib.util, io, json, os, pathlib, shutil, struct, sys, tarfile
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
base=pathlib.Path(sys.argv[2]).resolve(); releases=base/'releases'; source=releases/'active'/'dist'; source.mkdir(parents=True)
def write(root,name,value,mtime=123):
 p=root/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(value); p.chmod(0o644); os.utime(p,ns=(mtime*10**9,)*2); return p
old=write(source,'asset.js',b'same bytes'*1000)
(source.parent/'.reader.lock').touch(mode=0o600); (source.parent/'.identity.json').write_text('{"release_id":"active"}')
candidate=base/'input'; candidate.mkdir()
write(candidate,'asset.js',old.read_bytes()); write(candidate,'alias.js',old.read_bytes()); write(candidate,'nested/alias.js',b'new body')
write(candidate,'new.js',b'new body'); write(candidate,'newer.js',old.read_bytes(),124); write(candidate,'empty.js',b'')
raw=m.build_index(candidate); index=m.parse_index(raw)
def allocated(roots):
 seen=set(); total=0
 for root in roots:
  for p in [root,*root.rglob('*')]:
   s=p.lstat(); key=(s.st_dev,s.st_ino)
   if key not in seen:seen.add(key); total+=s.st_blocks*512
 return total
class Package:
 SLUG=None
 @staticmethod
 def _match(pattern,value):assert value and '/' not in value
 @staticmethod
 @contextlib.contextmanager
 def operation_lock():
  with (base/'.operation.lock').open('a+b') as lock:fcntl.flock(lock,fcntl.LOCK_EX); yield
 @staticmethod
 def regular_file(root,name,maximum):
  with m.file_at(root,name) as (source,_,__):
   value=source.read(maximum+1); assert len(value)<=maximum; return value
class Activation:
 current='active'
 rollback=None
 def current_release(self):return self.current
 def retained_rollback(self,current):return self.rollback
 def sealed_identity(self,release):return json.loads((release/'.identity.json').read_bytes())
activation=Activation()
def inventory(*args):
 for release in releases.iterdir():
  assert release.is_dir() and not release.is_symlink()
  activation.sealed_identity(release)
m.inventory=inventory
def plan():
 with Package.operation_lock(),m.pinned_sources(Package,activation,releases) as sources:
  storage,lookup=m.storage_plan(Package,activation,base/'dist',releases,raw,activation.current,1610612736,m.BACKEND_RESERVE,allocated,sources=sources)
  return m.transfer_plan(storage,index,lookup),lookup
transfer,lookup=plan(); storage=transfer['storage_plan']
def packed(root):
 out=io.BytesIO(); original=sys.stdout; sys.stdout=type('Out',(),{'buffer':out})()
 try:m.pack(root)
 finally:sys.stdout=original
 return out.getvalue()
full=packed(candidate)
(base/'index.json').write_bytes(raw); (base/'plan.json').write_bytes(m.canonical(transfer)); (base/'full.tar.gz').write_bytes(full)
def frame():
 out=io.BytesIO(); m.frame_v3(base/'index.json',base/'plan.json',base/'full.tar.gz',out); return out.getvalue()
framed=frame()
def split(payload):
 a,b=struct.unpack('>II',payload[:8]); return payload[8:8+a],m.strict_json(payload[8+a:8+a+b]),payload[8+a+b:]
def archive(rows):
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode='w:gz') as tar:
  for name,value,kind in rows:
   row=next((r for r in index['files'] if r['path']==name),None)
   member=tarfile.TarInfo(name); member.type=kind; member.size=len(value) if kind==tarfile.REGTYPE else 0
   member.mode=0o644; member.mtime=row['mtime'] if row else 123; member.linkname='asset.js'
   tar.addfile(member,io.BytesIO(value) if kind==tarfile.REGTYPE else None)
 return out.getvalue()
required_rows=[(name,(candidate/name).read_bytes(),tarfile.REGTYPE) for name in transfer['required_paths']]
attempt=0
def stage(payload=framed,name='candidate'):
 sys.stdin=type('Input',(),{'buffer':io.BytesIO(payload)})()
 return m.stage_v3(Package,activation,base/'dist',releases,[name,activation.current,'1610612736',str(m.BACKEND_RESERVE)],allocated)
def fail_materialize(payload,known=None):
 global attempt
 attempt+=1; root=base/('attempt'+str(attempt))/'dist'; root.mkdir(parents=True)
 try:m.materialize_v3(root,io.BytesIO(payload),raw,dict(lookup if known is None else known),transfer,releases); raise AssertionError('invalid delta admitted')
 except (ValueError,OSError,tarfile.TarError,EOFError):pass
 assert not (root.parent/'.storage-member.v2.tmp').exists()
 return root
`

function check(body: string, expected: string) {
  const root = makeTempDir('quest-transfer-', { root: path.resolve('.codex-temp/task-2363-tests') })
  try {
    const result = runCli('python3', ['-B', '-c', setup + body, transport, root])
    if (result.status !== 0) throw new Error(result.stderr || result.stdout)
    expect(result.stdout).toContain(expected)
  } finally { removeDir(root) }
}

describe('private delta transfer over unchanged v2 storage', () => {
  it('sends each new content/metadata body once, reconstructs the complete root and supports a zero-body release', () => {
    check(`
assert transfer['required_paths']==['empty.js','nested/alias.js','newer.js']
index_raw,provided,delta=split(framed); assert index_raw==raw and provided==transfer
with tarfile.open(fileobj=io.BytesIO(delta),mode='r:gz') as tar:
 assert sorted(r.name for r in tar)==transfer['required_paths']
assert sum(r[1].__len__() for r in required_rows)<sum(r['size'] for r in index['files'])
before=(old.stat().st_mode,old.stat().st_mtime_ns,old.read_bytes())
receipt=stage(); root=releases/'candidate'/'dist'
assert receipt['schema_version']==3 and receipt['transfer_plan_sha256']==transfer['transfer_plan_sha256']
assert receipt['plan_sha256']==storage['plan_sha256'] and allocated([releases])==receipt['allocated_bytes']<=storage['peak_bytes']
assert type(receipt['max_rss_bytes']) is int and receipt['max_rss_bytes']>0
assert m.build_index(root)==raw
assert old.stat().st_ino==(root/'asset.js').stat().st_ino==(root/'alias.js').stat().st_ino
assert (root/'new.js').stat().st_ino==(root/'nested/alias.js').stat().st_ino
assert (root/'newer.js').stat().st_ino!=old.stat().st_ino and (root/'newer.js').stat().st_mtime_ns==124*10**9
assert (old.stat().st_mode,old.stat().st_mtime_ns,old.read_bytes())==before
assert {p.name for p in root.parent.iterdir()}=={'.reader.lock',m.INDEX_NAME,'.storage-plan.v2.json','dist'}
assert m.strict_json((root.parent/'.storage-plan.v2.json').read_bytes())==storage
(root.parent/'.identity.json').write_text('{"release_id":"candidate"}'); activation.current='candidate'
transfer,lookup=plan(); assert transfer['required_paths']==[]
(base/'plan.json').write_bytes(m.canonical(transfer)); again=frame(); _,_,delta=split(again)
with tarfile.open(fileobj=io.BytesIO(delta),mode='r:gz') as tar:assert list(tar)==[]
stage(again,'zero'); assert m.build_index(releases/'zero'/'dist')==raw
assert (releases/'zero'/'dist'/'new.js').stat().st_ino==(root/'new.js').stat().st_ino
print('full root, unique delta, unchanged v2 provenance and zero-body PASS')
`, 'zero-body PASS')
  })

  it('rejects missing, extra, repeated, linked, corrupt, truncated and trailing delta entries', () => {
    check(`
valid=archive(required_rows)
fail_materialize(archive(required_rows[:-1]))
fail_materialize(archive(required_rows+[required_rows[0]]))
fail_materialize(archive(required_rows+[('asset.js',old.read_bytes(),tarfile.REGTYPE)]))
for kind in [tarfile.SYMTYPE,tarfile.LNKTYPE,tarfile.DIRTYPE,tarfile.FIFOTYPE]:
 fail_materialize(archive([(required_rows[0][0],b'',kind)]+required_rows[1:]))
for name in ['../escape','/absolute','nested//alias.js','unindexed.js']:
 fail_materialize(archive([(name,b'x',tarfile.REGTYPE)]+required_rows[1:]))
fail_materialize(archive([(required_rows[0][0],b'wrong',tarfile.REGTYPE)]+required_rows[1:]))
for cut in [1,8,len(valid)//2]:fail_materialize(valid[:-cut])
fail_materialize(valid+gzip.compress(b'not tar padding'))
fail_materialize(valid+gzip.compress(b'\\0'*(tarfile.RECORDSIZE+1)))
print('exact wire set, metadata, content and framing refusals PASS')
`, 'framing refusals PASS')
  })

  it('validates every full prepared archive member, including bodies omitted from the delta', () => {
    check(`
all_rows=[(r['path'],(candidate/r['path']).read_bytes(),tarfile.REGTYPE) for r in index['files']]
# A valid flat archive is used because this case intentionally omits nested directories.
bad=archive(all_rows); (base/'full.tar.gz').write_bytes(bad)
try:frame(); raise AssertionError('missing directory admitted')
except ValueError:pass
flat=base/'flat'; flat.mkdir(); write(flat,'asset.js',b'same bytes'*1000); write(flat,'fresh.js',b'fresh')
raw=m.build_index(flat); index=m.parse_index(raw); transfer,lookup=plan()
(base/'index.json').write_bytes(raw); (base/'plan.json').write_bytes(m.canonical(transfer))
for rows in [[('asset.js',b'wrong bytes'*1000,tarfile.REGTYPE),('fresh.js',b'fresh',tarfile.REGTYPE)],
             [('asset.js',b'same bytes'*1000,tarfile.REGTYPE),('fresh.js',b'fresh',tarfile.REGTYPE),('extra',b'x',tarfile.REGTYPE)],
             [('asset.js',b'',tarfile.LNKTYPE),('fresh.js',b'fresh',tarfile.REGTYPE)],
             [('asset.js',b'same bytes'*1000,tarfile.REGTYPE),('asset.js',b'same bytes'*1000,tarfile.REGTYPE),('fresh.js',b'fresh',tarfile.REGTYPE)]]:
 (base/'full.tar.gz').write_bytes(archive(rows))
 try:frame(); raise AssertionError('invalid full archive admitted')
 except (ValueError,tarfile.TarError):pass
for payload in [packed(flat)[:-8],packed(flat)+gzip.compress(b'foreign'),
                packed(flat)+gzip.compress(b'\\0'*(tarfile.RECORDSIZE+1))]:
 (base/'full.tar.gz').write_bytes(payload)
 try:frame(); raise AssertionError('invalid full gzip admitted')
 except (ValueError,EOFError):pass
print('full archive retained proof before filtered wire PASS')
`, 'filtered wire PASS')
  })

  it('binds the wrapper, inner allocation plan, index, source tree and CAS before candidate creation', () => {
    check(`
def framed_plan(value,index_raw=raw):
 body=m.canonical(value); return struct.pack('>II',len(index_raw),len(body))+index_raw+body+split(framed)[2]
def rejected(payload):
 try:stage(payload); raise AssertionError('changed plan admitted')
 except (ValueError,FileNotFoundError):pass
 assert not (releases/'candidate').exists()
def rehash(value):
 value.pop('transfer_plan_sha256',None); value['transfer_plan_sha256']=hashlib.sha256(m.canonical(value)).hexdigest(); return value
for key,value in [('transfer_plan_sha256','0'*64),('required_paths',[]),('required_paths',['new.js']),('schema_version',2)]:
 changed=json.loads(m.canonical(transfer)); changed[key]=value
 rejected(framed_plan(changed))
changed=json.loads(m.canonical(transfer)); changed['storage_plan']['physical_bytes']+=4096; rejected(framed_plan(rehash(changed)))
changed=json.loads(m.canonical(transfer)); changed['storage_plan']['physical_bytes']+=4096
inner=changed['storage_plan']; inner.pop('plan_sha256'); inner['plan_sha256']=hashlib.sha256(m.canonical(inner)).hexdigest()
rejected(framed_plan(rehash(changed)))
changed=json.loads(raw); changed['files'][0]['sha256']='0'*64; rejected(framed_plan(transfer,m.canonical(changed)))
activation.current='new-current'; rejected(framed); activation.current='active'
old.write_bytes(b'x'*old.stat().st_size); os.utime(old,ns=(123*10**9,)*2); rejected(framed)
old.write_bytes(b'same bytes'*1000); os.utime(old,ns=(123*10**9,)*2)
transfer,lookup=plan(); (base/'plan.json').write_bytes(m.canonical(transfer)); framed=frame()
original=old.rename(source/'kept.js'); write(source,'asset.js',original.read_bytes()); rejected(framed)
(source/'asset.js').unlink(); original.rename(source/'asset.js')
transfer,lookup=plan(); (base/'plan.json').write_bytes(m.canonical(transfer)); framed=frame()
(releases/'interrupted').mkdir(); rejected(framed)
print('wrapper/index/storage/source/CAS/partial generation refusal PASS')
`, 'generation refusal PASS')
  })

  it('rechecks source bytes and parent identities, stops at reserve and refuses hardlink copy fallback', () => {
    check(`
delta=split(framed)[2]
# Materialization pins were collected before a source is modified or replaced.
old.write_bytes(b'x'*old.stat().st_size); os.utime(old,ns=(123*10**9,)*2); fail_materialize(delta)
old.write_bytes(b'same bytes'*1000); os.utime(old,ns=(123*10**9,)*2); transfer,lookup=plan()
kept=old.rename(source/'kept.js'); write(source,'asset.js',kept.read_bytes()); fail_materialize(delta)
(source/'asset.js').unlink(); kept.rename(source/'asset.js'); transfer,lookup=plan()
outside=base/'outside'; outside.mkdir(); write(outside,'asset.js',old.read_bytes())
kept=old.rename(base/'kept.js'); old.symlink_to(outside/'asset.js'); fail_materialize(delta); old.unlink(); kept.rename(old)
transfer,lookup=plan()
saved_source=source.rename(source.parent/'saved-dist'); source.symlink_to(outside,target_is_directory=True)
fail_materialize(delta); source.unlink(); saved_source.rename(source)
transfer,lookup=plan(); real_link=m.os.link
def no_link(*args,**kwargs):raise OSError('unsupported hardlink')
m.os.link=no_link; rejected=fail_materialize(delta); m.os.link=real_link
assert not (rejected/'alias.js').exists(), 'full-copy fallback'
real_statvfs=m.os.statvfs
m.os.statvfs=lambda root:type('V',(),{'f_frsize':4096,'f_bavail':m.BACKEND_RESERVE//4096})()
fail_materialize(delta)
try:plan(); raise AssertionError('borrowed backend reserve')
except ValueError:pass
m.os.statvfs=real_statvfs
print('source race, no-follow, reserve and no-copy safeguards PASS')
`, 'safeguards PASS')
  })

  it('keeps v2 abort provenance and refuses active, rollback, reader-pinned or unknown partial contents', () => {
    check(`
stage(); release=releases/'candidate'
args=['candidate','active',storage['index_sha256'],storage['plan_sha256']]
def refused_abort():
 try:m.abort_stage_v2(Package,activation,base/'dist',releases,args); raise AssertionError('unsafe abort admitted')
 except (ValueError,BlockingIOError):pass
 assert release.exists()
activation.rollback='candidate'; refused_abort(); activation.rollback=None
activation.current='candidate'
try:m.abort_stage_v2(Package,activation,base/'dist',releases,['candidate','candidate',storage['index_sha256'],storage['plan_sha256']]); raise AssertionError('active generation aborted')
except ValueError:pass
activation.current='active'
with (release/'.reader.lock').open('rb') as reader:
 fcntl.flock(reader,fcntl.LOCK_SH); refused_abort()
(release/'unknown').write_bytes(b'x'); refused_abort(); (release/'unknown').unlink()
(release/'.identity.json').write_text('{}'); refused_abort(); (release/'.identity.json').unlink()
receipt=m.abort_stage_v2(Package,activation,base/'dist',releases,args)
assert receipt['schema_version']==2 and receipt['result']=='aborted' and not release.exists()
assert source.exists() and old.read_bytes()==b'same bytes'*1000
print('v2 exact partial abort, protected readers and unchanged sources PASS')
`, 'unchanged sources PASS')
  })
})
