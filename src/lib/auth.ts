/**
 * Authentication Utilities
 *
 * Handles JWT token signing/verification and password hashing.
 * Uses JWT_SECRET from environment variables for token security.
 *
 * The JWT_SECRET is read lazily (inside functions) rather than at module
 * load time to ensure environment variables are fully loaded in serverless.
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

/**
 * Get the JWT secret from environment variables.
 * Reads at call-time (not import-time) for serverless compatibility.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('❌ JWT_SECRET is not set in environment variables!')
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

/**
 * Hash a plaintext password using bcryptjs.
 * Uses salt rounds of 12 for strong security.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hashed = await bcrypt.hash(password, 12)
    return hashed
  } catch (error) {
    console.error('❌ Password hashing failed:', error)
    throw new Error('Password hashing failed')
  }
}

/**
 * Compare a plaintext password against a stored hash.
 */
export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashed)
  } catch (error) {
    console.error('❌ Password comparison failed:', error)
    return false
  }
}

/**
 * Sign a JWT token with user payload.
 * Token expires in 7 days.
 */
export function signToken(payload: JWTPayload): string {
  try {
    const secret = getJwtSecret()
    return jwt.sign(payload, secret, { expiresIn: '7d' })
  } catch (error) {
    console.error('❌ JWT signing failed:', error)
    throw new Error('Token generation failed')
  }
}

/**
 * Verify and decode a JWT token.
 * Returns null if the token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = getJwtSecret()
    return jwt.verify(token, secret) as JWTPayload
  } catch (error) {
    // Token expired or invalid — this is expected, not an error
    if (error instanceof jwt.TokenExpiredError) {
      console.log('⚠️ JWT token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('⚠️ Invalid JWT token')
    } else {
      console.error('❌ JWT verification error:', error)
    }
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
  try {
    const cookies = cookieHeader.split(';').reduce((acc, c) => {
      const eqIndex = c.indexOf('=')
      if (eqIndex === -1) return acc
      const key = c.substring(0, eqIndex).trim()
      const val = c.substring(eqIndex + 1).trim()
      acc[key] = val
      return acc
    }, {} as Record<string, string>)
    return cookies['token'] || null
  } catch {
    return null
  }
}
