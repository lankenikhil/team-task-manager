'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { ProjectsView } from '@/components/projects/projects-view'
import { ProjectDetailView } from '@/components/projects/project-detail-view'
import { TasksView } from '@/components/tasks/tasks-view'
import { TeamView } from '@/components/team/team-view'
import { SettingsView } from '@/components/settings/settings-view'
import type { AuthUser } from '@/types'

export default function HomePage() {
  const { user, isLoading, setUser, setLoading, currentView } = useAppStore()
  const [showSignup, setShowSignup] = useState(false)

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success) {
        setUser(data.data as AuthUser)
      }
    } catch {
      // Not authenticated
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Auth pages
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold">TaskFlow</h1>
            <p className="text-muted-foreground">Team Task Manager</p>
          </div>
          {showSignup ? (
            <SignupForm onSwitchToLogin={() => setShowSignup(false)} />
          ) : (
            <LoginForm onSwitchToSignup={() => setShowSignup(true)} />
          )}
        </div>
      </div>
    )
  }

  // App layout
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'projects':
        return <ProjectsView />
      case 'project-detail':
        return <ProjectDetailView />
      case 'tasks':
        return <TasksView />
      case 'team':
        return <TeamView />
      case 'settings':
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  )
}
