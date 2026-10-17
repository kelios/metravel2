'use strict'

const { spawn } = require('child_process')

// The worker remains its detached process-group leader until release. Only the
// worker signals its own group; no cancellation acts on a cached PID or PGID.
function captureWorker(command) {
  if (typeof process.send !== 'function' || !process.connected) throw new Error('Private capture IPC required')
  return new Promise((resolve) => {
    let stopping = false, result = null
    const child = spawn(command[0], command.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] })
    const cancel = () => {
      if (stopping) return
      stopping = true
      process.kill(-process.pid, 'SIGTERM')
      // A TERM-ignoring descendant must not outlive the group leader.
      setTimeout(() => process.kill(-process.pid, 'SIGKILL'), 5000)
    }
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => {})
    process.on('disconnect', cancel)
    process.on('message', (message) => {
      if (message === 'cancel') cancel()
      else if (message === 'release' && result !== null && !stopping) {
        process.removeListener('disconnect', cancel)
        process.disconnect()
        resolve(result)
      }
    })
    child.on('error', (error) => console.error(`Capture process failed to start: ${error.message}`))
    child.on('close', (code) => {
      result = code === 0 ? 0 : 1
      if (!stopping && process.connected) process.send({ result })
    })
  })
}

function supervise(command, label) {
  return new Promise((resolve, reject) => {
    const owner = process.ppid
    if (owner <= 1) { resolve(1); return }
    let requested = null, result = null, released = false, input = ''
    const started = Date.now()
    const worker = spawn(process.execPath, [__filename, JSON.stringify(command)], {
      detached: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    const request = (next) => {
      if (requested === 'cancel' || released) return
      requested = next
      if (next === 'cancel') {
        if (worker.connected) worker.send('cancel')
      } else if (result !== null && worker.connected) {
        released = true
        worker.send('release')
      }
    }
    const cancel = () => request('cancel')
    // The control writer owns this supervisor as its direct child. Reparenting
    // is owner loss even when a FIFO fails to deliver EOF (macOS). This identity
    // is only observed; cancellation never signals a remembered parent PID.
    const ownerWatch = setInterval(() => {
      if (process.ppid !== owner) cancel()
    }, 100)
    const onInput = (chunk) => {
      input += chunk
      if (input.length > 32) cancel()
      else if (input.includes('\n')) request(input === 'finish\n' ? 'finish' : 'cancel')
    }
    // The FIFO writer is held until reaping. EOF therefore means the owner
    // died, even if it had already requested finish while the child was busy.
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, cancel)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', onInput)
    process.stdin.on('end', cancel)
    const cleanup = () => {
      clearInterval(ownerWatch)
      for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeListener(signal, cancel)
      process.stdin.removeListener('data', onInput)
      process.stdin.removeListener('end', cancel)
      process.stdin.destroy()
    }
    worker.on('message', (message) => {
      if (message && (message.result === 0 || message.result === 1)) {
        result = message.result
        console.log(`${label} (parallel with Metro): ${Date.now() - started} ms, status=${result}`)
        if (requested === 'finish') request('finish')
      }
    })
    worker.on('error', (error) => { cleanup(); reject(error) })
    worker.on('close', () => { cleanup(); resolve(requested === 'finish' && released ? result : 1) })
  })
}

if (require.main === module) {
  const command = JSON.parse(process.argv[2])
  if (!Array.isArray(command) || !command.length || command.some(value => typeof value !== 'string')) throw new Error('Command argv required')
  captureWorker(command).then(code => { process.exitCode = code })
    .catch(error => { console.error(error); process.exitCode = 1 })
}
module.exports = { captureWorker, supervise }
