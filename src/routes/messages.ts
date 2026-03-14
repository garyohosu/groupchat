import { Hono } from 'hono'
import type { Bindings } from '../types'
import { authMiddleware, type AuthContext } from '../middleware/auth'
import { validateMessageBody } from '../lib/validation'

const messages = new Hono<{ Bindings: Bindings }>()

// Rate limiting map (simple in-memory implementation)
const rateLimitMap = new Map<number, number>()

/**
 * GET /api/messages - Get messages
 */
messages.get('/', authMiddleware, async (c: AuthContext) => {
  try {
    const roomId = c.req.query('roomId') || '1'
    const before = c.req.query('before')

    const db = c.env.DB

    let query = `
      SELECT m.id, m.user_id, m.body, m.is_deleted, m.created_at, m.updated_at,
             u.display_name, u.login_id
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
    `
    const params: any[] = [parseInt(roomId)]

    if (before) {
      query += ' AND m.id < ?'
      params.push(parseInt(before))
    }

    query += ' ORDER BY m.id DESC LIMIT 50'

    const result = await db.prepare(query).bind(...params).all()

    const messagesList = result.results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      loginId: row.login_id,
      body: row.is_deleted === 1 ? '' : row.body,
      isDeleted: row.is_deleted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    // Reverse to get chronological order
    messagesList.reverse()

    return c.json({
      messages: messagesList,
      hasMore: result.results.length === 50
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'メッセージの取得中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * GET /api/messages/changes - Get message changes (for polling)
 */
messages.get('/changes', authMiddleware, async (c: AuthContext) => {
  try {
    const roomId = c.req.query('roomId') || '1'
    const since = c.req.query('since')

    if (!since) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sinceパラメータが必要です'
          }
        },
        400
      )
    }

    const db = c.env.DB

    const result = await db
      .prepare(
        `SELECT m.id, m.user_id, m.body, m.is_deleted, m.created_at, m.updated_at,
                u.display_name, u.login_id
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.room_id = ? AND m.updated_at > ?
         ORDER BY m.id ASC`
      )
      .bind(parseInt(roomId), since)
      .all()

    const changesList = result.results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      loginId: row.login_id,
      body: row.is_deleted === 1 ? '' : row.body,
      isDeleted: row.is_deleted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return c.json({
      messages: changesList
    })
  } catch (error) {
    console.error('Get changes error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'メッセージ変更の取得中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * POST /api/messages - Post a message
 */
messages.post('/', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const { roomId, body: messageBody } = body

    // Validate message body
    const bodyValidation = validateMessageBody(messageBody)
    if (!bodyValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyValidation.error
          }
        },
        400
      )
    }

    // Rate limiting (2 seconds)
    const now = Date.now()
    const lastPost = rateLimitMap.get(user.id) || 0
    if (now - lastPost < 2000) {
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: '投稿は2秒に1回までです'
          }
        },
        429
      )
    }
    rateLimitMap.set(user.id, now)

    const db = c.env.DB

    // Insert message
    const result = await db
      .prepare(
        `INSERT INTO messages (user_id, room_id, body)
         VALUES (?, ?, ?)`
      )
      .bind(user.id, roomId || 1, messageBody.trim())
      .run()

    const messageId = result.meta.last_row_id

    // Get the created message
    const message = await db
      .prepare(
        `SELECT m.id, m.user_id, m.body, m.is_deleted, m.created_at, m.updated_at,
                u.display_name, u.login_id
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.id = ?`
      )
      .bind(messageId)
      .first()

    return c.json({
      success: true,
      message: {
        id: message.id,
        userId: message.user_id,
        displayName: message.display_name,
        loginId: message.login_id,
        body: message.body,
        isDeleted: false,
        createdAt: message.created_at,
        updatedAt: message.updated_at
      }
    })
  } catch (error) {
    console.error('Post message error:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'メッセージ送信中にエラーが発生しました'
        }
      },
      500
    )
  }
})

/**
 * DELETE /api/messages/:id - Delete own message
 */
messages.delete('/:id', authMiddleware, async (c: AuthContext) => {
  try {
    const user = c.get('user')
    const messageId = c.req.param('id')

    const db = c.env.DB

    // Check if message exists and belongs to user (or user is admin)
    const message = await db
      .prepare('SELECT user_id FROM messages WHERE id = ?')
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

    if (message.user_id !== user.id && user.role !== 'admin') {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '自分のメッセージのみ削除できます'
          }
        },
        403
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
    console.error('Delete message error:', error)
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
})

export default messages
