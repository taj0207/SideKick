export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
  lastLoginAt: Date
  subscription: UserSubscription
  usage: UserUsage
}

export interface UserSubscription {
  plan: 'free' | 'monthly_pro'
  status: 'active' | 'canceled' | 'past_due'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: Date
  cancelAtPeriodEnd: boolean
}

export interface UserUsage {
  messagesThisMonth: number
  resetDate: Date
}

export interface AuthError {
  code: string
  message: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  displayName: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}