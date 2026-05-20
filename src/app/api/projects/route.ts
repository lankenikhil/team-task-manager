/**
 * Projects API Route
 *
 * GET  - List projects (admins see all, members see only their projects)
 * POST - Create a new project (admin only). Creator is auto-added as member.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import Task from '@/models/Task'
import User from '@/models/User'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Build a project response object with populated relations.
 * Mimics Prisma's include behavior using manual MongoDB lookups.
 */
async function buildProjectResponse(project: InstanceType<typeof Project>) {
  const [createdBy, members, taskCount, memberCount] = await Promise.all([
    User.findById(project.createdById).select('name email role'),
    ProjectMember.find({ projectId: project._id })
      .then(async (pms) => {
        const userIds = pms.map((pm) => pm.userId)
        const users = await User.find({ _id: { $in: userIds } }).select('name email role')
        const userMap = new Map(users.map((u) => [u._id.toString(), u]))
        return pms.map((pm) => ({
          id: pm._id.toString(),
          userId: pm.userId.toString(),
          projectId: pm.projectId.toString(),
          createdAt: pm.createdAt,
          user: userMap.get(pm.userId.toString())
            ? {
                id: userMap.get(pm.userId.toString())!._id.toString(),
                name: userMap.get(pm.userId.toString())!.name,
                email: userMap.get(pm.userId.toString())!.email,
                role: userMap.get(pm.userId.toString())!.role,
              }
            : null,
        }))
      }),
    Task.countDocuments({ projectId: project._id }),
    ProjectMember.countDocuments({ projectId: project._id }),
  ])

  return {
    id: project._id.toString(),
    title: project.title,
    description: project.description,
    createdById: project.createdById.toString(),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: createdBy
      ? {
          id: createdBy._id.toString(),
          name: createdBy.name,
          email: createdBy.email,
          role: createdBy.role,
        }
      : null,
    members,
    _count: {
      tasks: taskCount,
      members: memberCount,
    },
  }
}

// GET /api/projects - List projects
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

    let projects: InstanceType<typeof Project>[]

    if (auth.role === 'admin') {
      // Admins can see all projects
      projects = await Project.find({}).sort({ createdAt: -1 })
    } else {
      // Members see only projects they created or are members of
      const memberEntries = await ProjectMember.find({ userId: auth.userId }).select('projectId')
      const projectIds = memberEntries.map((m) => m.projectId)

      projects = await Project.find({
        $or: [
          { createdById: auth.userId },
          { _id: { $in: projectIds } },
        ],
      }).sort({ createdAt: -1 })
    }

    // Build full response for each project
    const data = await Promise.all(projects.map(buildProjectResponse))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create project
export async function POST(request: NextRequest) {
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
        { success: false, error: 'Only admins can create projects' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, memberIds } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Create the project
    const project = await Project.create({
      title,
      description: description || '',
      createdById: auth.userId,
    })

    // Add creator as a member
    await ProjectMember.create({
      userId: auth.userId,
      projectId: project._id,
    })

    // Add other members (if provided)
    if (memberIds?.length) {
      const memberDocs = memberIds.map((uid: string) => ({
        userId: uid,
        projectId: project._id,
      }))
      await ProjectMember.insertMany(memberDocs)
    }

    // Re-fetch to get timestamps
    const savedProject = await Project.findById(project._id)
    const data = await buildProjectResponse(savedProject!)

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
