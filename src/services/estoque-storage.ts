import { createWithId, getAll, get as dbGet, update as dbUpdate, remove, where } from './db'
import { Collections } from './collections'
import {
  listLotesByProduct,
  listAllLotesByProduct,
  getEstoqueAtual,
  getCustoMedio,
  getProximaValidade,
  isLoteVencido,
  isLoteProximoVencimento,
  diasAteVencimento,
  consumirEstoqueFEFO,
  reverterConsumo,
  ajustarLote,
  type ConsumoFEFO,
  type ResultadoConsumo,
} from './lote-service'
import type { Lote } from '@/types/schema'

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
  estoqueMinimo: number
  dataValidade: string
  fornecedor: string
  createdAt: string
  estoqueAtual?: number
  custoMedio?: number
  proximaValidade?: string | null
}

function fromFirestoreDoc(doc: any): Produto {
  return {
    id: doc.id,
    companyId: doc.companyId,
    codigo: doc.codigo ?? '',
    nome: doc.nome,
    categoria: doc.categoria,
    unidade: doc.unidade,
    quantidade: doc.quantidade ?? 1,
    custo: doc.custo ?? 0,
    precoVenda: doc.precoVenda ?? 0,
    estoqueMinimo: doc.estoqueMinimo ?? 0,
    dataValidade: doc.dataValidade ?? '',
    fornecedor: doc.fornecedor ?? '',
    createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? doc.createdAt ?? new Date().toISOString(),
  }
}

export async function getProduto(id: string): Promise<Produto | null> {
  try {
    const doc = await dbGet<any>(Collections.inventory, id)
    if (!doc) return null
    const p = fromFirestoreDoc(doc)
    p.estoqueAtual = await getEstoqueAtual(p.id)
    p.custoMedio = await getCustoMedio(p.id)
    p.proximaValidade = await getProximaValidade(p.id)
    return p
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
    const produtos = docs.map(fromFirestoreDoc)

    const enriched = await Promise.all(
      produtos.map(async (p) => {
        p.estoqueAtual = await getEstoqueAtual(p.id)
        p.custoMedio = await getCustoMedio(p.id)
        p.proximaValidade = await getProximaValidade(p.id)
        return p
      })
    )
    return enriched
  } catch {
    return []
  }
}

export async function saveProduto(produto: Produto): Promise<void> {
  const { id, createdAt, estoqueAtual, custoMedio, proximaValidade, ...data } = produto as any
  const existing = await dbGet<any>(Collections.inventory, id)
  if (existing) {
    await dbUpdate<any>(Collections.inventory, id, data)
  } else {
    await createWithId<any>(Collections.inventory, id, data)
  }
}

export async function deleteProduto(id: string): Promise<void> {
  try {
    const lotes = await listAllLotesByProduct(id)
    for (const lote of lotes) {
      if (lote.id) await remove(Collections.lotes, lote.id)
    }
    await remove(Collections.inventory, id)
  } catch {}
}

export async function getLotesDoProduto(productId: string): Promise<Lote[]> {
  return listLotesByProduct(productId)
}

export async function getTodosLotesDoProduto(productId: string): Promise<Lote[]> {
  return listAllLotesByProduct(productId)
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

export {
  isLoteVencido,
  isLoteProximoVencimento,
  diasAteVencimento,
  consumirEstoqueFEFO,
  reverterConsumo,
  ajustarLote,
}

export type { ConsumoFEFO, ResultadoConsumo, Lote }
