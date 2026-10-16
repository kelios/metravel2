/** @jest-environment node */
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const transport = path.resolve('scripts/quest-seo-transport.py')

describe('bounded private physical quest staging', () => {
  it('shares verified immutable content including candidate aliases, preserving publication metadata', () => {
    const root = makeTempDir('quest-storage-links-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import hashlib, importlib.util, io, json, os, pathlib, sys, tarfile
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
base=pathlib.Path(sys.argv[2]).resolve(); releases=base/'releases'; source=releases/'active'/'dist'; source.mkdir(parents=True)
def write(root,name,value,mtime=123):
 p=root/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(value); p.chmod(0o644); os.utime(p,ns=(mtime*10**9,)*2); return p
old=write(source,'asset.js',b'same bytes'); before=(old.stat().st_mode,old.stat().st_mtime_ns,old.read_bytes())
candidate=base/'input'; candidate.mkdir(); write(candidate,'asset.js',b'same bytes'); write(candidate,'alias.js',b'same bytes')
write(candidate,'new.js',b'new bytes'); write(candidate,'nested/alias.js',b'new bytes'); write(candidate,'newer.js',b'same bytes',124)
raw=m.build_index(candidate); assert len(raw)<m.MAX_INDEX_BYTES and m.parse_index(raw)['schema_version']==2
out=io.BytesIO(); original=sys.stdout; sys.stdout=type('Out',(),{'buffer':out})(); m.pack(candidate); sys.stdout=original
def allocated(roots):
 seen=set(); total=0
 for root in roots:
  for p in [root,*root.rglob('*')]:
   s=p.lstat(); key=(s.st_dev,s.st_ino)
   if key not in seen:seen.add(key); total+=s.st_blocks*512
 return total
class Activation:
 def current_release(self):return 'active'
plan,lookup=m.storage_plan(None,Activation(),base/'dist',releases,raw,'active',1610612736,m.BACKEND_RESERVE,allocated,sources=[(source.parent,{'release_id':'active'})])
assert plan['physical_bytes']==allocated([releases]) and plan['logical_bytes']==sum(p.stat().st_size for p in candidate.rglob('*') if p.is_file())
assert plan['incremental_bytes']>0 and plan['required_free_bytes']==plan['peak_bytes']-plan['physical_bytes']+m.BACKEND_RESERVE
release=releases/'candidate'; target=release/'dist'; target.mkdir(parents=True)
m.write_private(release/m.INDEX_NAME,raw)
m.materialize(target,io.BytesIO(out.getvalue()),raw,lookup,plan,allocated,releases)
assert old.stat().st_ino==(target/'asset.js').stat().st_ino==(target/'alias.js').stat().st_ino
assert (target/'new.js').stat().st_ino==(target/'nested/alias.js').stat().st_ino
assert (target/'newer.js').stat().st_ino!=old.stat().st_ino and (target/'newer.js').stat().st_mtime_ns==124*10**9
assert (old.stat().st_mode,old.stat().st_mtime_ns,old.read_bytes())==before
assert not list(target.rglob('.quest-member-*')) and not (target/m.INDEX_NAME).exists()
assert allocated([releases])<=plan['peak_bytes']
# Subsecond source stamps never share an inode, despite equal rounded index metadata.
os.utime(old,ns=(123000000001,)*2)
_,other=m.source_lookup([(source.parent,{'release_id':'active'})],m.parse_index(raw)); assert other
assert not m.source_lookup([(source.parent,{'release_id':'active'})],m.parse_index(raw))[0]
print('physical union, immutable links and timestamp isolation PASS')
`, transport, root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('timestamp isolation PASS')
    } finally { removeDir(root) }
  })

  it('refuses corrupt streams, links, source races, link failures and insufficient physical/free budgets', () => {
    const root = makeTempDir('quest-storage-refusals-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import hashlib, importlib.util, io, os, pathlib, sys, tarfile
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
base=pathlib.Path(sys.argv[2]).resolve(); releases=base/'releases'; source=releases/'active'/'dist'; source.mkdir(parents=True)
p=source/'asset.js'; p.write_bytes(b'asset'); p.chmod(0o644); os.utime(p,ns=(123*10**9,)*2)
index={'schema_version':2,'directories':[],'files':[{'path':'asset.js','size':5,'sha256':hashlib.sha256(b'asset').hexdigest(),'mode':0o644,'mtime':123}]}; raw=m.canonical(index)
def allocated(roots):return 4096
class Activation:
 def current_release(self):return 'active'
def plan(budget=1610612736):return m.storage_plan(None,Activation(),base/'dist',releases,raw,'active',budget,m.BACKEND_RESERVE,allocated,sources=[(source.parent,{'release_id':'active'})])
valid,lookup=plan()
for budget in [1,valid['peak_bytes']-1]:
 try:plan(budget); raise AssertionError('insufficient managed budget admitted')
 except ValueError:pass
try:m.storage_plan(None,Activation(),base/'dist',releases,raw,'stale',1610612736,m.BACKEND_RESERVE,allocated,sources=[]); raise AssertionError('stale CAS admitted')
except ValueError:pass
real_statvfs=m.os.statvfs
m.os.statvfs=lambda root:type('V',(),{'f_frsize':4096,'f_bavail':m.BACKEND_RESERVE//4096})()
try:plan(); raise AssertionError('backend reserve borrowed')
except ValueError:pass
m.os.statvfs=real_statvfs
def archive(name='asset.js',kind=tarfile.REGTYPE,value=b'asset',duplicate=False):
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode='w:gz') as t:
  member=tarfile.TarInfo(name); member.type=kind; member.mode=0o644; member.mtime=123; member.linkname='asset.js'; member.size=len(value) if kind==tarfile.REGTYPE else 0
  t.addfile(member,io.BytesIO(value) if kind==tarfile.REGTYPE else None)
  if duplicate:t.addfile(member,io.BytesIO(value))
 return out.getvalue()
attempt=0
def refused(payload,known=None):
 global attempt
 attempt+=1; root=releases/('attempt'+str(attempt))/'dist'; root.mkdir(parents=True)
 try:m.materialize(root,io.BytesIO(payload),raw,dict(lookup if known is None else known),valid,allocated,releases); raise AssertionError('unsafe stage admitted')
 except (ValueError,OSError):pass
 assert not list(root.rglob('.quest-member-*'))
 return root
for name,kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('a//b',tarfile.REGTYPE),('asset.js',tarfile.SYMTYPE),('asset.js',tarfile.LNKTYPE),('asset.js',tarfile.FIFOTYPE)]:refused(archive(name,kind))
refused(archive(value=b'wrong')); refused(archive(duplicate=True)); refused(archive(name='unindexed.js'))
empty=io.BytesIO()
with tarfile.open(fileobj=empty,mode='w:gz'):pass
refused(empty.getvalue())
# Same inode/size/mtime, different bytes: the index is advisory, source is rehashed.
p.write_bytes(b'wrong'); os.utime(p,ns=(123*10**9,)*2); refused(archive()); p.write_bytes(b'asset'); os.utime(p,ns=(123*10**9,)*2)
# Replacing a source by an identical different inode is refused too.
original=p.rename(source/'retained'); p.write_bytes(b'asset'); p.chmod(0o644); os.utime(p,ns=(123*10**9,)*2); refused(archive()); p.unlink(); original.rename(p)
# A parent swapped for a symlink cannot escape the pinned root.
outside=base/'outside'; outside.mkdir(); (outside/'asset.js').write_bytes(b'asset')
p.unlink(); p.symlink_to(outside/'asset.js'); refused(archive()); p.unlink(); p.write_bytes(b'asset'); p.chmod(0o644); os.utime(p,ns=(123*10**9,)*2)
(source/'linked-parent').symlink_to(outside)
try:
 with m.file_at(source,'linked-parent/asset.js'):raise AssertionError('parent symlink followed')
except OSError:pass
(source/'linked-parent').unlink()
valid,lookup=plan(); real_link=m.os.link
def failure(*args,**kwargs):raise OSError('cross-device or unsupported hardlink')
m.os.link=failure; rejected=refused(archive()); m.os.link=real_link
assert not (rejected/'asset.js').exists(), 'unbudgeted full-copy fallback'
tiny=m.MAX_INDEX_BYTES; m.MAX_INDEX_BYTES=len(raw)-1
try:m.parse_index(raw); raise AssertionError('oversized index admitted')
except ValueError:pass
m.MAX_INDEX_BYTES=tiny
try:m.parse_index(raw.replace(b'"schema_version":2',b'"schema_version":2,"schema_version":2')); raise AssertionError('duplicate index key admitted')
except ValueError:pass
print('bounded and no-fallback refusals PASS')
`, transport, root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('no-fallback refusals PASS')
    } finally { removeDir(root) }
  })

  it('binds staging to the exact private index/plan and refuses unknown candidates before any new generation', () => {
    const root = makeTempDir('quest-storage-plan-cas-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import contextlib, hashlib, importlib.util, io, json, pathlib, struct, sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
base=pathlib.Path(sys.argv[2]).resolve(); releases=base/'releases'; releases.mkdir()
raw=m.canonical({'schema_version':2,'directories':[],'files':[{'path':'index.html','size':1,'sha256':hashlib.sha256(b'x').hexdigest(),'mode':0o644,'mtime':123}]})
class Package:
 SLUG=None
 @staticmethod
 def _match(pattern,value):assert value in ('candidate','interrupted')
 @staticmethod
 @contextlib.contextmanager
 def operation_lock():yield
class Activation:
 current=None
 def current_release(self):return self.current
 def sealed_identity(self,release):return json.loads((release/'.identity.json').read_bytes())
activation=Activation(); allocated=lambda roots:4096
plan,_=m.storage_plan(Package(),activation,base/'dist',releases,raw,None,1610612736,m.BACKEND_RESERVE,allocated,sources=[])
def refused(index,provided):
 p=m.canonical(provided); framed=struct.pack('>II',len(index),len(p))+index+p
 sys.stdin=type('Input',(),{'buffer':io.BytesIO(framed)})()
 try:m.stage_v2(Package(),activation,base/'dist',releases,['candidate','none','1610612736',str(m.BACKEND_RESERVE)],allocated); raise AssertionError('stale or unbound stage admitted')
 except (ValueError,FileNotFoundError):pass
 assert not (releases/'candidate').exists()
refused(raw,{**plan,'index_sha256':'0'*64})
refused(raw,{**plan,'physical_bytes':0})
changed=m.strict_json(raw); changed['files'][0]['sha256']='0'*64; refused(m.canonical(changed),plan)
activation.current='newer'; refused(raw,plan); activation.current=None
(releases/'interrupted').mkdir(); refused(raw,plan)
assert list(releases.iterdir())==[releases/'interrupted']
print('hash-bound plan, CAS and interrupted-candidate refusal PASS')
`, transport, root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('interrupted-candidate refusal PASS')
    } finally { removeDir(root) }
  })

  it('aborts only one hash-bound unsealed candidate after validating bytes, metadata, CAS and reader pins', () => {
    const root = makeTempDir('quest-storage-abort-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import contextlib, fcntl, hashlib, importlib.util, io, os, pathlib, shutil, sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
base=pathlib.Path(sys.argv[2]).resolve(); releases=base/'releases'; releases.mkdir()
raw=m.canonical({'schema_version':2,'directories':['nested'],'files':[{'path':'a.js','size':5,'sha256':hashlib.sha256(b'asset').hexdigest(),'mode':0o644,'mtime':123},{'path':'nested/b.js','size':5,'sha256':hashlib.sha256(b'asset').hexdigest(),'mode':0o644,'mtime':123}]})
digest=hashlib.sha256(raw).hexdigest()
class Package:
 SLUG=None
 @staticmethod
 def _match(pattern,value):assert value=='candidate'
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
 rollback='rollback'
 def current_release(self):return self.current
 def retained_rollback(self,current):return self.rollback
activation=Activation(); release=releases/'candidate'
def create(expected='active'):
 release.mkdir(); (release/'dist/nested').mkdir(parents=True); (release/'.reader.lock').write_bytes(b'')
 m.write_private(release/m.INDEX_NAME,raw)
 plan={'schema_version':2,'expected_current':expected,'index_sha256':digest}; plan['plan_sha256']=hashlib.sha256(m.canonical(plan)).hexdigest()
 m.write_private(release/'.storage-plan.v2.json',m.canonical(plan))
 p=release/'dist/a.js'; p.write_bytes(b'asset'); p.chmod(0o644); os.utime(p,ns=(123*10**9,)*2)
 return ['candidate','none' if expected is None else expected,digest,plan['plan_sha256']]
def reject(args):
 try:m.abort_stage_v2(Package(),activation,base/'dist',releases,args); raise AssertionError('unsafe candidate abort admitted')
 except (ValueError,OSError):pass
 assert release.exists()
for issue in ['digest','plan','cas','active','rollback','sealed','unknown','bytes','mtime','temp-size','temp-link','reader']:
 args=create(); held=None
 if issue=='digest':args[2]='0'*64
 if issue=='plan':args[3]='0'*64
 if issue=='cas':activation.current='newer'
 if issue=='active':activation.current='candidate'; args[1]='candidate'
 if issue=='rollback':activation.rollback='candidate'
 if issue=='sealed':(release/'.identity.json').write_text('{}')
 if issue=='unknown':(release/'unrecognized').write_bytes(b'')
 if issue=='bytes':(release/'dist/a.js').write_bytes(b'wrong'); os.utime(release/'dist/a.js',ns=(123*10**9,)*2)
 if issue=='mtime':os.utime(release/'dist/a.js',ns=(124*10**9,)*2)
 if issue=='temp-size':(release/'.storage-member.v2.tmp').write_bytes(b'too large')
 if issue=='temp-link':(release/'.storage-member.v2.tmp').symlink_to(release/'dist/a.js')
 if issue=='reader':held=(release/'.reader.lock').open('rb'); fcntl.flock(held,fcntl.LOCK_SH)
 reject(args)
 if held:held.close()
 activation.current='active'; activation.rollback='rollback'; shutil.rmtree(release)
# Remove just this interrupted candidate, including its one private partial member.
args=create(); (release/'.storage-member.v2.tmp').write_bytes(b'pa'); survivor=base/'immutable.js'; os.link(release/'dist/a.js',survivor)
receipt=m.abort_stage_v2(Package(),activation,base/'dist',releases,args)
assert receipt['result']=='aborted' and not release.exists() and survivor.read_bytes()==b'asset'
# Before first activation, a none-CAS candidate can also be explicitly aborted.
activation.current=None; activation.rollback=None; args=create(None); m.abort_stage_v2(Package(),activation,base/'dist',releases,args); assert not release.exists()
print('explicit provenance-bound abort and protected-reader refusal PASS')
`, transport, root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('protected-reader refusal PASS')
    } finally { removeDir(root) }
  })
})
