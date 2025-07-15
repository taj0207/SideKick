import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { SendMessageRequest, SendMessageResponse } from '@/types/chat'
import type { StripeCheckoutSession } from '@/types/subscription'

// Chat API functions
export const sendMessage = httpsCallable<SendMessageRequest, SendMessageResponse>(
  functions,
  'sendMessage'
)

export const getChatHistory = httpsCallable(
  functions,
  'getChatHistory'
)

export const createNewChat = httpsCallable(
  functions,
  'createNewChat'
)

export const deleteChat = httpsCallable(
  functions,
  'deleteChat'
)

export const updateChatTitle = httpsCallable(
  functions,
  'updateChatTitle'
)

// Subscription API functions
export const createStripeCustomer = httpsCallable(
  functions,
  'createStripeCustomer'
)

export const createSubscription = httpsCallable<{ priceId: string }, StripeCheckoutSession>(
  functions,
  'createSubscription'
)

export const cancelSubscription = httpsCallable(
  functions,
  'cancelSubscription'
)

export const getBillingPortal = httpsCallable<void, { url: string }>(
  functions,
  'getBillingPortal'
)

export const getSubscriptionStatus = httpsCallable(
  functions,
  'getSubscriptionStatus'
)

// Error handling helper
export function handleApiError(error: any): string {
  if (error.code === 'functions/unauthenticated') {
    return 'Please sign in to continue'
  }
  
  if (error.code === 'functions/permission-denied') {
    return 'You do not have permission to perform this action'
  }
  
  if (error.code === 'functions/unavailable') {
    return 'Service temporarily unavailable. Please try again later'
  }
  
  return error.message || 'An unexpected error occurred'
}