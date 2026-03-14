import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings } from '../types'
import { generateSalt, hashPassword, verifyPassword, generateSessionToken } from '../lib/auth'
import {
  validateLoginId,
  validateDisplayName,
  validatePassword
} from '../lib/validation'
import { authMiddleware } from '../middleware/auth'

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/auth/register - User registration
 */
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const { loginId, displayName, password, passwordConfirm } = body

    // Validate inputs
    const loginIdValidation = validateLoginId(loginId)
    if (!loginIdValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: loginIdValidation.error
          }
        },
        400
      )
    }

    const displayNameValidation = validateDisplayName(displayName)
    if (!displayNameValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: displayNameValidation.error
          }
        },
        400
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: passwordValidation.error
          }
        },
        400
      )
    }

    if (password !== passwordConfirm) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'パスワードが一致しません'
          }
        },
        400
      )
    }

    const db = c.env.DB

    // Check if login ID already exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE login_id = ?')
      .bind(loginId)
      .first()

    if (existing) {
      return c.json(
        {
          success: false,
          error: {
            code: 'LOGIN_ID_ALREADY_EXISTS',
            message: 'このログインIDは既に使用されています'
          }
        },
        409
      )
    }

    // Generate password hash
    const salt = await generateSalt()
    const passwordHash = await hashPassword(password, salt)

    // Insert user
    const result = await db
      .prepare(
        `INSERT INTO users (login_id, display_name, password_hash, password_salt, role, is_active)
         VALUES (?, ?, ?, ?, 'user', 1)`
      )
      .bind(loginId, displayName.trim(), passwordHash, salt)
      .run()

    const userId = result.meta.last_row_id

    // Create session
    const sessionToken = generateSessionToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await db
      .prepare(
        'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)'
      )
      .bind(userId, sessionToken, expiresAt)
      .run()

    // Set cookie
    setCookie(c, 'session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    return c.json({
      success: true,
      user: {
        id: userId,
        loginId,
        displayName: displayName.trim()
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '登録処理中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * POST /api/auth/login - User login
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { loginId, password } = body

    if (!loginId || !password) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ログインIDとパスワードを入力してください'
          }
        },
        400
      )
    }

    const db = c.env.DB

    // Find user
    const user = await db
      .prepare(
        `SELECT id, login_id, display_name, password_hash, password_salt, role, is_active
         FROM users WHERE login_id = ?`
      )
      .bind(loginId)
      .first()

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ログインIDまたはパスワードが正しくありません'
          }
        },
        401
      )
    }

    // Check if user is active
    if (user.is_active === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'このアカウントは利用停止中です'
          }
        },
        403
      )
    }

    // Verify password
    const isValid = await verifyPassword(
      password,
      user.password_salt as string,
      user.password_hash as string
    )

    if (!isValid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ログインIDまたはパスワードが正しくありません'
          }
        },
        401
      )
    }

    // Create session
    const sessionToken = generateSessionToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await db
      .prepare(
        'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)'
      )
      .bind(user.id, sessionToken, expiresAt)
      .run()

    // Set cookie
    setCookie(c, 'session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    return c.json({
      success: true,
      user: {
        id: user.id,
        loginId: user.login_id,
        displayName: user.display_name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ログイン処理中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * POST /api/auth/logout - User logout
 */
auth.post('/logout', authMiddleware, async (c) => {
  try {
    const sessionToken = c.req.header('Cookie')?.match(/session_token=([^;]+)/)?.[1]

    if (sessionToken) {
      const db = c.env.DB
      await db
        .prepare('DELETE FROM sessions WHERE session_token = ?')
        .bind(sessionToken)
        .run()
    }

    deleteCookie(c, 'session_token', { path: '/' })

    return c.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ログアウト処理中にエラーが発生しました'
        }
      },
      500
    )
  }
})

export default auth
