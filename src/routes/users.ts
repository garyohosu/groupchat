import { Hono } from 'hono'
import type { Bindings } from '../types'
import { authMiddleware, type AuthContext } from '../middleware/auth'
import { validateDisplayName, validateBio, validatePassword } from '../lib/validation'
import { hashPassword, verifyPassword, generateSalt } from '../lib/auth'

const users = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/me - Get current user info
 */
users.get('/me', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.get('user')

    return c.json({
      id: user.id,
      loginId: user.loginId,
      displayName: user.displayName,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt
    })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ユーザー情報の取得中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * PUT /api/me - Update user profile
 */
users.put('/me', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const { displayName, bio } = body

    // Validate display name
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

    // Validate bio
    const bioValidation = validateBio(bio)
    if (!bioValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: bioValidation.error
          }
        },
        400
      )
    }

    const db = c.env.DB

    // Update user
    await db
      .prepare(
        `UPDATE users SET display_name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(displayName.trim(), bio || null, user.id)
      .run()

    return c.json({
      success: true,
      user: {
        id: user.id,
        loginId: user.loginId,
        displayName: displayName.trim(),
        bio: bio || null,
        role: user.role,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'プロフィール更新中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * GET /api/users - Get user list (for regular users)
 */
/**
 * PUT /api/me/password - Change own password
 */
users.put('/me/password', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const { currentPassword, newPassword, newPasswordConfirm } = body

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '現在のパスワードと新しいパスワードを入力してください'
          }
        },
        400
      )
    }

    const passwordValidation = validatePassword(newPassword)
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

    if (newPassword !== newPasswordConfirm) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '新しいパスワードが一致しません'
          }
        },
        400
      )
    }

    const db = c.env.DB

    const row = await db
      .prepare('SELECT password_hash, password_salt FROM users WHERE id = ?')
      .bind(user.id)
      .first()

    if (!row) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'ユーザーが見つかりません'
          }
        },
        404
      )
    }

    const ok = await verifyPassword(
      currentPassword,
      row.password_salt as string,
      row.password_hash as string
    )

    if (!ok) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '現在のパスワードが正しくありません'
          }
        },
        401
      )
    }

    const newSalt = await generateSalt()
    const newHash = await hashPassword(newPassword, newSalt)

    await db
      .prepare(
        `UPDATE users
         SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(newHash, newSalt, user.id)
      .run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'パスワード変更中にエラーが発生しました'
        }
      },
      500
    )
  }
})

users.get('/users', authMiddleware, async (c: AuthContext) => {
  try {
    const db = c.env.DB

    const result = await db
      .prepare(
        `SELECT id, display_name, bio, created_at
         FROM users
         WHERE is_active = 1
         ORDER BY created_at DESC`
      )
      .all()

    const usersList = result.results.map((row: any) => ({
      id: row.id,
      displayName: row.display_name,
      bio: row.bio,
      createdAt: row.created_at
    }))

    return c.json({
      users: usersList
    })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'ユーザー一覧の取得中にエラーが発生しました'
        }
      },
      500
    )
  }
})

export default users
