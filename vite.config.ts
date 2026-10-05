import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiPlugin } from './server/devPlugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.AI_API_KEY && env.AI_API_KEY) process.env.AI_API_KEY = env.AI_API_KEY
  if (!process.env.AI_BASE_URL && env.AI_BASE_URL) process.env.AI_BASE_URL = env.AI_BASE_URL
  if (!process.env.AI_MODEL && env.AI_MODEL) process.env.AI_MODEL = env.AI_MODEL

  return {
    plugins: [react(), apiPlugin()],
    server: { port: 5173 },
  }
})
