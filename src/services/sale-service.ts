import { create, getAll, get, update, remove, where, limit, Timestamp } from './db'
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
    where('saleId', '==', saleId)
  )
}

export async function getAllSales(companyId: string): Promise<Sale[]> {
  return getAll<Sale>(
    Collections.sales,
    where('companyId', '==', companyId)
  )
}

export async function getSalesByDate(companyId: string, date: Date): Promise<Sale[]> {
  const sales = await getAll<Sale>(
    Collections.sales,
    where('companyId', '==', companyId)
  )
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  const startTimestamp = Timestamp.fromDate(startOfDay)
  const endTimestamp = Timestamp.fromDate(endOfDay)
  return sales
    .filter((s) => s.createdAt && s.createdAt.toMillis() >= startTimestamp.toMillis() && s.createdAt.toMillis() <= endTimestamp.toMillis())
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}

export async function getTodaySales(companyId: string): Promise<Sale[]> {
  const sales = await getAll<Sale>(
    Collections.sales,
    where('companyId', '==', companyId)
  )
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startTimestamp = Timestamp.fromDate(startOfDay)
  return sales
    .filter((s) => s.createdAt && s.createdAt.toMillis() >= startTimestamp.toMillis())
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}
