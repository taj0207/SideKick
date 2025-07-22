import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

// Firebase configuration - replace with actual values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    // Check if emulator is running before connecting
    if (!auth.currentUser) { // Only connect if not already connected
      connectAuthEmulator(auth, 'http://localhost:9099')
      console.log('Connected to Auth emulator')
    }
    
    // Check if Firestore emulator connection exists
    if (!(db as any)._delegate._databaseId.projectId.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080)
      console.log('Connected to Firestore emulator')
    }
    
    connectFunctionsEmulator(functions, 'localhost', 5001)
    connectStorageEmulator(storage, 'localhost', 9199)
    console.log('Connected to Firebase emulators')
  } catch (error) {
    console.warn('Firebase emulators not available or already connected:', error)
    console.log('Using production Firebase services')
  }
} else {
  console.log('Using production Firebase services')
}

export default app