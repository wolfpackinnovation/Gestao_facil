import { create, getAll, get, update, remove, where, orderBy, limit, Timestamp } from './db'
import { Collections } from './collections'
import type { Sale, SaleItem } from '@/types/schema'

export interface CreateSaleInput {
  companyId: string
  number: string
  userId?: string
  clientId?: string
  totalAmount: number
  paymentMethod?: string
  status?: string
}

export async function createSale(data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Sale>(Collections.sales, data)
}

export async function createSaleWithItems(
  saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
  items: Omit<SaleItem, 'id' | 'createdAt' | 'updatedAt' | 'saleId'>[]
): Promise<string> {
  const saleId = await create<Sale>(Collections.sales, saleData)
  for (const item of items) {
    await create<SaleItem>(Collections.saleItems, { ...item, saleId })
  }
  return saleId
}

export async function getSale(id: string): Promise<Sale | null> {
  return get<Sale>(Collections.sales, id)
}

export async function listSales(companyId: string, max = 50): Promise<Sale[]> {
  return getAll<Sale>(
    Collections.sales,
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(max)
  )
}

export async function updateSale(id: string, data: Partial<Omit<Sale, 'id' | 'createdAt'>>): Promise<void> {
  return update<Sale>(Collections.sales, id, data)
}

export async function deleteSale(id: string): Promise<void> {
  return remove(Collections.sales, id)
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  return getAll<SaleItem>(
    Collections.saleItems,
    where('saleId', '==', saleId),
    orderBy('createdAt', 'asc')
  )
}

export async function getTodaySales(companyId: string): Promise<Sale[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return getAll<Sale>(
    Collections.sales,
    where('companyId', '==', companyId),
    where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
    orderBy('createdAt', 'desc')
  )
}
