import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleInstructor, healthBody } from './handler'

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 100_000) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url?.split('?')[0]
  if (url === '/api/health' && req.method === 'GET') {
    send(res, 200, healthBody())
    return true
  }
  if (url === '/api/instructor' && req.method === 'POST') {
    try {
      const body = await readBody(req)
      const result = await handleInstructor(body)
      send(res, result.status, result.body)
    } catch {
      send(res, 400, { ok: false, error: 'invalid request' })
    }
    return true
  }
  return false
}

export function apiPlugin(): Plugin {
  return {
    name: 'voice-trainer-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await route(req, res)
        if (!handled) next()
      })
    },
  }
}
