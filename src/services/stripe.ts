import { loadStripe } from '@stripe/stripe-js'

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY

if (!stripePublicKey) {
  throw new Error('Missing Stripe public key')
}

export const stripe = loadStripe(stripePublicKey)

export async function redirectToCheckout(sessionId: string) {
  const stripeInstance = await stripe
  
  if (!stripeInstance) {
    throw new Error('Stripe failed to load')
  }
  
  const { error } = await stripeInstance.redirectToCheckout({ sessionId })
  
  if (error) {
    throw error
  }
}

export async function redirectToBillingPortal(url: string) {
  window.location.href = url
}