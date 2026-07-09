import { create, getAll, update, remove, where } from './db'
import { Collections } from './collections'
import type { Category } from '@/types/schema'

export async function createCategory(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Category>(Collections.categories, data)
}

export async function listCategories(companyId: string): Promise<Category[]> {
  return getAll<Category>(
    Collections.categories,
    where('companyId', '==', companyId)
  )
}

export async function updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<void> {
  return update<Category>(Collections.categories, id, data)
}

export async function deleteCategory(id: string): Promise<void> {
  return remove(Collections.categories, id)
}
