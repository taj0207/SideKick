import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])

    // Auto remove after duration
    setTimeout(() => {
      removeToast(id)
    }, toast.duration || 5000)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast()

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  return (
    <div
      className={cn(
        'relative flex w-full items-center space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all',
        typeStyles[toast.type]
      )}
    >
      <div className="grid gap-1">
        <div className="text-sm font-semibold">{toast.title}</div>
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <>
      <ToastProvider>
        <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      </ToastProvider>
    </>
  )
}

// Helper functions for easier usage
export const toast = {
  success: (title: string, description?: string) => {
    // This will be used by components that have access to the context
    return { type: 'success' as const, title, description }
  },
  error: (title: string, description?: string) => {
    return { type: 'error' as const, title, description }
  },
  warning: (title: string, description?: string) => {
    return { type: 'warning' as const, title, description }
  },
  info: (title: string, description?: string) => {
    return { type: 'info' as const, title, description }
  }
}