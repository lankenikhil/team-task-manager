/**
 * Project Model
 *
 * Represents a project created by an admin.
 * Projects have members (via ProjectMember) and tasks (via Task).
 * The creator is automatically added as a member.
 */

import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IProject extends Document {
  title: string
  description: string
  createdById: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Index for faster queries by creator
ProjectSchema.index({ createdById: 1 })

const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema)

export default Project
