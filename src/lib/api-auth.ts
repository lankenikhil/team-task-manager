/**
 * API Authentication Helper
 *
 * Shared utility for extracting and verifying the authenticated user
 * from request cookies. Used across all protected API routes.
 *
 * Returns detailed logging for debugging auth issues.
 */

import { NextRequest } from 'next/server'
import { verifyToken, getTokenFromCookies } from '@/lib/auth'
import type { JWTPayload } from '@/lib/auth'

/**
 * Extracts and verifies the authenticated user from the request.
 * Reads the JWT token from the cookie header and validates it.
 *
 * @param request - The incoming Next.js request
 * @returns The decoded JWT payload, or null if not authenticated
 */
export function getAuthUser(request: NextRequest): JWTPayload | null {
  try {
    const cookieHeader = request.headers.get('cookie')

    if (!cookieHeader) {
      return null
    }

    const token = getTokenFromCookies(cookieHeader)

    if (!token) {
      return null
    }

    const payload = verifyToken(token)

    if (!payload) {
      return null
    }

    return payload
  } catch (error) {
    console.error('❌ getAuthUser error:', error)
    return null
  }
}
