'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FolderKanban, Plus, MoreVertical, Pencil, Trash2, Users, ListTodo, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { Project, User } from '@/types'

export function ProjectsView() {
  const { user, setCurrentView, setSelectedProjectId } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    loadProjects()
    if (isAdmin) loadUsers()
  }, [isAdmin])

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (data.success) setProjects(data.data)
    } catch (error) {
      console.error('Load projects error:', error)
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

  const openCreateDialog = () => {
    setEditProject(null)
    setTitle('')
    setDescription('')
    setSelectedMemberIds([])
    setDialogOpen(true)
  }

  const openEditDialog = (project: Project) => {
    setEditProject(project)
    setTitle(project.title)
    setDescription(project.description)
    setSelectedMemberIds(
      project.members
        ?.filter(m => m.userId !== project.createdById)
        .map(m => m.userId) || []
    )
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    try {
      if (editProject) {
        // Determine member changes
        const existingIds = editProject.members?.map(m => m.userId) || []
        const addMemberIds = selectedMemberIds.filter(id => !existingIds.includes(id))
        const removeMemberIds = existingIds.filter(id => !selectedMemberIds.includes(id) && id !== editProject.createdById)

        const res = await fetch(`/api/projects/${editProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            addMemberIds,
            removeMemberIds,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setDialogOpen(false)
          loadProjects()
        }
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, memberIds: selectedMemberIds }),
        })
        const data = await res.json()
        if (data.success) {
          setDialogOpen(false)
          loadProjects()
        }
      }
    } catch (error) {
      console.error('Save project error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? All tasks will be deleted.')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) loadProjects()
    } catch (error) {
      console.error('Delete project error:', error)
    }
  }

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editProject ? 'Edit Project' : 'Create New Project'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="Project name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Project description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team Members</label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {users
                      .filter(u => u.id !== user?.userId)
                      .map(u => (
                        <label
                          key={u.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(u.id)}
                            onChange={() => toggleMember(u.id)}
                            className="rounded"
                          />
                          <span className="text-sm">{u.name}</span>
                          <Badge variant="secondary" className="ml-auto text-xs capitalize">
                            {u.role}
                          </Badge>
                        </label>
                      ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving || !title.trim()}>
                    {saving ? 'Saving...' : editProject ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground">Create a project to start managing tasks</p>
            {isAdmin && (
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group relative transition-colors hover:border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{project.title}</CardTitle>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(project)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(project.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListTodo className="h-3.5 w-3.5" />
                    {project._count?.tasks || 0} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {project._count?.members || 0} members
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => {
                    setSelectedProjectId(project.id)
                    setCurrentView('project-detail')
                  }}
                >
                  Open <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
