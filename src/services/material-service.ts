import { createWithId, getAll, get, remove, update, where } from './db'
import { Collections } from './collections'
import { convertToBase } from '@/utils/units'

export const CATEGORIAS_MATERIAL = [
  'Insumos',
  'Embalagens',
  'Limpeza',
  'Outros',
] as const

export type CategoriaMaterial = typeof CATEGORIAS_MATERIAL[number]

export interface Material {
  id: string
  companyId: string
  nome: string
  categoria: CategoriaMaterial
  unidadeCompra: string
  quantidadeCompra: number
  precoCompra: number
  custoPorUnidadeBase: number
  fornecedor?: string
  observacao?: string
  updatedAt: string
  createdAt: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function calcCustoPorUnidadeBase(
  precoCompra: number,
  quantidadeCompra: number,
  unidadeCompra: string,
): number {
  const baseQty = convertToBase(quantidadeCompra || 0, unidadeCompra)
  if (baseQty <= 0) return 0
  return precoCompra / baseQty
}

function fromFirestoreDoc(doc: any): Material {
  const preco = doc.precoCompra ?? 0;
  const qtd = doc.quantidadeCompra ?? 0;
  const unidade = doc.unidadeCompra ?? 'un';
  
  let baseCost = doc.custoPorUnidadeBase;
  if (baseCost === undefined || baseCost === null || baseCost === 0) {
    baseCost = calcCustoPorUnidadeBase(preco, qtd, unidade);
  }

  return {
    id: doc.id,
    companyId: doc.companyId,
    nome: doc.nome ?? '',
    categoria: doc.categoria ?? 'Outros',
    unidadeCompra: unidade,
    quantidadeCompra: qtd,
    precoCompra: preco,
    custoPorUnidadeBase: baseCost,
    fornecedor: doc.fornecedor || undefined,
    observacao: doc.observacao || undefined,
    createdAt: doc.createdAt?.toDate?.()?.toISOString?.() ?? doc.createdAt ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toDate?.()?.toISOString?.() ?? doc.updatedAt ?? new Date().toISOString(),
  }
}

export async function getMaterials(companyId: string): Promise<Material[]> {
  try {
    const docs = await getAll<any>(
      Collections.materiais,
      where('companyId', '==', companyId),
    )
    return docs.map(fromFirestoreDoc)
  } catch (e) {
    console.error('getMaterials error:', e)
    return []
  }
}

export async function getMaterial(id: string): Promise<Material | null> {
  try {
    const doc = await get<any>(Collections.materiais, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function createMaterial(
  data: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'custoPorUnidadeBase'>,
): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  const custoPorUnidadeBase = calcCustoPorUnidadeBase(
    data.precoCompra,
    data.quantidadeCompra,
    data.unidadeCompra,
  )
  await createWithId<any>(Collections.materiais, id, {
    ...data,
    custoPorUnidadeBase,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function deleteMaterial(id: string): Promise<void> {
  try {
    await remove(Collections.materiais, id)
  } catch {}
}

export async function updateMaterial(
  id: string,
  data: Partial<Omit<Material, 'id' | 'createdAt'>>,
): Promise<void> {
  try {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() }
    if (data.custoPorUnidadeBase === undefined) {
      if (
        data.precoCompra !== undefined ||
        data.quantidadeCompra !== undefined ||
        data.unidadeCompra !== undefined
      ) {
        const current = await getMaterial(id)
        const preco = data.precoCompra ?? current?.precoCompra ?? 0
        const qtd = data.quantidadeCompra ?? current?.quantidadeCompra ?? 0
        const unidade = data.unidadeCompra ?? current?.unidadeCompra ?? 'un'
        updateData.custoPorUnidadeBase = calcCustoPorUnidadeBase(preco, qtd, unidade)
      }
    }
    await update<any>(Collections.materiais, id, updateData)
  } catch {}
}
