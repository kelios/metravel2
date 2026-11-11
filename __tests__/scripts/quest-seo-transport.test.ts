/** @jest-environment node */
// The private archive transport and the static-root lock of
// scripts/quest-seo-transport.py. These cases moved here from the retired
// quest-seo-operation.test.ts when the static quest publication pipeline was
// removed (#2766); the CAS operations on the static root and their recovery
// scripts went with #3209 and #3272.
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

describe('quest SEO transport: private archive and operation lock', () => {
  it('publishes only the active sealed cover under the operation lock without mutating the package', () => {
    const root = makeTempDir('quest-e-cover-transport-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import contextlib, fcntl, hashlib, importlib.util, os, pathlib, sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=pathlib.Path(sys.argv[2]).resolve(); static=root/'static'; releases=static/'quest-seo-releases'; release=releases/'candidate'; source=release/'dist/static/quests/quest-default-cover.svg'; source.parent.mkdir(parents=True); source.write_bytes(b'<svg>candidate</svg>'); active=static/'dist'; active.symlink_to('quest-seo-releases/candidate/dist')
@contextlib.contextmanager
def lock():
 with (static/'.quest-seo-operation.lock').open('a+b') as fd:
  fcntl.flock(fd,fcntl.LOCK_EX); yield
class Package:
 SLUG=None
 operation_lock=staticmethod(lock)
 @staticmethod
 def _match(pattern,value):assert value=='candidate'
 @staticmethod
 def regular_file(root,name,maximum):
  target=root
  for part in name.split('/'):
   target=target/part
   assert not target.is_symlink()
  value=target.read_bytes(); assert len(value)<=maximum; return value
class Activation:
 current='candidate'
 def current_release(self):return self.current
 def sealed_identity(self,release):return {'frontend_sha':'a'*40,'manifest_sha256':'b'*64}
a=Activation(); arguments=['candidate','a'*40,'b'*64]; replace=m.os.replace
def checked_replace(source,target):
 fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR)
 try:
  try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); raise AssertionError('cover write escaped operation lock')
  except BlockingIOError:pass
 finally:os.close(fd)
 return replace(source,target)
m.os.replace=checked_replace
receipt=m.publish_cover(Package(),a,active,releases,arguments); target=static/'quests/quest-default-cover.svg'
assert receipt['sha256']==hashlib.sha256(source.read_bytes()).hexdigest() and target.read_bytes()==source.read_bytes()
source_bytes=source.read_bytes(); target.unlink(); target.symlink_to(source)
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('cover symlink accepted')
except ValueError:pass
target.unlink(); (static/'quests').rmdir(); (static/'quests').symlink_to(source.parent)
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('directory symlink accepted')
except ValueError:pass
(static/'quests').unlink(); a.current='newer'
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('stale cover accepted')
except ValueError:pass
assert source.read_bytes()==source_bytes and not (static/'quests').exists()
print('sealed cover/lock/CAS PASS')
`, path.resolve('scripts/quest-seo-transport.py'), root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('cover/lock/CAS PASS')
    } finally { removeDir(root) }
  })

  it('preserves bytes/mtime, rejects archive links/traversal and tree links, and holds the static-root flock', () => {
    const root = makeTempDir('quest-e-transport-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import importlib.util, io, os, pathlib, stat, sys, tarfile, fcntl
spec=importlib.util.spec_from_file_location('transport',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=pathlib.Path(sys.argv[2]).resolve(); source=root/'source'; source.mkdir(); (source/'empty').mkdir(); (source/'a.js').write_bytes(b'asset'); os.utime(source/'a.js',(12345,12345))
buffer=io.BytesIO(); original=sys.stdout; sys.stdout=type('Output',(),{'buffer':buffer})(); m.pack(source); sys.stdout=original
target=root/'target'; target.mkdir(); sys.stdin=type('Input',(),{'buffer':io.BytesIO(buffer.getvalue())})(); m.unpack(target)
assert (target/'a.js').read_bytes()==b'asset' and (target/'a.js').stat().st_mtime==12345
assert (target/'empty').is_dir()
for name,kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('linked',tarfile.SYMTYPE),('hardlink',tarfile.LNKTYPE)]:
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode='w:gz') as t:
  info=tarfile.TarInfo(name); info.type=kind; info.linkname='a.js'; t.addfile(info)
 sys.stdin=type('Input',(),{'buffer':io.BytesIO(out.getvalue())})()
 try:m.unpack(target); raise AssertionError('unsafe archive accepted')
 except ValueError:pass
(source/'link').symlink_to('a.js')
try:list(m.regular_tree(source)); raise AssertionError('tree link accepted')
except ValueError:pass
walk=m.os.walk
def unreadable(*args,**kwargs):
 kwargs['onerror'](PermissionError('unreadable subtree')); yield None
m.os.walk=unreadable
try:list(m.regular_tree(source)); raise AssertionError('unreadable tree accepted')
except PermissionError:pass
m.os.walk=walk
release=root/'releases'; release.mkdir(); (release/'unfinished').mkdir()
class Package:
 def _match(self,*args):pass
 SLUG=None
class Activation:
 def sealed_identity(self,p):return (p/'.identity.json').read_text()
try:m.inventory(Package(),Activation(),release,10000); raise AssertionError('unknown generation accepted')
except FileNotFoundError:pass
assert list(release.iterdir())==[release/'unfinished']
static=root/'static'; static.mkdir(); (static/'dist').mkdir()
with m.legacy_lock(static):
 fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR)
 try:
  try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); raise AssertionError('nested fd bypassed operation lock')
  except BlockingIOError:pass
 finally:os.close(fd)
fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR); fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); os.close(fd)
(static/'dist').rmdir(); (static/'dist').symlink_to('quest-seo-releases/x/dist')
try:
 with m.legacy_lock(static):raise AssertionError('managed mutation accepted')
except ValueError:pass
assert stat.S_IMODE((static/'.quest-seo-operation.lock').stat().st_mode)==0o600
print('archive and real flock PASS')
`, path.resolve('scripts/quest-seo-transport.py'), root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('real flock PASS')
    } finally { removeDir(root) }
  })
})
