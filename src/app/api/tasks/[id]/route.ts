/**
 * Task Detail API Route
 *
 * PUT    - Update a task (admin can update all fields, members can only update status)
 * DELETE - Delete a task (admin only)
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

// PUT /api/tasks/[id] - Update task
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

    const { id } = await params
    const task = await db.task.findUnique({ where: { id } })

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { title, description, status, priority, dueDate, assignedToId } = body

    // Members can only update status of tasks assigned to them
    if (auth.role !== 'admin') {
      if (task.assignedToId !== auth.userId) {
        return NextResponse.json(
          { success: false, error: 'You can only update tasks assigned to you' },
          { status: 403 }
        )
      }
      // Members can only change the status field
      if (title !== undefined || description !== undefined || priority !== undefined || dueDate !== undefined || assignedToId !== undefined) {
        return NextResponse.json(
          { success: false, error: 'Members can only update task status' },
          { status: 403 }
        )
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null

    const updated = await db.task.update({
      where: { id },
      data: updateData,
      include: taskInclude,
    })
    console.log(`✅ Task updated: ${id} — fields: ${Object.keys(updateData).join(', ')}`)

    const data = buildTaskResponse(updated)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Update task error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id] - Delete task
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
        { success: false, error: 'Only admins can delete tasks' },
        { status: 403 }
      )
    }

    const { id } = await params
    await db.task.delete({ where: { id } })

    console.log(`✅ Task deleted: ${id}`)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Delete task error:', err.message || err)
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
