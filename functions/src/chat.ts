import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'
import { HttpsError } from 'firebase-functions/v2/https'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAvailableModels as getModelCapabilities, convertToLegacyFormat } from './data/modelCapabilities'
import pdfParse from 'pdf-parse'
import * as xlsx from 'node-xlsx'
import * as mammoth from 'mammoth'
import { Readable } from 'stream'

// Initialize AI clients with environment variables (V2 style)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

const db = admin.firestore()

// File processing interfaces
interface ProcessedFile {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
  content: string
  fileType: 'document' | 'text' | 'pdf' | 'image' | 'other'
}

// File content extraction functions
// Used by OpenAI and other providers that cannot download files directly
async function extractFileContent(fileUrl: string, fileName: string, mimeType: string): Promise<string> {
  try {
    console.log(`📄 Extracting content from: ${fileName} (${mimeType})`)
    
    // Fetch file content
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }
    
    const buffer = await response.arrayBuffer()
    const data = Buffer.from(buffer)
    
    // Extract content based on file type
    switch (mimeType) {
      case 'application/pdf':
        return await extractPdfContent(data)
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractWordContent(data)
      
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return await extractExcelContent(data)
      
      case 'text/plain':
      case 'text/markdown':
      case 'application/json':
      case 'text/csv':
        return data.toString('utf-8')
      
      default:
        console.log(`⚠️ Unsupported file type: ${mimeType}`)
        return `[File: ${fileName} - Content extraction not supported for ${mimeType}]`
    }
  } catch (error) {
    console.error(`❌ Error extracting content from ${fileName}:`, error)
    return `[File: ${fileName} - Content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}]`
  }
}

async function extractPdfContent(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error('Failed to extract PDF content')
  }
}

async function extractWordContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('Error parsing Word document:', error)
    throw new Error('Failed to extract Word document content')
  }
}

async function extractExcelContent(buffer: Buffer): Promise<string> {
  try {
    const workbook = xlsx.parse(buffer)
    let content = ''
    
    workbook.forEach(sheet => {
      content += `Sheet: ${sheet.name}\n`
      sheet.data.forEach(row => {
        content += row.join('\t') + '\n'
      })
      content += '\n'
    })
    
    return content
  } catch (error) {
    console.error('Error parsing Excel file:', error)
    throw new Error('Failed to extract Excel content')
  }
}

function getFileType(mimeType: string): 'document' | 'text' | 'pdf' | 'image' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'document'
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text'
  return 'other'
}

// AI Provider configurations
interface AIProvider {
  name: string
  endpoint?: string
  headers?: Record<string, string>
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: { name: 'OpenAI' },
  google: { name: 'Google' },
  anthropic: { 
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01'
    }
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY || ''}`,
      'Content-Type': 'application/json'
    }
  },
  perplexity: {
    name: 'Perplexity',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || ''}`,
      'Content-Type': 'application/json'
    }
  }
}

// Helper function to call different AI providers
async function callAIProvider(provider: string, model: string, messages: any[]): Promise<any> {
  console.log(`🤖 Calling AI provider: ${provider} with model: ${model}`)
  
  // Debug: Check if any messages have images
  const messagesWithImages = messages.filter(msg => msg.images && msg.images.length > 0)
  console.log(`📊 Messages summary: Total=${messages.length}, WithImages=${messagesWithImages.length}`)
  
  if (messagesWithImages.length > 0) {
    console.log('📸 Messages with images:')
    messagesWithImages.forEach((msg, index) => {
      console.log(`  Message ${index + 1}: ${msg.images.length} images`)
      msg.images.forEach((img: any, imgIndex: number) => {
        console.log(`    Image ${imgIndex + 1}: ${img.url ? img.url.substring(0, 80) + '...' : 'NO URL'} (${img.mimeType})`)
      })
    })
  } else {
    console.log('❌ No messages with images detected')
  }
  
  try {
    switch (provider) {
      case 'openai':
        return await callOpenAI(model, messages)
      
      case 'google':
        return await callGoogle(model, messages)
      
      case 'anthropic':
        return await callAnthropic(model, messages)
      
      case 'deepseek':
        return await callDeepSeek(model, messages)
      
      case 'perplexity':
        return await callPerplexity(model, messages)
      
      default:
        throw new HttpsError('invalid-argument', `Unsupported provider: ${provider}`)
    }
  } catch (error: any) {
    console.error(`Error calling ${provider}:`, error)
    throw new HttpsError('internal', `AI provider error (${provider}): ${error.message}`)
  }
}

async function callOpenAI(model: string, messages: any[]) {
  console.log(`🔍 OpenAI processing ${messages.length} messages`)
  
  // Check what content types we have
  const hasFiles = messages.some(msg => msg.files && msg.files.length > 0)
  const hasImages = messages.some(msg => msg.images && msg.images.length > 0)
  
  console.log(`📊 Content analysis: Files=${hasFiles}, Images=${hasImages}`)
  
  if (hasFiles && !hasImages) {
    console.log(`📁 Files only - using OpenAI Assistants API`)
    return await callOpenAIWithAssistants(model, messages)
  }
  
  if (hasFiles && hasImages) {
    console.log(`📁🖼️ Files + Images - using hybrid approach with Chat Completions API`)
    return await callOpenAIWithFilesAndImages(model, messages)
  }
  
  // For images only or text only - use Chat Completions API
  console.log(`💬 Images only or text only - using Chat Completions API`)
  return await callOpenAIChatCompletions(model, messages)
}

async function callOpenAIWithAssistants(model: string, messages: any[]) {
  console.log(`🤖 Using OpenAI Assistants API for file processing`)
  
  try {
    // Step 1: Upload files to OpenAI
    const uploadedFiles = []
    for (const message of messages) {
      if (message.files && message.files.length > 0) {
        for (const file of message.files) {
          console.log(`📤 Uploading file: ${file.fileName}`)
          
          // Download file from Firebase Storage
          const response = await fetch(file.url)
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`)
          }
          
          const buffer = Buffer.from(await response.arrayBuffer())
          
          // Upload to OpenAI Files API using the file data
          const uploadedFile = await openai.files.create({
            file: buffer as any, // Type assertion for compatibility
            purpose: 'assistants'
          })
          
          uploadedFiles.push({
            id: uploadedFile.id,
            name: file.fileName,
            originalFile: file
          })
          
          console.log(`✅ File uploaded to OpenAI: ${uploadedFile.id}`)
        }
      }
    }
    
    // Step 2: Create Assistant with uploaded files
    const assistant = await openai.beta.assistants.create({
      name: "SideKick File Assistant",
      instructions: "You are a helpful assistant that can analyze uploaded files. Provide detailed analysis and answers based on the file content.",
      model: model,
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [], // Will be populated if needed
        }
      }
    })
    
    console.log(`🤖 Assistant created: ${assistant.id}`)
    
    // Step 3: Create Thread
    const thread = await openai.beta.threads.create()
    console.log(`💬 Thread created: ${thread.id}`)
    
    // Step 4: Add uploaded files to the thread and create messages
    for (const message of messages) {
      if (message.role === 'system') continue // Skip system messages for Assistants API
      
      let attachments = []
      if (message.files && message.files.length > 0) {
        // Find the corresponding uploaded files
        attachments = message.files.map((file: any) => {
          const uploadedFile = uploadedFiles.find(uf => uf.originalFile.fileName === file.fileName)
          if (uploadedFile) {
            return {
              file_id: uploadedFile.id,
              tools: [{ type: "file_search" }]
            }
          }
          return null
        }).filter(Boolean)
      }
      
      await openai.beta.threads.messages.create(thread.id, {
        role: message.role as 'user' | 'assistant',
        content: message.content,
        attachments: attachments
      })
    }
    
    // Step 5: Create and run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    })
    
    console.log(`🏃 Run started: ${run.id}`)
    
    // Step 6: Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      console.log(`⏳ Run status: ${runStatus.status}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    }
    
    if (runStatus.status === 'completed') {
      // Get the assistant's response
      const threadMessages = await openai.beta.threads.messages.list(thread.id)
      const assistantMessage = threadMessages.data.find(msg => msg.role === 'assistant')
      
      if (assistantMessage && assistantMessage.content.length > 0) {
        const content = assistantMessage.content[0]
        if (content.type === 'text') {
          console.log(`✅ Assistant response received`)
          
          // Cleanup: Delete assistant and uploaded files
          await openai.beta.assistants.delete(assistant.id)
          for (const uploadedFile of uploadedFiles) {
            await openai.files.delete(uploadedFile.id)
          }
          
          return {
            content: content.text.value,
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0
            }
          }
        }
      }
    } else {
      console.error(`❌ Run failed with status: ${runStatus.status}`)
      throw new Error(`Assistant run failed: ${runStatus.status}`)
    }
    
  } catch (error: any) {
    console.error('❌ OpenAI Assistants API Error:', error)
    throw error
  }
}

async function callOpenAIWithFilesAndImages(model: string, messages: any[]) {
  console.log(`🔧 Processing files and images with OpenAI native support`)
  
  try {
    // Step 1: Upload files to OpenAI and get URLs
    const uploadedFileUrls = []
    
    for (const message of messages) {
      if (message.files && message.files.length > 0) {
        console.log(`📤 Uploading ${message.files.length} files to OpenAI`)
        
        for (const file of message.files) {
          console.log(`📄 Uploading file: ${file.fileName}`)
          
          // Download file from Firebase Storage
          const response = await fetch(file.url)
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`)
          }
          
          const buffer = Buffer.from(await response.arrayBuffer())
          
          // Upload to OpenAI Files API
          const uploadedFile = await openai.files.create({
            file: buffer as any,
            purpose: 'assistants'  // Use assistants purpose to get a URL
          })
          
          console.log(`✅ File uploaded to OpenAI: ${uploadedFile.id}`)
          
          // Get the file URL from OpenAI
          const fileInfo = await openai.files.retrieve(uploadedFile.id)
          uploadedFileUrls.push({
            id: uploadedFile.id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            openaiUrl: `https://files.openai.com/files/${uploadedFile.id}`, // OpenAI file URL
            originalFile: file
          })
        }
      }
    }
    
    // Step 2: Convert messages to OpenAI format with both files and images
    const openaiMessages = messages.map(msg => {
      const content = []
      
      // Add text content
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        })
      }
      
      // Add files as URLs (like images)
      if (msg.files && msg.files.length > 0) {
        console.log(`📁 Adding ${msg.files.length} files as URLs to message`)
        
        msg.files.forEach((file: any) => {
          const uploadedFile = uploadedFileUrls.find(uf => uf.originalFile.fileName === file.fileName)
          if (uploadedFile) {
            console.log(`📄 Adding file URL: ${uploadedFile.fileName}`)
            
            // Add file reference (similar to image format)
            content.push({
              type: 'text',
              text: `[Attached File: ${uploadedFile.fileName} - Available at: ${uploadedFile.openaiUrl}]`
            })
          }
        })
      }
      
      // Add images
      if (msg.images && msg.images.length > 0) {
        console.log(`🖼️ Adding ${msg.images.length} images to message`)
        
        msg.images.forEach((image: any, index: number) => {
          console.log(`🖼️ Adding image ${index + 1}: ${image.url}`)
          
          if (image.url && image.url.startsWith('https://')) {
            content.push({
              type: 'image_url',
              image_url: {
                url: image.url,
                detail: 'auto'
              }
            })
          } else {
            console.error(`❌ Invalid image URL: ${image.url}`)
          }
        })
      }
      
      return {
        role: msg.role,
        content: content.length > 0 ? content : msg.content
      }
    })
    
    console.log(`✅ Processed ${openaiMessages.length} messages with ${uploadedFileUrls.length} uploaded files`)
    
    // Step 3: Use Chat Completions API with files and images
    const completion = await openai.chat.completions.create({
      model: model,
      messages: openaiMessages,
      max_tokens: 1000,
      temperature: 0.7,
    })
    
    console.log('✅ OpenAI Chat Completions API call successful with files and images')
    
    // Step 4: Cleanup uploaded files
    for (const uploadedFile of uploadedFileUrls) {
      try {
        await openai.files.delete(uploadedFile.id)
        console.log(`🗑️ Cleaned up uploaded file: ${uploadedFile.id}`)
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup file ${uploadedFile.id}:`, error)
      }
    }
    
    return {
      content: completion.choices[0].message.content || '',
      usage: completion.usage
    }
    
  } catch (error: any) {
    console.error('❌ Error in files+images processing:', error)
    throw error
  }
}

async function callOpenAIChatCompletions(model: string, messages: any[]) {
  console.log(`💬 Using Chat Completions API for ${messages.length} messages`)
  
  // Convert messages to OpenAI format with image support
  const openaiMessages = messages.map(msg => {
    if (msg.images && msg.images.length > 0) {
      console.log(`📸 Processing message with ${msg.images.length} images`)
      // For vision models, create content array with text and images
      const content = []
      
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        })
      }
      
      msg.images.forEach((image: any, index: number) => {
        console.log(`🖼️ Adding image ${index + 1}: ${image.url}`)
        
        // Validate URL format
        if (!image.url || !image.url.startsWith('https://')) {
          console.error(`❌ Invalid image URL: ${image.url}`)
          return
        }
        
        content.push({
          type: 'image_url',
          image_url: {
            url: image.url,
            detail: 'auto'
          }
        })
      })
      
      return {
        role: msg.role,
        content: content
      }
    } else {
      return {
        role: msg.role,
        content: msg.content
      }
    }
  })
  
  // Check if model supports vision
  const hasImages = openaiMessages.some(msg => 
    Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'image_url')
  )
  
  // List of OpenAI models that support vision
  const visionModels = [
    'gpt-4o', 'gpt-4o-2024-11-20', 'gpt-4o-2024-08-06', 'gpt-4o-2024-05-13',
    'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-4-turbo-2024-04-09',
    'gpt-4-vision-preview'
  ]
  const supportsVision = visionModels.includes(model) || visionModels.some(visionModel => model.includes(visionModel))
  
  console.log(`🔍 Model '${model}' vision support: ${supportsVision}`)
  
  if (hasImages && !supportsVision) {
    console.log(`⚠️ Model ${model} may not support images, but proceeding anyway`)
  }
  
  console.log(`📤 Sending to OpenAI Chat Completions API`)
  
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: openaiMessages,
      max_tokens: 1000,
      temperature: 0.7,
    })
    
    console.log('✅ OpenAI Chat Completions API call successful')
    
    return {
      content: completion.choices[0].message.content || '',
      usage: completion.usage
    }
  } catch (error: any) {
    console.error('❌ OpenAI Chat Completions API Error:', error)
    throw error
  }
}

async function callGoogle(model: string, messages: any[]) {
  // Map model names to correct API format
  let apiModel = model
  if (model === 'gemini-1.5-pro-latest') {
    apiModel = 'gemini-1.5-pro'
  } else if (model === 'gemini-2.0-flash-exp') {
    apiModel = 'gemini-2.0-flash-exp'
  } else if (model === 'gemini-1.5-flash-8b') {
    apiModel = 'gemini-1.5-flash-8b'
  }
  
  const genModel = genAI.getGenerativeModel({ model: apiModel })
  
  // Check if any message has images
  const hasImages = messages.some(m => m.images && m.images.length > 0)
  
  if (hasImages) {
    // For messages with images, use multimodal approach
    const lastMessage = messages[messages.length - 1]
    const parts = []
    
    // Add text content
    if (lastMessage.content) {
      parts.push({ text: lastMessage.content })
    }
    
    // Add images
    if (lastMessage.images) {
      for (const image of lastMessage.images) {
        try {
          // Convert image URL to base64 for Google AI
          const response = await fetch(image.url)
          const buffer = await response.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          
          parts.push({
            inlineData: {
              data: base64,
              mimeType: image.mimeType
            }
          })
        } catch (error) {
          console.error('Error processing image for Google AI:', error)
        }
      }
    }
    
    const result = await genModel.generateContent(parts)
    const response = await result.response
    
    return {
      content: response.text(),
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    }
  } else {
    // Text-only conversation
    const conversationMessages = messages.filter(m => m.role !== 'system')
    let prompt = ''
    
    // Add system message as context if exists
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage) {
      prompt += `Context: ${systemMessage.content}\n\n`
    }
    
    // Add conversation history
    prompt += conversationMessages.map(m => {
      const role = m.role === 'assistant' ? 'model' : 'user'
      return `${role}: ${m.content}`
    }).join('\n')
    
    const result = await genModel.generateContent(prompt)
    const response = await result.response
    
    return {
      content: response.text(),
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    }
  }
}

async function callAnthropic(model: string, messages: any[]) {
  console.log(`🔍 Anthropic processing ${messages.length} messages`)
  
  // Claude API requires system message to be separate
  const systemMessage = messages.find(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  
  // Convert messages to Anthropic format with image support
  const anthropicMessages = conversationMessages.map(msg => {
    if (msg.images && msg.images.length > 0) {
      console.log(`📸 Processing message with ${msg.images.length} images for Anthropic`)
      const content = []
      
      // Add text content
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        })
      }
      
      // Add images in Anthropic format
      msg.images.forEach((image: any, index: number) => {
        console.log(`🖼️ Adding image ${index + 1} to Anthropic: ${image.url}`)
        content.push({
          type: 'image',
          source: {
            type: 'url',
            url: image.url
          }
        })
      })
      
      return {
        role: msg.role,
        content: content
      }
    } else {
      return {
        role: msg.role,
        content: msg.content
      }
    }
  })
  
  console.log('📤 Sending to Anthropic with converted messages')
  
  const body: any = {
    model: model,
    max_tokens: 4096,
    messages: anthropicMessages
  }
  
  if (systemMessage) {
    body.system = systemMessage.content
  }
  console.log('Anthropic API response:', body.model) 
  const response = await fetch(AI_PROVIDERS.anthropic.endpoint!, {
    method: 'POST',
    headers: AI_PROVIDERS.anthropic.headers!,
    body: JSON.stringify(body)
  })
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  console.log('Anthropic API response:', JSON.stringify(data, null, 2))
  
  return {
    content: data.content && data.content[0] ? data.content[0].text : 'No response',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  }
}

async function callDeepSeek(model: string, messages: any[]) {
  const response = await fetch(AI_PROVIDERS.deepseek.endpoint!, {
    method: 'POST',
    headers: AI_PROVIDERS.deepseek.headers!,
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    })
  })
  
  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    usage: data.usage
  }
}

async function callPerplexity(model: string, messages: any[]) {
  const response = await fetch(AI_PROVIDERS.perplexity.endpoint!, {
    method: 'POST',
    headers: AI_PROVIDERS.perplexity.headers!,
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  const data = await response.json()
  console.log('Perplexity API response:', JSON.stringify(data, null, 2))
  
  return {
    content: data.choices && data.choices[0] ? data.choices[0].message.content : 'No response',
    usage: data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  }
}


// Create new chat
export const createNewChatV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { projectId } = request.data || {}
  const userId = request.auth.uid
  
  // If projectId is provided, verify user owns the project
  if (projectId) {
    const projectDoc = await db.collection('projects').doc(projectId).get()
    if (!projectDoc.exists || projectDoc.data()?.userId !== userId) {
      throw new HttpsError('permission-denied', 'Access denied to project')
    }
  }

  const chatData = {
    userId,
    projectId: projectId || null,
    title: 'New Chat',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: 0
  }

  try {
    const chatRef = await db.collection('chats').add(chatData)
    
    // Update project chat count if this chat belongs to a project
    if (projectId) {
      await db.collection('projects').doc(projectId).update({
        chatCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }
    
    return {
      id: chatRef.id,
      ...chatData,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } catch (error) {
    console.error('Error creating chat:', error)
    throw new HttpsError('internal', 'Failed to create chat')
  }
})

// Get available models from all providers
export const getAvailableModelsV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    console.log('🔍 Getting available models from capability database')
    
    // Check which API keys are available
    const apiKeys = {
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY
    }

    console.log('🔑 Available API keys:', apiKeys)

    // Get models from capability database based on available API keys
    const availableModels = getModelCapabilities(apiKeys)
    
    // Convert to legacy format for compatibility
    const legacyModels = availableModels.map(convertToLegacyFormat)

    console.log(`✅ Found ${legacyModels.length} available models`)

    return { models: legacyModels }
  } catch (error) {
    console.error('❌ Error getting available models:', error)
    throw new HttpsError('internal', 'Failed to get available models')
  }
})

// Helper functions to get models from each provider
async function getOpenAIModels() {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    }
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.data
    .filter((model: any) => 
      model.id.includes('gpt') && 
      !model.id.includes('dall-e') && 
      !model.id.includes('whisper') &&
      !model.id.includes('tts')
    )
    .map((model: any) => {
      // Check if model supports vision
      const supportsVision = model.id.includes('gpt-4o') || 
                           model.id.includes('vision') || 
                           model.id.includes('gpt-4-turbo')
      
      const capabilities = ['text', 'chat']
      if (supportsVision) {
        capabilities.push('multimodal')
      }
      
      return {
        id: model.id,
        name: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        provider: 'openai',
        description: `OpenAI ${model.id}${supportsVision ? ' (Vision)' : ''}`,
        capabilities,
        available: true,
        contextWindow: getContextWindow(model.id),
        maxTokens: 4096
      }
    })
}

async function getGoogleModels() {
  try {
    // Try to use Google's listModels API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return data.models
      .filter((model: any) => 
        model.name.includes('gemini') &&
        model.supportedGenerationMethods?.includes('generateContent') &&
        !model.name.includes('vision') // Filter out vision-only models
      )
      .map((model: any) => {
        // All Gemini models support multimodal
        const capabilities = ['text', 'chat', 'multimodal']
        
        return {
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name.replace('models/', '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          provider: 'google',
          description: (model.description || `Google ${model.name.replace('models/', '')}`) + ' (Vision)',
          capabilities,
          available: true,
          contextWindow: model.inputTokenLimit || 1000000,
          maxTokens: model.outputTokenLimit || 8192
        }
      })
  } catch (error) {
    console.error('Failed to fetch Google models via API, using fallback:', error)
    // Fallback to known models if API fails
    return [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
        provider: 'google',
        description: 'Google\'s latest experimental model with multimodal capabilities',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 1000000,
        maxTokens: 8192
      },
      {
        id: 'gemini-1.5-pro-latest',
        name: 'Gemini 1.5 Pro (Latest)',
        provider: 'google',
        description: 'Google\'s most capable production model',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 2000000,
        maxTokens: 8192
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        description: 'Fast and efficient Gemini model',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 1000000,
        maxTokens: 8192
      },
      {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash 8B',
        provider: 'google',
        description: 'Smaller, faster Gemini model',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 1000000,
        maxTokens: 8192
      }
    ]
  }
}

async function getAnthropicModels() {
  try {
    // Try to use Anthropic's models API (if available)
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.data
        .filter((model: any) => 
          model.type === 'model' &&
          !model.id.includes('embedding')
        )
        .map((model: any) => {
          // Check if Claude model supports vision (Claude 3+ models do)
          const supportsVision = model.id.includes('claude-3')
          const capabilities = ['text', 'chat']
          if (supportsVision) {
            capabilities.push('multimodal')
          }
          
          return {
            id: model.id,
            name: model.display_name || model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            provider: 'anthropic',
            description: (model.description || `Anthropic ${model.id}`) + (supportsVision ? ' (Vision)' : ''),
            capabilities,
            available: true,
            contextWindow: model.max_context_tokens || 200000,
            maxTokens: model.max_output_tokens || 8192
          }
        })
    } else {
      throw new Error(`Anthropic API error: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to fetch Anthropic models via API, using fallback:', error)
    // Fallback to known models if API fails
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        description: 'Most intelligent Claude model (Vision)',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        description: 'Most powerful Claude model (Vision)',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 200000,
        maxTokens: 4096
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        description: 'Fastest Claude model (Vision)',
        capabilities: ['text', 'chat', 'multimodal'],
        available: true,
        contextWindow: 200000,
        maxTokens: 4096
      }
    ]
  }
}

async function getDeepSeekModels() {
  // DeepSeek uses OpenAI-compatible API
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data.data
      .filter((model: any) => 
        model.id.includes('deepseek') && 
        !model.id.includes('embedding')
      )
      .map((model: any) => ({
        id: model.id,
        name: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        provider: 'deepseek',
        description: `DeepSeek ${model.id}`,
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 32000,
        maxTokens: 4096
      }))
  } catch (error) {
    // Fallback to known models
    return [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        description: 'DeepSeek conversational model',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 32000,
        maxTokens: 4096
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: 'deepseek',
        description: 'DeepSeek coding model',
        capabilities: ['text', 'chat', 'code'],
        available: true,
        contextWindow: 16000,
        maxTokens: 4096
      }
    ]
  }
}

async function getPerplexityModels() {
  try {
    // Try to fetch models from Perplexity API (may not exist)
    const response = await fetch('https://api.perplexity.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.data
        .filter((model: any) => 
          model.id && 
          !model.id.includes('embedding') &&
          !model.id.includes('vision')
        )
        .map((model: any) => ({
          id: model.id,
          name: model.name || model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          provider: 'perplexity',
          description: model.description || `Perplexity ${model.id}`,
          capabilities: ['text', 'chat', 'web_search'],
          available: true,
          contextWindow: model.context_window || 127072,
          maxTokens: model.max_tokens || 4096
        }))
    } else {
      throw new Error(`Perplexity API error: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to fetch Perplexity models via API, using fallback:', error)
    // Use comprehensive list of known Perplexity models
    return [
      {
        id: 'llama-3.1-sonar-huge-128k-online',
        name: 'Sonar Huge 128K Online',
        provider: 'perplexity',
        description: 'Largest web-connected model with real-time search',
        capabilities: ['text', 'chat', 'web_search'],
        available: true,
        contextWindow: 127072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large 128K Online',
        provider: 'perplexity',
        description: 'Large web-connected model with real-time search',
        capabilities: ['text', 'chat', 'web_search'],
        available: true,
        contextWindow: 127072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Sonar Small 128K Online',
        provider: 'perplexity',
        description: 'Fast web-connected model with real-time search',
        capabilities: ['text', 'chat', 'web_search'],
        available: true,
        contextWindow: 127072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-sonar-large-128k-chat',
        name: 'Sonar Large 128K Chat',
        provider: 'perplexity',
        description: 'Large model optimized for conversation',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 127072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-sonar-small-128k-chat',
        name: 'Sonar Small 128K Chat',
        provider: 'perplexity',
        description: 'Fast model optimized for conversation',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 127072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B Instruct',
        provider: 'perplexity',
        description: 'Instruction-following model',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 131072,
        maxTokens: 4096
      },
      {
        id: 'llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B Instruct',
        provider: 'perplexity',
        description: 'Large instruction-following model',
        capabilities: ['text', 'chat'],
        available: true,
        contextWindow: 131072,
        maxTokens: 4096
      }
    ]
  }
}

function getContextWindow(modelId: string): number {
  if (modelId.includes('gpt-4')) return 128000
  if (modelId.includes('gpt-3.5')) return 16385
  return 4096
}

// Get chat history
export const getChatHistoryV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const userId = request.auth.uid
  const { limit = 20, startAfter } = request.data

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
    throw new HttpsError('internal', 'Failed to get chat history')
  }
})

// Delete chat
export const deleteChatV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  invoker: 'public'
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId } = request.data
  const userId = request.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new HttpsError('permission-denied', 'Access denied')
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
    throw new HttpsError('internal', 'Failed to delete chat')
  }
})

// Update chat title
export const updateChatTitleV2 = onCall({
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId, title } = request.data
  const userId = request.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new HttpsError('permission-denied', 'Access denied')
    }

    await db.collection('chats').doc(chatId).update({
      title,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating chat title:', error)
    throw new HttpsError('internal', 'Failed to update chat title')
  }
})

// Send message V2 - Using invoker permissions to allow unauthenticated CORS
export const sendMessageV2 = onCall({
  memory: '1GiB',
  timeoutSeconds: 120,
  concurrency: 100,
  cors: [
    'https://sidekick-d87aa.web.app',
    'https://sidekick-d87aa.firebaseapp.com', 
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  invoker: 'public'  // Allow public access for CORS preflight
}, async (request) => {
  // Verify authentication for actual requests
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }

  const { chatId, content, images, files, model = 'gpt-4o-mini', provider = 'openai' } = request.data
  const userId = request.auth.uid

  try {
    // Verify user owns the chat
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
      throw new HttpsError('permission-denied', 'Access denied')
    }

    // Check user subscription and usage limits
    const userDoc = await db.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    if (!userData) {
      throw new HttpsError('not-found', 'User not found')
    }

    // Check usage limits for free tier
    if (userData.subscription.plan === 'free' && userData.usage.messagesThisMonth >= 10) {
      throw new HttpsError('resource-exhausted', 'Monthly message limit exceeded')
    }

    // Get chat history for context
    const messagesSnapshot = await db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(20)
      .get()

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data()
      const message: any = {
        role: data.role,
        content: data.content
      }
      
      // Only add images if they exist
      if (data.images && data.images.length > 0) {
        message.images = data.images
        console.log(`📚 Historical message with ${message.images.length} images found`)
      }
      
      return message
    })
    
    console.log(`📖 Loaded ${messages.length} historical messages from Firestore`)

    // Add project shared context if chat belongs to a project
    const chatData = chatDoc.data()
    if (chatData?.projectId) {
      const projectDoc = await db.collection('projects').doc(chatData.projectId).get()
      if (projectDoc.exists) {
        const projectData = projectDoc.data()
        
        // Add project context (same logic as V1)
        if (projectData?.settings?.instructions) {
          messages.unshift({
            role: 'system',
            content: `Project Instructions: ${projectData.settings.instructions}`
          } as any)
        }
        
        if (projectData?.sharedContext) {
          messages.unshift({
            role: 'system',
            content: `Project Context: ${projectData.sharedContext}`
          } as any)
        }
        
        if (projectData?.settings?.systemPrompt) {
          messages.unshift({
            role: 'system',
            content: projectData.settings.systemPrompt
          } as any)
        }
        
        if (projectData?.settings?.files && projectData.settings.files.length > 0) {
          const fileContext = projectData.settings.files
            .filter((file: any) => file.content)
            .map((file: any) => `File: ${file.name}\nContent: ${file.content}`)
            .join('\n\n')
          
          if (fileContext) {
            messages.unshift({
              role: 'system',
              content: `Project Files:\n${fileContext}`
            } as any)
          }
        }
      }
    }

    // Add file content for AI providers that can't download URLs (like OpenAI)
    if (files && files.length > 0) {
      console.log(`📁 Processing ${files.length} files for ${provider}`)
      
      if (provider === 'openai') {
        // OpenAI cannot download files, so we extract content server-side
        console.log(`📄 Extracting file contents for OpenAI`)
        
        const fileContents = await Promise.all(
          files.map(async (file) => {
            const content = await extractFileContent(file.url, file.fileName, file.mimeType)
            return `=== FILE: ${file.fileName} (${file.mimeType}) ===\n${content}\n=== END FILE ===`
          })
        )
        
        const allFileContent = fileContents.join('\n\n')
        messages.push({
          role: 'system',
          content: `The following files have been uploaded and their content extracted:\n\n${allFileContent}`
        } as any)
        
        console.log(`✅ Extracted content from ${files.length} files for OpenAI`)
      } else {
        // Other providers - provide URLs for direct download
        const fileList = files
          .map(file => `File: ${file.fileName} (${file.mimeType})\nURL: ${file.url}`)
          .join('\n\n')
        
        messages.push({
          role: 'system',
          content: `Please download and analyze the following files:\n\n${fileList}\n\nNote: These files are stored in Firebase Storage with public read access. You can download them directly using the provided URLs.`
        } as any)
        
        console.log(`✅ Added ${files.length} file URLs for ${provider}`)
      }
    }

    // Add user message to context
    const userMessage: any = { role: 'user', content }
    if (images && images.length > 0) {
      userMessage.images = images
      console.log(`✅ Added ${images.length} images to user message`)
      images.forEach((img: any, index: number) => {
        console.log(`  Image ${index + 1}: ${img.url ? img.url.substring(0, 80) + '...' : 'NO URL'} (${img.mimeType}, ${img.fileSize} bytes)`)
      })
    } else {
      console.log('ℹ️ No images provided for this message')
    }
    
    if (files && files.length > 0) {
      userMessage.files = files
      console.log(`✅ Added ${files.length} files to user message`)
    }
    
    messages.push(userMessage)
    
    console.log(`📝 User message structure:`, {
      role: userMessage.role,
      contentLength: userMessage.content?.length || 0,
      hasImages: !!(userMessage.images && userMessage.images.length > 0),
      imageCount: userMessage.images ? userMessage.images.length : 0
    })

    console.log(`🚀 V2 Processing query for ${provider}/${model}:`, {
      provider,
      model,
      messagesCount: messages.length,
      hasImages: images && images.length > 0,
      imageCount: images ? images.length : 0,
      lastMessageImages: messages[messages.length - 1]?.images?.length || 0,
      userId,
      chatId,
      projectId: chatData?.projectId || 'none'
    })
    
    // Debug: Log image details if present
    if (images && images.length > 0) {
      console.log(`📸 Image details:`, images.map(img => ({
        url: img.url,
        mimeType: img.mimeType,
        size: img.size
      })))
    }

    // Debug: Log final message structure before sending to AI
    console.log('🔍 Final message structure before AI call:', JSON.stringify(messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : '[complex content]',
      hasImages: !!(msg.images && msg.images.length > 0),
      imageCount: msg.images ? msg.images.length : 0,
      imageDetails: msg.images ? msg.images.map(img => ({
        url: img.url ? img.url.substring(0, 50) + '...' : 'no url',
        mimeType: img.mimeType,
        size: img.fileSize
      })) : []
    })), null, 2))
    
    // Call AI provider using existing function
    const aiResponse = await callAIProvider(provider, model, messages)
    
    const assistantContent = aiResponse.content
    const usage = aiResponse.usage

    // Create response message
    const messageData = {
      id: admin.firestore().collection('temp').doc().id,
      chatId,
      role: 'assistant',
      content: assistantContent,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      model,
      provider,
      tokenCount: usage?.total_tokens || 0,
      status: 'sent',
      version: 'v2' // Mark as V2 response
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
      },
      version: 'v2'
    }
  } catch (error) {
    console.error('❌ V2 Error sending message:', error)
    throw new HttpsError('internal', 'Failed to send message')
  }
})