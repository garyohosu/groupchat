// Validation utilities based on spec.md requirements

export type ValidationResult = {
  valid: boolean
  error?: string
}

/**
 * Validate login ID
 * Rule: ^[a-zA-Z0-9_.-]{3,20}$
 */
export function validateLoginId(loginId: string): ValidationResult {
  if (!loginId || typeof loginId !== 'string') {
    return { valid: false, error: 'ログインIDは必須です' }
  }

  const regex = /^[a-zA-Z0-9_.-]{3,20}$/
  if (!regex.test(loginId)) {
    return {
      valid: false,
      error: 'ログインIDは3〜20文字の半角英数字、アンダースコア、ハイフン、ドットのみ使用できます'
    }
  }

  return { valid: true }
}

/**
 * Validate display name
 * Rule: 1-20 characters
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName || typeof displayName !== 'string') {
    return { valid: false, error: '表示名は必須です' }
  }

  const trimmed = displayName.trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: '表示名は1〜20文字で入力してください' }
  }

  return { valid: true }
}

/**
 * Validate password
 * Rule: 8-128 characters
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'パスワードは必須です' }
  }

  if (password.length < 8 || password.length > 128) {
    return { valid: false, error: 'パスワードは8〜128文字で入力してください' }
  }

  return { valid: true }
}

/**
 * Validate bio
 * Rule: 0-160 characters
 */
export function validateBio(bio: string | null | undefined): ValidationResult {
  if (!bio) {
    return { valid: true }
  }

  if (typeof bio !== 'string') {
    return { valid: false, error: '自己紹介の形式が正しくありません' }
  }

  if (bio.length > 160) {
    return { valid: false, error: '自己紹介は160文字以内で入力してください' }
  }

  return { valid: true }
}

/**
 * Validate message body
 * Rule: 1-500 characters
 */
export function validateMessageBody(body: string): ValidationResult {
  if (!body || typeof body !== 'string') {
    return { valid: false, error: 'メッセージは必須です' }
  }

  const trimmed = body.trim()
  if (trimmed.length < 1) {
    return { valid: false, error: 'メッセージを入力してください' }
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'メッセージは500文字以内で入力してください' }
  }

  return { valid: true }
}
