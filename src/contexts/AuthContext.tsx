import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'
import type { User, AuthContextType, LoginCredentials, RegisterCredentials } from '@/types/auth'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getUserDocument(firebaseUser.uid)
        setUser(userDoc)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const getUserDocument = async (uid: string): Promise<User> => {
    const userDocRef = doc(db, 'users', uid)
    
    try {
      const userDoc = await getDoc(userDocRef)
      
      if (userDoc.exists()) {
        const data = userDoc.data()
        
        // Handle potential missing fields gracefully
        const userData: User = {
          uid,
          email: data.email || auth.currentUser?.email || '',
          displayName: data.displayName || auth.currentUser?.displayName || '',
          photoURL: data.photoURL || auth.currentUser?.photoURL || undefined,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          lastLoginAt: data.lastLoginAt ? data.lastLoginAt.toDate() : new Date(),
          subscription: data.subscription || {
            plan: 'free',
            status: 'active',
            cancelAtPeriodEnd: false
          },
          usage: {
            messagesThisMonth: data.usage?.messagesThisMonth || 0,
            resetDate: data.usage?.resetDate ? data.usage.resetDate.toDate() : new Date()
          }
        }
        
        return userData
      } else {
        // Create new user document
        const newUser: User = {
          uid,
          email: auth.currentUser?.email || '',
          displayName: auth.currentUser?.displayName || '',
          photoURL: auth.currentUser?.photoURL || undefined,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          subscription: {
            plan: 'free',
            status: 'active',
            cancelAtPeriodEnd: false
          },
          usage: {
            messagesThisMonth: 0,
            resetDate: new Date()
          }
        }
        
        await setDoc(userDocRef, newUser)
        
        return newUser
      }
    } catch (error) {
      console.error('Error getting user document:', error)
      
      // Fallback: create minimal user object if document retrieval fails
      const fallbackUser: User = {
        uid,
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || '',
        photoURL: auth.currentUser?.photoURL || undefined,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        subscription: {
          plan: 'free',
          status: 'active',
          cancelAtPeriodEnd: false
        },
        usage: {
          messagesThisMonth: 0,
          resetDate: new Date()
        }
      }
      
      return fallbackUser
    }
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
      
      // Update last login time (create document if it doesn't exist)
      if (userCredential.user) {
        try {
          const userDocRef = doc(db, 'users', userCredential.user.uid)
          
          // Check if document exists first
          const userDoc = await getDoc(userDocRef)
          
          if (userDoc.exists()) {
            // Document exists, update it
            await updateDoc(userDocRef, {
              lastLoginAt: new Date()
            })
          } else {
            // Document doesn't exist, create it
            console.log('User document not found, creating new one during login')
            const newUser = {
              uid: userCredential.user.uid,
              email: userCredential.user.email || '',
              displayName: userCredential.user.displayName || '',
              photoURL: userCredential.user.photoURL || null,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              subscription: {
                plan: 'free',
                status: 'active',
                cancelAtPeriodEnd: false
              },
              usage: {
                messagesThisMonth: 0,
                resetDate: new Date()
              }
            }
            await setDoc(userDocRef, newUser)
          }
        } catch (updateError) {
          console.warn('Failed to update/create user document during login:', updateError)
          // Don't fail the login if we can't update the timestamp
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Login failed'
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address'
          break
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password'
          break
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address'
          break
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled'
          break
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later'
          break
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection'
          break
        default:
          errorMessage = error.message || 'Login failed'
      }
      
      throw new Error(errorMessage)
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      )
      
      // Update Firebase Auth profile
      await updateFirebaseProfile(firebaseUser, {
        displayName: credentials.displayName
      })
      
      // Create user document in Firestore immediately
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const newUser = {
        uid: firebaseUser.uid,
        email: credentials.email,
        displayName: credentials.displayName,
        photoURL: null,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        subscription: {
          plan: 'free',
          status: 'active',
          cancelAtPeriodEnd: false
        },
        usage: {
          messagesThisMonth: 0,
          resetDate: new Date()
        }
      }
      
      await setDoc(userDocRef, newUser)
      console.log('User document created successfully')
      
    } catch (error: any) {
      console.error('Registration error:', error)
      
      // Clean up: if user was created but document creation failed, try to delete the auth user
      if (auth.currentUser && error.message.includes('Firestore')) {
        try {
          await auth.currentUser.delete()
          console.log('Cleaned up auth user after Firestore error')
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError)
        }
      }
      
      // Provide specific error messages
      let errorMessage = 'Registration failed'
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists'
          break
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address'
          break
        case 'auth/weak-password':
          errorMessage = 'Password is too weak'
          break
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection'
          break
        default:
          errorMessage = error.message || 'Registration failed'
      }
      
      throw new Error(errorMessage)
    }
  }

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      
      // Update last login time (create document if it doesn't exist)
      if (userCredential.user) {
        try {
          const userDocRef = doc(db, 'users', userCredential.user.uid)
          
          // Check if document exists first
          const userDoc = await getDoc(userDocRef)
          
          if (userDoc.exists()) {
            // Document exists, update it
            await updateDoc(userDocRef, {
              lastLoginAt: new Date()
            })
          } else {
            // Document doesn't exist, create it
            console.log('User document not found, creating new one during Google login')
            const newUser = {
              uid: userCredential.user.uid,
              email: userCredential.user.email || '',
              displayName: userCredential.user.displayName || '',
              photoURL: userCredential.user.photoURL || null,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              subscription: {
                plan: 'free',
                status: 'active',
                cancelAtPeriodEnd: false
              },
              usage: {
                messagesThisMonth: 0,
                resetDate: new Date()
              }
            }
            await setDoc(userDocRef, newUser)
          }
        } catch (updateError) {
          console.warn('Failed to update/create user document during Google login:', updateError)
          // Don't fail the login if we can't update the timestamp
        }
      }
    } catch (error: any) {
      console.error('Google login error:', error)
      throw error // Re-throw to let the UI handle the error
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const updateUserProfile = async (data: Partial<User>) => {
    if (!user) return
    
    const userDocRef = doc(db, 'users', user.uid)
    await updateDoc(userDocRef, data)
    
    // Update local state
    setUser(prev => prev ? { ...prev, ...data } : null)
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    updateProfile: updateUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}