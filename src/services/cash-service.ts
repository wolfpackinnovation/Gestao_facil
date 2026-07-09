import { create, getAll, get, update, remove, where, limit } from './db'
import { Collections } from './collections'
import type { CashRegister, CashMovement } from '@/types/schema'

export async function createCashRegister(data: Omit<CashRegister, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<CashRegister>(Collections.cashRegisters, data)
}

export async function getCashRegister(id: string): Promise<CashRegister | null> {
  return get<CashRegister>(Collections.cashRegisters, id)
}

export async function listCashRegisters(companyId: string): Promise<CashRegister[]> {
  return getAll<CashRegister>(
    Collections.cashRegisters,
    where('companyId', '==', companyId)
  )
}

export async function updateCashRegister(id: string, data: Partial<Omit<CashRegister, 'id' | 'createdAt'>>): Promise<void> {
  return update<CashRegister>(Collections.cashRegisters, id, data)
}

export async function deleteCashRegister(id: string): Promise<void> {
  return remove(Collections.cashRegisters, id)
}

export async function createCashMovement(data: Omit<CashMovement, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<CashMovement>(Collections.cashMovements, data)
}

export async function listCashMovements(cashRegisterId: string): Promise<CashMovement[]> {
  return getAll<CashMovement>(
    Collections.cashMovements,
    where('cashRegisterId', '==', cashRegisterId)
  )
}

export async function openCashRegister(id: string, initialBalance: number): Promise<void> {
  await update<CashRegister>(Collections.cashRegisters, id, { isOpen: true, currentBalance: initialBalance } as any)
}

export async function closeCashRegister(id: string): Promise<void> {
  await update<CashRegister>(Collections.cashRegisters, id, { isOpen: false } as any)
}
