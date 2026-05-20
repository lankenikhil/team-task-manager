/**
 * Tasks API Route
 *
 * GET  - List tasks with filtering by status, priority, and project
 *        Members can only see tasks assigned to them in their projects
 * POST - Create a new task (admin only)
 * Uses Mongoose + MongoDB Atlas.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import User from '@/models/User'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Format a Mongoose task result into the API response shape.
 */
async function formatTask(task: any) {
  if (!task) return null

  // Ensure populated fields are resolved
  let assignedTo = task.assignedToId
  let projectInfo = task.projectId

  // If not already populated, fetch manually
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

    await connectDB()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // Build Mongoose filter
    const filter: Record<string, any> = {}

    if (projectId) filter.projectId = projectId
    if (status) filter.status = status
    if (priority) filter.priority = priority

    // Members can only see their assigned tasks
    if (auth.role !== 'admin') {
      filter.assignedToId = auth.userId

      // Also restrict to projects they're part of
      const memberEntries = await ProjectMember.find({ userId: auth.userId }).select('projectId').lean()
      const memberProjectIds = memberEntries.map(m => m.projectId)

      const createdProjects = await Project.find({ createdById: auth.userId }).select('_id').lean()
      const allProjectIds = [
        ...memberProjectIds.map(id => id.toString()),
        ...createdProjects.map(p => p._id.toString()),
      ]

      // Merge with existing projectId filter if any
      if (filter.projectId) {
        // If a specific project is requested, ensure the member has access
        if (!allProjectIds.includes(filter.projectId)) {
          return NextResponse.json({ success: true, data: [] })
        }
      } else {
        filter.projectId = { $in: allProjectIds }
      }
    }

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .populate('assignedToId', 'name email role')
      .populate('projectId', 'title')
      .lean()

    const data = await Promise.all(tasks.map(formatTask))

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

    await connectDB()

    const body = await request.json()
    const { title, description, status, priority, dueDate, assignedToId, projectId } = body

    if (!title || !projectId) {
      return NextResponse.json(
        { success: false, error: 'Title and project are required' },
        { status: 400 }
      )
    }

    const task = await Task.create({
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: assignedToId || null,
      projectId,
    })

    console.log(`✅ Task created: ${title} in project ${projectId}`)

    // Fetch with populated fields
    const populatedTask = await Task.findById(task._id)
      .populate('assignedToId', 'name email role')
      .populate('projectId', 'title')
      .lean()

    const data = await formatTask(populatedTask)
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
