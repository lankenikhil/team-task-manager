/**
 * Project Detail API Route
 *
 * GET    - Get a single project with members, tasks, and creator info
 * PUT    - Update a project (title, description, add/remove members)
 * DELETE - Delete a project and all its associated data
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Shared Prisma include for detailed project queries (with tasks)
 */
const projectDetailInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  tasks: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  _count: { select: { tasks: true, members: true } },
} as const

/**
 * Helper: Format a Prisma project result into the API response shape.
 */
function buildProjectDetail(project: any) {
  if (!project) return null

  return {
    id: project.id,
    title: project.title,
    description: project.description,
    createdById: project.createdById,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: project.createdBy
      ? {
          id: project.createdBy.id,
          name: project.createdBy.name,
          email: project.createdBy.email,
          role: project.createdBy.role,
        }
      : null,
    members: project.members.map((pm: any) => ({
      id: pm.id,
      userId: pm.userId,
      projectId: pm.projectId,
      createdAt: pm.createdAt,
      user: pm.user
        ? {
            id: pm.user.id,
            name: pm.user.name,
            email: pm.user.email,
            role: pm.user.role,
          }
        : null,
    })),
    tasks: project.tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assignedToId: t.assignedToId,
      projectId: t.projectId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignedTo: t.assignedTo
        ? {
            id: t.assignedTo.id,
            name: t.assignedTo.name,
            email: t.assignedTo.email,
            role: t.assignedTo.role,
          }
        : null,
    })),
    _count: {
      tasks: project._count.tasks,
      members: project._count.members,
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

    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: projectDetailInclude,
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check access for non-admin users
    if (auth.role !== 'admin') {
      const isMember = await db.projectMember.findFirst({
        where: { projectId: id, userId: auth.userId },
      })
      if (!isMember && project.createdById !== auth.userId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    const data = buildProjectDetail(project)
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

    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })

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
      await db.project.update({
        where: { id },
        data: updateData,
      })
    }

    // Add members (upsert to skip duplicates)
    if (addMemberIds?.length) {
      for (const uid of addMemberIds) {
        await db.projectMember.upsert({
          where: {
            userId_projectId: { userId: uid, projectId: id },
          },
          update: {},
          create: { userId: uid, projectId: id },
        })
      }
    }

    // Remove members
    if (removeMemberIds?.length) {
      await db.projectMember.deleteMany({
        where: {
          projectId: id,
          userId: { in: removeMemberIds },
        },
      })
    }

    console.log(`✅ Project updated: ${id}`)

    // Re-fetch and return updated project
    const updatedProject = await db.project.findUnique({
      where: { id },
      include: projectDetailInclude,
    })
    const data = buildProjectDetail(updatedProject)

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

    const { id } = await params

    // Delete project (cascade will handle members + tasks)
    await db.project.delete({ where: { id } })

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
