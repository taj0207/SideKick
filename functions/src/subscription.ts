import * as admin from 'firebase-admin'
import { onCall, onRequest } from 'firebase-functions/v2/https'
import { HttpsError } from 'firebase-functions/v2/https'
import Stripe from 'stripe'
import cors from 'cors'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16',
})

const db = admin.firestore()
const corsHandler = cors({ origin: true })

// Create Stripe customer
export const createStripeCustomerV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = request.auth.uid
  const { email, name } = request.data || {}

  try {
    // Check if customer already exists
    const userDoc = await db.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    if (userData?.subscription.stripeCustomerId) {
      return { customerId: userData.subscription.stripeCustomerId }
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        firebaseUID: userId
      }
    })

    // Update user document with customer ID
    await db.collection('users').doc(userId).update({
      'subscription.stripeCustomerId': customer.id
    })

    return { customerId: customer.id }
  } catch (error) {
    console.error('Error creating Stripe customer:', error)
    throw new HttpsError('internal', 'Failed to create customer')
  }
})

// Create subscription checkout session
export const createSubscriptionV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = request.auth.uid
  const { priceId } = request.data || {}

  try {
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    if (!userData) {
      throw new HttpsError('not-found', 'User not found')
    }

    let customerId = userData.subscription.stripeCustomerId

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.displayName,
        metadata: {
          firebaseUID: userId
        }
      })
      customerId = customer.id
      
      await db.collection('users').doc(userId).update({
        'subscription.stripeCustomerId': customerId
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/subscription?success=true`,
      cancel_url: `${process.env.APP_URL}/subscription?canceled=true`,
      metadata: {
        firebaseUID: userId
      }
    })

    return {
      sessionId: session.id,
      url: session.url
    }
  } catch (error) {
    console.error('Error creating subscription:', error)
    throw new HttpsError('internal', 'Failed to create subscription')
  }
})

// Handle Stripe webhooks
export const handleStripeWebhookV2 = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    const sig = request.headers['stripe-signature'] as string
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      response.status(400).send(`Webhook Error: ${err.message}`)
      return
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
          break
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.Invoice)
          break
        default:
          console.log(`Unhandled event type ${event.type}`)
      }

      response.json({ received: true })
    } catch (error) {
      console.error('Error handling webhook:', error)
      response.status(500).send('Internal Server Error')
    }
  })
})

// Get billing portal session
export const getBillingPortalV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = request.auth.uid

  try {
    const userDoc = await db.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    if (!userData?.subscription.stripeCustomerId) {
      throw new HttpsError('not-found', 'No subscription found')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/subscription`,
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error creating billing portal session:', error)
    throw new HttpsError('internal', 'Failed to create billing portal session')
  }
})

// Helper functions
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const firebaseUID = subscription.metadata.firebaseUID
  if (!firebaseUID) {
    console.error('No Firebase UID in subscription metadata')
    return
  }

  const plan = subscription.items.data[0].price.id === 'price_monthly_pro' ? 'monthly_pro' : 'free'
  
  await db.collection('users').doc(firebaseUID).update({
    'subscription.plan': plan,
    'subscription.status': subscription.status,
    'subscription.stripeSubscriptionId': subscription.id,
    'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
    'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const firebaseUID = subscription.metadata.firebaseUID
  if (!firebaseUID) {
    console.error('No Firebase UID in subscription metadata')
    return
  }

  await db.collection('users').doc(firebaseUID).update({
    'subscription.plan': 'free',
    'subscription.status': 'canceled',
    'subscription.stripeSubscriptionId': null,
    'subscription.currentPeriodEnd': null,
    'subscription.cancelAtPeriodEnd': false
  })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful payment
  console.log('Payment succeeded for invoice:', invoice.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payment
  console.log('Payment failed for invoice:', invoice.id)
  
  if (invoice.customer && typeof invoice.customer === 'string') {
    const customer = await stripe.customers.retrieve(invoice.customer)
    if (customer && !customer.deleted && 'metadata' in customer) {
      const firebaseUID = customer.metadata.firebaseUID
      if (firebaseUID) {
        await db.collection('users').doc(firebaseUID).update({
          'subscription.status': 'past_due'
        })
      }
    }
  }
}