/**
 * Projects API Route
 *
 * GET  - List projects (admins see all, members see only their projects)
 * POST - Create a new project (admin only). Creator is auto-added as member.
 * Uses Mongoose + MongoDB Atlas.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Project from '@/models/Project'
import ProjectMember from '@/models/ProjectMember'
import User from '@/models/User'
import Task from '@/models/Task'
import { getAuthUser } from '@/lib/api-auth'

/**
 * Helper: Format a Mongoose project document into the API response shape.
 * Includes createdBy, members with user info, and task/member counts.
 */
function formatProject(project: any, createdBy: any, members: any[], taskCount: number, memberCount: number) {
  return {
    id: project._id.toString(),
    title: project.title,
    description: project.description,
    createdById: project.createdById.toString(),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: createdBy
      ? {
          id: createdBy._id.toString(),
          name: createdBy.name,
          email: createdBy.email,
          role: createdBy.role,
        }
      : null,
    members: members.map((pm: any) => ({
      id: pm._id.toString(),
      userId: pm.userId._id ? pm.userId._id.toString() : pm.userId.toString(),
      projectId: pm.projectId._id ? pm.projectId._id.toString() : pm.projectId.toString(),
      createdAt: pm.createdAt,
      user: pm.populatedUser
        ? {
            id: pm.populatedUser._id.toString(),
            name: pm.populatedUser.name,
            email: pm.populatedUser.email,
            role: pm.populatedUser.role,
          }
        : null,
    })),
    _count: {
      tasks: taskCount,
      members: memberCount,
    },
  }
}

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

    await connectDB()

    let projects

    if (auth.role === 'admin') {
      // Admins can see all projects
      projects = await Project.find().sort({ createdAt: -1 }).lean()
    } else {
      // Members see only projects they created or are members of
      const memberEntries = await ProjectMember.find({ userId: auth.userId }).select('projectId').lean()
      const memberProjectIds = memberEntries.map(m => m.projectId)
      const createdProjects = await Project.find({ createdById: auth.userId }).select('_id').lean()
      const createdProjectIds = createdProjects.map(p => p._id)

      const allProjectIds = [...new Set([...memberProjectIds.map(id => id.toString()), ...createdProjectIds.map(id => id.toString())])]

      projects = await Project.find({ _id: { $in: allProjectIds } }).sort({ createdAt: -1 }).lean()
    }

    // Enrich each project with related data
    const data = await Promise.all(
      projects.map(async (project) => {
        const [createdBy, memberEntries, taskCount, memberCount] = await Promise.all([
          User.findById(project.createdById).select('name email role').lean(),
          ProjectMember.find({ projectId: project._id })
            .populate('userId', 'name email role')
            .lean(),
          Task.countDocuments({ projectId: project._id }),
          ProjectMember.countDocuments({ projectId: project._id }),
        ])

        // Transform populated members
        const members = memberEntries.map((pm: any) => ({
          ...pm,
          populatedUser: pm.userId,
          userId: pm.userId._id ? pm.userId._id : pm.userId,
          projectId: project._id,
        }))

        return formatProject(project, createdBy, members, taskCount, memberCount)
      })
    )

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

    await connectDB()

    const body = await request.json()
    const { title, description, memberIds } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Create the project
    const project = await Project.create({
      title,
      description: description || '',
      createdById: auth.userId,
    })

    // Add creator as a member
    const allMemberIds = [auth.userId, ...(memberIds?.length ? memberIds : [])]
    const uniqueMemberIds = [...new Set(allMemberIds)]

    // Create member entries (skip duplicates)
    const memberDocs = uniqueMemberIds.map(uid => ({
      userId: uid,
      projectId: project._id,
    }))

    await ProjectMember.insertMany(memberDocs, { ordered: false })

    console.log(`✅ Project created: ${title} by ${auth.email}`)

    // Fetch enriched project data
    const [createdBy, memberEntries, taskCount, memberCount] = await Promise.all([
      User.findById(project.createdById).select('name email role').lean(),
      ProjectMember.find({ projectId: project._id })
        .populate('userId', 'name email role')
        .lean(),
      Task.countDocuments({ projectId: project._id }),
      ProjectMember.countDocuments({ projectId: project._id }),
    ])

    const members = memberEntries.map((pm: any) => ({
      ...pm,
      populatedUser: pm.userId,
      userId: pm.userId._id ? pm.userId._id : pm.userId,
      projectId: project._id,
    }))

    const data = formatProject(project, createdBy, members, taskCount, memberCount)
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
