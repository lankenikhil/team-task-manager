/**
 * Users API Route
 *
 * GET - List all users with task and project counts (admin only).
 * Used by the Team Members page and project member management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/users - List all users with counts
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    if (auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can view all users' },
        { status: 403 }
      )
    }

    // Fetch all users with counts using Prisma's _count
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            assignedTasks: true,
            projectMembers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const data = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      _count: {
        assignedTasks: user._count.assignedTasks,
        projectMembers: user._count.projectMembers,
      },
    }))

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Get users error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
