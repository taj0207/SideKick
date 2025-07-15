export interface Message {
  id: string
  chatId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model: 'gpt-4'
  tokenCount?: number
  status: 'sending' | 'sent' | 'error'
}

export interface Chat {
  id: string
  userId: string
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
  createChat: () => Promise<Chat>
  selectChat: (chatId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  updateChatTitle: (chatId: string, title: string) => Promise<void>
  clearError: () => void
}

export interface SendMessageRequest {
  chatId: string
  content: string
  model: 'gpt-4'
}

export interface SendMessageResponse {
  message: Message
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}