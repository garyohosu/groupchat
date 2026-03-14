import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'
import { csrfMiddleware } from './middleware/auth'
import { generateSalt, hashPassword } from './lib/auth'
import auth from './routes/auth'
import users from './routes/users'
import messages from './routes/messages'
import admin from './routes/admin'

const app = new Hono<{ Bindings: Bindings }>()

// CORS for API routes
app.use('/api/*', cors())

// CSRF protection for state-changing requests
app.use('/api/*', csrfMiddleware)

// Mount API routes
app.route('/api/auth', auth)
app.route('/api', users)
app.route('/api/messages', messages)
app.route('/api/admin', admin)

// Admin initialization endpoint (for first-time setup)
app.post('/api/init-admin', async (c) => {
  try {
    const db = c.env.DB

    // Check if admin already exists
    const existing = await db
      .prepare("SELECT id FROM users WHERE login_id = 'admin'")
      .first()

    if (existing) {
      return c.json({ success: false, message: 'Admin already exists' })
    }

    // Create admin user with default password
    const defaultPassword = 'Admin@12345'
    const salt = await generateSalt()
    const passwordHash = await hashPassword(defaultPassword, salt)

    await db
      .prepare(
        `INSERT INTO users (login_id, display_name, password_hash, password_salt, role, is_active)
         VALUES ('admin', '管理者', ?, ?, 'admin', 1)`
      )
      .bind(passwordHash, salt)
      .run()

    return c.json({
      success: true,
      message: 'Admin user created',
      credentials: {
        loginId: 'admin',
        password: defaultPassword
      }
    })
  } catch (error) {
    console.error('Admin init error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// Get user info endpoint (for checking login status)
app.get('/api/me', users)

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>できるかなラボ - グループチャット</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .chat-bubble {
                max-width: 70%;
                word-wrap: break-word;
            }
            .chat-container {
                height: calc(100vh - 120px);
            }
            .message-input {
                resize: none;
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div id="app"></div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
