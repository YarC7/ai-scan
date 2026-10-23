import type { OrderLabel } from './types'

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number | null

  constructor(message: string, retryAfterSeconds: number | null) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class NetworkRestrictedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkRestrictedError'
  }
}

export async function scanLabel(dataUrl: string): Promise<OrderLabel> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    if (res.status === 403 && data?.code === 'IP_NOT_ALLOWED') {
      throw new NetworkRestrictedError(
        data?.error || 'This device is not connected to the store WiFi.',
      )
    }
    if (res.status === 401 || res.status === 403) {
      throw new UnauthorizedError(data?.error || 'You need to sign in to continue.')
    }
    if (res.status === 429) {
      const raw = data?.retryAfterSeconds
      const seconds = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
      throw new RateLimitError(data?.error || 'Too many requests — the AI service is rate limited.', seconds)
    }
    throw new Error(data?.error || `API error ${res.status}`)
  }

  return res.json()
}
