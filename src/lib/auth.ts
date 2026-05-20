/**
 * Authentication Utilities
 *
 * Handles JWT token signing/verification and password hashing.
 * Uses JWT_SECRET from environment variables for token security.
 * In production, the secret MUST be set via environment variable.
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// JWT secret — must be set via environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ JWT_SECRET environment variable is not set. Using fallback in production is insecure.')
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

/**
 * Hash a plaintext password using bcryptjs.
 * Uses salt rounds of 12 for strong security.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/**
 * Compare a plaintext password against a stored hash.
 */
export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed)
}

/**
 * Sign a JWT token with user payload.
 * Token expires in 7 days.
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Verify and decode a JWT token.
 * Returns null if the token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Extract JWT token from Authorization header (Bearer token).
 */
export function getTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * Extract JWT token from cookie header string.
 * Parses the cookie header and looks for the 'token' cookie.
 */
export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').reduce((acc, c) => {
    const [key, val] = c.trim().split('=')
    acc[key] = val
    return acc
  }, {} as Record<string, string>)
  return cookies['token'] || null
}
