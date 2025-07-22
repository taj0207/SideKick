import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { collection, query, orderBy, onSnapshot, doc, addDoc, deleteDoc, updateDoc, where, setDoc, deleteField, increment } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from './AuthContext'
import { sendMessage as sendMessageApi, createNewChat as createNewChatApi, handleApiError } from '@/services/api'
import type { Chat, Message, ChatContextType } from '@/types/chat'
import { generateId } from '@/lib/utils'

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to user's chats
  useEffect(() => {
    if (!user) {
      setChats([])
      setCurrentChat(null)
      setMessages([])
      return
    }

    const chatsQuery = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    )

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const chatsData: Chat[] = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        }
      }) as Chat[]
      
      setChats(chatsData)
      
      // Set current chat to first one if none selected
      if (!currentChat && chatsData.length > 0) {
        setCurrentChat(chatsData[0])
      }
    })

    return unsubscribe
  }, [user, currentChat])

  // Subscribe to current chat's messages
  useEffect(() => {
    if (!currentChat) {
      setMessages([])
      return
    }

    const messagesQuery = query(
      collection(db, 'chats', currentChat.id, 'messages'),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Message[]
      
      setMessages(messagesData)
    })

    return unsubscribe
  }, [currentChat])

  const createChat = async (data?: { projectId?: string }): Promise<Chat> => {
    if (!user) throw new Error('User not authenticated')
    
    try {
      const result = await createNewChatApi(data)
      const newChat = result.data as Chat
      setCurrentChat(newChat)
      return newChat
    } catch (error: any) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const selectChat = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat) {
      setCurrentChat(chat)
    }
  }

  const sendMessage = async (content: string) => {
    if (!currentChat || !user) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Create user message with proper ID generation
      const userMessageId = generateId()
      const userMessage: Omit<Message, 'id'> = {
        chatId: currentChat.id,
        role: 'user',
        content,
        timestamp: new Date(),
        model: 'gpt-4',
        status: 'sending'
      }
      
      // Add user message to Firestore atomically
      const userMessageRef = doc(db, 'chats', currentChat.id, 'messages', userMessageId)
      await setDoc(userMessageRef, userMessage)
      
      // Update message status to sent
      await updateDoc(userMessageRef, { status: 'sent' })
      
      try {
        // Send message to API
        const response = await sendMessageApi({
          chatId: currentChat.id,
          content,
          model: 'gpt-4o-mini',
          provider: 'openai'
        })
        
        const assistantMessage = response.data.message
        
        // Add assistant message to Firestore
        await addDoc(collection(db, 'chats', currentChat.id, 'messages'), {
          ...assistantMessage,
          id: undefined, // Let Firestore generate the ID
          timestamp: assistantMessage.timestamp instanceof Date 
            ? assistantMessage.timestamp 
            : new Date()
        })
        
        // Update chat metadata atomically
        await updateDoc(doc(db, 'chats', currentChat.id), {
          updatedAt: new Date(),
          messageCount: messages.length + 2
        })
        
      } catch (apiError: any) {
        const errorMessage = handleApiError(apiError)
        setError(errorMessage)
        
        // Update user message status to error
        await updateDoc(userMessageRef, { status: 'error' })
        
        throw apiError
      }
      
    } catch (error: any) {
      console.error('Error sending message:', error)
      if (!error.message?.includes('status')) {
        // Only set error if it's not already handled above
        const errorMessage = handleApiError(error)
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteChat = async (chatId: string) => {
    try {
      // Find the chat to get its projectId before deletion
      const chatToDelete = chats.find(chat => chat.id === chatId)
      const projectId = chatToDelete?.projectId
      
      console.log(`🗑️ Deleting chat ${chatId} from project: ${projectId || 'No Project'}`)
      
      await deleteDoc(doc(db, 'chats', chatId))
      
      // Update project chat count if chat was in a project
      if (projectId) {
        console.log(`📊 Decreasing chatCount for project ${projectId} after deletion`)
        await updateDoc(doc(db, 'projects', projectId), {
          chatCount: increment(-1),
          updatedAt: new Date()
        })
      }
      
      if (currentChat?.id === chatId) {
        setCurrentChat(null)
      }
      
      console.log(`✅ Chat ${chatId} deleted and project count updated`)
      
    } catch (error: any) {
      console.error('❌ Error deleting chat:', error)
      const errorMessage = handleApiError(error)
      setError(errorMessage)
    }
  }

  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        title,
        updatedAt: new Date()
      })
    } catch (error: any) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
    }
  }

  const updateChatProject = async (chatId: string, projectId: string | null) => {
    try {
      // Find the current chat to get its current projectId
      const currentChat = chats.find(chat => chat.id === chatId)
      const oldProjectId = currentChat?.projectId || null
      
      console.log(`📦 Moving chat ${chatId}:`, {
        from: oldProjectId || 'No Project',
        to: projectId || 'No Project',
        chatTitle: currentChat?.title
      })
      
      // Update the chat's project
      const updateData: any = {
        updatedAt: new Date()
      }
      
      if (projectId === null) {
        updateData.projectId = deleteField()
      } else {
        updateData.projectId = projectId
      }
      
      await updateDoc(doc(db, 'chats', chatId), updateData)
      
      // Update project chat counts
      const updatePromises: Promise<void>[] = []
      
      // Decrease count from old project
      if (oldProjectId) {
        console.log(`📊 Decreasing chatCount for project ${oldProjectId}`)
        updatePromises.push(
          updateDoc(doc(db, 'projects', oldProjectId), {
            chatCount: increment(-1),
            updatedAt: new Date()
          })
        )
      }
      
      // Increase count for new project
      if (projectId) {
        console.log(`📊 Increasing chatCount for project ${projectId}`)
        updatePromises.push(
          updateDoc(doc(db, 'projects', projectId), {
            chatCount: increment(1),
            updatedAt: new Date()
          })
        )
      }
      
      // Execute all project updates
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }
      
      console.log(`✅ Chat ${chatId} successfully moved and project counts updated`)
      
    } catch (error: any) {
      console.error('❌ Error updating chat project:', error)
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      throw error
    }
  }

  const clearError = () => {
    setError(null)
  }

  const value: ChatContextType = {
    chats,
    currentChat,
    messages,
    loading,
    error,
    createChat,
    selectChat,
    sendMessage,
    deleteChat,
    updateChatTitle,
    updateChatProject,
    clearError
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}