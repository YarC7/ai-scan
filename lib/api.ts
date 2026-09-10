import type { OrderLabel } from './types'

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number | null

  constructor(message: string, retryAfterSeconds: number | null) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
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
    if (res.status === 429) {
      const raw = data?.retryAfterSeconds
      const seconds = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
      throw new RateLimitError(data?.error || 'Too many requests — the AI service is rate limited.', seconds)
    }
    throw new Error(data?.error || `API error ${res.status}`)
  }

  return res.json()
}
