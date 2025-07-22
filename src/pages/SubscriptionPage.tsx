import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toaster'
import { ArrowLeft, Check, Crown, Loader2, ExternalLink } from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '@/types/subscription'
import { createSubscription, getBillingPortal } from '@/services/api'
import { useState } from 'react'

export default function SubscriptionPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const currentPlan = user?.subscription.plan || 'free'

  const handleUpgrade = async (priceId: string) => {
    if (!priceId) return
    
    setLoading(priceId)
    try {
      const response = await createSubscription({ priceId })
      // Redirect to Stripe Checkout
      window.location.href = response.data.url
    } catch (error: any) {
      console.error('Error creating subscription:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to start subscription process',
        type: 'error'
      })
    } finally {
      setLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setLoading('billing')
    try {
      const response = await getBillingPortal()
      window.open(response.data.url, '_blank')
    } catch (error: any) {
      console.error('Error opening billing portal:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to open billing portal',
        type: 'error'
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/chat">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Subscription</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Current plan:</span>
            <span className="font-semibold capitalize">{currentPlan}</span>
          </div>
        </div>
      </header>

      {/* Subscription Plans */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upgrade to unlock unlimited conversations and advanced features
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`border rounded-lg p-8 text-center relative ${
                plan.popular ? 'ring-2 ring-primary' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                    <Crown className="h-4 w-4 mr-1" />
                    Popular
                  </span>
                </div>
              )}
              
              <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold mb-4">
                ${plan.price}
                <span className="text-lg font-normal text-muted-foreground">/{plan.interval}</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center justify-center space-x-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              {currentPlan === plan.id ? (
                <div className="space-y-2">
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                  {currentPlan !== 'free' && (
                    <Button
                      onClick={handleManageBilling}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={loading === 'billing'}
                    >
                      {loading === 'billing' ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Manage Billing
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => handleUpgrade(plan.stripePriceId)}
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={!plan.stripePriceId || loading === plan.stripePriceId}
                >
                  {loading === plan.stripePriceId ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {plan.price === 0 ? 'Downgrade' : 'Upgrade Now'}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Current Usage */}
        {user && (
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Messages this month</span>
                    <span className="text-sm text-muted-foreground">
                      {user.usage.messagesThisMonth} / {currentPlan === 'free' ? '10' : '∞'}
                    </span>
                  </div>
                  {currentPlan === 'free' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((user.usage.messagesThisMonth / 10) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Usage resets on {user.usage.resetDate.toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}