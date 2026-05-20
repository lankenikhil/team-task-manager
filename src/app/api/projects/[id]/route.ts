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

// GET /api/projects/[id] - Get project detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    // Check access
    if (auth.role !== 'admin') {
      const isMember = project.members.some(m => m.userId === auth.userId)
      if (!isMember && project.createdById !== auth.userId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only admins can update projects' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, addMemberIds, removeMemberIds } = body

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    // Update basic fields
    if (title !== undefined || description !== undefined) {
      await db.project.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
        },
      })
    }

    // Add members
    if (addMemberIds?.length) {
      for (const uid of addMemberIds) {
        await db.projectMember.upsert({
          where: { userId_projectId: { userId: uid, projectId: id } },
          create: { userId: uid, projectId: id },
          update: {},
        })
      }
    }

    // Remove members
    if (removeMemberIds?.length) {
      await db.projectMember.deleteMany({
        where: { projectId: id, userId: { in: removeMemberIds } },
      })
    }

    const updated = await db.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
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
      return NextResponse.json({ success: false, error: 'Only admins can delete projects' }, { status: 403 })
    }

    const { id } = await params
    await db.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
