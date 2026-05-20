/**
 * Auth Me API Route
 *
 * Returns the currently authenticated user's profile.
 * Reads the JWT token from the cookie header and verifies it.
 * Used by the frontend to check session status on page load.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromCookies } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Extract and verify token from cookies BEFORE connecting to DB
    // This avoids unnecessary DB connections for unauthenticated requests
    const cookieHeader = request.headers.get('cookie')
    const token = getTokenFromCookies(cookieHeader)

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Find user by ID from token (exclude password)
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Auth me error:', err.message || err)
    console.error('   Stack:', err.stack?.split('\n').slice(0, 3).join('\n'))

    return NextResponse.json(
      { success: false, error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}
