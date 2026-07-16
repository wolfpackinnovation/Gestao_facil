import { createWithId, getAll, get, update, remove, where } from './db'
import { Collections } from './collections'

export interface CortePadrao {
  nome: string
}

export const CORTES_BOI: CortePadrao[] = [
  { nome: 'Picanha' },
  { nome: 'Filé Mignon' },
  { nome: 'Cupim' },
  { nome: 'Peito' },
  { nome: 'Costela' },
  { nome: 'Alcatra' },
  { nome: 'Contrafilé' },
  { nome: 'Maminha' },
  { nome: 'Fraldinha' },
  { nome: 'Coxão Mole' },
  { nome: 'Coxão Duro' },
  { nome: 'Patinho' },
  { nome: 'Lagarto' },
  { nome: 'Músculo' },
  { nome: 'Osso' },
  { nome: 'Aparas' },
]

export const CORTES_PORCO: CortePadrao[] = [
  { nome: 'Lombo' },
  { nome: 'Pernil' },
  { nome: 'Costela' },
  { nome: 'Barriga' },
  { nome: 'Paleta' },
  { nome: 'Pé' },
  { nome: 'Orelha' },
  { nome: 'Toucinho' },
  { nome: 'Osso' },
]

export const CORTES_FRANGO: CortePadrao[] = [
  { nome: 'Peito' },
  { nome: 'Coxa' },
  { nome: 'Sobrecoxa' },
  { nome: 'Asa' },
  { nome: 'Carcaça' },
  { nome: 'Pé' },
  { nome: 'Miúdos' },
]

export function getCortesPorTipo(tipo: string): CortePadrao[] {
  switch (tipo) {
    case 'boi': return CORTES_BOI
    case 'porco': return CORTES_PORCO
    case 'frango': return CORTES_FRANGO
    default: return []
  }
}

export interface DesossaItem {
  nome: string
  peso: number
  custo: number
  precoVenda: number
  dataValidade: string
  produtoId: string
}

export interface DesossaRecord {
  id: string
  companyId: string
  tipoAnimal: string
  animalNome: string
  pesoTotal: number
  custoTotal: number
  items: DesossaItem[]
  createdAt: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function fromFirestoreDoc(doc: any): DesossaRecord {
  return {
    id: doc.id,
    companyId: doc.companyId,
    tipoAnimal: doc.tipoAnimal,
    animalNome: doc.animalNome ?? '',
    pesoTotal: doc.pesoTotal,
    custoTotal: doc.custoTotal,
    items: doc.items ?? [],
    createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? doc.createdAt ?? new Date().toISOString(),
  }
}

export async function getDesossas(companyId: string): Promise<DesossaRecord[]> {
  try {
    const docs = await getAll<any>(
      Collections.desossas,
      where('companyId', '==', companyId)
    )
    return docs.map(fromFirestoreDoc)
  } catch {
    return []
  }
}

export async function getDesossa(id: string): Promise<DesossaRecord | null> {
  try {
    const doc = await get<any>(Collections.desossas, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function createDesossa(
  companyId: string,
  tipoAnimal: string,
  animalNome: string,
  pesoTotal: number,
  custoTotal: number,
  items: { nome: string; peso: number; custo: number; precoVenda: number; dataValidade: string }[]
): Promise<string> {
  const id = generateId()
  const desossaItems: DesossaItem[] = []
  const now = new Date().toISOString()

  for (const item of items) {
    if (item.peso <= 0) continue

    desossaItems.push({
      nome: item.nome,
      peso: item.peso,
      custo: item.custo,
      precoVenda: item.precoVenda,
      dataValidade: item.dataValidade,
      produtoId: '',
    })
  }

  await createWithId<any>(Collections.desossas, id, {
    companyId,
    tipoAnimal,
    animalNome,
    pesoTotal,
    custoTotal,
    items: desossaItems,
    createdAt: now,
  })

  return id
}

export async function updateDesossa(
  id: string,
  data: {
    animalNome?: string
    pesoTotal?: number
    custoTotal?: number
    items?: { nome: string; peso: number; custo: number; precoVenda: number; dataValidade: string }[]
  }
): Promise<void> {
  try {
    await update<any>(Collections.desossas, id, data)
  } catch {}
}

export async function deleteDesossa(id: string): Promise<void> {
  try {
    await remove(Collections.desossas, id)
  } catch {}
}
