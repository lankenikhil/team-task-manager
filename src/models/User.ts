/**
 * User Model
 *
 * Stores user accounts with authentication data.
 * Supports two roles: 'admin' and 'member'.
 * Password is hashed using bcryptjs before storage.
 */

import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  role: 'admin' | 'member'
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
)

// Prevent re-compilation in development (hot reload safety)
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User
