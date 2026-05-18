import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

/** Shown in the footer so non-developers know when this bundle was built (UTC). */
const buildDateLabel = new Date().toLocaleString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

/** Stamp index.html + manifest so PWAs and phones can detect new production deploys. */
function buildStampPlugin({ sha, builtAt }) {
  const safeSha = String(sha).replace(/"/g, '')
  const safeBuiltAt = String(builtAt).replace(/"/g, '')
  // Inline object so the footer can read it before / alongside the module bundle (avoids stale cached JS showing an old build time).
  const inlineStamp = JSON.stringify({ sha, builtAt }).replace(/</g, '\\u003c')
  return {
    name: 'lidp-build-stamp',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (html.includes('name="app-build"')) return html
        return html.replace(
          '</head>',
          `    <meta name="app-build" content="${safeSha}" />\n    <meta name="app-built-at" content="${safeBuiltAt}" />\n    <script>window.__LIDP_BUILD_STAMP__=${inlineStamp}</script>\n  </head>`,
        )
      },
    },
    closeBundle() {
      const manifestSrc = resolve(__dirname, 'public/manifest.json')
      const manifestDist = resolve(__dirname, 'dist/manifest.json')
      if (!existsSync(manifestSrc) || !existsSync(resolve(__dirname, 'dist'))) return
      const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'))
      manifest.start_url = `/?build=${encodeURIComponent(safeSha)}`
      writeFileSync(manifestDist, `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

export default defineConfig({
  plugins: [react(), buildStampPlugin({ sha: deploySha, builtAt: buildDateLabel })],
  server: { port: 5180 },
  define: {
    __DEPLOY_SHA__: JSON.stringify(deploySha),
    __BUILD_DATE__: JSON.stringify(buildDateLabel),
  },
})
