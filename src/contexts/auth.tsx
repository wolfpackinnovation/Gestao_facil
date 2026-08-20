import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signInWithGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function ensureUserDoc(firebaseUser: User, name?: string): Promise<void> {
  const userRef = doc(db, 'users', firebaseUser.uid)
  const userSnap = await getDoc(userRef)
  const displayName = name ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? ''
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      companyId: firebaseUser.uid,
      name: displayName,
      email: firebaseUser.email,
      role: 'owner',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  const companyRef = doc(db, 'companies', firebaseUser.uid)
  const companySnap = await getDoc(companyRef)
  if (!companySnap.exists()) {
    await setDoc(companyRef, {
      name: displayName,
      email: firebaseUser.email ?? '',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } else if (!companySnap.data().name && displayName) {
    await setDoc(companyRef, { name: displayName, updatedAt: serverTimestamp() }, { merge: true })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        ensureUserDoc(firebaseUser).catch(() => {})
      }
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await ensureUserDoc(cred.user, name)
  }

  const signInWithGoogle = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken)
    await signInWithCredential(auth, credential)
  }

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
