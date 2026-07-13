import { create, getAll, where, Timestamp } from './db'
import { Collections } from './collections'
import type { Payment } from '@/types/schema'

export async function createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Payment>(Collections.payments, data)
}

export async function getClientPayments(companyId: string, clientId: string): Promise<Payment[]> {
  return getAll<Payment>(
    Collections.payments,
    where('companyId', '==', companyId),
    where('clientId', '==', clientId)
  )
}

export async function getAllPayments(companyId: string): Promise<Payment[]> {
  return getAll<Payment>(
    Collections.payments,
    where('companyId', '==', companyId)
  )
}

export async function getPaymentsByDate(companyId: string, date: Date): Promise<Payment[]> {
  const all = await getAll<Payment>(
    Collections.payments,
    where('companyId', '==', companyId)
  )
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  const startTimestamp = Timestamp.fromDate(startOfDay)
  const endTimestamp = Timestamp.fromDate(endOfDay)
  return all
    .filter((p) => p.createdAt && p.createdAt.toMillis() >= startTimestamp.toMillis() && p.createdAt.toMillis() <= endTimestamp.toMillis())
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}
