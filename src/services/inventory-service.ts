import { create, createWithId, getAll, get, update, remove, where, limit } from './db'
import { Collections } from './collections'
import type { Inventory } from '@/types/schema'

export async function createInventory(data: Omit<Inventory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Inventory>(Collections.inventory, data)
}

export async function createInventoryWithId(
  id: string,
  data: Omit<Inventory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  return createWithId<Inventory>(Collections.inventory, id, data)
}

export async function getInventory(id: string): Promise<Inventory | null> {
  return get<Inventory>(Collections.inventory, id)
}

export async function listInventory(companyId: string, max = 100): Promise<Inventory[]> {
  return getAll<Inventory>(
    Collections.inventory,
    where('companyId', '==', companyId),
    limit(max)
  )
}

export async function updateInventory(id: string, data: Partial<Omit<Inventory, 'id' | 'createdAt'>>): Promise<void> {
  return update<Inventory>(Collections.inventory, id, data)
}

export async function deleteInventory(id: string): Promise<void> {
  return remove(Collections.inventory, id)
}
