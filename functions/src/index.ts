import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import OpenAI from 'openai'
import Stripe from 'stripe'
import * as cors from 'cors'

// Initialize Firebase Admin
admin.initializeApp()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: functions.config().openai.api_key,
})

// Initialize Stripe
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
})

// CORS handler
const corsHandler = cors({ origin: true })

// Export functions
export { sendMessage } from './chat'
export { createStripeCustomer, createSubscription, handleStripeWebhook, getBillingPortal } from './subscription'
export { createNewChat, getChatHistory, deleteChat, updateChatTitle } from './chat'

// Health check
export const healthCheck = functions.https.onRequest((request, response) => {
  corsHandler(request, response, () => {
    response.json({ status: 'OK', timestamp: new Date().toISOString() })
  })
})