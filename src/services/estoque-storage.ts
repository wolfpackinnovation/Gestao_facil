import { createWithId, getAll, get as dbGet, update as dbUpdate, remove, where } from './db'
import { Collections } from './collections'
import { listLotes, getEstoqueAtual, listAllLotesByProduct } from './lote-service'

export type UnidadeMedida = 'un' | 'kg' | 'g' | 'litro' | 'mL'

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
  precoSugerido?: number
  custosAdicionais?: number
  percentualCustosAdicionais?: number
  percentualLucro?: number
  custoTotal?: number
  custoPorUnidade?: number
  custoMateriais?: number
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
    precoSugerido: doc.precoSugerido,
    custosAdicionais: doc.custosAdicionais,
    percentualCustosAdicionais: doc.percentualCustosAdicionais,
    percentualLucro: doc.percentualLucro,
    custoTotal: doc.custoTotal,
    custoPorUnidade: doc.custoPorUnidade,
    custoMateriais: doc.custoMateriais,
  }
}

export async function getProduto(id: string): Promise<Produto | null> {
  try {
    const doc = await dbGet<any>(Collections.inventory, id)
    if (!doc) return null
    const p = fromFirestoreDoc(doc)
    const lotes = await listAllLotesByProduct(id)
    if (lotes.length > 0) {
      p.estoqueAtual = await getEstoqueAtual(id)
    } else {
      p.estoqueAtual = p.quantidade
    }
    p.custoMedio = p.custo
    p.proximaValidade = p.dataValidade
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
    const allLotes = await listLotes(companyId)

    const lotesByProduct = allLotes.reduce((acc, lote) => {
      acc[lote.productId] = (acc[lote.productId] || 0) + (lote.quantidadeAtual || 0);
      return acc;
    }, {} as Record<string, number>);

    return produtos.map((p) => {
      p.estoqueAtual = lotesByProduct[p.id] !== undefined ? lotesByProduct[p.id] : p.quantidade;
      p.custoMedio = p.custo
      p.proximaValidade = p.dataValidade
      return p
    })
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
    await remove(Collections.inventory, id)
  } catch {}
}

export const CATEGORIAS = [
  'Doces',
  'Sobremesas',
  'Alimentos',
  'Proteínas',
  'Bebidas',
  'Embalagens',
  'Insumos',
  'Limpeza',
  'Outros',
];

export const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'g', 'litro', 'mL'];

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type StockStatus = 'out' | 'low' | 'ok'

export function getStockStatus(product: Produto): StockStatus {
  const estoque = product.estoqueAtual ?? 0
  if (estoque <= 0) return 'out'
  if (estoque <= 1) return 'low'
  return 'ok'
}

export interface StockIssue {
  product: Produto
  status: Exclude<StockStatus, 'ok'>
  estoqueAtual: number
}
