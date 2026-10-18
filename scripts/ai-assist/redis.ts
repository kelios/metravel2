/**
 * Минимальный клиент redis (RESP2) на `node:net`: GET и SET … EX — всё, что нужно кэшу ответов.
 * Отдельная зависимость ради двух команд не заводится; одно соединение на клиента, ответы
 * сопоставляются с командами по порядку (очередь ожиданий сокета) и разбираются по спецификации
 * RESP (+, -, :, $).
 */
import net from 'node:net'

export interface RedisClient {
  get: (key: string) => Promise<string | null>
  setEx: (key: string, value: string, ttlSeconds: number) => Promise<void>
  close: () => void
}

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void }

function encodeCommand(parts: string[]): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${parts.length}\r\n`)]
  for (const part of parts) {
    const body = Buffer.from(part, 'utf8')
    chunks.push(Buffer.from(`$${body.length}\r\n`), body, Buffer.from('\r\n'))
  }
  return Buffer.concat(chunks)
}

/** Разбор одного ответа RESP2 из начала буфера; null — ответ ещё не пришёл целиком. */
export function parseReply(buffer: Buffer): { value: unknown; rest: Buffer } | null {
  const lineEnd = buffer.indexOf('\r\n')
  if (lineEnd < 0) return null
  const type = String.fromCharCode(buffer[0])
  const line = buffer.subarray(1, lineEnd).toString('utf8')
  const rest = buffer.subarray(lineEnd + 2)
  switch (type) {
    case '+':
      return { value: line, rest }
    case '-':
      return { value: new Error(line), rest }
    case ':':
      return { value: Number(line), rest }
    case '$': {
      const length = Number(line)
      if (length < 0) return { value: null, rest }
      if (rest.length < length + 2) return null
      return { value: rest.subarray(0, length).toString('utf8'), rest: rest.subarray(length + 2) }
    }
    default:
      throw new Error(`redis: неожиданный тип ответа "${type}"`)
  }
}

export interface RedisOptions {
  url: string
  timeoutMs?: number
}

/** Одно TCP-соединение и его ожидания: RESP отвечает строго в порядке команд этого сокета. */
interface Connection {
  socket: net.Socket
  pending: Pending[]
}

export function createRedisClient(options: RedisOptions): RedisClient {
  const url = new URL(options.url)
  if (url.protocol !== 'redis:') throw new Error(`REDIS_URL: поддерживается только redis://, получено ${url.protocol}`)
  const timeoutMs = options.timeoutMs ?? 300
  const auth = url.password ? [url.username ? ['AUTH', url.username, url.password] : ['AUTH', url.password]] : []
  const db = url.pathname && url.pathname !== '/' ? [['SELECT', url.pathname.slice(1)]] : []
  const setup = [...auth, ...db]
  let connection: Promise<Connection> | null = null
  let closed = false

  const send = (conn: Connection, parts: string[]): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (conn.socket.destroyed) {
        reject(new Error('redis: соединение закрыто'))
        return
      }
      const timer = setTimeout(() => {
        const index = conn.pending.indexOf(waiter)
        if (index >= 0) conn.pending.splice(index, 1)
        conn.socket.destroy()
        reject(new Error(`redis: таймаут ${timeoutMs} мс`))
      }, timeoutMs)
      const waiter: Pending = {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      }
      conn.pending.push(waiter)
      conn.socket.write(encodeCommand(parts))
    })

  const openSocket = (onClose: () => void): Promise<Connection> =>
    new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) })
      const conn: Connection = { socket, pending: [] }
      let buffer: Buffer = Buffer.alloc(0)
      const failAll = (error: Error) => {
        while (conn.pending.length) conn.pending.shift()!.reject(error)
      }
      // Хост, который молча теряет пакеты, держит connect минутами (таймаут ОС), а кэш стоит
      // на пути каждого запроса: подключение ограничено тем же таймаутом, что и команда.
      const connectTimer = setTimeout(() => socket.destroy(new Error(`redis: подключение дольше ${timeoutMs} мс`)), timeoutMs)
      socket.setNoDelay(true)
      socket.once('connect', () => {
        clearTimeout(connectTimer)
        resolve(conn)
      })
      socket.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data])
        for (;;) {
          let parsed: ReturnType<typeof parseReply>
          try {
            parsed = parseReply(buffer)
          } catch (error) {
            socket.destroy(error as Error)
            return
          }
          if (!parsed) return
          buffer = parsed.rest
          const waiter = conn.pending.shift()
          if (!waiter) continue
          if (parsed.value instanceof Error) waiter.reject(parsed.value)
          else waiter.resolve(parsed.value)
        }
      })
      socket.on('error', (error) => {
        clearTimeout(connectTimer)
        failAll(error)
        reject(error)
      })
      socket.on('close', () => {
        clearTimeout(connectTimer)
        onClose()
        const error = new Error('redis: соединение закрыто')
        failAll(error)
        reject(error)
      })
    })

  // Одно соединение на клиента: параллельные команды ждут общий промис подключения, а не
  // открывают по сокету каждая. AUTH/SELECT выполняются на каждом новом сокете — после
  // переподключения команды не уходят в базу 0 и не падают с NOAUTH.
  const connect = (): Promise<Connection> => {
    if (connection) return connection
    const forget = () => {
      if (connection === attempt) connection = null
    }
    const attempt: Promise<Connection> = openSocket(forget).then(async (conn) => {
      try {
        for (const parts of setup) await send(conn, parts)
      } catch (error) {
        conn.socket.destroy()
        throw error
      }
      return conn
    })
    connection = attempt
    attempt.catch(forget)
    return attempt
  }

  const command = async (parts: string[]): Promise<unknown> => {
    if (closed) throw new Error('redis: клиент закрыт')
    return send(await connect(), parts)
  }

  return {
    async get(key) {
      const value = await command(['GET', key])
      return typeof value === 'string' ? value : null
    },
    async setEx(key, value, ttlSeconds) {
      await command(['SET', key, value, 'EX', String(Math.max(1, Math.floor(ttlSeconds)))])
    },
    close() {
      closed = true
      const current = connection
      connection = null
      current?.then(
        (conn) => conn.socket.destroy(),
        () => {},
      )
    },
  }
}
