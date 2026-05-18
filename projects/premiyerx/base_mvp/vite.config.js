import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function resolveDeploySha() {
  const fromGitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  if (fromGitSha) return fromGitSha
  // CLI / directory uploads often have no .git and no VERCEL_GIT_COMMIT_SHA; deployment id is always set on Vercel.
  const deployId = process.env.VERCEL_DEPLOYMENT_ID?.replace(/^dpl_/, '') || ''
  if (deployId.length >= 7) return deployId.slice(0, 7)
  if (deployId) return deployId
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
