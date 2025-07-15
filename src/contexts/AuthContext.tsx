import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
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
    const userDoc = await getDoc(userDocRef)
    
    if (userDoc.exists()) {
      const data = userDoc.data()
      return {
        uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        createdAt: data.createdAt.toDate(),
        lastLoginAt: data.lastLoginAt.toDate(),
        subscription: data.subscription,
        usage: {
          ...data.usage,
          resetDate: data.usage.resetDate.toDate()
        }
      }
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
      
      await setDoc(userDocRef, {
        ...newUser,
        createdAt: newUser.createdAt,
        lastLoginAt: newUser.lastLoginAt,
        usage: {
          ...newUser.usage,
          resetDate: newUser.usage.resetDate
        }
      })
      
      return newUser
    }
  }

  const login = async (credentials: LoginCredentials) => {
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
    
    // Update last login time
    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid)
      await updateDoc(userDocRef, {
        lastLoginAt: new Date()
      })
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    )
    
    await updateProfile(firebaseUser, {
      displayName: credentials.displayName
    })
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    
    // Update last login time
    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid)
      await updateDoc(userDocRef, {
        lastLoginAt: new Date()
      })
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