# SideKick

An AI-powered browser extension and cross-platform assistant that brings advanced AI capabilities directly to your browsing experience.

## Overview

SideKick is a comprehensive AI assistant platform featuring a browser extension with sidebar chat interface, multi-model AI support, and powerful web page processing tools. Built with Firebase backend and Stripe payment integration for subscription management.

## Architecture & Technology Stack

### Core Technologies
- **Frontend**: React + TypeScript, shadcn/ui + Tailwind CSS
- **State Management**: Redux Toolkit or Context API
- **Build Tool**: Vite
- **Backend**: Firebase (Authentication, Firestore, Functions, Hosting)
- **Payments**: Stripe integration
- **Cross-Platform**: Electron (Desktop), React Native (Mobile)
- **AI Models**: OpenAI GPT-4, Anthropic Claude, Google Gemini

## Implementation Plan

### 1. Authentication & Subscription Management (🔐 Backend Core)
- **OAuth 2.0** integration with Authorization Code + PKCE
- **JWT token** issuance and validation using Firebase Auth
- **Subscription tiers**: 
  - Free (基礎功能)
  - Monthly $29 (標準AI模型)
  - Monthly Pro $99 (進階AI模型 + 進階功能)
  - Yearly Pro $899 (年費優惠 + 全功能)
- **Stripe payment** gateway with automatic billing and renewal
- **Auto-renewal & cancellation** management (取消到當期結束後生效)

### 2. Firebase Backend Architecture

#### 2.1 Firebase Setup & Best Practices
```bash
# Project initialization
firebase init
# Select: Authentication, Firestore, Functions, Hosting
```

**Environment Configuration**:
- Frontend: `firebaseConfig` in environment variables
- Functions: `process.env` for API keys and sensitive parameters

**Authentication Providers**:
- Email/Password, Google, Facebook OAuth
- Callback domain configuration in Firebase Console

#### 2.2 Firestore Database Structure
```
users/{userId}/
  ├── subscriptions/     # 訂閱方案狀態
  └── preferences/       # 使用者偏好設定

chats/{chatId}/
  └── messages/{messageId}/  # 對話訊息 (含索引優化)
```

#### 2.3 Cloud Functions Architecture
**Callable Functions**:
- `getSubscription` - 檢查訂閱狀態
- `sendMessage` - 處理AI模型調用
- `streamResponse` - 即時串流回應

**Security Rules Example**:
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId}/messages/{messageId} {
      allow read, write: if request.auth.uid != null && 
                           resource.data.userId == request.auth.uid;
    }
  }
}
```

**Deployment**:
```bash
npm run build && firebase deploy --only hosting,functions
```

### 3. Web Application (MVP) - ChatGPT-like Interface

#### 3.1 UI Design & Interaction (參考 OpenAI ChatGPT)

**Layout Structure**:
- **Left Panel**: Chat history, model selection, new chat button
- **Right Panel**: Main chat interface

**Message Design**:
- Different colors for user/AI messages with rounded corners
- Source labels and timestamps (YYYY-MM-DD HH:mm:ss format)
- Hover for relative time ("3 minutes ago")

**Real-time Features**:
- **Streaming responses**: Character-by-character rendering
- **Loading animations**: Cursor and progress indicators
- **Quick actions**: Copy, edit, favorite, delete buttons (hover display)

**Input Interface**:
- **Markdown support**: Code blocks, formatting
- **Keyboard shortcuts**: Enter to send, Shift+Enter for new line
- **Smart suggestions**: Dropdown with intelligent suggestions and command history

**Settings & Theme**:
- **Theme toggle**: Light/dark mode switching
- **Language settings**: Multi-language support
- **User profile**: Account management and logout

**Advanced Features (Pro)**:
- **API key configuration**: Custom model endpoints
- **System prompt templates**: Custom template management
- **Model caching**: Performance optimization settings

#### 3.2 State Management & Caching

**Local Storage**:
- **IndexedDB/localStorage**: Recent conversation caching
- **Redux Store**: Current session state management
- **Error Handling**: Global error boundary with toast notifications

#### 3.3 Responsive Design & Browser Compatibility

**Responsive Breakpoints**: Tailwind CSS responsive design
**Browser Support**: Chrome, Firefox, Edge, Safari

#### 3.4 Testing Strategy

**Unit Testing**: Jest + React Testing Library
**E2E Testing**: Playwright automation
**Performance**: Lighthouse automated reports
**Stress Testing**: 
- **Gremlins.js**: Random UI event testing (clicks, scrolls, inputs)
- **Fuzz Testing**: Jest-Fuzz/node-fuzz for parameter validation
- **Advanced**: Fuzzilli for JavaScript engine-level testing

#### 3.5 Deployment Pipeline

**CDN**: Netlify or Vercel for static assets
**CI/CD**: GitHub Actions for automated build and deployment
```bash
# Production & Staging environments
npm run build && firebase deploy --only hosting,functions
```

## MVP (Minimum Viable Product) Detailed Specifications

### MVP Scope & Features

#### Core Features (Must Have)
- ✅ **User Authentication**: Email/password + Google OAuth
- ✅ **Basic Chat Interface**: Single conversation with GPT-4
- ✅ **Subscription Management**: Free tier + Monthly Pro ($99)
- ✅ **Message History**: Persistent conversation storage
- ✅ **Responsive Design**: Desktop and mobile web interface

#### MVP Exclusions (Future Releases)
- ❌ Browser extension
- ❌ Multi-model support (Claude, Gemini)
- ❌ Document upload/PDF processing
- ❌ Image generation
- ❌ Advanced features (custom prompts, API keys)

### MVP Technical Architecture

#### Frontend Structure
```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── AuthGuard.tsx
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── MessageBubble.tsx
│   ├── subscription/
│   │   ├── PricingPlans.tsx
│   │   ├── PaymentForm.tsx
│   │   └── SubscriptionStatus.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Layout.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useChat.ts
│   └── useSubscription.ts
├── services/
│   ├── firebase.ts
│   ├── api.ts
│   └── stripe.ts
└── types/
    ├── auth.ts
    ├── chat.ts
    └── subscription.ts
```

#### MVP Database Schema (Firestore)
```javascript
// Users collection
users/{userId} {
  email: string,
  displayName: string,
  photoURL?: string,
  createdAt: timestamp,
  lastLoginAt: timestamp,
  subscription: {
    plan: 'free' | 'monthly_pro',
    status: 'active' | 'canceled' | 'past_due',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    currentPeriodEnd?: timestamp,
    cancelAtPeriodEnd: boolean
  },
  usage: {
    messagesThisMonth: number,
    resetDate: timestamp
  }
}

// Chats collection
chats/{chatId} {
  userId: string,
  title: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  messageCount: number
}

// Messages subcollection
chats/{chatId}/messages/{messageId} {
  role: 'user' | 'assistant',
  content: string,
  timestamp: timestamp,
  model: 'gpt-4',
  tokenCount?: number,
  status: 'sending' | 'sent' | 'error'
}
```

#### MVP API Endpoints (Cloud Functions)

**Authentication Functions:**
```typescript
// Already handled by Firebase Auth
```

**Chat Functions:**
```typescript
// functions/src/chat.ts
export const sendMessage = functions.https.onCall(async (data, context) => {
  // 1. Verify user authentication
  // 2. Check subscription limits
  // 3. Call OpenAI GPT-4 API
  // 4. Save message to Firestore
  // 5. Return response
});

export const getChatHistory = functions.https.onCall(async (data, context) => {
  // 1. Verify user authentication
  // 2. Fetch user's chats with pagination
  // 3. Return formatted chat list
});

export const createNewChat = functions.https.onCall(async (data, context) => {
  // 1. Verify user authentication
  // 2. Create new chat document
  // 3. Return chat ID
});
```

**Subscription Functions:**
```typescript
// functions/src/subscription.ts
export const createStripeCustomer = functions.https.onCall(async (data, context) => {
  // 1. Create Stripe customer
  // 2. Save customer ID to user document
});

export const createSubscription = functions.https.onCall(async (data, context) => {
  // 1. Create Stripe subscription
  // 2. Update user subscription status
});

export const handleStripeWebhook = functions.https.onRequest(async (req, res) => {
  // Handle subscription status changes
});
```

### MVP User Flows

#### 1. User Registration & Onboarding
```
1. User visits landing page
2. Click "Sign Up" → Register form
3. Enter email/password OR Google OAuth
4. Email verification (if email/password)
5. Redirect to chat interface
6. Show welcome message with usage limits
7. Optional: Show pricing plans for upgrade
```

#### 2. Free Tier Chat Flow
```
1. User types message in input field
2. Click send OR press Enter
3. Show "typing" indicator
4. Display streaming response
5. Save conversation to Firestore
6. Update usage counter
7. Show upgrade prompt if approaching limit
```

#### 3. Subscription Upgrade Flow
```
1. User clicks "Upgrade" button
2. Show pricing plans modal
3. Select Monthly Pro ($99)
4. Redirect to Stripe Checkout
5. Complete payment
6. Webhook updates subscription status
7. Redirect back with success message
8. Remove usage limitations
```

### MVP UI/UX Specifications

#### Landing Page Requirements
- **Hero Section**: Clear value proposition and "Try Free" CTA
- **Features**: 3-4 key benefits with icons
- **Pricing**: Free vs Pro comparison table
- **Social Proof**: Testimonials or user count
- **Footer**: Links to privacy policy, terms of service

#### Chat Interface Requirements
- **Header**: Logo, user avatar, subscription status, settings menu
- **Sidebar**: Chat history list, new chat button, usage indicator
- **Main Area**: Message thread with user/AI message bubbles
- **Input**: Text area with send button, character/token counter
- **Mobile**: Collapsible sidebar, touch-friendly buttons

#### Authentication UI
- **Login Form**: Email/password fields, Google OAuth button, forgot password link
- **Register Form**: Email/password/confirm, Google OAuth, terms checkbox
- **Error Handling**: Clear error messages for failed attempts

### MVP Performance Requirements

#### Response Time Targets
- **Page Load**: < 2 seconds initial load
- **Chat Response**: < 5 seconds for GPT-4 response
- **Message Send**: < 500ms to show in interface
- **Authentication**: < 3 seconds for login/register

#### Scalability Targets
- **Concurrent Users**: Support 100 simultaneous users
- **Messages/Day**: Handle 10,000 messages daily
- **Database**: Efficient queries with proper indexing
- **CDN**: Static assets served from global CDN

### MVP Security Requirements

#### Authentication Security
- **Password Policy**: Minimum 8 characters with complexity requirements
- **Session Management**: Secure JWT tokens with expiration
- **OAuth Security**: Proper PKCE implementation for Google OAuth
- **Rate Limiting**: Prevent brute force attacks

#### API Security
- **CORS Configuration**: Restrict to allowed origins
- **Input Validation**: Sanitize all user inputs
- **Authorization**: Verify user permissions for all operations
- **Secrets Management**: Use Firebase environment variables

#### Data Protection
- **Firestore Rules**: Restrict access to user's own data only
- **PII Handling**: Minimal collection and secure storage
- **Conversation Privacy**: Users can only access their own chats
- **Payment Security**: PCI compliance through Stripe

### MVP Testing Strategy

#### Unit Testing (80% Coverage Target)
- **Components**: React component rendering and interactions
- **Hooks**: Custom hooks logic and state management
- **Services**: API calls and Firebase operations
- **Utils**: Helper functions and data transformations

#### Integration Testing
- **Authentication Flow**: Complete login/register process
- **Chat Flow**: Send message and receive response
- **Subscription Flow**: Payment and upgrade process
- **Error Handling**: Network failures and API errors

#### E2E Testing (Critical Paths)
- **User Registration**: Complete onboarding flow
- **First Chat**: Send first message and get response
- **Subscription**: Upgrade to Pro plan
- **Responsive**: Mobile and desktop compatibility

### MVP Deployment Strategy

#### Infrastructure Requirements
- **Firebase Hosting**: Static site hosting with CDN
- **Cloud Functions**: Serverless backend (Node.js 18)
- **Firestore**: NoSQL database with security rules
- **Firebase Authentication**: User management
- **Stripe**: Payment processing
- **Domain**: Custom domain with SSL certificate

#### Environment Setup
```bash
# Development
npm run dev              # Local development server
firebase emulators:start # Local Firebase emulators

# Staging
firebase use staging
firebase deploy

# Production
firebase use production
firebase deploy --only hosting,functions
```

#### Monitoring & Analytics
- **Firebase Analytics**: User behavior and engagement
- **Cloud Functions Logs**: Error tracking and performance
- **Stripe Dashboard**: Payment and subscription metrics
- **Google Analytics**: Traffic and conversion tracking

### MVP Success Metrics

#### Technical Metrics
- **Uptime**: > 99.5% availability
- **Performance**: Page load < 2s, API response < 5s
- **Error Rate**: < 1% of requests fail
- **Test Coverage**: > 80% code coverage

#### Business Metrics
- **User Registration**: 100 users in first month
- **Conversion Rate**: 10% free to paid conversion
- **User Retention**: 40% week-1 retention
- **Revenue**: $1000 MRR within 3 months

#### User Experience Metrics
- **Task Completion**: 90% successful chat completion
- **User Satisfaction**: NPS score > 50
- **Support Tickets**: < 5% users need support
- **Feature Usage**: Average 10 messages per session

### MVP Development Timeline

#### Week 1-2: Foundation
- Firebase project setup and configuration
- Basic React app with TypeScript and Tailwind
- Authentication system (email/password + Google OAuth)
- Basic UI layout and navigation

#### Week 3-4: Core Chat Functionality
- Chat interface with message bubbles
- OpenAI GPT-4 integration
- Message persistence in Firestore
- Real-time message updates

#### Week 5-6: Subscription System
- Stripe integration and payment flow
- Subscription management in Firebase
- Usage tracking and limitations
- Pricing page and upgrade flow

#### Week 7-8: Polish & Testing
- Responsive design improvements
- Error handling and loading states
- Comprehensive testing (unit, integration, E2E)
- Performance optimization

#### Week 9-10: Deployment & Launch
- Production deployment setup
- Security audit and penetration testing
- Beta testing with limited users
- MVP launch and monitoring setup

### 4. Browser Extension (側邊欄聊天介面)
- **Manifest V3** compliant sidebar chat interface
- **Multi-Model Support**: GPT-4, Claude, Gemini parallel processing
- **Security**: Permission and content injection safety checks
- **Shortcuts**: Keyboard and toolbar trigger registration
- **Real-time Communication**: Connection and authentication with backend chat API

### 5. Advanced AI Features

#### 5.1 🌐 Web Page Processing Tools
- **Page Summarization**: Full page content analysis and summarization
- **Text Processing**: Selected text translation, rewriting, and explanation
- **Context Integration**: Seamless web content interaction

#### 5.2 📄 Document & PDF Interaction
- **File Support**: PDF/Word upload and text extraction
- **ChatPDF**: Interactive document Q&A functionality
- **Document Analysis**: Advanced parsing and content understanding

#### 5.3 🎨 Image Generation & Editing
- **Text-to-Image**: AI-powered image generation API integration
- **Image Processing**: Background removal, inpainting, upscaling
- **Creative Tools**: Advanced editing capabilities

#### 5.4 💻 Code Understanding & Assistance
- **Code Analysis**: Snippet parsing, annotation, and optimization suggestions
- **Syntax Highlighting**: Enhanced code display with language detection
- **Debugging Assistant**: Error troubleshooting and debugging support

#### 5.5 🔍 Deep Research Agent (搜尋代理)
- **Search Integration**: Bing/Google API with multi-source aggregation
- **Deduplication**: Smart result filtering and consolidation
- **Citation Formatting**: Automatic key point extraction with proper citations

#### 5.6 📚 Personal Knowledge Base (Wisebase)
- **Data Storage**: Chat logs, reports, notes with persistent storage
- **Search Capabilities**: Full-text and vector search functionality
- **Knowledge Retrieval**: Intelligent information retrieval system

### 6. Cross-Platform Expansion

#### 6.1 🌍 Platform Support
- **Desktop Application**: Electron-based cross-platform app
- **Mobile Applications**: iOS and Android native apps
- **Browser Extension**: Chrome, Firefox, Edge compatibility

#### 6.2 🔔 Notifications & Integration
- **System Notifications**: Desktop push notifications and alerts
- **Context Menus**: Right-click integration and sharing features
- **Quick Access**: Streamlined user interactions across platforms

### 7. Backend Management & Operations

#### 7.1 ⚙️ Infrastructure & Monitoring
- **API Gateway**: Rate limiting, access control, and traffic management
- **Logging System**: Error tracking and performance monitoring
- **Analytics**: Usage statistics, system health, and user behavior analysis

#### 7.2 🎛️ Personalization & Configuration
- **User Preferences**: Default models, response styles, language options
- **Template Management**: Custom prompt template creation and management
- **Profile System**: Personalized AI assistant behavior and settings

## Development Roadmap

### Phase 1: Core Infrastructure (MVP)
1. Firebase backend setup with authentication
2. Basic web chat interface (ChatGPT-like)
3. Stripe subscription integration
4. Single AI model integration (GPT-4)

### Phase 2: Enhanced Features
1. Multi-model support (Claude, Gemini)
2. Browser extension development
3. Web page processing tools
4. Document upload and processing

### Phase 3: Advanced Capabilities
1. Image generation and editing
2. Code analysis tools
3. Research agent with web search
4. Personal knowledge base

### Phase 4: Platform Expansion
1. Desktop application (Electron)
2. Mobile applications (iOS/Android)
3. Advanced personalization features
4. Enterprise features and API

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase CLI
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/taj0207/SideKick.git
cd SideKick

# Install dependencies
npm install

# Firebase setup
firebase init

# Environment configuration
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Development
```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
