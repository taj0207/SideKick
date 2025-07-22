import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ChatProvider } from './contexts/ChatContext'
import { ToastProvider, Toaster } from './components/ui/toaster'
import { ErrorBoundary } from './components/ErrorBoundary'
import AuthGuard from './components/auth/AuthGuard'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'
import SubscriptionPage from './pages/SubscriptionPage'
import './services/firebase'

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/chat" element={
                <AuthGuard>
                  <ErrorBoundary>
                    <ProjectProvider>
                      <ChatProvider>
                        <ChatPage />
                      </ChatProvider>
                    </ProjectProvider>
                  </ErrorBoundary>
                </AuthGuard>
              } />
              <Route path="/subscription" element={
                <AuthGuard>
                  <SubscriptionPage />
                </AuthGuard>
              } />
              <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">404</h1>
                    <p className="text-muted-foreground mb-4">Page not found</p>
                    <a href="/" className="text-primary hover:underline">
                      Go back home
                    </a>
                  </div>
                </div>
              } />
            </Routes>
          </ErrorBoundary>
          <Toaster />
        </div>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App