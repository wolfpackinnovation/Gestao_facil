import { createWithId, getAll, get, remove, update, where } from './db'
import { Collections } from './collections'

export const CATEGORIAS_DESPESA = [
  'Compra de Produtos',
  'Boletos',
  'Aluguel',
  'Energia',
  'Água',
  'Salários',
  'Impostos',
  'Manutenção',
  'Marketing',
  'Outros',
] as const

export type CategoriaDespesa = typeof CATEGORIAS_DESPESA[number]

export interface Despesa {
  id: string
  companyId: string
  descricao: string
  valor: number
  categoria: CategoriaDespesa
  data: string
  observacao: string
  createdAt: string
  vencimento?: string
  pago?: boolean
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function fromFirestoreDoc(doc: any): Despesa {
  return {
    id: doc.id,
    companyId: doc.companyId,
    descricao: doc.descricao ?? '',
    valor: doc.valor ?? 0,
    categoria: doc.categoria ?? 'Outros',
    data: doc.data ?? '',
    observacao: doc.observacao ?? '',
    createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? doc.createdAt ?? new Date().toISOString(),
    vencimento: doc.vencimento || undefined,
    pago: doc.pago ?? false,
  }
}

export async function getDespesas(companyId: string): Promise<Despesa[]> {
  try {
    const docs = await getAll<any>(
      Collections.expenses,
      where('companyId', '==', companyId),
    )
    return docs.map(fromFirestoreDoc)
  } catch (e) {
    console.error('getDespesas error:', e)
    return []
  }
}

export async function getDespesa(id: string): Promise<Despesa | null> {
  try {
    const doc = await get<any>(Collections.expenses, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function createDespesa(data: Omit<Despesa, 'id' | 'createdAt'>): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  await createWithId<any>(Collections.expenses, id, {
    ...data,
    createdAt: now,
  })
  return id
}

export async function deleteDespesa(id: string): Promise<void> {
  try {
    await remove(Collections.expenses, id)
  } catch {}
}

export async function updateDespesa(id: string, data: Partial<Omit<Despesa, 'id' | 'createdAt'>>): Promise<void> {
  try {
    await update<any>(Collections.expenses, id, data)
  } catch {}
}
