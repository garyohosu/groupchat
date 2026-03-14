import { Hono } from 'hono'
import type { Bindings } from '../types'
import { authMiddleware, type AuthContext } from '../middleware/auth'
import { validateDisplayName, validateBio } from '../lib/validation'

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
users.get('/', authMiddleware, async (c: AuthContext) => {
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
