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

// PUT /api/tasks/[id] - Update task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, status, priority, dueDate, assignedToId } = body

    const task = await db.task.findUnique({ where: { id } })
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    // Members can only update status of their own tasks
    if (auth.role !== 'admin') {
      if (task.assignedToId !== auth.userId) {
        return NextResponse.json({ success: false, error: 'You can only update tasks assigned to you' }, { status: 403 })
      }
      // Members can only change status
      if (Object.keys(body).some(k => k !== 'status')) {
        if (title !== undefined || description !== undefined || priority !== undefined || dueDate !== undefined || assignedToId !== undefined) {
          return NextResponse.json({ success: false, error: 'Members can only update task status' }, { status: 403 })
        }
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only admins can delete tasks' }, { status: 403 })
    }

    const { id } = await params
    await db.task.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
