/**
 * Client-side encryption for the cloud vault.
 *
 * The vault blob is stored at a deterministic, publicly reachable path, so anything
 * sensitive (API keys, voice corpus) MUST be encrypted before it ever leaves the device.
 * We derive an AES-GCM key from the user's sync passphrase with PBKDF2 (per-payload salt),
 * so the server and the public blob only ever see ciphertext.
 *
 * Envelope format (JSON-serializable):
 *   { v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter, salt, iv, ct }   // base64 fields
 */

const PBKDF2_ITERATIONS = 150_000
const SALT_BYTES = 16
const IV_BYTES = 12

function hasWebCrypto() {
  return typeof crypto !== 'undefined' && !!crypto.subtle?.deriveKey
}

function normalizePassphrase(passphrase) {
  // Must match deriveSyncIdFromPassphrase normalization so the same phrase works everywhere.
  return String(passphrase || '').trim().toLowerCase()
}

function bytesToBase64(bytes) {
  let bin = ''
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin)
}

function base64ToBytes(b64) {
  const bin = atob(String(b64 || ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveAesKey(passphrase, salt) {
  const enc = new TextEncoder().encode(normalizePassphrase(passphrase))
  const baseKey = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt a JSON-serializable object. Returns an envelope object or null if crypto is unavailable. */
export async function encryptVaultPayload(payload, passphrase) {
  if (!hasWebCrypto()) return null
  const pass = normalizePassphrase(passphrase)
  if (pass.length < 8) return null
  try {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const key = await deriveAesKey(pass, salt)
    const plaintext = new TextEncoder().encode(JSON.stringify(payload ?? {}))
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    return {
      v: 1,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ct: bytesToBase64(new Uint8Array(ctBuf)),
    }
  } catch {
    return null
  }
}

/** Decrypt an envelope produced by encryptVaultPayload. Returns the object or null on failure. */
export async function decryptVaultPayload(envelope, passphrase) {
  if (!hasWebCrypto() || !envelope || typeof envelope !== 'object') return null
  const pass = normalizePassphrase(passphrase)
  if (pass.length < 8) return null
  try {
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const ct = base64ToBytes(envelope.ct)
    const key = await deriveAesKey(pass, salt)
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    const text = new TextDecoder().decode(buf)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function isVaultEnvelope(value) {
  return !!value && typeof value === 'object' && value.alg === 'AES-GCM' && typeof value.ct === 'string'
}
