import * as admin from 'firebase-admin'
import { onRequest } from 'firebase-functions/v2/https'

// Initialize Firebase Admin
admin.initializeApp()

// V2 functions (re-export from modules with V2 names)
export { createStripeCustomerV2, createSubscriptionV2, handleStripeWebhookV2, getBillingPortalV2 } from './subscription'
export { createNewChatV2, getChatHistoryV2, deleteChatV2, updateChatTitleV2, getAvailableModelsV2, sendMessageV2 } from './chat'
export { createProjectV2, getUserProjectsV2, updateProjectV2, deleteProjectV2, getProjectChatsV2 } from './project'
export { cleanupExpiredFilesV2, manualCleanupExpiredFilesV2, cleanupProjectFilesV2 } from './storage'

// Health check (V2)
export const healthCheckV2 = onRequest((request, response) => {
  response.json({ status: 'OK', timestamp: new Date().toISOString() })
})