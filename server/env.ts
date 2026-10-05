import { readFileSync } from 'node:fs'

export function loadLocalEnv(): void {
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && process.env[key] == null) process.env[key] = value
    }
  } catch {
    // A missing .env file is the demo configuration.
  }
}

export interface InstructorConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export function instructorConfig(): InstructorConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim()
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
  }
}
