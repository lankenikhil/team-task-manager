/**
 * Tasks API Route
 *
 * GET  - List tasks with filtering by status, priority, and project
 *        Members can only see tasks assigned to them in their projects
 * POST - Create a new task (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Shared Prisma include for task queries
 */
const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  project: { select: { id: true, title: true } },
} as const

/**
 * Helper: Format a Prisma task result into the API response shape.
 */
function buildTaskResponse(task: any) {
  if (!task) return null

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedToId: task.assignedToId,
    projectId: task.projectId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedTo: task.assignedTo
      ? {
          id: task.assignedTo.id,
          name: task.assignedTo.name,
          email: task.assignedTo.email,
          role: task.assignedTo.role,
        }
      : null,
    project: task.project
      ? {
          id: task.project.id,
          title: task.project.title,
        }
      : null,
  }
}

// GET /api/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // Build Prisma where clause
    const where: Record<string, any> = {}

    if (projectId) where.projectId = projectId
    if (status) where.status = status
    if (priority) where.priority = priority

    // Members can only see their assigned tasks
    if (auth.role !== 'admin') {
      where.assignedToId = auth.userId

      // Also restrict to projects they're part of
      const memberEntries = await db.projectMember.findMany({
        where: { userId: auth.userId },
        select: { projectId: true },
      })
      const memberProjectIds = memberEntries.map((m) => m.projectId)

      const createdProjects = await db.project.findMany({
        where: { createdById: auth.userId },
        select: { id: true },
      })
      const allProjectIds = [
        ...memberProjectIds,
        ...createdProjects.map((p) => p.id),
      ]

      // Merge with existing projectId filter if any
      if (where.projectId) {
        // If a specific project is requested, ensure the member has access
        if (!allProjectIds.includes(where.projectId)) {
          return NextResponse.json({ success: true, data: [] })
        }
      } else {
        where.projectId = { in: allProjectIds }
      }
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: taskInclude,
    })

    const data = tasks.map(buildTaskResponse)

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Get tasks error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
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
        { success: false, error: 'Only admins can create tasks' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, status, priority, dueDate, assignedToId, projectId } = body

    if (!title || !projectId) {
      return NextResponse.json(
        { success: false, error: 'Title and project are required' },
        { status: 400 }
      )
    }

    const task = await db.task.create({
      data: {
        title,
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || null,
        projectId,
      },
      include: taskInclude,
    })

    console.log(`✅ Task created: ${title} in project ${projectId}`)

    const data = buildTaskResponse(task)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Create task error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    )
  }
}
