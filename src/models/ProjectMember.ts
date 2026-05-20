/**
 * ProjectMember Model
 *
 * Junction collection representing membership relationships
 * between users and projects. A user can be a member of
 * multiple projects, and a project can have multiple members.
 *
 * The compound unique index prevents duplicate memberships.
 */

import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IProjectMember extends Document {
  userId: Types.ObjectId
  projectId: Types.ObjectId
  createdAt: Date
}

const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
  },
  {
    // Enable timestamps to get createdAt automatically
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Compound unique index — a user can only be a member of a project once
ProjectMemberSchema.index({ userId: 1, projectId: 1 }, { unique: true })

// Index for faster lookups by project
ProjectMemberSchema.index({ projectId: 1 })

// Prevent re-compilation in development (hot reload safety)
const ProjectMember =
  mongoose.models.ProjectMember || mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema)

export default ProjectMember
