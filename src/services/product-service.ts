import { create, getAll, get, update, remove, where, orderBy, limit, type QueryConstraint } from './db'
import { Collections } from './collections'
import type { Product } from '@/types/schema'

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Product>(Collections.products, data)
}

export async function getProduct(id: string): Promise<Product | null> {
  return get<Product>(Collections.products, id)
}

export async function listProducts(companyId: string, max = 100): Promise<Product[]> {
  return getAll<Product>(
    Collections.products,
    where('companyId', '==', companyId),
    orderBy('name', 'asc'),
    limit(max)
  )
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
  return update<Product>(Collections.products, id, data)
}

export async function deleteProduct(id: string): Promise<void> {
  return remove(Collections.products, id)
}

export async function listProductsByCategory(companyId: string, categoryId: string): Promise<Product[]> {
  return getAll<Product>(
    Collections.products,
    where('companyId', '==', companyId),
    where('categoryId', '==', categoryId),
    orderBy('name', 'asc')
  )
}

export async function listLowStockProducts(companyId: string): Promise<Product[]> {
  return getAll<Product>(
    Collections.products,
    where('companyId', '==', companyId)
  ).then(products => products.filter(p => p.minStock != null && p.stockQuantity <= p.minStock))
}
