import type { ReduceResult } from '../scenario/types'
import type { DebriefReport } from '../scenario/debrief'

export function replyAcceptable(reply: string, result: ReduceResult): boolean {
  const text = reply.trim()
  if (!text || text.length > 420) return false
  const sentences = text.match(/[^.!?]+[.!?]+/g)
  if (sentences && sentences.length > 4) return false
  if (/\b\d{1,3}\s*%/.test(text) || /\bscore\b/i.test(text)) return false
  if (!result.completedNow && /diagnosis confirmed|session complete|final score|you passed/i.test(text)) return false
  if (result.wrongDiagnosis && /you(?:'re| are) right|that is the fault|correct fault/i.test(text)) return false
  return true
}

export function coachingAcceptable(text: string, report: DebriefReport): boolean {
  const coaching = text.trim()
  if (coaching.length < 40 || coaching.length > 700) return false
  if (/\b\d{1,3}\s*%/.test(coaching) || /\bscore\b/i.test(coaching)) return false
  const mentioned = coaching.match(/overall(?:\s+mark)?\s*(?:of\s*)?(\d{1,3})/i)
  if (mentioned && Number(mentioned[1]) !== report.overall) return false
  if (!report.completed && /diagnosis confirmed/i.test(coaching)) return false
  return true
}
