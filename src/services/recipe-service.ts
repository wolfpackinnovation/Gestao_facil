import { createWithId, getAll, get, remove, update, where } from './db'
import { Collections } from './collections'
import { convertToBase, sameType } from '@/utils/units'
import type { Material } from './material-service'

export const CATEGORIAS_RECEITA = [
  'Bolos',
  'Doces',
  'Salgados',
  'Bebidas',
  'Pratos',
  'Outros',
] as const

export type CategoriaReceita = typeof CATEGORIAS_RECEITA[number]

export type ModoLucro = 'markup' | 'margem'

export interface RecipeItem {
  materialId: string
  quantidade: number
  unidade: string
  custoCalculado?: number
}

export interface Recipe {
  id: string
  companyId: string
  nome: string
  categoria: CategoriaReceita
  rendimento: number
  unidadeRendimento: string
  custosAdicionais: number
  custoFixo?: number
  modoLucro: ModoLucro
  valorLucro: number
  observacao?: string
  itens: RecipeItem[]
  custoTotal?: number
  custoPorUnidade?: number
  precoSugerido?: number
  createdAt: string
  updatedAt: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export interface RecipeCostBreakdown {
  custoMateriais: number
  custoTotal: number
  custoPorUnidade: number
  precoSugerido: number
  lucroPorUnidade: number
  itensDetalhados: {
    item: RecipeItem
    material: Material | undefined
    custo: number
  }[]
}

export function calcRecipeCost(
  recipe: Pick<Recipe, 'itens' | 'rendimento' | 'custosAdicionais' | 'custoFixo' | 'modoLucro' | 'valorLucro'>,
  materials: Material[],
): RecipeCostBreakdown {
  const itensDetalhados = recipe.itens.map((item) => {
    const material = materials.find((m) => m.id === item.materialId)
    if (!material) return { item, material: undefined, custo: 0 }
    const sameUnit = sameType(item.unidade, material.unidadeCompra)
    if (!sameUnit) return { item, material, custo: 0 }
    const qtyBase = convertToBase(item.quantidade, item.unidade)
    const custo = qtyBase * material.custoPorUnidadeBase
    return { item, material, custo }
  })

  const custoMateriais = itensDetalhados.reduce((sum, d) => sum + d.custo, 0)
  const custosAdicionais = Number(recipe.custosAdicionais ?? 0)
  const custoFixo = Number(recipe.custoFixo ?? 0)
  const custoTotal = custoMateriais + custosAdicionais + custoFixo
  const rendimento = Number(recipe.rendimento ?? 0) || 1
  const custoPorUnidade = custoTotal / rendimento

  const lucroPercent = Number(recipe.valorLucro ?? 0)
  let precoSugerido = 0
  if (recipe.modoLucro === 'margem') {
    precoSugerido = custoPorUnidade / (1 - lucroPercent / 100)
  } else {
    precoSugerido = custoPorUnidade * (1 + lucroPercent / 100)
  }
  if (!isFinite(precoSugerido) || precoSugerido < 0) precoSugerido = custoPorUnidade

  const lucroPorUnidade = precoSugerido - custoPorUnidade

  return {
    custoMateriais,
    custoTotal,
    custoPorUnidade,
    precoSugerido,
    lucroPorUnidade,
    itensDetalhados,
  }
}

function fromFirestoreDoc(doc: any): Recipe {
  return {
    id: doc.id,
    companyId: doc.companyId,
    nome: doc.nome ?? '',
    categoria: doc.categoria ?? 'Outros',
    rendimento: doc.rendimento ?? 1,
    unidadeRendimento: doc.unidadeRendimento ?? 'un',
    custosAdicionais: doc.custosAdicionais ?? 0,
    modoLucro: doc.modoLucro ?? 'markup',
    valorLucro: doc.valorLucro ?? 0,
    observacao: doc.observacao || undefined,
    itens: Array.isArray(doc.itens)
      ? doc.itens.map((i: any) => ({
          materialId: i.materialId,
          quantidade: Number(i.quantidade ?? 0),
          unidade: i.unidade ?? 'un',
        }))
      : [],
    custoTotal: doc.custoTotal,
    custoPorUnidade: doc.custoPorUnidade,
    precoSugerido: doc.precoSugerido,
    createdAt: doc.createdAt?.toDate?.()?.toISOString?.() ?? doc.createdAt ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toDate?.()?.toISOString?.() ?? doc.updatedAt ?? new Date().toISOString(),
  }
}

export async function getRecipes(companyId: string): Promise<Recipe[]> {
  try {
    const docs = await getAll<any>(
      Collections.recipes,
      where('companyId', '==', companyId),
    )
    return docs.map(fromFirestoreDoc)
  } catch (e) {
    console.error('getRecipes error:', e)
    return []
  }
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  try {
    const doc = await get<any>(Collections.recipes, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function createRecipe(
  data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  await createWithId<any>(Collections.recipes, id, {
    ...data,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function deleteRecipe(id: string): Promise<void> {
  try {
    await remove(Collections.recipes, id)
  } catch {}
}

export async function updateRecipe(
  id: string,
  data: Partial<Omit<Recipe, 'id' | 'createdAt'>>,
): Promise<void> {
  await update<any>(Collections.recipes, id, data);
}

export async function duplicateRecipe(
  sourceId: string,
  newName: string,
): Promise<string | null> {
  const source = await getRecipe(sourceId)
  if (!source) return null
  const id = generateId()
  const now = new Date().toISOString()
  const { id: _ignore, createdAt: _c, updatedAt: _u, ...rest } = source
  await createWithId<any>(Collections.recipes, id, {
    ...rest,
    nome: newName,
    createdAt: now,
    updatedAt: now,
  })
  return id
}
