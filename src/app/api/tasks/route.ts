/**
 * Tasks API Route
 *
 * GET  - List tasks with filtering by status, priority, and project
 *        Members can only see tasks assigned to them in their projects
 * POST - Create a new task (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import User from '@/models/User'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Build a task response object with populated assignee and project.
 */
async function buildTaskResponse(task: InstanceType<typeof Task>) {
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

// GET /api/tasks - List tasks with filters
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // Build filter query
    const filter: Record<string, unknown> = {}

    if (projectId) filter.projectId = projectId
    if (status) filter.status = status
    if (priority) filter.priority = priority

    // Members can only see their assigned tasks
    if (auth.role !== 'admin') {
      filter.assignedToId = auth.userId

      // Also restrict to projects they're part of
      const memberEntries = await ProjectMember.find({ userId: auth.userId }).select('projectId')
      const projectIds = memberEntries.map((m) => m.projectId)
      const createdProjects = await Project.find({ createdById: auth.userId }).select('_id')
      const allProjectIds = [
        ...projectIds,
        ...createdProjects.map((p) => p._id),
      ]

      // Merge with existing projectId filter if any
      if (filter.projectId) {
        // If a specific project is requested, ensure the member has access
        if (!allProjectIds.some((id) => id.toString() === filter.projectId)) {
          return NextResponse.json({ success: true, data: [] })
        }
      } else {
        filter.projectId = { $in: allProjectIds }
      }
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 })
    const data = await Promise.all(tasks.map(buildTaskResponse))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create task
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

    const task = await Task.create({
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: assignedToId || null,
      projectId,
    })

    const data = await buildTaskResponse(task)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
