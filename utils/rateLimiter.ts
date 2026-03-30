export interface RateLimitSlot {
  key: string
  timestamp: number
}

export interface RateLimiterOptions {
  window?: number
  maxPerWindow?: number
  maxPerEndpoint?: number
  endpointLimits?: Record<string, number>
}

export class RateLimiter {
  private requestTimestamps: Map<string, number[]> = new Map()
  private globalTimestamps: number[] = []
  private readonly window: number
  private readonly maxPerWindow: number
  private readonly maxPerEndpoint: number
  private readonly endpointLimits: Record<string, number>

  constructor(options: RateLimiterOptions = {}) {
    this.window = options.window ?? 60_000
    this.maxPerWindow = options.maxPerWindow ?? 100
    this.maxPerEndpoint = options.maxPerEndpoint ?? 20
    this.endpointLimits = options.endpointLimits ?? {}
  }

  private getEndpointLimit(key: string): number {
    return this.endpointLimits[key] ?? this.maxPerEndpoint
  }

  acquire(endpoint: string): RateLimitSlot | null {
    const now = Date.now()
    const cutoff = now - this.window
    const key = endpoint.split('?')[0]

    // Trim global timestamps
    while (this.globalTimestamps.length > 0 && this.globalTimestamps[0] < cutoff) {
      this.globalTimestamps.shift()
    }

    if (this.globalTimestamps.length >= this.maxPerWindow) {
      console.warn('Global rate limit exceeded')
      return null
    }

    // Trim per-endpoint timestamps
    const timestamps = this.requestTimestamps.get(key)
    if (timestamps) {
      while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift()
      }
      if (timestamps.length === 0) {
        this.requestTimestamps.delete(key)
      }
    }

    const current = this.requestTimestamps.get(key)
    const endpointLimit = this.getEndpointLimit(key)
    if (current && current.length >= endpointLimit) {
      console.warn(`Rate limit exceeded for endpoint: ${key}`)
      return null
    }

    this.globalTimestamps.push(now)
    if (current) {
      current.push(now)
    } else {
      this.requestTimestamps.set(key, [now])
    }

    return { key, timestamp: now }
  }

  release(slot: RateLimitSlot): void {
    const endpointTimestamps = this.requestTimestamps.get(slot.key)
    if (endpointTimestamps && endpointTimestamps.length > 0) {
      const index = endpointTimestamps.lastIndexOf(slot.timestamp)
      if (index >= 0) {
        endpointTimestamps.splice(index, 1)
      } else {
        endpointTimestamps.pop()
      }

      if (endpointTimestamps.length === 0) {
        this.requestTimestamps.delete(slot.key)
      }
    }

    const globalIndex = this.globalTimestamps.lastIndexOf(slot.timestamp)
    if (globalIndex >= 0) {
      this.globalTimestamps.splice(globalIndex, 1)
    } else if (this.globalTimestamps.length > 0) {
      this.globalTimestamps.pop()
    }
  }
}
