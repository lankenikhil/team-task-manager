/**
 * Login API Route
 *
 * Authenticates a user with email and password,
 * generates a JWT token, and sets it as an HTTP-only cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      console.log(`⚠️ Login attempt with unregistered email: ${email}`)
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const valid = await comparePassword(password, user.password)
    if (!valid) {
      console.log(`⚠️ Invalid password for user: ${email}`)
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    console.log(`✅ User logged in: ${email} (${user.role})`)

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Build response with user data (excluding password)
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    })

    // Set HTTP-only cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Login error:', err.message || err)
    console.error('   Stack:', err.stack?.split('\n').slice(0, 3).join('\n'))

    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}
