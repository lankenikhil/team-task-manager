/**
 * Project Detail API Route
 *
 * GET    - Get a single project with members, tasks, and creator info
 * PUT    - Update a project (title, description, add/remove members)
 * DELETE - Delete a project and all its associated data
 * Uses Mongoose + MongoDB Atlas.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import Task from '@/models/Task'
import User from '@/models/User'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Format a Mongoose project result into the API response shape.
 * Includes createdBy, members with user info, tasks with assigned user, and counts.
 */
async function buildProjectDetail(projectId: string) {
  const project = await Project.findById(projectId).lean()
  if (!project) return null

  const [createdBy, memberEntries, tasks, taskCount, memberCount] = await Promise.all([
    User.findById(project.createdById).select('name email role').lean(),
    ProjectMember.find({ projectId: project._id })
      .populate('userId', 'name email role')
      .lean(),
    Task.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .populate('assignedToId', 'name email role')
      .lean(),
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
    members: memberEntries.map((pm: any) => ({
      id: pm._id.toString(),
      userId: pm.userId?._id ? pm.userId._id.toString() : pm.userId.toString(),
      projectId: project._id.toString(),
      createdAt: pm.createdAt,
      user: pm.userId
        ? {
            id: pm.userId._id.toString(),
            name: pm.userId.name,
            email: pm.userId.email,
            role: pm.userId.role,
          }
        : null,
    })),
    tasks: tasks.map((t: any) => ({
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assignedToId: t.assignedToId?._id ? t.assignedToId._id.toString() : (t.assignedToId ? t.assignedToId.toString() : null),
      projectId: t.projectId.toString(),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignedTo: t.assignedToId
        ? {
            id: t.assignedToId._id.toString(),
            name: t.assignedToId.name,
            email: t.assignedToId.email,
            role: t.assignedToId.role,
          }
        : null,
    })),
    _count: {
      tasks: taskCount,
      members: memberCount,
    },
  }
}

// GET /api/projects/[id] - Get project detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    await connectDB()

    const { id } = await params
    const project = await Project.findById(id).lean()

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check access for non-admin users
    if (auth.role !== 'admin') {
      const isMember = await ProjectMember.findOne({ projectId: id, userId: auth.userId })
      if (!isMember && project.createdById.toString() !== auth.userId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    const data = await buildProjectDetail(id)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Get project error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project' },
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

    await connectDB()

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
    if (title !== undefined) project.title = title
    if (description !== undefined) project.description = description
    if (title !== undefined || description !== undefined) {
      await project.save()
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

    console.log(`✅ Project updated: ${id}`)

    // Re-fetch and return updated project
    const data = await buildProjectDetail(id)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Update project error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
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

    await connectDB()

    const { id } = await params

    // Delete project (cascade delete members + tasks)
    await Project.findByIdAndDelete(id)
    await ProjectMember.deleteMany({ projectId: id })
    await Task.deleteMany({ projectId: id })

    console.log(`✅ Project deleted: ${id}`)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Delete project error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
