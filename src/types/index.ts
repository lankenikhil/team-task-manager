export type UserRole = 'admin' | 'member'

export type TaskStatus = 'todo' | 'in_progress' | 'completed'

export type TaskPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export interface Project {
  id: string
  title: string
  description: string
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy?: User
  members?: ProjectMember[]
  tasks?: Task[]
  _count?: {
    tasks: number
    members: number
  }
}

export interface ProjectMember {
  id: string
  userId: string
  projectId: string
  createdAt: string
  user?: User
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  assignedToId: string | null
  projectId: string
  createdAt: string
  updatedAt: string
  assignedTo?: User | null
  project?: Project
}

export interface AuthUser {
  userId: string
  email: string
  role: UserRole
  name: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export type AppView = 
  | 'dashboard' 
  | 'projects' 
  | 'project-detail' 
  | 'tasks' 
  | 'team' 
  | 'settings'
