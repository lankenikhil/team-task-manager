'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { Project, Task, User } from '@/types'

export function ProjectDetailView() {
  const { user, selectedProjectId, setCurrentView, setSelectedProjectId } = useAppStore()
  const [project, setProject] = useState<Project | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  // Task form state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskStatus, setTaskStatus] = useState('todo')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)

  // Member add state
  const [addMemberIds, setAddMemberIds] = useState<string[]>([])
  const [removeMemberIds, setRemoveMemberIds] = useState<string[]>([])

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (selectedProjectId) {
      loadProject()
      if (isAdmin) loadUsers()
    }
  }, [selectedProjectId, isAdmin])

  const loadProject = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      const data = await res.json()
      if (data.success) setProject(data.data)
    } catch (error) {
      console.error('Load project error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) setUsers(data.data)
    } catch (error) {
      console.error('Load users error:', error)
    }
  }

  const openCreateTask = () => {
    setEditTask(null)
    setTaskTitle('')
    setTaskDesc('')
    setTaskStatus('todo')
    setTaskPriority('medium')
    setTaskDueDate('')
    setTaskAssignee('')
    setTaskDialogOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditTask(task)
    setTaskTitle(task.title)
    setTaskDesc(task.description)
    setTaskStatus(task.status)
    setTaskPriority(task.priority)
    setTaskDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
    setTaskAssignee(task.assignedToId || '')
    setTaskDialogOpen(true)
  }

  const handleSaveTask = async () => {
    if (!taskTitle.trim()) return
    setTaskSaving(true)

    try {
      if (editTask) {
        const res = await fetch(`/api/tasks/${editTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDesc,
            status: taskStatus,
            priority: taskPriority,
            dueDate: taskDueDate || null,
            assignedToId: taskAssignee || null,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setTaskDialogOpen(false)
          loadProject()
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDesc,
            status: taskStatus,
            priority: taskPriority,
            dueDate: taskDueDate || null,
            assignedToId: taskAssignee || null,
            projectId: selectedProjectId,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setTaskDialogOpen(false)
          loadProject()
        }
      }
    } catch (error) {
      console.error('Save task error:', error)
    } finally {
      setTaskSaving(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      loadProject()
    } catch (error) {
      console.error('Delete task error:', error)
    }
  }

  const handleMemberSave = async () => {
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMemberIds, removeMemberIds }),
      })
      const data = await res.json()
      if (data.success) {
        setMemberDialogOpen(false)
        setAddMemberIds([])
        setRemoveMemberIds([])
        loadProject()
      }
    } catch (error) {
      console.error('Update members error:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      todo: { label: 'To Do', className: 'bg-secondary text-secondary-foreground' },
      in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    }
    const v = variants[status] || variants.todo
    return <Badge variant="secondary" className={v.className}>{v.label}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      low: { label: 'Low', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
      medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    }
    const v = variants[priority] || variants.medium
    return <Badge variant="secondary" className={v.className}>{v.label}</Badge>
  }

  const projectMemberIds = project?.members?.map(m => m.userId) || []
  const availableUsers = users.filter(u => !projectMemberIds.includes(u.id))

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setCurrentView('projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const todoCount = project.tasks?.filter(t => t.status === 'todo').length || 0
  const inProgressCount = project.tasks?.filter(t => t.status === 'in_progress').length || 0
  const completedCount = project.tasks?.filter(t => t.status === 'completed').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedProjectId(null)
              setCurrentView('projects')
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="mt-1 text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setAddMemberIds([])
              setRemoveMemberIds([])
              setMemberDialogOpen(true)
            }}>
              <UserPlus className="mr-2 h-4 w-4" /> Members
            </Button>
            <Button size="sm" onClick={openCreateTask}>
              <Plus className="mr-2 h-4 w-4" /> Add Task
            </Button>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{todoCount}</div>
            <div className="text-sm text-muted-foreground">To Do</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inProgressCount}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {project.members?.map(member => (
              <div key={member.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {member.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{member.user?.name}</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {member.user?.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {!project.tasks || project.tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No tasks yet</p>
              {isAdmin && (
                <Button variant="outline" className="mt-2" onClick={openCreateTask}>
                  <Plus className="mr-2 h-4 w-4" /> Add first task
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  {(isAdmin || user?.role === 'member') && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assignedTo?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditTask(task)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Task Create/Edit Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Task title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Task description (optional)"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={taskStatus} onValueChange={setTaskStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee</label>
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Unassigned</SelectItem>
                    {project.members?.map(member => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask} disabled={taskSaving || !taskTitle.trim()}>
                {taskSaving ? 'Saving...' : editTask ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Team Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Current members */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Members</label>
              <div className="space-y-2">
                {project.members?.map(member => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {member.user?.name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{member.user?.name}</span>
                    </div>
                    {member.userId !== project.createdById && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (removeMemberIds.includes(member.userId)) {
                            setRemoveMemberIds(prev => prev.filter(id => id !== member.userId))
                          } else {
                            setRemoveMemberIds(prev => [...prev, member.userId])
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add new members */}
            {availableUsers.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Add Members</label>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {availableUsers.map(u => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={addMemberIds.includes(u.id)}
                        onChange={() => {
                          if (addMemberIds.includes(u.id)) {
                            setAddMemberIds(prev => prev.filter(id => id !== u.id))
                          } else {
                            setAddMemberIds(prev => [...prev, u.id])
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{u.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs capitalize">{u.role}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMemberSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
