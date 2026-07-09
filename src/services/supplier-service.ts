import { create, getAll, get, update, remove, where } from './db'
import { Collections } from './collections'
import type { Supplier } from '@/types/schema'

export async function createSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Supplier>(Collections.suppliers, data)
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return get<Supplier>(Collections.suppliers, id)
}

export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  return getAll<Supplier>(
    Collections.suppliers,
    where('companyId', '==', companyId)
  )
}

export async function updateSupplier(id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> {
  return update<Supplier>(Collections.suppliers, id, data)
}

export async function deleteSupplier(id: string): Promise<void> {
  return remove(Collections.suppliers, id)
}
