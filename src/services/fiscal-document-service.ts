import { create, getAll, get, update, remove, where, limit } from './db'
import { Collections } from './collections'
import type { FiscalDocument } from '@/types/schema'

export async function createFiscalDocument(
  data: Omit<FiscalDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return create<FiscalDocument>(Collections.fiscalDocuments, data)
}

export async function listFiscalDocuments(
  companyId: string,
  max = 50
): Promise<FiscalDocument[]> {
  const docs = await getAll<FiscalDocument>(
    Collections.fiscalDocuments,
    where('companyId', '==', companyId),
    limit(max)
  )
  return docs.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getFiscalDocument(id: string): Promise<FiscalDocument | null> {
  return get<FiscalDocument>(Collections.fiscalDocuments, id)
}

export async function updateFiscalDocument(
  id: string,
  data: Partial<Omit<FiscalDocument, 'id' | 'createdAt'>>
): Promise<void> {
  return update<FiscalDocument>(Collections.fiscalDocuments, id, data)
}

export async function deleteFiscalDocument(id: string): Promise<void> {
  return remove(Collections.fiscalDocuments, id)
}
