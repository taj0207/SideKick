import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: functions.config().openai.api_key,
})

const db = admin.firestore()

// Send message to AI model
export const sendMessage = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId, content, model = 'gpt-4' } = data
  const userId = context.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied')
    }

    // Check user subscription and usage limits
    const userDoc = await db.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    if (!userData) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    // Check usage limits for free tier
    if (userData.subscription.plan === 'free' && userData.usage.messagesThisMonth >= 10) {
      throw new functions.https.HttpsError('resource-exhausted', 'Monthly message limit exceeded')
    }

    // Get chat history for context
    const messagesSnapshot = await db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(20) // Last 20 messages for context
      .get()

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        role: data.role,
        content: data.content
      }
    })

    // Add user message to context
    messages.push({ role: 'user', content })

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages as any[],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const assistantMessage = completion.choices[0].message
    const usage = completion.usage

    // Create response message
    const messageData = {
      id: admin.firestore().collection('temp').doc().id,
      chatId,
      role: 'assistant',
      content: assistantMessage.content || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      model,
      tokenCount: usage?.total_tokens || 0,
      status: 'sent'
    }

    // Update user usage
    await db.collection('users').doc(userId).update({
      'usage.messagesThisMonth': admin.firestore.FieldValue.increment(1)
    })

    return {
      message: messageData,
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0
      }
    }
  } catch (error) {
    console.error('Error sending message:', error)
    throw new functions.https.HttpsError('internal', 'Failed to send message')
  }
})

// Create new chat
export const createNewChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = context.auth.uid
  const chatData = {
    userId,
    title: 'New Chat',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: 0
  }

  try {
    const chatRef = await db.collection('chats').add(chatData)
    return {
      id: chatRef.id,
      ...chatData,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } catch (error) {
    console.error('Error creating chat:', error)
    throw new functions.https.HttpsError('internal', 'Failed to create chat')
  }
})

// Get chat history
export const getChatHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = context.auth.uid
  const { limit = 20, startAfter } = data

  try {
    let query = db
      .collection('chats')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)

    if (startAfter) {
      query = query.startAfter(startAfter)
    }

    const snapshot = await query.get()
    const chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return { chats }
  } catch (error) {
    console.error('Error getting chat history:', error)
    throw new functions.https.HttpsError('internal', 'Failed to get chat history')
  }
})

// Delete chat
export const deleteChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId } = data
  const userId = context.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied')
    }

    // Delete all messages in the chat
    const messagesSnapshot = await db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .get()

    const batch = db.batch()
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    // Delete the chat
    batch.delete(db.collection('chats').doc(chatId))

    await batch.commit()
    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    throw new functions.https.HttpsError('internal', 'Failed to delete chat')
  }
})

// Update chat title
export const updateChatTitle = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId, title } = data
  const userId = context.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied')
    }

    await db.collection('chats').doc(chatId).update({
      title,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating chat title:', error)
    throw new functions.https.HttpsError('internal', 'Failed to update chat title')
  }
})