import { Hono } from 'hono'
import type { Bindings } from '../types'
import { authMiddleware, adminMiddleware, type AuthContext } from '../middleware/auth'

const admin = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/admin/users - Get all users (admin only)
 */
admin.get('/users', authMiddleware, adminMiddleware, async (c: AuthContext) => {
  try {
    const db = c.env.DB

    const result = await db
      .prepare(
        `SELECT id, login_id, display_name, bio, role, is_active, created_at
         FROM users
         ORDER BY created_at DESC`
      )
      .all()

    const usersList = result.results.map((row: any) => ({
      id: row.id,
      loginId: row.login_id,
      displayName: row.display_name,
      bio: row.bio,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at
    }))

    return c.json({
      users: usersList
    })
  } catch (error) {
    console.error('Admin get users error:', error)
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

/**
 * PATCH /api/admin/users/:id/status - Toggle user active status
 */
admin.patch(
  '/users/:id/status',
  authMiddleware,
  adminMiddleware,
  async (c: AuthContext) => {
    try {
      const userId = c.req.param('id')
      const body = await c.req.json()
      const { isActive } = body

      if (typeof isActive !== 'number' || (isActive !== 0 && isActive !== 1)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'isActiveは0または1である必要があります'
            }
          },
          400
        )
      }

      const db = c.env.DB

      // Update user status
      await db
        .prepare(
          `UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(isActive, userId)
        .run()

      // If disabling user, delete all their sessions
      if (isActive === 0) {
        await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Admin update user status error:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'ユーザーステータス更新中にエラーが発生しました'
          }
        },
        500
      )
    }
  }
)

/**
 * DELETE /api/admin/messages/:id - Delete any message (admin only)
 */
admin.delete(
  '/messages/:id',
  authMiddleware,
  adminMiddleware,
  async (c: AuthContext) => {
    try {
      const messageId = c.req.param('id')

      const db = c.env.DB

      // Check if message exists
      const message = await db
        .prepare('SELECT id FROM messages WHERE id = ?')
        .bind(messageId)
        .first()

      if (!message) {
        return c.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'メッセージが見つかりません'
            }
          },
          404
        )
      }

      // Logical delete
      await db
        .prepare(
          `UPDATE messages SET is_deleted = 1, body = '', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(messageId)
        .run()

      return c.json({ success: true })
    } catch (error) {
      console.error('Admin delete message error:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'メッセージ削除中にエラーが発生しました'
          }
        },
        500
      )
    }
  }
)

export default admin
