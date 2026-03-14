export type Bindings = {
  DB: D1Database
}

export type User = {
  id: number
  loginId: string
  displayName: string
  passwordHash: string
  passwordSalt: string
  bio: string | null
  role: 'user' | 'admin'
  isActive: number
  createdAt: string
  updatedAt: string
}

export type Message = {
  id: number
  userId: number
  roomId: number
  body: string
  isDeleted: number
  createdAt: string
  updatedAt: string
}

export type Session = {
  id: number
  userId: number
  sessionToken: string
  expiresAt: string
  createdAt: string
}

export type Room = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

export type AuthenticatedUser = {
  id: number
  loginId: string
  displayName: string
  bio: string | null
  role: 'user' | 'admin'
  createdAt: string
}
