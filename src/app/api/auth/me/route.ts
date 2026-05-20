/**
 * Auth Me API Route
 *
 * Returns the currently authenticated user's profile.
 * Reads the JWT token from the cookie header and verifies it.
 * Uses Mongoose + MongoDB Atlas.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { verifyToken, getTokenFromCookies } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Extract and verify token from cookies BEFORE connecting to DB
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

    await connectDB()

    // Find user by ID from token (exclude password)
    const user = await User.findById(payload.userId).select('-password')

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user._id.toString(),
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
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
