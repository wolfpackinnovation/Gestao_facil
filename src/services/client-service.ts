import { create, getAll, get, update, remove, where, orderBy, limit } from './db'
import { Collections } from './collections'
import type { Client } from '@/types/schema'

export async function createClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return create<Client>(Collections.clients, data)
}

export async function getClient(id: string): Promise<Client | null> {
  return get<Client>(Collections.clients, id)
}

export async function listClients(companyId: string): Promise<Client[]> {
  return getAll<Client>(
    Collections.clients,
    where('companyId', '==', companyId),
    orderBy('name', 'asc')
  )
}

export async function updateClient(id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> {
  return update<Client>(Collections.clients, id, data)
}

export async function deleteClient(id: string): Promise<void> {
  return remove(Collections.clients, id)
}

export async function searchClients(companyId: string, searchTerm: string): Promise<Client[]> {
  const all = await listClients(companyId)
  const term = searchTerm.toLowerCase()
  return all.filter(c =>
    c.name.toLowerCase().includes(term) ||
    c.email?.toLowerCase().includes(term) ||
    c.phone?.includes(term) ||
    c.cpfCnpj?.includes(term)
  )
}
