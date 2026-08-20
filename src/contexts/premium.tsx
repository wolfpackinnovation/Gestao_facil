import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { doc, getDoc, update, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from './auth'
import { db } from '@/lib/firebase'
import { listClients } from '@/services/client-service'
import { listInventory } from '@/services/inventory-service'

const FREE_LIMIT = 3

type PremiumContextType = {
  isPremium: boolean
  isLoading: boolean
  canAddClient: boolean
  canAddInventory: boolean
  clientCount: number
  inventoryCount: number
  activatePremium: () => Promise<void>
  checkLimits: () => Promise<{ canAddClient: boolean; canAddInventory: boolean }>
  refreshCounts: () => Promise<void>
}

const PremiumContext = createContext<PremiumContextType | null>(null)

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isPremium, setIsPremium] = useState(true) // DEBUG: tudo liberado
  const [isLoading, setIsLoading] = useState(true)
  const [clientCount, setClientCount] = useState(0)
  const [inventoryCount, setInventoryCount] = useState(0)

  useEffect(() => {
    if (user) {
      loadPremiumStatus()
    } else {
      setIsPremium(false)
      setIsLoading(false)
    }
  }, [user])

  async function loadPremiumStatus() {
    if (!user) return
    try {
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        setIsPremium(true) // DEBUG: tudo liberado
      }
    } catch (error) {
      console.error('Error loading premium status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshCounts() {
    if (!user) return
    try {
      const [clients, inventory] = await Promise.all([
        listClients(user.uid),
        listInventory(user.uid),
      ])
      setClientCount(clients.length)
      setInventoryCount(inventory.length)
    } catch (error) {
      console.error('Error refreshing counts:', error)
    }
  }

  async function activatePremium() {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    await update(ref, {
      isPremium: true,
      premiumActivatedAt: serverTimestamp(),
    })
    setIsPremium(true)
  }

  async function checkLimits(): Promise<{ canAddClient: boolean; canAddInventory: boolean }> {
    if (!user) return { canAddClient: false, canAddInventory: false }
    try {
      const [clients, inventory] = await Promise.all([
        listClients(user.uid),
        listInventory(user.uid),
      ])
      const currentClientCount = clients.length
      const currentInventoryCount = inventory.length
      return {
        canAddClient: isPremium || currentClientCount < FREE_LIMIT,
        canAddInventory: isPremium || currentInventoryCount < FREE_LIMIT,
      }
    } catch (error) {
      console.error('Error checking limits:', error)
      return { canAddClient: false, canAddInventory: false }
    }
  }

  const canAddClient = isPremium || clientCount < FREE_LIMIT
  const canAddInventory = isPremium || inventoryCount < FREE_LIMIT

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        isLoading,
        canAddClient,
        canAddInventory,
        clientCount,
        inventoryCount,
        activatePremium,
        checkLimits,
        refreshCounts,
      }}
    >
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const ctx = useContext(PremiumContext)
  if (!ctx) throw new Error('usePremium must be used within PremiumProvider')
  return ctx
}
