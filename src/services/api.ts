import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { SendMessageRequest, SendMessageResponse } from '@/types/chat'
import type { StripeCheckoutSession } from '@/types/subscription'

// Chat API functions (V2)  
export const sendMessage = httpsCallable<SendMessageRequest, SendMessageResponse>(
  functions,
  'sendMessageV2'
)

export const getChatHistory = httpsCallable(
  functions,
  'getChatHistoryV2'
)

export const createNewChat = httpsCallable(
  functions,
  'createNewChatV2'
)

export const deleteChat = httpsCallable(
  functions,
  'deleteChatV2'
)

export const updateChatTitle = httpsCallable(
  functions,
  'updateChatTitleV2'
)

export const getAvailableModels = httpsCallable(
  functions,
  'getAvailableModelsV2'
)

// Project API functions (V2)
export const createProject = httpsCallable(
  functions,
  'createProjectV2'
)

export const getUserProjects = httpsCallable(
  functions,
  'getUserProjectsV2'
)

export const updateProject = httpsCallable(
  functions,
  'updateProjectV2'
)

export const deleteProject = httpsCallable(
  functions,
  'deleteProjectV2'
)

export const getProjectChats = httpsCallable(
  functions,
  'getProjectChatsV2'
)

// Subscription API functions (V2)
export const createStripeCustomer = httpsCallable(
  functions,
  'createStripeCustomerV2'
)

export const createSubscription = httpsCallable<{ priceId: string }, StripeCheckoutSession>(
  functions,
  'createSubscriptionV2'
)

export const getBillingPortal = httpsCallable<void, { url: string }>(
  functions,
  'getBillingPortalV2'
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