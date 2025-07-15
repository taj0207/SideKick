// Input validation and sanitization utilities

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitized?: string
}

// Basic input sanitization
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = []
  const sanitized = sanitizeInput(email)
  
  if (!sanitized) {
    errors.push('Email is required')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitized)) {
      errors.push('Please enter a valid email address')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// Password validation with detailed requirements
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = []
  
  if (!password) {
    errors.push('Password is required')
    return { isValid: false, errors }
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123'
  ]
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common, please choose a stronger password')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Display name validation
export function validateDisplayName(name: string): ValidationResult {
  const errors: string[] = []
  const sanitized = sanitizeInput(name)
  
  if (!sanitized) {
    errors.push('Display name is required')
  } else if (sanitized.length < 2) {
    errors.push('Display name must be at least 2 characters long')
  } else if (sanitized.length > 50) {
    errors.push('Display name must be less than 50 characters')
  } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
    errors.push('Display name can only contain letters, numbers, spaces, hyphens, and underscores')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// Chat message validation
export function validateChatMessage(message: string): ValidationResult {
  const errors: string[] = []
  const sanitized = sanitizeInput(message)
  
  if (!sanitized) {
    errors.push('Message cannot be empty')
  } else if (sanitized.length > 4000) {
    errors.push('Message is too long (maximum 4000 characters)')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// Environment variable validation
export function validateEnvironmentVariables(): void {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ]
  
  const missing = required.filter(key => !import.meta.env[key])
  
  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`
    console.error(error)
    
    if (import.meta.env.DEV) {
      throw new Error(error)
    }
  }
}

// Generic form validation helper
export function validateForm<T extends Record<string, any>>(
  data: T,
  validators: Record<keyof T, (value: any) => ValidationResult>
): { isValid: boolean; errors: Record<keyof T, string[]>; sanitized: Partial<T> } {
  const errors = {} as Record<keyof T, string[]>
  const sanitized = {} as Partial<T>
  let isValid = true
  
  for (const [field, validator] of Object.entries(validators)) {
    const result = validator(data[field])
    
    if (!result.isValid) {
      errors[field as keyof T] = result.errors
      isValid = false
    }
    
    if (result.sanitized !== undefined) {
      sanitized[field as keyof T] = result.sanitized
    }
  }
  
  return { isValid, errors, sanitized }
}