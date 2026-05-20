/**
 * Users API Route
 *
 * GET - List all users with task and project counts (admin only).
 * Used by the Team Members page and project member management.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Task from '@/models/Task'
import ProjectMember from '@/models/ProjectMember'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/users - List all users with counts
export async function GET(request: NextRequest) {
  try {
    await connectDB()

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

    // Fetch all users (excluding passwords)
    const users = await User.find({}).select('-password').sort({ createdAt: -1 })

    // Build response with task and project counts for each user
    const data = await Promise.all(
      users.map(async (user) => {
        const [assignedTasks, projectMembers] = await Promise.all([
          Task.countDocuments({ assignedToId: user._id }),
          ProjectMember.countDocuments({ userId: user._id }),
        ])

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          _count: {
            assignedTasks,
            projectMembers,
          },
        }
      })
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
