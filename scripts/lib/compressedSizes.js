/**
 * scripts/lib/compressedSizes.js
 * Размеры gzip и Brotli q11 набора буферов — параллельно, но синхронно для
 * вызывающего.
 *
 * Бюджет JavaScript выката сжимал каждый чанк `brotliCompressSync` q11 в одном
 * потоке и стоил 39–50 с даже на спокойной машине, тогда как предсжатие той же
 * статики в четыре потока укладывается в 8–9 с (#2980). Сам guard синхронный, и
 * переписывать его в async ради одного прохода — значит переставить тысячу строк.
 * Поэтому проход идёт в worker_threads, а главный поток ждёт их через
 * `Atomics.wait`: параметры zlib те же, что у прежнего последовательного кода,
 * и числа совпадают побайтно.
 */

const os = require('os')
const zlib = require('zlib')
const { Worker, isMainThread, workerData } = require('worker_threads')

const BROTLI_OPTIONS = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }
const DEFAULT_WORKERS = Math.max(1, Math.min(4, os.cpus().length))
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
// status: [завершившиеся воркеры, упавшие воркеры, курсор очереди]
const DONE = 0
const FAILED = 1
const CURSOR = 2

function measure(buffer) {
  return { gzip: zlib.gzipSync(buffer).length, brotli: zlib.brotliCompressSync(buffer, BROTLI_OPTIONS).length }
}

/**
 * @param {Buffer[]} buffers
 * @param {{ workers?: number, timeoutMs?: number }} [options]
 * @returns {{ gzip: number, brotli: number }[]} в порядке `buffers`
 */
function compressedSizesSync(buffers, { workers = DEFAULT_WORKERS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const count = Math.max(1, Math.min(workers, buffers.length))
  if (count === 1) return buffers.map(measure)

  // Один общий блок байтов вместо копии всех чанков в каждый воркер.
  const offsets = new Float64Array(buffers.length + 1)
  buffers.forEach((buffer, index) => { offsets[index + 1] = offsets[index] + buffer.length })
  const bytes = new Uint8Array(new SharedArrayBuffer(Math.max(1, offsets[buffers.length])))
  buffers.forEach((buffer, index) => bytes.set(buffer, offsets[index]))
  const results = new Float64Array(new SharedArrayBuffer(buffers.length * 2 * 8))
  const status = new Int32Array(new SharedArrayBuffer(3 * 4))

  const pool = Array.from({ length: count }, () => {
    const worker = new Worker(__filename, { workerData: { compressedSizes: true, bytes, offsets, results, status } })
    worker.unref()
    return worker
  })

  const deadline = Date.now() + timeoutMs
  for (let done = Atomics.load(status, DONE); done < count; done = Atomics.load(status, DONE)) {
    const left = deadline - Date.now()
    if (left <= 0) {
      // A caller that survives the error must not keep q11 threads running.
      pool.forEach((worker) => worker.terminate())
      throw new Error(`compressed sizes: ${count - done} of ${count} workers did not finish in ${timeoutMs} ms`)
    }
    Atomics.wait(status, DONE, done, left)
  }
  if (Atomics.load(status, FAILED) > 0) throw new Error('compressed sizes: a compression worker failed')

  return buffers.map((_, index) => ({ gzip: results[index * 2], brotli: results[index * 2 + 1] }))
}

if (!isMainThread && workerData && workerData.compressedSizes) {
  const { bytes, offsets, results, status } = workerData
  const total = offsets.length - 1
  try {
    for (let index = Atomics.add(status, CURSOR, 1); index < total; index = Atomics.add(status, CURSOR, 1)) {
      const sizes = measure(bytes.subarray(offsets[index], offsets[index + 1]))
      results[index * 2] = sizes.gzip
      results[index * 2 + 1] = sizes.brotli
    }
  } catch {
    Atomics.add(status, FAILED, 1)
  } finally {
    Atomics.add(status, DONE, 1)
    Atomics.notify(status, DONE)
  }
}

module.exports = { compressedSizesSync }
