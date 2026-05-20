'use client'

import { create } from 'zustand'
import type { AuthUser, AppView } from '@/types'

interface AppState {
  // Auth
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void

  // Navigation
  currentView: AppView
  selectedProjectId: string | null
  setCurrentView: (view: AppView) => void
  setSelectedProjectId: (id: string | null) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  currentView: 'dashboard',
  selectedProjectId: null,
  setCurrentView: (currentView) => set({ currentView }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
