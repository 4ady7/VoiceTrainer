import { createReadStream, existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLocalEnv } from './env'
import { handleInstructor, healthBody } from './handler'

loadLocalEnv()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT || 4173)

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/'
  if (url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, healthBody())
    return
  }
  if (url === '/api/instructor' && req.method === 'POST') {
    try {
      const result = await handleInstructor(await readBody(req))
      sendJson(res, result.status, result.body)
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid request' })
    }
    return
  }

  const requested = url === '/' ? '/index.html' : url
  const filePath = path.normalize(path.join(root, requested))
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  res.setHeader('content-type', types[path.extname(filePath)] || 'application/octet-stream')
  createReadStream(filePath).pipe(res)
})

server.listen(port, () => {
  console.log(`Voice Trainer listening on http://localhost:${port}`)
})
