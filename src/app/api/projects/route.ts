/**
 * Projects API Route
 *
 * GET  - List projects (admins see all, members see only their projects)
 * POST - Create a new project (admin only). Creator is auto-added as member.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Build a project response object using Prisma's include result.
 * Prisma handles population automatically via include, so we just
 * format the result to match the expected API response shape.
 */
function buildProjectResponse(project: Awaited<ReturnType<typeof db.project.findUnique<{ include: { createdBy: true, members: { include: { user: true } }, _count: { select: { tasks: true, members: true } } } }>>>) {
  if (!project) return null

  return {
    id: project.id,
    title: project.title,
    description: project.description,
    createdById: project.createdById,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: project.createdBy
      ? {
          id: project.createdBy.id,
          name: project.createdBy.name,
          email: project.createdBy.email,
          role: project.createdBy.role,
        }
      : null,
    members: project.members.map((pm) => ({
      id: pm.id,
      userId: pm.userId,
      projectId: pm.projectId,
      createdAt: pm.createdAt,
      user: pm.user
        ? {
            id: pm.user.id,
            name: pm.user.name,
            email: pm.user.email,
            role: pm.user.role,
          }
        : null,
    })),
    _count: {
      tasks: project._count.tasks,
      members: project._count.members,
    },
  }
}

// Shared Prisma include for project queries
const projectInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  _count: { select: { tasks: true, members: true } },
} as const

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let projects

    if (auth.role === 'admin') {
      // Admins can see all projects
      projects = await db.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: projectInclude,
      })
    } else {
      // Members see only projects they created or are members of
      projects = await db.project.findMany({
        where: {
          OR: [
            { createdById: auth.userId },
            { members: { some: { userId: auth.userId } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: projectInclude,
      })
    }

    const data = projects.map((p) => buildProjectResponse(p as any))

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Get projects error:', err.message || err)
    console.error('   Stack:', err.stack?.split('\n').slice(0, 3).join('\n'))
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create project
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
        { success: false, error: 'Only admins can create projects' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, memberIds } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Build the member list: creator + additional members
    const memberData = [
      { userId: auth.userId },
      ...(memberIds?.length
        ? memberIds.map((uid: string) => ({ userId: uid }))
        : []),
    ]

    // Create the project with members in one transaction
    const project = await db.project.create({
      data: {
        title,
        description: description || '',
        createdById: auth.userId,
        members: {
          create: memberData,
        },
      },
      include: projectInclude,
    })

    console.log(`✅ Project created: ${title} by ${auth.email}`)

    const data = buildProjectResponse(project as any)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Create project error:', err.message || err)
    console.error('   Stack:', err.stack?.split('\n').slice(0, 3).join('\n'))
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
