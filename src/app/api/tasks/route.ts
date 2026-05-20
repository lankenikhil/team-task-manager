import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromCookies } from '@/lib/auth'

async function getAuthUser(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const token = getTokenFromCookies(cookieHeader)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return payload
}

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assignedToMe = searchParams.get('assignedToMe')

    const where: Record<string, unknown> = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    // Members can only see their assigned tasks
    if (auth.role !== 'admin' && assignedToMe !== 'false') {
      where.assignedToId = auth.userId
    }

    // Members can only see tasks in projects they're part of
    if (auth.role !== 'admin') {
      where.project = {
        OR: [
          { createdById: auth.userId },
          { members: { some: { userId: auth.userId } } },
        ],
      }
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only admins can create tasks' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, status, priority, dueDate, assignedToId, projectId } = body

    if (!title || !projectId) {
      return NextResponse.json({ success: false, error: 'Title and project are required' }, { status: 400 })
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
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
