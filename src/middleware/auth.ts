import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, User, AuthenticatedUser } from '../types'

type Variables = {
  user: AuthenticatedUser
}

export type AuthContext = Context<{ Bindings: Bindings; Variables: Variables }>

/**
 * Authentication middleware
 * Verifies session token and attaches user to context
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const sessionToken = getCookie(c, 'session_token')

  if (!sessionToken) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ログインが必要です'
        }
      },
      401
    )
  }

  const db = c.env.DB

  // Find session and check expiration
  const session = await db
    .prepare(
      `SELECT s.*, u.id, u.login_id, u.display_name, u.bio, u.role, u.is_active, u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > datetime('now')`
    )
    .bind(sessionToken)
    .first()

  if (!session) {
    // Delete expired or invalid session
    await db.prepare('DELETE FROM sessions WHERE session_token = ?').bind(sessionToken).run()

    return c.json(
      {
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'セッションが期限切れです。再度ログインしてください'
        }
      },
      401
    )
  }

  // Check if user is active
  if (session.is_active === 0) {
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

  // Attach user to context
  const user: AuthenticatedUser = {
    id: session.id,
    loginId: session.login_id,
    displayName: session.display_name,
    bio: session.bio,
    role: session.role,
    createdAt: session.created_at
  }

  c.set('user', user)
  await next()
}

/**
 * Admin-only middleware
 * Must be used after authMiddleware
 */
export async function adminMiddleware(c: AuthContext, next: Next) {
  const user = c.get('user')

  if (user.role !== 'admin') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '管理者権限が必要です'
        }
      },
      403
    )
  }

  await next()
}

/**
 * CSRF protection middleware
 * Verifies Origin header for state-changing requests
 */
export async function csrfMiddleware(c: Context, next: Next) {
  const method = c.req.method

  // Only check for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = c.req.header('Origin')
    const host = c.req.header('Host')

    if (origin && host) {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'CSRF検証に失敗しました'
            }
          },
          403
        )
      }
    }
  }

  await next()
}
