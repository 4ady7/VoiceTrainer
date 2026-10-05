export interface RecentLine {
  speaker: string
  text: string
}

async function post(task: string, body: Record<string, unknown>, timeoutMs: number): Promise<unknown | null> {
  try {
    const response = await fetch('/api/instructor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const body = (await response.json()) as { live?: boolean }
    return Boolean(body.live)
  } catch {
    return false
  }
}

export async function fetchInterpretation(input: {
  utterance: string
  snapshot: unknown
  recent: RecentLine[]
}): Promise<unknown | null> {
  const body = (await post('interpret', input, 12000)) as { ok?: boolean; interpretation?: unknown } | null
  if (!body?.ok) return null
  return body.interpretation ?? null
}

export async function fetchPhrase(input: {
  utterance: string
  template: string
  facts: unknown
  snapshot: unknown
}): Promise<string | null> {
  const body = (await post('phrase', input, 12000)) as { ok?: boolean; reply?: string } | null
  if (!body?.ok || typeof body.reply !== 'string') return null
  return body.reply
}

export async function fetchCoaching(debrief: unknown): Promise<string | null> {
  const body = (await post('debrief', { debrief }, 12000)) as { ok?: boolean; coaching?: string } | null
  if (!body?.ok || typeof body.coaching !== 'string') return null
  return body.coaching
}
