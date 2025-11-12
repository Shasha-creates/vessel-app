import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'

export type AuthenticatedUser = {
  id: string
  email: string
  handle: string
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedUser
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload & Partial<AuthenticatedUser>
    const id = typeof payload.sub === 'string' ? payload.sub : payload.id
    if (!id || !payload.email || !payload.handle) {
      return res.status(401).json({ message: 'Invalid token payload' })
    }
    req.authUser = {
      id,
      email: payload.email,
      handle: payload.handle,
    }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
