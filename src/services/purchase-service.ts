import { create, getAll, get, update, remove, where, limit } from './db'
import { Collections } from './collections'
import type { Purchase, PurchaseItem } from '@/types/schema'

export async function createPurchase(data: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Purchase>(Collections.purchases, data)
}

export async function createPurchaseWithItems(
  purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>,
  items: Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt' | 'purchaseId'>[]
): Promise<string> {
  const purchaseId = await create<Purchase>(Collections.purchases, purchaseData)
  for (const item of items) {
    await create<PurchaseItem>(Collections.purchaseItems, { ...item, purchaseId })
  }
  return purchaseId
}

export async function listPurchases(companyId: string, max = 50): Promise<Purchase[]> {
  return getAll<Purchase>(
    Collections.purchases,
    where('companyId', '==', companyId),
    limit(max)
  )
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  return getAll<PurchaseItem>(
    Collections.purchaseItems,
    where('purchaseId', '==', purchaseId)
  )
}

export async function updatePurchase(id: string, data: Partial<Omit<Purchase, 'id' | 'createdAt'>>): Promise<void> {
  return update<Purchase>(Collections.purchases, id, data)
}

export async function deletePurchase(id: string): Promise<void> {
  return remove(Collections.purchases, id)
}
