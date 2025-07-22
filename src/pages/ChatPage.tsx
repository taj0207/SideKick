import { useChat } from '@/contexts/ChatContext'
import { MessageCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChatInterface from '@/components/chat/ChatInterface'
import ProjectSidebar from '@/components/sidebar/ProjectSidebar'

export default function ChatPage() {
  const { currentChat, createChat } = useChat()

  const handleCreateChat = async () => {
    try {
      await createChat()
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Project Sidebar */}
      <ProjectSidebar />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Fixed Chat Header */}
            <div className="sticky top-0 z-10 p-4 border-b bg-background">
              <h1 className="font-semibold">{currentChat.title}</h1>
            </div>
            
            {/* Chat Interface */}
            <div className="flex-1 overflow-hidden">
              <ChatInterface chat={currentChat} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-24 w-24 mx-auto mb-4 opacity-50" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to SideKick</h2>
              <p className="text-muted-foreground mb-6">Start a conversation with your AI assistant</p>
              <Button onClick={handleCreateChat}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}