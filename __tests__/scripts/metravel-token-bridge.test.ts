import { Readable } from 'stream'
import { runCli } from './cli-test-utils'
import path from 'path'

const { readFrame } = require('../../scripts/lib/metravel-token-bridge')
const frame = (value: unknown) => {
  const body = Buffer.from(JSON.stringify(value))
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length)
  return Buffer.concat([header, body])
}

describe('private owner-token bridge', () => {
  test.each([
    Buffer.from(''), Buffer.from([0, 0, 0, 10, 123]),
    frame({ v: 2, op: 'token', profile: 'owner', expectedUserId: 1, origin: 'https://metravel.by' }),
    frame({ v: 1, op: 'token', profile: 'qa104', expectedUserId: 104, origin: 'https://metravel.by' }),
    Buffer.from([0, 1, 0, 0]),
  ])('rejects truncated, oversized and unauthorized frames without reflected data', async (bytes) => {
    await expect(readFrame(Readable.from([bytes]))).rejects.toThrow('metravel-auth:')
  })
  it('accepts the bounded metadata frame', async () => {
    await expect(readFrame(Readable.from([frame({ v: 1, op: 'token', profile: 'owner', expectedUserId: 1, origin: 'https://metravel.by' })]))).resolves.toMatchObject({ expectedUserId: 1 })
  })
  test.each(['.agents', '.claude'])('Python %s validates private results and keeps secrets off argv', (directory) => {
    const file = path.resolve(directory, 'skills/metravel-travel-article/scripts/metravel_publish.py')
    const result = runCli('python3', ['-c', `
import runpy, json, os, struct, subprocess
m = runpy.run_path(${JSON.stringify(file)})
sentinel='private-fixture-secret'
captured=[]
class Child:
  returncode=0
  def __init__(self,args,**options):
    captured.append(args)
    value=json.dumps({'v':1,'userId':1,'token':sentinel}).encode()
    os.write(int(args[-1]),struct.pack('>I',len(value))+value)
  def communicate(self,*args,**options): return b'',b''
  def poll(self): return 0
subprocess.Popen=Child
assert m['token']()==sentinel
assert sentinel not in json.dumps(captured)
class Bad(Child):
  def communicate(self,*args,**options): return sentinel.encode(),b''
subprocess.Popen=Bad
try:
  m['token']()
  raise AssertionError('stdout token accepted')
except RuntimeError as error:
  assert sentinel not in str(error)
print('private bridge PASS')
`])
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('private bridge PASS')
  })
})
