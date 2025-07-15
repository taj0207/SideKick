export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  limits: {
    messagesPerMonth: number
    models: string[]
  }
  stripePriceId: string
  popular?: boolean
}

export interface SubscriptionContextType {
  plans: SubscriptionPlan[]
  currentPlan: SubscriptionPlan | null
  loading: boolean
  error: string | null
  createSubscription: (priceId: string) => Promise<void>
  cancelSubscription: () => Promise<void>
  updateSubscription: (priceId: string) => Promise<void>
  getBillingPortal: () => Promise<string>
}

export interface StripeCheckoutSession {
  sessionId: string
  url: string
}

export interface UsageStats {
  current: number
  limit: number
  resetDate: Date
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '10 messages per month',
      'GPT-4 access',
      'Basic chat interface',
      'Community support'
    ],
    limits: {
      messagesPerMonth: 10,
      models: ['gpt-4']
    },
    stripePriceId: ''
  },
  {
    id: 'monthly_pro',
    name: 'Monthly Pro',
    price: 99,
    interval: 'month',
    features: [
      'Unlimited messages',
      'GPT-4 access',
      'Priority support',
      'Advanced features',
      'Export conversations'
    ],
    limits: {
      messagesPerMonth: -1, // unlimited
      models: ['gpt-4']
    },
    stripePriceId: 'price_monthly_pro', // to be replaced with actual Stripe price ID
    popular: true
  }
]