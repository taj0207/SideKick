import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ChatProvider } from './contexts/ChatContext'
import { Toaster } from './components/ui/toaster'
import AuthGuard from './components/auth/AuthGuard'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'
import SubscriptionPage from './pages/SubscriptionPage'
import './services/firebase'

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/chat" element={
              <AuthGuard>
                <ChatPage />
              </AuthGuard>
            } />
            <Route path="/subscription" element={
              <AuthGuard>
                <SubscriptionPage />
              </AuthGuard>
            } />
          </Routes>
          <Toaster />
        </div>
      </ChatProvider>
    </AuthProvider>
  )
}

export default App