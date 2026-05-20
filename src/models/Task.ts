/**
 * Task Model
 *
 * Represents a task within a project. Tasks can be assigned
 * to project members and have status/priority tracking.
 *
 * Status flow: todo → in_progress → completed
 * Priority levels: low, medium, high
 */

import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITask extends Document {
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  dueDate: Date | null
  assignedToId: Types.ObjectId | null
  projectId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const TaskSchema = new Schema<ITask>(
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
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'completed'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    assignedToId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for common query patterns
TaskSchema.index({ projectId: 1, createdAt: -1 })
TaskSchema.index({ assignedToId: 1 })
TaskSchema.index({ status: 1 })

const Task = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema)

export default Task
