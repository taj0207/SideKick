import { Timestamp } from 'firebase/firestore'

export interface MessageImage {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface MessageFile {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
  content?: string // Text content for text files
  fileType: 'document' | 'text' | 'pdf' | 'image' | 'other'
}

export interface Message {
  id: string
  chatId: string
  role: 'user' | 'assistant'
  content: string
  images?: MessageImage[]
  files?: MessageFile[]
  timestamp: Date | Timestamp
  model?: string
  provider?: string
  tokenCount?: number
  status: 'sending' | 'sent' | 'error'
}

export interface Chat {
  id: string
  userId: string
  projectId?: string
  title: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
  lastMessage?: Message
}

export interface ChatContextType {
  chats: Chat[]
  currentChat: Chat | null
  messages: Message[]
  loading: boolean
  error: string | null
  createChat: (data?: { projectId?: string }) => Promise<Chat>
  selectChat: (chatId: string) => Promise<void>
  sendMessage: (content: string, images?: File[], files?: File[]) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  updateChatTitle: (chatId: string, title: string) => Promise<void>
  updateChatProject: (chatId: string, projectId: string | null) => Promise<void>
  clearError: () => void
}

export interface SendMessageRequest {
  chatId: string
  content: string
  images?: MessageImage[]
  files?: MessageFile[]
  model: string
  provider: string
}

export interface SendMessageResponse {
  message: Message
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}