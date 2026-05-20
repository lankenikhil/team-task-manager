/**
 * Task Detail API Route
 *
 * PUT    - Update a task (admin can update all fields, members can only update status)
 * DELETE - Delete a task (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Task from '@/models/Task'
import { getAuthUser } from '@/lib/api-auth'

// Helper to build task response with populated relations (reused from tasks/route.ts)
async function buildTaskResponse(task: InstanceType<typeof Task>) {
  // Dynamic import to avoid circular deps — use the User and Project models directly
  const User = (await import('@/models/User')).default
  const Project = (await import('@/models/Project')).default

  const [assignedTo, project] = await Promise.all([
    task.assignedToId
      ? User.findById(task.assignedToId).select('name email role')
      : null,
    Project.findById(task.projectId).select('title'),
  ])

  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedToId: task.assignedToId?.toString() || null,
    projectId: task.projectId.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedTo: assignedTo
      ? {
          id: assignedTo._id.toString(),
          name: assignedTo.name,
          email: assignedTo.email,
          role: assignedTo.role,
        }
      : null,
    project: project
      ? {
          id: project._id.toString(),
          title: project.title,
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
    await connectDB()

    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    const task = await Task.findById(id)

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
      if (task.assignedToId?.toString() !== auth.userId) {
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
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null

    const updated = await Task.findByIdAndUpdate(id, updateData, { new: true })
    const data = await buildTaskResponse(updated!)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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
        { success: false, error: 'Only admins can delete tasks' },
        { status: 403 }
      )
    }

    const { id } = await params
    await Task.findByIdAndDelete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
