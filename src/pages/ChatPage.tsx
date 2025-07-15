import { useAuth } from '@/contexts/AuthContext'
import { useChat } from '@/contexts/ChatContext'
import { Button } from '@/components/ui/button'
import { MessageCircle, Plus, Settings, User } from 'lucide-react'

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { chats, currentChat, createChat } = useChat()

  const handleCreateChat = async () => {
    try {
      await createChat()
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="font-semibold">SideKick</span>
            </div>
            <Button size="sm" onClick={handleCreateChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-4">
          {chats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentChat?.id === chat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium truncate">{chat.title}</div>
                  <div className="text-xs opacity-70">
                    {chat.messageCount} messages
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* User Menu */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span className="text-sm font-medium">{user?.displayName}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button size="sm" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {user?.subscription.plan === 'free' ? 'Free Plan' : 'Pro Plan'}
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b">
              <h1 className="font-semibold">{currentChat.title}</h1>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center text-muted-foreground py-20">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Chat interface coming soon...</p>
                <p className="text-sm">This will be implemented in the next step</p>
              </div>
            </div>
            
            {/* Input Area */}
            <div className="p-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
                <Button disabled>
                  Send
                </Button>
              </div>
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