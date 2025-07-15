import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Validate environment variables
const validateEnvironment = () => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID'
  ]
  
  const missing = required.filter(key => !import.meta.env[key])
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '))
    // Don't throw in production, just warn
    if (import.meta.env.DEV) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`)
    }
  }
}

// Validate environment on startup
try {
  validateEnvironment()
} catch (error) {
  console.error('Environment validation failed:', error)
}

// Safe root element access
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)