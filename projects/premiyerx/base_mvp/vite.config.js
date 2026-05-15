import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function resolveDeploySha() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  if (fromVercel) return fromVercel
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
}

const deploySha = resolveDeploySha()

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  define: {
    __DEPLOY_SHA__: JSON.stringify(deploySha),
  },
})
