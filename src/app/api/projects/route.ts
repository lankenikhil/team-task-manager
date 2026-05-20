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

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    let projects
    if (auth.role === 'admin') {
      projects = await db.project.findMany({
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
          _count: { select: { tasks: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    } else {
      projects = await db.project.findMany({
        where: {
          OR: [
            { createdById: auth.userId },
            { members: { some: { userId: auth.userId } } },
          ],
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
          _count: { select: { tasks: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json({ success: true, data: projects })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects - Create project
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (auth.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only admins can create projects' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, memberIds } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        title,
        description: description || '',
        createdById: auth.userId,
        members: {
          create: [
            { userId: auth.userId },
            ...(memberIds || []).map((uid: string) => ({ userId: uid })),
          ],
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    })

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
