import { createWithId, getAll, get as dbGet, update as dbUpdate, remove, where } from './db'
import { Collections } from './collections'

export type UnidadeMedida = 'un' | 'kg' | 'g' | 'L' | 'mL'

export interface Produto {
  id: string
  companyId: string
  codigo: string
  nome: string
  categoria: string
  unidade: UnidadeMedida
  quantidade: number
  custo: number
  precoVenda: number
  estoqueAtual: number
  estoqueMinimo: number
  dataValidade: string
  fornecedor: string
  createdAt: string
}

function fromFirestoreDoc(doc: any): Produto {
  return {
    id: doc.id,
    companyId: doc.companyId,
    codigo: doc.codigo ?? '',
    nome: doc.nome,
    categoria: doc.categoria,
    unidade: doc.unidade,
    quantidade: doc.quantidade,
    custo: doc.custo,
    precoVenda: doc.precoVenda ?? 0,
    estoqueAtual: doc.estoqueAtual,
    estoqueMinimo: doc.estoqueMinimo,
    dataValidade: doc.dataValidade,
    fornecedor: doc.fornecedor,
    createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? doc.createdAt ?? new Date().toISOString(),
  }
}

export async function getProduto(id: string): Promise<Produto | null> {
  try {
    const doc = await dbGet<any>(Collections.inventory, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function getProdutos(companyId: string): Promise<Produto[]> {
  try {
    const docs = await getAll<any>(
      Collections.inventory,
      where('companyId', '==', companyId)
    )
    return docs.map(fromFirestoreDoc)
  } catch {
    return []
  }
}

export async function saveProduto(produto: Produto): Promise<void> {
  const { id, createdAt, ...data } = produto
  const existing = await dbGet<any>(Collections.inventory, id)
  if (existing) {
    await dbUpdate<any>(Collections.inventory, id, data)
  } else {
    await createWithId<any>(Collections.inventory, id, data)
  }
}

export async function deleteProduto(id: string): Promise<void> {
  try {
    await remove(Collections.inventory, id)
  } catch {}
}

export const CATEGORIAS = [
  'Carnes',
  'Aves',
  'Peixes',
  'Vegetais',
  'Laticínios',
  'Bebidas',
  'Secos',
  'Limpeza',
  'Embalagens',
  'Outros',
];

export const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'g', 'L', 'mL'];

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
