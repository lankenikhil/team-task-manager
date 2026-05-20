/**
 * Project Detail API Route
 *
 * GET    - Get a single project with members, tasks, and creator info
 * PUT    - Update a project (title, description, add/remove members)
 * DELETE - Delete a project and all its associated data
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import Task from '@/models/Task'
import User from '@/models/User'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Build detailed project response with tasks and members populated.
 */
async function buildProjectDetail(project: InstanceType<typeof Project>) {
  const [createdBy, members, tasks] = await Promise.all([
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
    Task.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .then(async (taskDocs) => {
        const assigneeIds = taskDocs.filter((t) => t.assignedToId).map((t) => t.assignedToId)
        const assignees = assigneeIds.length
          ? await User.find({ _id: { $in: assigneeIds } }).select('name email role')
          : []
        const assigneeMap = new Map(assignees.map((u) => [u._id.toString(), u]))

        return taskDocs.map((t) => ({
          id: t._id.toString(),
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          assignedToId: t.assignedToId?.toString() || null,
          projectId: t.projectId.toString(),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          assignedTo: t.assignedToId && assigneeMap.has(t.assignedToId.toString())
            ? {
                id: assigneeMap.get(t.assignedToId.toString())!._id.toString(),
                name: assigneeMap.get(t.assignedToId.toString())!.name,
                email: assigneeMap.get(t.assignedToId.toString())!.email,
                role: assigneeMap.get(t.assignedToId.toString())!.role,
              }
            : null,
        }))
      }),
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
    tasks,
    _count: {
      tasks: tasks.length,
      members: members.length,
    },
  }
}

// GET /api/projects/[id] - Get project detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    const project = await Project.findById(id)

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check access for non-admin users
    if (auth.role !== 'admin') {
      const isMember = await ProjectMember.exists({
        projectId: project._id,
        userId: auth.userId,
      })
      if (!isMember && project.createdById.toString() !== auth.userId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    const data = await buildProjectDetail(project)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: 'Only admins can update projects' },
        { status: 403 }
      )
    }

    const { id } = await params
    const project = await Project.findById(id)

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { title, description, addMemberIds, removeMemberIds } = body

    // Update basic fields
    if (title !== undefined || description !== undefined) {
      const updateData: Record<string, string> = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      await Project.findByIdAndUpdate(id, updateData)
    }

    // Add members (skip duplicates)
    if (addMemberIds?.length) {
      for (const uid of addMemberIds) {
        await ProjectMember.findOneAndUpdate(
          { userId: uid, projectId: id },
          { userId: uid, projectId: id },
          { upsert: true }
        )
      }
    }

    // Remove members
    if (removeMemberIds?.length) {
      await ProjectMember.deleteMany({
        projectId: id,
        userId: { $in: removeMemberIds },
      })
    }

    // Re-fetch and return updated project
    const updatedProject = await Project.findById(id)
    const data = await buildProjectDetail(updatedProject!)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: 'Only admins can delete projects' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Delete project and all associated data (members + tasks)
    await Promise.all([
      Project.findByIdAndDelete(id),
      ProjectMember.deleteMany({ projectId: id }),
      Task.deleteMany({ projectId: id }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
