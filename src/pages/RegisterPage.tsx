import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import RegisterForm from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/chat')
    }
  }, [user, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">SideKick</h1>
          <p className="text-muted-foreground">
            Your AI-powered assistant
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}