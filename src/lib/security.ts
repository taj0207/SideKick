// Security utilities and helpers

export interface SecurityError extends Error {
  code: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Rate limiting helpers
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}

  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const attempt = this.attempts.get(identifier)

    if (!attempt || now > attempt.resetTime) {
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return false
    }

    if (attempt.count >= this.maxAttempts) {
      return true
    }

    attempt.count++
    return false
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier)
  }

  getRemainingAttempts(identifier: string): number {
    const attempt = this.attempts.get(identifier)
    if (!attempt || Date.now() > attempt.resetTime) {
      return this.maxAttempts
    }
    return Math.max(0, this.maxAttempts - attempt.count)
  }

  getResetTime(identifier: string): number | null {
    const attempt = this.attempts.get(identifier)
    if (!attempt || Date.now() > attempt.resetTime) {
      return null
    }
    return attempt.resetTime
  }
}

// Global rate limiters
export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000) // 5 attempts per 15 minutes
export const messageRateLimiter = new RateLimiter(60, 60 * 1000) // 60 messages per minute

// Content Security Policy helpers
export function createNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Input sanitization
export function sanitizeHtml(input: string): string {
  const div = document.createElement('div')
  div.textContent = input
  return div.innerHTML
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol')
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

// CSRF protection
export function generateCSRFToken(): string {
  return createNonce()
}

export function validateCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken && token.length === 32
}

// Environment validation
export function validateSecurityConfiguration(): void {
  const errors: string[] = []

  // Check if running in development with production-like settings
  if (import.meta.env.DEV) {
    console.warn('🔶 Running in development mode - some security features are disabled')
  }

  // Validate Firebase configuration
  const requiredFirebaseEnvs = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID'
  ]

  for (const env of requiredFirebaseEnvs) {
    if (!import.meta.env[env]) {
      errors.push(`Missing Firebase environment variable: ${env}`)
    }
  }

  // Validate Stripe configuration
  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
    errors.push('Missing Stripe public key')
  }

  // Check for insecure configurations
  if (import.meta.env.VITE_FIREBASE_API_KEY?.startsWith('AIza') && 
      import.meta.env.PROD) {
    console.warn('🔶 Using Firebase API key in production - ensure proper security rules are in place')
  }

  if (errors.length > 0) {
    const error = new Error(`Security configuration errors: ${errors.join(', ')}`) as SecurityError
    error.code = 'SECURITY_CONFIG_ERROR'
    error.severity = 'high'
    throw error
  }
}

// Password strength calculation
export function calculatePasswordStrength(password: string): {
  score: number // 0-100
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong'
  feedback: string[]
} {
  let score = 0
  const feedback: string[] = []

  // Length scoring
  if (password.length >= 8) score += 25
  else feedback.push('Use at least 8 characters')

  if (password.length >= 12) score += 25
  else if (password.length >= 8) feedback.push('Longer passwords are more secure')

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 10
  else feedback.push('Add lowercase letters')

  if (/[A-Z]/.test(password)) score += 10
  else feedback.push('Add uppercase letters')

  if (/[0-9]/.test(password)) score += 10
  else feedback.push('Add numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score += 15
  else feedback.push('Add special characters')

  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) {
    score -= 10
    feedback.push('Avoid repeating characters')
  }

  if (/123|abc|qwe/i.test(password)) {
    score -= 15
    feedback.push('Avoid common sequences')
  }

  // Common password check
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon'
  ]
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score -= 25
    feedback.push('Avoid common passwords')
  }

  // Determine level
  let level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong'
  if (score < 20) level = 'very-weak'
  else if (score < 40) level = 'weak'
  else if (score < 60) level = 'fair'
  else if (score < 80) level = 'good'
  else level = 'strong'

  return {
    score: Math.max(0, Math.min(100, score)),
    level,
    feedback
  }
}

// Secure storage helpers
export class SecureStorage {
  private static prefix = 'sidekick_secure_'

  static set(key: string, value: string, expirationMs?: number): void {
    const item = {
      value,
      timestamp: Date.now(),
      expiration: expirationMs ? Date.now() + expirationMs : null
    }
    
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(item))
    } catch (error) {
      console.error('Failed to store secure item:', error)
    }
  }

  static get(key: string): string | null {
    try {
      const item = localStorage.getItem(this.prefix + key)
      if (!item) return null

      const parsed = JSON.parse(item)
      
      // Check expiration
      if (parsed.expiration && Date.now() > parsed.expiration) {
        this.remove(key)
        return null
      }

      return parsed.value
    } catch (error) {
      console.error('Failed to retrieve secure item:', error)
      return null
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key)
    } catch (error) {
      console.error('Failed to remove secure item:', error)
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Failed to clear secure storage:', error)
    }
  }
}

// Browser security checks
export function checkBrowserSecurity(): {
  isSecure: boolean
  warnings: string[]
  recommendations: string[]
} {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Check HTTPS
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    warnings.push('Not using HTTPS - data transmission is not secure')
    recommendations.push('Use HTTPS in production')
  }

  // Check for mixed content
  if (location.protocol === 'https:' && document.querySelectorAll('[src^="http:"]').length > 0) {
    warnings.push('Mixed content detected - some resources loaded over HTTP')
    recommendations.push('Ensure all resources use HTTPS')
  }

  // Check localStorage availability
  try {
    localStorage.setItem('test', 'test')
    localStorage.removeItem('test')
  } catch {
    warnings.push('localStorage not available - some features may not work')
    recommendations.push('Enable cookies and local storage')
  }

  // Check for modern browser features
  if (!window.crypto || !window.crypto.getRandomValues) {
    warnings.push('Crypto API not available - security features limited')
    recommendations.push('Update to a modern browser')
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
    recommendations
  }
}