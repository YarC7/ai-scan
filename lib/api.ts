import type { OrderLabel } from './types'

export async function scanLabel(dataUrl: string): Promise<OrderLabel> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || `API error ${res.status}`)
  }

  return res.json()
}
