/**
 * Task Detail API Route
 *
 * PUT    - Update a task (admin can update all fields, members can only update status)
 * DELETE - Delete a task (admin only)
 * Uses Mongoose + MongoDB Atlas.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Task from '@/models/Task'
import User from '@/models/User'
import Project from '@/models/Project'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Format a Mongoose task result into the API response shape.
 */
async function formatTask(task: any) {
  if (!task) return null

  let assignedTo = task.assignedToId
  let projectInfo = task.projectId

  if (assignedTo && typeof assignedTo === 'object' && assignedTo._id) {
    assignedTo = {
      id: assignedTo._id.toString(),
      name: assignedTo.name,
      email: assignedTo.email,
      role: assignedTo.role,
    }
  } else if (assignedTo && typeof assignedTo === 'string') {
    const user = await User.findById(assignedTo).select('name email role').lean()
    assignedTo = user
      ? { id: user._id.toString(), name: user.name, email: user.email, role: user.role }
      : null
  } else {
    assignedTo = null
  }

  if (projectInfo && typeof projectInfo === 'object' && projectInfo._id) {
    projectInfo = {
      id: projectInfo._id.toString(),
      title: projectInfo.title,
    }
  } else if (projectInfo && typeof projectInfo === 'string') {
    const proj = await Project.findById(projectInfo).select('title').lean()
    projectInfo = proj ? { id: proj._id.toString(), title: proj.title } : null
  } else {
    projectInfo = null
  }

  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedToId: task.assignedToId
      ? (typeof task.assignedToId === 'object' ? task.assignedToId._id.toString() : task.assignedToId.toString())
      : null,
    projectId: typeof task.projectId === 'object' ? task.projectId._id.toString() : task.projectId.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedTo,
    project: projectInfo,
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

    await connectDB()

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
    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null

    const updated = await Task.findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .populate('assignedToId', 'name email role')
      .populate('projectId', 'title')
      .lean()

    console.log(`✅ Task updated: ${id} — fields: ${Object.keys(updateData).join(', ')}`)

    const data = await formatTask(updated)
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

    await connectDB()

    const { id } = await params
    await Task.findByIdAndDelete(id)

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
