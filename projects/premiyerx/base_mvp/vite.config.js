import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Short git SHA on Vercel builds — verify footer matches GitHub deploy. */
const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  define: {
    __DEPLOY_SHA__: JSON.stringify(deploySha),
  },
})
