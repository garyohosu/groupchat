// PBKDF2-SHA-256 password hashing utilities
// Cloudflare Workers の上限に合わせて iterations は 100,000 以下

const ITERATIONS = 100000
const SALT_LENGTH = 16
const HASH_LENGTH = 32

/**
 * Generate a random salt
 */
export async function generateSalt(): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)
  return arrayBufferToBase64(salt)
}

/**
 * Hash a password using PBKDF2-SHA-256
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = base64ToArrayBuffer(salt)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    HASH_LENGTH * 8
  )

  return arrayBufferToBase64(new Uint8Array(hashBuffer))
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  const computedHash = await hashPassword(password, salt)
  return computedHash === hash
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return arrayBufferToBase64(buffer)
}

// Helper functions
function arrayBufferToBase64(buffer: Uint8Array): string {
  const binary = String.fromCharCode(...buffer)
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}
