/**
 * Tiny Node ESM resolver hook so the reach harness can import the same source files Vite
 * builds without rewriting every `import './foo'` to `'./foo.js'`. For relative specifiers
 * that lack an extension, try `.js` and (for jsx) `.jsx` before giving up.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as pathResolve } from 'node:path'

function hasExt(spec) {
  return /\.[a-zA-Z0-9]+(\?.*)?$/.test(spec)
}

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !hasExt(specifier)) {
    const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd()
    for (const ext of ['.js', '.mjs', '.jsx']) {
      const candidate = pathResolve(parent, `${specifier}${ext}`)
      if (existsSync(candidate)) {
        return nextResolve(`${specifier}${ext}`, context)
      }
    }
  }
  return nextResolve(specifier, context)
}
